package com.shelfy.api.comments;

import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class MentionParser {
  private static final Pattern MENTION_PATTERN =
      Pattern.compile("(?<![\\w@])@([a-zA-Z0-9_.-]{3,50})\\b(?!@)");
  private static final Pattern REMOTE_PATTERN =
      Pattern.compile(
          "(?<![\\w@])@([a-zA-Z0-9_.-]{1,50})@([a-zA-Z0-9-]+(?:\\.[a-zA-Z0-9-]+)+(?::\\d{1,5})?)");

  private MentionParser() {}

  public static Set<String> extractRemoteHandles(String content) {
    Set<String> handles = new LinkedHashSet<>();
    if (content == null) {
      return handles;
    }
    Matcher matcher = REMOTE_PATTERN.matcher(content);
    while (matcher.find()) {
      handles.add(matcher.group(1) + "@" + matcher.group(2).toLowerCase(Locale.ROOT));
    }
    return handles;
  }

  static Set<String> extractMentionedUsernames(String content) {
    Set<String> usernames = new LinkedHashSet<>();
    if (content == null) {
      return usernames;
    }
    Matcher matcher = MENTION_PATTERN.matcher(content);
    while (matcher.find()) {
      usernames.add(matcher.group(1));
    }
    return usernames;
  }
}
