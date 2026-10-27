package com.shelfy.api.related;

import com.shelfy.api.collection.MediaType;
import com.shelfy.api.related.dto.RelatedSectionResponseDto;
import com.shelfy.api.related.dto.SimilarMediaResponseDto;
import java.util.List;

public interface RelatedMediaSource {

  boolean supports(MediaType mediaType);

  List<RelatedSectionResponseDto> sections(MediaType mediaType, String externalId);

  SimilarMediaResponseDto similar(MediaType mediaType, String externalId, int page);
}
