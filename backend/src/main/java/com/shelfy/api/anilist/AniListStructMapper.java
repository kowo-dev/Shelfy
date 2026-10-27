package com.shelfy.api.anilist;

import com.shelfy.api.anilist.client.AniListStudioResponseDto;
import com.shelfy.api.anilist.dto.StudioRefDto;
import org.mapstruct.Mapper;
import org.mapstruct.factory.Mappers;

@Mapper
interface AniListStructMapper {

  AniListStructMapper INSTANCE = Mappers.getMapper(AniListStructMapper.class);

  StudioRefDto toStudioRef(AniListStudioResponseDto payload);
}
