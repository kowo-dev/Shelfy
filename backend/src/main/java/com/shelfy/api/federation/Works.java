package com.shelfy.api.federation;

import com.shelfy.api.collection.MediaEntity;
import com.shelfy.api.collection.MediaResolver;
import com.shelfy.api.collection.MediaType;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

@Component
@RequiredArgsConstructor
public class Works {

  private static final Logger LOG = LoggerFactory.getLogger(Works.class);

  private final JdbcClient jdbcClient;
  private final MediaResolver mediaResolver;

  record Reference(String provider, MediaType mediaType, String externalId) {}

  public Map<String, Object> describe(MediaEntity media) {
    List<Map<String, Object>> references = new ArrayList<>();
    references.add(
        reference(media.getProvider(), media.getMediaType().getValue(), media.getExternalId()));
    jdbcClient
        .sql(
            """
            select provider, media_type, external_id from canonical_work_references
            where canonical_work_id = :workId
            """)
        .param("workId", media.getCanonicalWork().getId())
        .query(
            (rs, row) ->
                reference(
                    rs.getString("provider"),
                    rs.getString("media_type").toLowerCase(Locale.ROOT),
                    rs.getString("external_id")))
        .list()
        .stream()
        .filter(reference -> !references.contains(reference))
        .forEach(references::add);
    Map<String, Object> work = new LinkedHashMap<>();
    work.put("mediaType", media.getMediaType().getValue());
    work.put("title", media.getTitle());
    work.put("references", references);
    return work;
  }

  public Optional<MediaEntity> resolve(JsonNode work) {
    List<Reference> references = new ArrayList<>();
    work.path("references").forEach(node -> parse(node).ifPresent(references::add));
    for (Reference ref : references) {
      Optional<MediaEntity> existing =
          mediaResolver.findExisting(ref.provider(), ref.mediaType(), ref.externalId());
      if (existing.isPresent()) {
        return existing;
      }
    }
    for (Reference ref : references) {
      try {
        return Optional.of(
            mediaResolver.findOrCreate(ref.externalId(), ref.provider(), ref.mediaType()));
      } catch (RuntimeException e) {
        LOG.debug("Could not resolve {}: {}", ref, e.getMessage());
      }
    }
    return Optional.empty();
  }

  private static Optional<Reference> parse(JsonNode reference) {
    String provider = Activities.text(reference, "provider");
    String externalId = Activities.text(reference, "externalId");
    String mediaType = Activities.text(reference, "mediaType");
    if (provider == null || externalId == null || mediaType == null || externalId.length() > 255) {
      return Optional.empty();
    }
    try {
      return Optional.of(new Reference(provider, MediaType.fromString(mediaType), externalId));
    } catch (IllegalArgumentException e) {
      return Optional.empty();
    }
  }

  private static Map<String, Object> reference(
      String provider, String mediaType, String externalId) {
    return Map.of("provider", provider, "mediaType", mediaType, "externalId", externalId);
  }
}
