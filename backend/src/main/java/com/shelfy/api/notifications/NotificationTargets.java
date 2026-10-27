package com.shelfy.api.notifications;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
class NotificationTargets {
  private static final int EXCERPT_LENGTH = 140;

  private final JdbcClient jdbcClient;

  Map<String, Object> describe(String targetType, UUID targetId) {
    Map<String, Object> description = new HashMap<>();
    if (targetType == null || targetId == null) {
      return description;
    }
    switch (targetType) {
      case "LIST" -> list(targetId, description);
      case "VERSUS_POOL" -> pool(targetId, description);
      case "REVIEW" -> review(targetId, description);
      case "COMMENT" -> comment(targetId, description);
      default -> {}
    }
    return description;
  }

  private void list(UUID id, Map<String, Object> into) {
    jdbcClient
        .sql(
            """
            select l.name,
                   (select m.cover_url from media_list_items i join media m on m.id = i.media_id
                    where i.list_id = l.id order by i.position limit 1) as cover
            from media_lists l where l.id = :id
            """)
        .param("id", id)
        .query(
            (rs, row) -> {
              into.put("kind", "LIST");
              into.put("listId", id.toString());
              into.put("title", rs.getString("name"));
              putIfPresent(into, "cover", rs.getString("cover"));
              return true;
            })
        .optional();
  }

  private void pool(UUID id, Map<String, Object> into) {
    jdbcClient
        .sql(
            """
            select p.name,
                   (select coalesce(m.cover_url, i.clip_thumbnail_url)
                    from versus_pool_items i left join media m on m.id = i.media_id
                    where i.pool_id = p.id order by i.added_at limit 1) as cover
            from versus_pools p where p.id = :id
            """)
        .param("id", id)
        .query(
            (rs, row) -> {
              into.put("kind", "VERSUS_POOL");
              into.put("poolId", id.toString());
              into.put("title", rs.getString("name"));
              putIfPresent(into, "cover", rs.getString("cover"));
              return true;
            })
        .optional();
  }

  private void review(UUID id, Map<String, Object> into) {
    jdbcClient
        .sql(
            """
            select m.title, m.cover_url, m.media_type, m.external_id
            from user_media um join media m on m.id = um.media_id where um.id = :id
            """)
        .param("id", id)
        .query(
            (rs, row) -> {
              into.put("kind", "REVIEW");
              into.put("reviewId", id.toString());
              into.put("title", rs.getString("title"));
              putIfPresent(into, "cover", rs.getString("cover_url"));
              into.put("mediaType", rs.getString("media_type"));
              into.put("externalId", rs.getString("external_id"));
              return true;
            })
        .optional();
  }

  private void comment(UUID id, Map<String, Object> into) {
    jdbcClient
        .sql("select target_type, target_id, content from comments where id = :id")
        .param("id", id)
        .query(
            (rs, row) ->
                new CommentRow(
                    rs.getString("target_type"),
                    rs.getObject("target_id", UUID.class),
                    rs.getString("content")))
        .optional()
        .ifPresent(
            comment -> {
              into.putAll(describe(comment.targetType(), comment.targetId()));
              into.put("commentId", id.toString());
              into.put("excerpt", excerpt(comment.content()));
            });
  }

  private record CommentRow(String targetType, UUID targetId, String content) {}

  static String excerpt(String content) {
    if (content == null) {
      return null;
    }
    String flat = content.replaceAll("\\s+", " ").strip();
    return flat.length() <= EXCERPT_LENGTH ? flat : flat.substring(0, EXCERPT_LENGTH) + "…";
  }

  private static void putIfPresent(Map<String, Object> into, String key, String value) {
    if (value != null && !value.isBlank()) {
      into.put(key, value);
    }
  }
}
