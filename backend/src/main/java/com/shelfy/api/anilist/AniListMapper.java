package com.shelfy.api.anilist;

import com.shelfy.api.anilist.client.AniListCharacterDetailResponseDto;
import com.shelfy.api.anilist.client.AniListCharacterEdgeResponseDto;
import com.shelfy.api.anilist.client.AniListCharacterNameResponseDto;
import com.shelfy.api.anilist.client.AniListCharacterResponseDto;
import com.shelfy.api.anilist.client.AniListDateResponseDto;
import com.shelfy.api.anilist.client.AniListMediaConnectionResponseDto;
import com.shelfy.api.anilist.client.AniListMediaEdgeResponseDto;
import com.shelfy.api.anilist.client.AniListMediaResponseDto;
import com.shelfy.api.anilist.client.AniListNextAiringResponseDto;
import com.shelfy.api.anilist.client.AniListStaffDetailResponseDto;
import com.shelfy.api.anilist.client.AniListStaffEdgeResponseDto;
import com.shelfy.api.anilist.client.AniListStaffResponseDto;
import com.shelfy.api.anilist.client.AniListStudioDetailResponseDto;
import com.shelfy.api.anilist.client.AniListStudioResponseDto;
import com.shelfy.api.anilist.client.AniListTagResponseDto;
import com.shelfy.api.anilist.client.AniListTitleResponseDto;
import com.shelfy.api.anilist.client.AniListTrailerResponseDto;
import com.shelfy.api.anilist.dto.AniListEntityMediaResponseDto;
import com.shelfy.api.anilist.dto.AnimeDetailResponseDto;
import com.shelfy.api.anilist.dto.AnimeSummaryResponseDto;
import com.shelfy.api.anilist.dto.CharacterResponseDto;
import com.shelfy.api.anilist.dto.MangaDetailResponseDto;
import com.shelfy.api.anilist.dto.MangaSummaryResponseDto;
import com.shelfy.api.anilist.dto.PersonDetailResponseDto;
import com.shelfy.api.anilist.dto.StaffCreditDto;
import com.shelfy.api.anilist.dto.StudioDetailResponseDto;
import com.shelfy.api.anilist.dto.StudioRefDto;
import com.shelfy.api.common.dto.NextAiringDto;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Stream;

final class AniListMapper {

  private static final double RATING_SCALE = 10.0;

  private AniListMapper() {}

  static AnimeSummaryResponseDto toAnimeSummary(AniListMediaResponseDto payload) {
    return new AnimeSummaryResponseDto(
        payload.id(),
        title(payload),
        payload.description(),
        releaseDate(payload),
        coverUrl(payload),
        genres(payload),
        rating(payload),
        popularity(payload),
        payload.episodes(),
        payload.status(),
        payload.bannerImage());
  }

  static AnimeDetailResponseDto toAnimeDetail(AniListMediaResponseDto payload) {
    return new AnimeDetailResponseDto(
        payload.id(),
        title(payload),
        payload.description(),
        releaseDate(payload),
        endDate(payload),
        coverUrl(payload),
        payload.bannerImage(),
        genres(payload),
        tags(payload),
        studios(payload),
        payload.format(),
        payload.source(),
        payload.season(),
        payload.seasonYear(),
        payload.countryOfOrigin(),
        rating(payload),
        popularity(payload),
        payload.episodes(),
        airedEpisodes(payload),
        payload.status(),
        characters(payload),
        trailerUrl(payload.trailer()),
        creators(payload));
  }

  static MangaSummaryResponseDto toMangaSummary(AniListMediaResponseDto payload) {
    return new MangaSummaryResponseDto(
        payload.id(),
        title(payload),
        payload.description(),
        releaseDate(payload),
        coverUrl(payload),
        genres(payload),
        rating(payload),
        popularity(payload),
        payload.chapters(),
        payload.status(),
        payload.bannerImage());
  }

  static MangaDetailResponseDto toMangaDetail(AniListMediaResponseDto payload) {
    return new MangaDetailResponseDto(
        payload.id(),
        title(payload),
        payload.description(),
        releaseDate(payload),
        endDate(payload),
        coverUrl(payload),
        payload.bannerImage(),
        genres(payload),
        tags(payload),
        payload.format(),
        payload.source(),
        payload.countryOfOrigin(),
        rating(payload),
        popularity(payload),
        payload.chapters(),
        payload.volumes(),
        payload.status(),
        characters(payload),
        trailerUrl(payload.trailer()),
        creators(payload));
  }

  static PersonDetailResponseDto toStaffDetail(AniListStaffDetailResponseDto payload) {
    String name = payload.name() == null ? null : payload.name().full();
    String imageUrl = payload.image() == null ? null : payload.image().large();
    List<AniListEntityMediaResponseDto> media = toEntityMediaList(payload.staffMedia());
    return new PersonDetailResponseDto(payload.id(), name, payload.description(), imageUrl, media);
  }

  static PersonDetailResponseDto toCharacterDetail(AniListCharacterDetailResponseDto payload) {
    String name = payload.name() == null ? null : payload.name().full();
    String imageUrl = payload.image() == null ? null : payload.image().large();
    List<AniListEntityMediaResponseDto> media = toEntityMediaList(payload.media());
    return new PersonDetailResponseDto(payload.id(), name, payload.description(), imageUrl, media);
  }

  static StudioDetailResponseDto toStudioDetail(AniListStudioDetailResponseDto payload) {
    List<AniListEntityMediaResponseDto> media = toEntityMediaList(payload.media());
    return new StudioDetailResponseDto(payload.id(), payload.name(), media);
  }

  static List<AniListEntityMediaResponseDto> toEntityMediaList(
      AniListMediaConnectionResponseDto connection) {
    if (connection == null || connection.edges() == null) {
      return List.of();
    }
    Set<Long> seen = new HashSet<>();
    return connection.edges().stream()
        .map(AniListMediaEdgeResponseDto::node)
        .filter(Objects::nonNull)
        .filter(media -> seen.add(media.id()))
        .map(AniListMapper::toEntityMedia)
        .filter(m -> m.title() != null)
        .toList();
  }

  static AniListEntityMediaResponseDto toEntityMedia(AniListMediaResponseDto media) {
    String mediaType = media.type();
    return new AniListEntityMediaResponseDto(
        media.id(),
        mediaType != null ? mediaType.toLowerCase() : "anime",
        title(media),
        coverUrl(media),
        rating(media));
  }

  static String title(AniListMediaResponseDto payload) {
    AniListTitleResponseDto t = payload.title();
    if (t == null) {
      return null;
    }
    return t.english() != null ? t.english() : t.romaji();
  }

  static NextAiringDto toNextAiring(AniListMediaResponseDto payload) {
    AniListNextAiringResponseDto next = payload.nextAiringEpisode();
    if (next == null || next.airingAt() == null) {
      return NextAiringDto.NONE;
    }
    Instant airingAt = Instant.ofEpochSecond(next.airingAt());
    return new NextAiringDto(
        null, next.episode(), null, LocalDate.ofInstant(airingAt, ZoneOffset.UTC), airingAt, null);
  }

  static LocalDate releaseDate(AniListMediaResponseDto payload) {
    return parseDate(payload.startDate());
  }

  private static LocalDate endDate(AniListMediaResponseDto payload) {
    return parseDate(payload.endDate());
  }

  private static LocalDate parseDate(AniListDateResponseDto date) {
    if (date == null || date.year() == null) {
      return null;
    }
    int month = date.month() == null ? 1 : date.month();
    int day = date.day() == null ? 1 : date.day();
    return LocalDate.of(date.year(), month, day);
  }

  static String coverUrl(AniListMediaResponseDto payload) {
    return payload.coverImage() == null ? null : payload.coverImage().extraLarge();
  }

  private static List<String> genres(AniListMediaResponseDto payload) {
    return payload.genres() == null ? List.of() : payload.genres();
  }

  private static List<String> tags(AniListMediaResponseDto payload) {
    if (payload.tags() == null) {
      return List.of();
    }
    return payload.tags().stream()
        .filter(tag -> !tag.isGeneralSpoiler() && !tag.isMediaSpoiler())
        .map(AniListTagResponseDto::name)
        .filter(Objects::nonNull)
        .limit(20)
        .toList();
  }

  private static List<StudioRefDto> studios(AniListMediaResponseDto payload) {
    if (payload.studios() == null || payload.studios().nodes() == null) {
      return List.of();
    }
    return payload.studios().nodes().stream()
        .filter(AniListStudioResponseDto::isAnimationStudio)
        .map(AniListStructMapper.INSTANCE::toStudioRef)
        .filter(s -> s.name() != null)
        .toList();
  }

  private static List<CharacterResponseDto> characters(AniListMediaResponseDto payload) {
    if (payload.characters() == null || payload.characters().edges() == null) {
      return List.of();
    }
    return payload.characters().edges().stream()
        .map(AniListMapper::toCharacter)
        .filter(Objects::nonNull)
        .limit(12)
        .toList();
  }

  private static List<StaffCreditDto> creators(AniListMediaResponseDto payload) {
    if (payload.staff() == null || payload.staff().edges() == null) {
      return List.of();
    }
    List<AniListStaffEdgeResponseDto> edges =
        payload.staff().edges().stream()
            .filter(edge -> edge.node() != null && edge.node().name() != null)
            .filter(edge -> edge.node().name().full() != null)
            .toList();
    return Stream.of(
            credits(edges, AniListStaffRoles.AUTHOR_ROLES, AniListStaffRoles.AUTHOR),
            credits(edges, AniListStaffRoles.DIRECTOR_ROLES, AniListStaffRoles.DIRECTOR))
        .flatMap(List::stream)
        .toList();
  }

  private static List<StaffCreditDto> credits(
      List<AniListStaffEdgeResponseDto> edges, List<String> roles, String role) {
    Set<Long> seen = new HashSet<>();
    return edges.stream()
        .filter(edge -> AniListStaffRoles.matches(edge.role(), roles))
        .filter(edge -> seen.add(edge.node().id()))
        .map(edge -> new StaffCreditDto(edge.node().id(), edge.node().name().full(), role))
        .toList();
  }

  private static CharacterResponseDto toCharacter(AniListCharacterEdgeResponseDto edge) {
    AniListCharacterResponseDto character = edge.node();
    if (character == null || character.name() == null || character.name().full() == null) {
      return null;
    }
    String imageUrl = character.image() == null ? null : character.image().large();
    Long voiceActorId =
        edge.voiceActors() != null && !edge.voiceActors().isEmpty()
            ? edge.voiceActors().get(0).id()
            : null;
    String voiceActor =
        edge.voiceActors() == null
            ? null
            : edge.voiceActors().stream()
                .map(AniListStaffResponseDto::name)
                .filter(Objects::nonNull)
                .map(AniListCharacterNameResponseDto::full)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);
    return new CharacterResponseDto(
        character.id(), character.name().full(), imageUrl, edge.role(), voiceActorId, voiceActor);
  }

  private static String trailerUrl(AniListTrailerResponseDto trailer) {
    if (trailer == null || trailer.id() == null || trailer.site() == null) {
      return null;
    }
    return switch (trailer.site().toLowerCase()) {
      case "youtube" -> "https://www.youtube.com/watch?v=" + trailer.id();
      case "dailymotion" -> "https://www.dailymotion.com/video/" + trailer.id();
      default -> null;
    };
  }

  static double rating(AniListMediaResponseDto payload) {
    return payload.averageScore() == null ? 0.0 : payload.averageScore() / RATING_SCALE;
  }

  private static int popularity(AniListMediaResponseDto payload) {
    return payload.popularity() == null ? 0 : payload.popularity();
  }

  private static Integer airedEpisodes(AniListMediaResponseDto payload) {
    return payload.nextAiringEpisode() == null ? null : payload.nextAiringEpisode().episode() - 1;
  }
}
