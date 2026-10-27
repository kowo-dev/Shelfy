package com.shelfy.api.versus.dto;

import com.shelfy.api.collection.dto.MediaResponseDto;
import com.shelfy.api.common.dto.ContributorDto;
import java.util.UUID;

public record VersusEntryResponseDto(
    UUID id,
    String title,
    String coverUrl,
    MediaResponseDto media,
    VersusClipDto clip,
    ContributorDto addedBy) {

  public VersusEntryResponseDto(
      UUID id, String title, String coverUrl, MediaResponseDto media, VersusClipDto clip) {
    this(id, title, coverUrl, media, clip, null);
  }

  public VersusEntryResponseDto withAddedBy(ContributorDto contributor) {
    return new VersusEntryResponseDto(id, title, coverUrl, media, clip, contributor);
  }

  public VersusEntryResponseDto maskedIfAdult(boolean adultContentAllowed) {
    if (adultContentAllowed || media == null || !media.isAdult()) {
      return this;
    }
    return new VersusEntryResponseDto(id, "", null, media.masked(), null, addedBy);
  }
}
