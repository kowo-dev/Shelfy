package com.shelfy.api.anilist.client;

final class AniListQueries {

  private AniListQueries() {}

  static final String STAFF_BY_ID_QUERY =
      """
      query ($id: Int, $page: Int) {
        Staff(id: $id) {
          id
          name { full }
          description(asHtml: false)
          image { large }
          staffMedia(page: $page, perPage: 25, sort: POPULARITY_DESC) {
            pageInfo { hasNextPage }
            edges { node { id type title { romaji english } coverImage { extraLarge } averageScore } }
          }
        }
      }
      """;

  static final String CHARACTER_BY_ID_QUERY =
      """
      query ($id: Int) {
        Character(id: $id) {
          id
          name { full }
          description(asHtml: false)
          image { large }
          media(perPage: 30, sort: POPULARITY_DESC) {
            edges { node { id type title { romaji english } coverImage { extraLarge } averageScore } }
          }
        }
      }
      """;

  static final String STUDIO_BY_ID_QUERY =
      """
      query ($id: Int) {
        Studio(id: $id) {
          id
          name
          media(perPage: 30, sort: POPULARITY_DESC) {
            edges { node { id type title { romaji english } coverImage { extraLarge } averageScore } }
          }
        }
      }
      """;

  static final String BROWSE_QUERY =
      """
      query ($type: MediaType, $page: Int, $perPage: Int, $genre: String, $tag: String, $countryOfOrigin: CountryCode) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { hasNextPage }
          media(
            type: $type, genre: $genre, tag: $tag, sort: POPULARITY_DESC,
            isAdult: false, countryOfOrigin: $countryOfOrigin
          ) {
            id
            type
            title { romaji english }
            coverImage { extraLarge }
            averageScore
            popularity
            episodes
            chapters
            status
            startDate { year month day }
          }
        }
      }
      """;

  static final String TRENDING_QUERY =
      """
      query ($type: MediaType, $page: Int, $perPage: Int, $countryOfOrigin: CountryCode) {
        Page(page: $page, perPage: $perPage) {
          media(type: $type, sort: TRENDING_DESC, countryOfOrigin: $countryOfOrigin, isAdult: false) {
            id
            title { romaji english }
            description(asHtml: false)
            coverImage { extraLarge }
            bannerImage
            genres
            averageScore
            popularity
            startDate { year month day }
            episodes
            chapters
            status
          }
        }
      }
      """;

  static final String TOP_RATED_QUERY =
      """
      query (
        $type: MediaType, $page: Int, $perPage: Int, $countryOfOrigin: CountryCode,
        $minPopularity: Int, $startedBefore: FuzzyDateInt
      ) {
        Page(page: $page, perPage: $perPage) {
          media(
            type: $type, countryOfOrigin: $countryOfOrigin, isAdult: false,
            sort: SCORE_DESC, popularity_greater: $minPopularity,
            startDate_lesser: $startedBefore
          ) {
            id
            title { romaji english }
            description(asHtml: false)
            coverImage { extraLarge }
            bannerImage
            genres
            averageScore
            popularity
            startDate { year month day }
            episodes
            chapters
            status
            format
            relations { edges { relationType } }
          }
        }
      }
      """;

  static final String NEW_QUERY =
      """
      query (
        $type: MediaType, $page: Int, $perPage: Int, $countryOfOrigin: CountryCode,
        $startedAfter: FuzzyDateInt, $startedBefore: FuzzyDateInt
      ) {
        Page(page: $page, perPage: $perPage) {
          media(
            type: $type, countryOfOrigin: $countryOfOrigin, isAdult: false,
            sort: POPULARITY_DESC, startDate_greater: $startedAfter, startDate_lesser: $startedBefore
          ) {
            id
            title { romaji english }
            description(asHtml: false)
            coverImage { extraLarge }
            bannerImage
            genres
            averageScore
            popularity
            startDate { year month day }
            episodes
            chapters
            status
          }
        }
      }
      """;

  static final String SEARCH_EVERY_FORMAT_QUERY =
      """
      query ($search: String, $page: Int, $perPage: Int) {
        anime: Page(page: $page, perPage: $perPage) {
          media(type: ANIME, search: $search, sort: SEARCH_MATCH, isAdult: false) {
            ...searchFields
          }
        }
        manga: Page(page: $page, perPage: $perPage) {
          media(
            type: MANGA
            search: $search
            sort: SEARCH_MATCH
            countryOfOrigin: JP
            isAdult: false
          ) {
            ...searchFields
          }
        }
        webtoon: Page(page: $page, perPage: $perPage) {
          media(
            type: MANGA
            search: $search
            sort: SEARCH_MATCH
            countryOfOrigin: KR
            isAdult: false
          ) {
            ...searchFields
          }
        }
      }

      fragment searchFields on Media {
        id
        title { romaji english }
        description(asHtml: false)
        coverImage { extraLarge }
        genres
        averageScore
        popularity
        startDate { year month day }
        episodes
        chapters
        status
      }
      """;

  static final String SEARCH_QUERY =
      """
      query ($type: MediaType, $search: String, $page: Int, $perPage: Int, $countryOfOrigin: CountryCode) {
        Page(page: $page, perPage: $perPage) {
          media(
            type: $type
            search: $search
            sort: SEARCH_MATCH
            countryOfOrigin: $countryOfOrigin
            isAdult: false
          ) {
            id
            title { romaji english }
            description(asHtml: false)
            coverImage { extraLarge }
            genres
            averageScore
            popularity
            startDate { year month day }
            episodes
            chapters
            status
          }
        }
      }
      """;

  static final String EXPLORE_QUERY =
      """
      query (
        $type: MediaType, $page: Int, $perPage: Int, $countryOfOrigin: CountryCode,
        $search: String, $genres: [String], $withoutGenres: [String], $tags: [String],
        $withoutTags: [String], $startedFrom: FuzzyDateInt, $startedTo: FuzzyDateInt,
        $isAdult: Boolean, $sort: [MediaSort], $minPopularity: Int, $formats: [MediaFormat]
      ) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { hasNextPage }
          media(
            type: $type
            countryOfOrigin: $countryOfOrigin
            search: $search
            genre_in: $genres
            genre_not_in: $withoutGenres
            tag_in: $tags
            tag_not_in: $withoutTags
            startDate_greater: $startedFrom
            startDate_lesser: $startedTo
            isAdult: $isAdult
            popularity_greater: $minPopularity
            format_in: $formats
            sort: $sort
          ) {
            id
            title { romaji english }
            description(asHtml: false)
            coverImage { extraLarge }
            countryOfOrigin
            genres
            averageScore
            popularity
            startDate { year month day }
            episodes
            chapters
            status
          }
        }
      }
      """;

  static final String COLLECTIONS_QUERY =
      """
      { GenreCollection MediaTagCollection { name isAdult } }
      """;

  private static final String RELATED_MEDIA_FIELDS =
      """
      id type format countryOfOrigin isAdult
      title { romaji english }
      description(asHtml: false)
      coverImage { extraLarge }
      averageScore popularity status
      startDate { year month day }
      """;

  static final String RELATED_QUERY =
      """
      query ($id: Int, $page: Int, $perPage: Int) {
        Media(id: $id) {
          id
          type
          studios(isMain: true) { nodes { id name isAnimationStudio } }
          staff(perPage: 25, sort: RELEVANCE) { edges { role node { id name { full } } } }
          relations { edges { relationType node { %s } } }
          recommendations(page: $page, perPage: $perPage, sort: RATING_DESC) {
            pageInfo { hasNextPage }
            nodes { mediaRecommendation { %s } }
          }
        }
      }
      """
          .formatted(RELATED_MEDIA_FIELDS, RELATED_MEDIA_FIELDS);

  static final String STAFF_WORKS_QUERY =
      """
      query ($id: Int) {
        Staff(id: $id) {
          staffMedia(perPage: 25, sort: POPULARITY_DESC) {
            edges { staffRole node { %s } }
          }
        }
      }
      """
          .formatted(RELATED_MEDIA_FIELDS);

  static final String BY_ID_QUERY =
      """
      query ($id: Int, $type: MediaType) {
        Media(id: $id, type: $type) {
          id
          title { romaji english }
          description(asHtml: false)
          coverImage { extraLarge }
          bannerImage
          genres
          tags { id name isGeneralSpoiler isMediaSpoiler }
          studios { nodes { id name isAnimationStudio } }
          staff(perPage: 25, sort: RELEVANCE) { edges { role node { id name { full } } } }
          characters(page: 1, perPage: 10) {
            edges {
              role
              node { id name { full } image { large } }
              voiceActors(language: JAPANESE) { id name { full } }
            }
          }
          trailer { id site }
          format
          source
          season
          seasonYear
          countryOfOrigin
          averageScore
          popularity
          startDate { year month day }
          endDate { year month day }
          episodes
          nextAiringEpisode { episode airingAt }
          chapters
          volumes
          status
        }
      }
      """;
}
