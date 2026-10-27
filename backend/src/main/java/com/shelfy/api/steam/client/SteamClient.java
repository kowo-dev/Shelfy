package com.shelfy.api.steam.client;

import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.http.ProviderCall;
import com.shelfy.api.common.http.ProviderCall.Provider;
import com.shelfy.api.steam.SteamProperties;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
@RequiredArgsConstructor
public class SteamClient {

  private static final Provider STEAM =
      new Provider("Steam", null, ErrorCode.STEAM_PROVIDER_UNAVAILABLE);

  private final RestClient steamApiRestClient;
  private final RestClient steamCommunityRestClient;
  private final SteamProperties properties;

  public boolean verifyOpenId(Map<String, String> openidParams) {
    StringBuilder body = new StringBuilder();
    openidParams.forEach(
        (key, value) -> {
          if (!key.startsWith("openid.") || key.equals("openid.mode")) {
            return;
          }
          if (!body.isEmpty()) {
            body.append('&');
          }
          body.append(urlEncode(key)).append('=').append(urlEncode(value));
        });
    if (!body.isEmpty()) {
      body.append('&');
    }
    body.append("openid.mode=check_authentication");

    return ProviderCall.execute(
        STEAM,
        "openid",
        () -> {
          String response =
              steamCommunityRestClient
                  .post()
                  .uri("/openid/login")
                  .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                  .body(body.toString())
                  .retrieve()
                  .body(String.class);
          return response != null && response.contains("is_valid:true");
        });
  }

  public SteamPlayerSummaryResponseDto fetchPlayerSummary(String steamId) {
    if (properties.apiKey() == null || properties.apiKey().isBlank()) {
      return null;
    }
    return ProviderCall.execute(
        STEAM,
        "GetPlayerSummaries",
        () -> {
          SteamPlayerSummariesResponseDto response =
              steamApiRestClient
                  .get()
                  .uri(
                      "/ISteamUser/GetPlayerSummaries/v2/?key={key}&steamids={steamId}",
                      properties.apiKey(),
                      steamId)
                  .retrieve()
                  .body(SteamPlayerSummariesResponseDto.class);
          List<SteamPlayerSummaryResponseDto> players =
              response == null || response.response() == null
                  ? List.of()
                  : response.response().players();
          return players == null || players.isEmpty() ? null : players.get(0);
        });
  }

  public List<SteamOwnedGameResponseDto> fetchOwnedGames(String steamId) {
    return ProviderCall.execute(
        STEAM,
        "GetOwnedGames",
        () -> {
          SteamOwnedGamesResponseDto response =
              steamApiRestClient
                  .get()
                  .uri(
                      "/IPlayerService/GetOwnedGames/v1/?key={key}&steamid={steamId}&include_appinfo=1&format=json",
                      properties.apiKey(),
                      steamId)
                  .retrieve()
                  .body(SteamOwnedGamesResponseDto.class);
          List<SteamOwnedGameResponseDto> games =
              response == null || response.response() == null
                  ? List.of()
                  : response.response().games();
          return games == null ? List.of() : games;
        });
  }

  private String urlEncode(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8);
  }
}
