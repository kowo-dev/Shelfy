package com.shelfy.api.auth.dto;

public record AuthResponseDto(String accessToken, String tokenType, long expiresInSeconds) {

  public static AuthResponseDto bearer(String accessToken, long expiresInSeconds) {
    return new AuthResponseDto(accessToken, "Bearer", expiresInSeconds);
  }
}
