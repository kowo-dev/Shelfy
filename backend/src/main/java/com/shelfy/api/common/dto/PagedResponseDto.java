package com.shelfy.api.common.dto;

import java.util.List;
import org.springframework.data.domain.Page;

public record PagedResponseDto<T>(List<T> content, int page, int size, long totalElements) {

  public static <T> PagedResponseDto<T> from(Page<T> page) {
    return new PagedResponseDto<>(
        page.getContent(), page.getNumber(), page.getSize(), page.getTotalElements());
  }
}
