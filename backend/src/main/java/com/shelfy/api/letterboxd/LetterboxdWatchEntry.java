package com.shelfy.api.letterboxd;

import java.time.LocalDate;

record LetterboxdWatchEntry(
    LocalDate watchedAt,
    boolean isRewatch,
    Double rating,
    String reviewText,
    boolean containsSpoilers) {}
