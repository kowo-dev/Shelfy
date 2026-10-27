package com.shelfy.api.letterboxd;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;

final class LetterboxdCsvReader {

  private static final String BYTE_ORDER_MARK = "\uFEFF";

  private LetterboxdCsvReader() {}

  static List<Map<String, String>> read(byte[] csvBytes) throws IOException {
    CSVFormat format =
        CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true).setTrim(true).build();
    String csv = new String(csvBytes, StandardCharsets.UTF_8);
    if (csv.startsWith(BYTE_ORDER_MARK)) {
      csv = csv.substring(1);
    }
    try (CSVParser parser = CSVParser.parse(csv, format)) {
      List<Map<String, String>> rows = new ArrayList<>();
      for (CSVRecord record : parser) {
        Map<String, String> row = new LinkedHashMap<>();
        record.toMap().forEach((key, value) -> row.put(key.toLowerCase(Locale.ROOT), value));
        rows.add(row);
      }
      return rows;
    }
  }
}
