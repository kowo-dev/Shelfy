package com.shelfy.api.tmdb;

import static org.assertj.core.api.Assertions.assertThat;

import com.shelfy.api.tmdb.client.TmdbVideoResponseDto;
import com.shelfy.api.tmdb.client.TmdbVideosResponseDto;
import java.util.List;
import org.junit.jupiter.api.Test;

class TmdbMapperTrailerTest {

  @Test
  void toTrailerUrl_prefersAnOfficialYouTubeTrailer() {
    TmdbVideosResponseDto videos =
        new TmdbVideosResponseDto(
            List.of(
                new TmdbVideoResponseDto("clip", "YouTube", "Clip", true),
                new TmdbVideoResponseDto("teaser", "YouTube", "Teaser", true),
                new TmdbVideoResponseDto("vimeo", "Vimeo", "Trailer", true),
                new TmdbVideoResponseDto("fan", "YouTube", "Trailer", false),
                new TmdbVideoResponseDto("official", "YouTube", "Trailer", true)));

    assertThat(TmdbMapper.toTrailerUrl(videos))
        .isEqualTo("https://www.youtube.com/watch?v=official");
  }

  @Test
  void toTrailerUrl_fallsBackToATeaser() {
    TmdbVideosResponseDto videos =
        new TmdbVideosResponseDto(
            List.of(new TmdbVideoResponseDto("teaser", "YouTube", "Teaser", false)));

    assertThat(TmdbMapper.toTrailerUrl(videos)).isEqualTo("https://www.youtube.com/watch?v=teaser");
  }

  @Test
  void toTrailerUrl_isNullWithoutAYouTubeTrailer() {
    assertThat(TmdbMapper.toTrailerUrl(null)).isNull();
    assertThat(TmdbMapper.toTrailerUrl(new TmdbVideosResponseDto(null))).isNull();
    assertThat(
            TmdbMapper.toTrailerUrl(
                new TmdbVideosResponseDto(
                    List.of(
                        new TmdbVideoResponseDto("bts", "YouTube", "Behind the Scenes", true)))))
        .isNull();
  }
}
