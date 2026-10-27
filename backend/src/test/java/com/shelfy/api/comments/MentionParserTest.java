package com.shelfy.api.comments;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;

class MentionParserTest {

  @Test
  void extractsDistinctMentionsInOrder() {
    assertEquals(
        List.of("alice", "bob_2"),
        List.copyOf(MentionParser.extractMentionedUsernames("hi @alice and @bob_2, @alice again")));
  }

  @Test
  void ignoresNullAndBlankContent() {
    assertTrue(MentionParser.extractMentionedUsernames(null).isEmpty());
    assertTrue(MentionParser.extractMentionedUsernames("   ").isEmpty());
  }

  @Test
  void ignoresEmailsAndDoubleAt() {
    assertTrue(MentionParser.extractMentionedUsernames("mail me at john@example.com").isEmpty());
    assertTrue(MentionParser.extractMentionedUsernames("@@alice").isEmpty());
  }

  @Test
  void separatesRemoteHandlesFromLocalMentions() {
    String content = "cc @bob@Shelfy.Example and @carol@host.test:8082, ping @alice";

    assertEquals(List.of("alice"), List.copyOf(MentionParser.extractMentionedUsernames(content)));
    assertEquals(
        List.of("bob@shelfy.example", "carol@host.test:8082"),
        List.copyOf(MentionParser.extractRemoteHandles(content)));
  }

  @Test
  void ignoresTooShortUsernames() {
    assertTrue(MentionParser.extractMentionedUsernames("@ab").isEmpty());
  }
}
