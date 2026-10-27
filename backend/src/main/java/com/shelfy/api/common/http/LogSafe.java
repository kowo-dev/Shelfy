package com.shelfy.api.common.http;

import java.util.regex.Pattern;

public final class LogSafe {

  private static final Pattern QUERY = Pattern.compile("\\?[^\\s\"']*");

  private LogSafe() {}

  public static String describe(Throwable ex) {
    String message = ex.getMessage();
    return ex.getClass().getSimpleName()
        + (message == null ? "" : ": " + QUERY.matcher(message).replaceAll("?[redacted]"));
  }
}
