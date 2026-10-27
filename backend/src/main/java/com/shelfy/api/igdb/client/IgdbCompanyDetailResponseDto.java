package com.shelfy.api.igdb.client;

public record IgdbCompanyDetailResponseDto(
    long id,
    String name,
    String description,
    Long startDate,
    IgdbImageResponseDto logo,
    String url) {

  public String logoImageId() {
    if (logo() == null || logo().url() == null) {
      return null;
    }
    String url = logo().url();
    int lastSlash = url.lastIndexOf('/');
    String fileName = lastSlash >= 0 ? url.substring(lastSlash + 1) : url;
    int dotIndex = fileName.lastIndexOf('.');
    return dotIndex >= 0 ? fileName.substring(0, dotIndex) : fileName;
  }
}
