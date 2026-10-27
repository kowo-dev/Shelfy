package com.shelfy.api.essentials.dto;

import com.shelfy.api.collection.dto.MediaResponseDto;
import java.util.UUID;

public record EssentialEntryResponseDto(int slot, UUID userMediaId, MediaResponseDto media) {

  public EssentialEntryResponseDto maskedIfAdult(boolean adultContentAllowed) {
    if (adultContentAllowed || !media.isAdult()) {
      return this;
    }
    return new EssentialEntryResponseDto(slot, userMediaId, media.masked());
  }
}
