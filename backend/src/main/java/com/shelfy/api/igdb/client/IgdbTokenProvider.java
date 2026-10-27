package com.shelfy.api.igdb.client;

import com.shelfy.api.igdb.IgdbProperties;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

@Component
@RequiredArgsConstructor
public class IgdbTokenProvider {

  private static final long EXPIRY_SAFETY_MARGIN_SECONDS = 60;

  private final RestClient twitchAuthRestClient;
  private final IgdbProperties properties;

  private volatile String cachedToken;
  private volatile Instant expiresAt = Instant.EPOCH;

  public synchronized String getAccessToken() {
    if (cachedToken != null && Instant.now().isBefore(expiresAt)) {
      return cachedToken;
    }
    return refreshToken();
  }

  private String refreshToken() {
    MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
    form.add("client_id", properties.clientId());
    form.add("client_secret", properties.clientSecret());
    form.add("grant_type", "client_credentials");
    TwitchTokenResponseDto response =
        twitchAuthRestClient
            .post()
            .uri("/oauth2/token")
            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
            .body(form)
            .retrieve()
            .body(TwitchTokenResponseDto.class);

    cachedToken = response.accessToken();
    expiresAt = Instant.now().plusSeconds(response.expiresIn() - EXPIRY_SAFETY_MARGIN_SECONDS);
    return cachedToken;
  }
}
