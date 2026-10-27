package com.shelfy.api.federation;

import java.util.List;
import java.util.Map;
import org.springframework.web.util.HtmlUtils;

public final class RichTextHtml {

  private static final String SPOILER = "<em>[spoiler]</em>";

  private RichTextHtml() {}

  public static String render(Map<String, Object> doc) {
    StringBuilder html = new StringBuilder();
    children(doc).forEach(node -> block(node, html));
    return html.toString();
  }

  private static void block(Map<String, Object> node, StringBuilder html) {
    switch (String.valueOf(node.get("type"))) {
      case "paragraph" -> wrap("p", node, html);
      case "heading" -> wrap("h" + level(node), node, html);
      case "blockquote" -> container("blockquote", node, html);
      case "bulletList" -> container("ul", node, html);
      case "orderedList" -> container("ol", node, html);
      case "listItem" -> container("li", node, html);
      default -> inline(node, html);
    }
  }

  private static void wrap(String tag, Map<String, Object> node, StringBuilder html) {
    html.append('<').append(tag).append('>');
    children(node).forEach(child -> inline(child, html));
    html.append("</").append(tag).append('>');
  }

  private static void container(String tag, Map<String, Object> node, StringBuilder html) {
    html.append('<').append(tag).append('>');
    children(node).forEach(child -> block(child, html));
    html.append("</").append(tag).append('>');
  }

  private static void inline(Map<String, Object> node, StringBuilder html) {
    if ("hardBreak".equals(node.get("type"))) {
      html.append("<br>");
      return;
    }
    if (!"text".equals(node.get("type"))) {
      return;
    }
    List<Map<String, Object>> marks = maps(node.get("marks"));
    if (marks.stream().anyMatch(mark -> "spoiler".equals(mark.get("type")))) {
      if (!html.toString().endsWith(SPOILER)) {
        html.append(SPOILER);
      }
      return;
    }
    String text = HtmlUtils.htmlEscape(String.valueOf(node.get("text")));
    for (Map<String, Object> mark : marks) {
      text =
          switch (String.valueOf(mark.get("type"))) {
            case "bold" -> "<strong>" + text + "</strong>";
            case "italic" -> "<em>" + text + "</em>";
            case "underline" -> "<u>" + text + "</u>";
            case "strike" -> "<del>" + text + "</del>";
            case "link" -> link(mark, text);
            default -> text;
          };
    }
    html.append(text);
  }

  private static String link(Map<String, Object> mark, String text) {
    Object attrs = mark.get("attrs");
    Object href = attrs instanceof Map<?, ?> map ? map.get("href") : null;
    if (!(href instanceof String url) || !url.startsWith("https://")) {
      return text;
    }
    return "<a href=\""
        + HtmlUtils.htmlEscape(url)
        + "\" rel=\"nofollow noopener\">"
        + text
        + "</a>";
  }

  private static int level(Map<String, Object> node) {
    Object attrs = node.get("attrs");
    Object level = attrs instanceof Map<?, ?> map ? map.get("level") : null;
    return level instanceof Number number ? Math.clamp(number.intValue(), 1, 3) : 2;
  }

  private static List<Map<String, Object>> children(Map<String, Object> node) {
    return maps(node.get("content"));
  }

  @SuppressWarnings("unchecked")
  private static List<Map<String, Object>> maps(Object value) {
    if (!(value instanceof List<?> list)) {
      return List.of();
    }
    return list.stream()
        .filter(Map.class::isInstance)
        .map(item -> (Map<String, Object>) item)
        .toList();
  }
}
