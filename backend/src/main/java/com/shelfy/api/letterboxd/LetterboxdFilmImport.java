package com.shelfy.api.letterboxd;

import java.util.ArrayList;
import java.util.List;

final class LetterboxdFilmImport {

  final String title;
  final Integer year;
  final String letterboxdUri;
  final List<LetterboxdWatchEntry> watches = new ArrayList<>();
  boolean onWatchlist;

  LetterboxdFilmImport(String title, Integer year, String letterboxdUri) {
    this.title = title;
    this.year = year;
    this.letterboxdUri = letterboxdUri;
  }
}
