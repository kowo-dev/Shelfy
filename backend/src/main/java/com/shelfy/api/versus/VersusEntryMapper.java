package com.shelfy.api.versus;

import com.shelfy.api.auth.AvatarStorageProperties;
import com.shelfy.api.collection.MediaEntity;
import com.shelfy.api.collection.dto.MediaResponseDto;
import com.shelfy.api.versus.dto.VersusClipDto;
import com.shelfy.api.versus.dto.VersusEntryResponseDto;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.springframework.stereotype.Component;

@Component
public class VersusEntryMapper {
  private final String publicBaseUrl;

  public VersusEntryMapper(AvatarStorageProperties properties) {
    this.publicBaseUrl = properties.publicBaseUrl();
  }

  public VersusEntryResponseDto toDto(VersusPoolItemEntity item) {
    MediaResponseDto media = item.getMedia() == null ? null : media(item.getMedia());
    if (!item.isClip()) {
      return new VersusEntryResponseDto(item.getId(), media.title(), media.coverUrl(), media, null);
    }
    VersusClipDto clip =
        new VersusClipDto(
            item.getClipProvider(),
            item.getClipExternalId(),
            item.getClipTitle(),
            item.getClipAuthor(),
            item.getClipStartSeconds());
    String title = item.getClipTitle();
    String cover =
        media != null && media.coverUrl() != null
            ? media.coverUrl()
            : thumbnail(item.getClipThumbnailUrl());
    return new VersusEntryResponseDto(item.getId(), title, cover, media, clip);
  }

  public VersusEntryResponseDto preview(ClipInfo clip) {
    VersusClipDto dto =
        new VersusClipDto(
            clip.provider().value(),
            clip.externalId(),
            clip.title(),
            clip.author(),
            clip.startSeconds());
    return new VersusEntryResponseDto(
        null, clip.title(), thumbnail(clip.thumbnailUrl()), null, dto);
  }

  private String thumbnail(String providerUrl) {
    return providerUrl == null
        ? null
        : publicBaseUrl
            + "/api/v1/versus/clips/thumbnail?src="
            + URLEncoder.encode(ClipResolver.widescreen(providerUrl), StandardCharsets.UTF_8);
  }

  static MediaResponseDto media(MediaEntity media) {
    return new MediaResponseDto(
        media.getId(),
        media.getCanonicalWork().getId(),
        media.getExternalId(),
        media.getProvider(),
        media.getMediaType(),
        media.getTitle(),
        media.getCoverUrl(),
        media.getMetadata(),
        media.getCreatedAt(),
        media.isAdult());
  }
}
