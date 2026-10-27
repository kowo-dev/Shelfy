package com.shelfy.api.igdb;

import com.shelfy.api.igdb.client.IgdbGameModeResponseDto;
import com.shelfy.api.igdb.client.IgdbGenreResponseDto;
import com.shelfy.api.igdb.client.IgdbInvolvedCompanyResponseDto;
import com.shelfy.api.igdb.client.IgdbPlatformResponseDto;
import com.shelfy.api.igdb.client.IgdbThemeResponseDto;
import com.shelfy.api.igdb.dto.CompanyRefDto;
import com.shelfy.api.igdb.dto.FacetRefDto;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.factory.Mappers;

@Mapper
interface IgdbStructMapper {

  IgdbStructMapper INSTANCE = Mappers.getMapper(IgdbStructMapper.class);

  FacetRefDto toFacetRef(IgdbGenreResponseDto payload);

  FacetRefDto toFacetRef(IgdbPlatformResponseDto payload);

  FacetRefDto toFacetRef(IgdbThemeResponseDto payload);

  FacetRefDto toFacetRef(IgdbGameModeResponseDto payload);

  @Mapping(target = "id", source = "company.id")
  @Mapping(target = "name", source = "company.name")
  CompanyRefDto toCompanyRef(IgdbInvolvedCompanyResponseDto payload);
}
