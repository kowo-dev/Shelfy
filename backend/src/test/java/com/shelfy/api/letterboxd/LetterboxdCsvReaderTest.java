package com.shelfy.api.letterboxd;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class LetterboxdCsvReaderTest {

  @Test
  void read_lowercasesHeadersAndKeepsQuotedCommas() throws Exception {
    List<Map<String, String>> rows =
        LetterboxdCsvReader.read(
            bytes(
                """
                Date,Name,Year,Letterboxd URI,Rating
                2024-03-01,"Crouching Tiger, Hidden Dragon",2000,https://boxd.it/a,4.5
                """));

    assertEquals(1, rows.size());
    assertEquals("Crouching Tiger, Hidden Dragon", rows.get(0).get("name"));
    assertEquals("4.5", rows.get(0).get("rating"));
    assertEquals("https://boxd.it/a", rows.get(0).get("letterboxd uri"));
  }

  @Test
  void read_ignoresAByteOrderMarkBeforeTheFirstHeader() throws Exception {
    List<Map<String, String>> rows =
        LetterboxdCsvReader.read(bytes("﻿Date,Name,Year\n2024-03-01,Alien,1979\n"));

    assertEquals("2024-03-01", rows.get(0).get("date"));
  }

  private static byte[] bytes(String csv) {
    return csv.getBytes(StandardCharsets.UTF_8);
  }
}
