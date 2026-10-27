package com.shelfy.api.igdb.dto;

public enum IgdbFacetKind {
  GENRE("/genres"),
  THEME("/themes"),
  KEYWORD("/keywords"),
  PLATFORM("/platforms");

  private final String endpoint;

  IgdbFacetKind(String endpoint) {
    this.endpoint = endpoint;
  }

  public String endpoint() {
    return endpoint;
  }
}
