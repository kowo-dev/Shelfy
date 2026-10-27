package com.shelfy.api.versus;

import com.shelfy.api.common.exception.BadRequestException;
import com.shelfy.api.common.exception.ErrorCode;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class ClipUrlParser {
  private static final Pattern YOUTUBE_ID = Pattern.compile("[A-Za-z0-9_-]{11}");
  private static final Pattern TIME = Pattern.compile("^(?:(\\d+)h)?(?:(\\d+)m)?(?:(\\d+)s?)?$");

  record ClipRef(ClipProvider provider, String externalId, Integer startSeconds) {}

  private ClipUrlParser() {}

  static ClipRef parse(String raw) {
    URI uri;
    try {
      uri = new URI(raw == null ? "" : raw.trim());
    } catch (URISyntaxException e) {
      throw invalid();
    }
    String scheme = uri.getScheme();
    String host = uri.getHost();
    if (host == null || !("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme))) {
      throw invalid();
    }
    host = host.toLowerCase().replaceFirst("^(www|m|music)\\.", "");
    String path = uri.getPath() == null ? "" : uri.getPath();
    String[] segments = path.replaceFirst("^/", "").split("/");

    switch (host) {
      case "youtube.com", "youtube-nocookie.com" -> {
        String id =
            "/watch".equals(path)
                ? query(uri, "v")
                : segments.length >= 2
                        && switch (segments[0]) {
                          case "shorts", "embed", "live" -> true;
                          default -> false;
                        }
                    ? segments[1]
                    : null;
        return youtube(id, query(uri, "t"));
      }
      case "youtu.be" -> {
        return youtube(segments[0], query(uri, "t"));
      }
      default -> throw invalid();
    }
  }

  private static ClipRef youtube(String id, String time) {
    if (id == null || !YOUTUBE_ID.matcher(id).matches()) {
      throw invalid();
    }
    return new ClipRef(ClipProvider.YOUTUBE, id, seconds(time));
  }

  static Integer seconds(String time) {
    if (time == null || time.isBlank()) {
      return null;
    }
    Matcher m = TIME.matcher(time);
    if (!m.matches()) {
      return null;
    }
    int total = 0;
    if (m.group(1) != null) {
      total += Integer.parseInt(m.group(1)) * 3600;
    }
    if (m.group(2) != null) {
      total += Integer.parseInt(m.group(2)) * 60;
    }
    if (m.group(3) != null) {
      total += Integer.parseInt(m.group(3));
    }
    return total;
  }

  private static String query(URI uri, String key) {
    String query = uri.getRawQuery();
    if (query == null) {
      return null;
    }
    for (String pair : query.split("&")) {
      int eq = pair.indexOf('=');
      if (eq > 0 && pair.substring(0, eq).equals(key)) {
        return pair.substring(eq + 1);
      }
    }
    return null;
  }

  private static BadRequestException invalid() {
    return new BadRequestException(ErrorCode.VERSUS_CLIP_INVALID_URL, "Paste a YouTube link");
  }
}
