package com.shelfy.api.federation;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RichTextHtmlTest {

  @Test
  void rendersBlocksMarksAndEscapesText() {
    Map<String, Object> doc =
        Map.of(
            "type",
            "doc",
            "content",
            List.of(
                Map.of(
                    "type",
                    "heading",
                    "attrs",
                    Map.of("level", 2),
                    "content",
                    List.of(Map.of("type", "text", "text", "Verdict"))),
                Map.of(
                    "type",
                    "paragraph",
                    "content",
                    List.of(
                        Map.of(
                            "type",
                            "text",
                            "text",
                            "<script>",
                            "marks",
                            List.of(Map.of("type", "bold"))),
                        Map.of("type", "hardBreak"),
                        Map.of(
                            "type",
                            "text",
                            "text",
                            "link",
                            "marks",
                            List.of(
                                Map.of("type", "link", "attrs", Map.of("href", "https://a.b/c")))),
                        Map.of(
                            "type",
                            "text",
                            "text",
                            "bad",
                            "marks",
                            List.of(
                                Map.of(
                                    "type",
                                    "link",
                                    "attrs",
                                    Map.of("href", "javascript:alert(1)")))))),
                Map.of(
                    "type",
                    "bulletList",
                    "content",
                    List.of(
                        Map.of(
                            "type",
                            "listItem",
                            "content",
                            List.of(
                                Map.of(
                                    "type",
                                    "paragraph",
                                    "content",
                                    List.of(Map.of("type", "text", "text", "one")))))))));

    assertThat(RichTextHtml.render(doc))
        .isEqualTo(
            "<h2>Verdict</h2><p><strong>&lt;script&gt;</strong><br>"
                + "<a href=\"https://a.b/c\" rel=\"nofollow noopener\">link</a>bad</p>"
                + "<ul><li><p>one</p></li></ul>");
  }

  @Test
  void hidesSpoilerTextBehindASinglePlaceholder() {
    Map<String, Object> doc =
        Map.of(
            "type",
            "doc",
            "content",
            List.of(
                Map.of(
                    "type",
                    "paragraph",
                    "content",
                    List.of(
                        Map.of("type", "text", "text", "The killer is "),
                        Map.of(
                            "type",
                            "text",
                            "text",
                            "the butler",
                            "marks",
                            List.of(Map.of("type", "bold"), Map.of("type", "spoiler"))),
                        Map.of(
                            "type",
                            "text",
                            "text",
                            " all along",
                            "marks",
                            List.of(Map.of("type", "spoiler"))),
                        Map.of("type", "text", "text", ".")))));

    assertThat(RichTextHtml.render(doc)).isEqualTo("<p>The killer is <em>[spoiler]</em>.</p>");
  }
}
