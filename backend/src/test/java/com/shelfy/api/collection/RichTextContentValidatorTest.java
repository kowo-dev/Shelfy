package com.shelfy.api.collection;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.shelfy.api.common.exception.BadRequestException;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RichTextContentValidatorTest {

  private final RichTextContentValidator validator = new RichTextContentValidator();

  @Test
  void acceptsTheConfiguredDocumentAndHttpsLink() {
    Map<String, Object> content =
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
                        Map.of(
                            "type",
                            "text",
                            "text",
                            "Shelfy",
                            "marks",
                            List.of(
                                Map.of(
                                    "type",
                                    "link",
                                    "attrs",
                                    Map.of("href", "https://example.com"))))))));

    assertDoesNotThrow(() -> validator.validate(content));
  }

  @Test
  void acceptsSpoilerMarks() {
    Map<String, Object> content =
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
                        Map.of(
                            "type",
                            "text",
                            "text",
                            "the butler",
                            "marks",
                            List.of(Map.of("type", "spoiler")))))));

    assertDoesNotThrow(() -> validator.validate(content));
  }

  @Test
  void rejectsExecutableLinksAndUnknownNodes() {
    Map<String, Object> unsafeLink =
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
                        Map.of(
                            "type",
                            "text",
                            "text",
                            "click",
                            "marks",
                            List.of(
                                Map.of(
                                    "type",
                                    "link",
                                    "attrs",
                                    Map.of("href", "javascript:alert(1)"))))))));
    Map<String, Object> image = Map.of("type", "doc", "content", List.of(Map.of("type", "image")));
    Map<String, Object> invalidStructure =
        Map.of(
            "type",
            "doc",
            "content",
            List.of(Map.of("type", "text", "text", "not a document block")));

    assertThrows(BadRequestException.class, () -> validator.validate(unsafeLink));
    assertThrows(BadRequestException.class, () -> validator.validate(image));
    assertThrows(BadRequestException.class, () -> validator.validate(invalidStructure));
  }
}
