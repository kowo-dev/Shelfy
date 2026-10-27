package com.shelfy.api.collection;

import com.shelfy.api.common.exception.BadRequestException;
import com.shelfy.api.common.exception.ErrorCode;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class RichTextContentValidator {

  private static final int MAX_TEXT_LENGTH = 20_000;
  private static final int MAX_DEPTH = 12;
  private static final int MAX_NODES = 5_000;
  private static final Set<String> NODE_TYPES =
      Set.of(
          "doc",
          "paragraph",
          "heading",
          "bulletList",
          "orderedList",
          "listItem",
          "blockquote",
          "hardBreak",
          "text");
  private static final Set<String> MARK_TYPES =
      Set.of("bold", "italic", "underline", "strike", "link", "spoiler");

  public void validate(Map<String, Object> content) {
    if (content == null) {
      return;
    }
    Counter counter = new Counter();
    validateNode(content, 0, counter, true, null);
  }

  private void validateNode(
      Map<String, Object> node, int depth, Counter counter, boolean root, String parentType) {
    if (depth > MAX_DEPTH) {
      invalid();
    }
    String type = string(node.get("type"));
    if (!NODE_TYPES.contains(type)
        || (root && !"doc".equals(type))
        || (!root && !isAllowedChild(parentType, type))
        || ++counter.nodes > MAX_NODES) {
      invalid();
    }
    if ("text".equals(type)) {
      String text = string(node.get("text"));
      if (text == null || (counter.textLength += text.length()) > MAX_TEXT_LENGTH) {
        invalid();
      }
      validateMarks(node.get("marks"));
      return;
    }
    if ("heading".equals(type)) {
      Map<String, Object> attrs = map(node.get("attrs"));
      Object level = attrs == null ? null : attrs.get("level");
      if (!(level instanceof Number number) || number.intValue() < 1 || number.intValue() > 3) {
        invalid();
      }
    }
    Object children = node.get("content");
    if (children == null) {
      return;
    }
    if (!(children instanceof List<?>)) {
      invalid();
      return;
    }
    for (Object child : (List<?>) children) {
      Map<String, Object> childNode = map(child);
      if (childNode == null) {
        invalid();
        return;
      }
      validateNode(childNode, depth + 1, counter, false, type);
    }
  }

  private void validateMarks(Object marks) {
    if (marks == null) {
      return;
    }
    if (!(marks instanceof List<?>)) {
      invalid();
      return;
    }
    for (Object value : (List<?>) marks) {
      Map<String, Object> mark = map(value);
      String type = mark == null ? null : string(mark.get("type"));
      if (!MARK_TYPES.contains(type)) {
        invalid();
      }
      if ("link".equals(type)) {
        Map<String, Object> attrs = map(mark.get("attrs"));
        String href = attrs == null ? null : string(attrs.get("href"));
        if (!isSafeHttpsUrl(href)) {
          invalid();
        }
      }
    }
  }

  private static boolean isSafeHttpsUrl(String value) {
    try {
      URI uri = URI.create(value);
      return "https".equalsIgnoreCase(uri.getScheme())
          && uri.getHost() != null
          && uri.getUserInfo() == null;
    } catch (IllegalArgumentException exception) {
      return false;
    }
  }

  private static boolean isAllowedChild(String parentType, String type) {
    return switch (parentType) {
      case "doc" ->
          Set.of("paragraph", "heading", "bulletList", "orderedList", "blockquote").contains(type);
      case "paragraph", "heading" -> Set.of("text", "hardBreak").contains(type);
      case "blockquote" ->
          Set.of("paragraph", "heading", "bulletList", "orderedList").contains(type);
      case "bulletList", "orderedList" -> "listItem".equals(type);
      case "listItem" -> Set.of("paragraph", "bulletList", "orderedList").contains(type);
      default -> false;
    };
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> map(Object value) {
    return value instanceof Map<?, ?> ? (Map<String, Object>) value : null;
  }

  private static String string(Object value) {
    return value instanceof String result ? result : null;
  }

  private static void invalid() {
    throw new BadRequestException(ErrorCode.VALIDATION_FAILED, "Invalid rich text content");
  }

  private static final class Counter {
    private int textLength;
    private int nodes;
  }
}
