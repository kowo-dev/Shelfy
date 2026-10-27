package com.shelfy.api.igdb.client;

final class IgdbQueries {

  private IgdbQueries() {}

  static final String SEARCH_GAMES =
      """
      search "%s";
      fields id,name,summary,first_release_date,cover.url,
             genres.name,platforms.name,themes.id,themes.name,
             total_rating,total_rating_count;
      where %s;
      limit %d;
      offset %d;
      """;

  static final String TRENDING_GAMES =
      """
      fields id,name,summary,first_release_date,cover.url,screenshots.url,artworks.url,
             genres.name,platforms.name,themes.id,themes.name,
             total_rating,total_rating_count;
      sort total_rating_count desc;
      where cover != null & total_rating_count >= 5 & first_release_date >= %d & %s;
      limit %d;
      """;

  static final String TOP_RATED_GAMES =
      """
      fields id,name,summary,first_release_date,cover.url,screenshots.url,
             genres.name,platforms.name,themes.id,themes.name,
             total_rating,total_rating_count;
      sort total_rating desc;
      where cover != null & total_rating_count >= %d & game_type = (0,8) & version_parent = null
            & %s;
      limit %d;
      """;

  static final String UPCOMING_GAMES =
      """
      fields id,name,summary,first_release_date,cover.url,screenshots.url,artworks.url,
             genres.name,platforms.name,themes.id,themes.name,
             total_rating,total_rating_count;
      sort hypes desc;
      where cover != null & first_release_date > %d & first_release_date <= %d & %s;
      limit %d;
      """;

  static final String NEW_GAMES =
      """
      fields id,name,summary,first_release_date,cover.url,screenshots.url,artworks.url,
             genres.name,platforms.name,themes.id,themes.name,
             total_rating,total_rating_count;
      sort total_rating_count desc;
      where cover != null & first_release_date >= %d & first_release_date <= %d & %s;
      limit %d;
      """;

  static final String GAMES_BY_ID =
      """
      fields id,name,summary,first_release_date,screenshots.url,artworks.url,total_rating,
             total_rating_count;
      where id = (%s);
      limit %d;
      """;

  static final String GAME_BY_ID =
      """
      fields id,name,summary,storyline,first_release_date,cover.url,screenshots.url,artworks.url,
             genres.name,platforms.name,themes.id,themes.name,
             involved_companies.company.name,involved_companies.developer,involved_companies.publisher,
             game_modes.name,total_rating,total_rating_count,franchise.id,franchise.name,franchises,category,
             external_games.uid,external_games.external_game_source;
      where id = %d;
      """;

  static final String GAME_RELATED =
      """
      fields id,franchise.id,franchise.name,franchises,
             involved_companies.company.id,involved_companies.company.name,
             involved_companies.developer,
             similar_games.name,similar_games.first_release_date,similar_games.cover.url,
             similar_games.genres.name,similar_games.themes.id,
             similar_games.total_rating,similar_games.total_rating_count;
      where id = %d;
      """;

  static final String FRANCHISE_TOP_GAMES =
      """
      fields id,name,first_release_date,cover.url,total_rating,total_rating_count,genres.name;
      where (franchise = %d | franchises = [%d]) & id != %d & cover != null
            & game_type = (0,4,8,9) & version_parent = null & %s;
      sort total_rating_count desc;
      limit 20;
      """;

  static final String TOP_GAMES_BY_INVOLVED_COMPANIES =
      """
      fields id,name,first_release_date,cover.url,total_rating,total_rating_count,genres.name;
      where involved_companies = (%s) & cover != null & game_type = (0,4,8,9)
            & version_parent = null & %s;
      sort total_rating_count desc;
      limit 20;
      """;

  static final String DLC_GAMES =
      """
      fields id,name,first_release_date,cover.url,screenshots.url,
             genres.name,platforms.name,total_rating,total_rating_count;
      where parent_game = %d & category = 1 & %s;
      sort first_release_date desc;
      limit 20;
      """;

  static final String FRANCHISE_BY_ID =
      """
      fields id,name;
      where id = %d;
      """;

  static final String EXTERNAL_GAMES_BY_STEAM_APP_ID =
      """
      fields uid, game.id, game.name, game.game_type, game.first_release_date, game.cover.url;
      where uid = (%s) & external_game_source = %d;
      limit 50;
      """;

  static final String COMPANY_BY_ID =
      """
      fields id,name,description,start_date,logo.url,url;
      where id = %d;
      """;

  static final String INVOLVED_COMPANY_IDS =
      """
      fields id;
      where company = %d & developer = %s;
      limit 100;
      """;

  static final String GAMES_BY_INVOLVED_COMPANIES =
      """
      fields id,name,summary,first_release_date,cover.url,screenshots.url,
             genres.name,platforms.name,total_rating,total_rating_count;
      where involved_companies = (%s) & %s;
      sort total_rating_count desc;
      limit %d;
      offset %d;
      """;

  static final String FRANCHISE_GAMES_PAGED =
      """
      fields id,name,first_release_date,cover.url,total_rating,total_rating_count,genres.name,category;
      where (franchise = %d | franchises = [%d]) & %s;
      sort first_release_date desc;
      limit %d;
      offset %d;
      """;

  static final String GAMES_BY_FACET =
      """
      fields id,name,summary,first_release_date,cover.url,screenshots.url,
             genres.name,platforms.name,total_rating,total_rating_count;
      where %s = (%d) & %s;
      sort total_rating_count desc;
      limit %d;
      offset %d;
      """;
}
