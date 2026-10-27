package com.shelfy.api.tmdb;

import com.shelfy.api.tmdb.client.TmdbCastMemberResponseDto;
import com.shelfy.api.tmdb.client.TmdbCompanyResponseDto;
import com.shelfy.api.tmdb.client.TmdbEpisodeResponseDto;
import com.shelfy.api.tmdb.client.TmdbGenreResponseDto;
import com.shelfy.api.tmdb.client.TmdbSeasonSummaryResponseDto;
import com.shelfy.api.tmdb.dto.CastMemberResponseDto;
import com.shelfy.api.tmdb.dto.CompanyRefDto;
import com.shelfy.api.tmdb.dto.EpisodeResponseDto;
import com.shelfy.api.tmdb.dto.SeasonSummaryResponseDto;
import com.shelfy.api.tmdb.dto.TmdbGenreDto;
import java.time.LocalDate;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.factory.Mappers;

@Mapper
interface TmdbStructMapper {

  TmdbStructMapper INSTANCE = Mappers.getMapper(TmdbStructMapper.class);

  TmdbGenreDto toGenre(TmdbGenreResponseDto payload);

  CompanyRefDto toCompanyRef(TmdbCompanyResponseDto payload);

  CastMemberResponseDto toCastMember(TmdbCastMemberResponseDto payload);

  @Mapping(target = "airDate", source = "airDate")
  SeasonSummaryResponseDto toSeasonSummary(TmdbSeasonSummaryResponseDto payload);

  @Mapping(target = "airDate", source = "airDate")
  EpisodeResponseDto toEpisode(TmdbEpisodeResponseDto payload);

  default LocalDate mapDate(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    return LocalDate.parse(value);
  }
}
