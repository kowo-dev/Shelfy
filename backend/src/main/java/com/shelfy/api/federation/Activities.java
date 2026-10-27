package com.shelfy.api.federation;

import java.util.LinkedHashMap;
import java.util.Map;
import tools.jackson.databind.JsonNode;

public final class Activities {

  private Activities() {}

  public static Map<String, Object> follow(String id, String actor, String object) {
    Map<String, Object> activity = activity(id, "Follow", actor);
    activity.put("object", object);
    return activity;
  }

  public static Map<String, Object> respond(
      String type, String id, String actor, Map<String, Object> follow) {
    Map<String, Object> activity = activity(id, type, actor);
    activity.put("object", withoutContext(follow));
    return activity;
  }

  public static Map<String, Object> undo(String id, String actor, Map<String, Object> object) {
    Map<String, Object> activity = activity(id, "Undo", actor);
    activity.put("object", withoutContext(object));
    return activity;
  }

  public static String idOf(JsonNode value) {
    if (value == null) {
      return null;
    }
    if (value.isString()) {
      return value.asString();
    }
    JsonNode id = value.path("id");
    return id.isString() ? id.asString() : null;
  }

  public static String text(JsonNode node, String field) {
    JsonNode value = node == null ? null : node.path(field);
    return value != null && value.isString() ? value.asString() : null;
  }

  private static Map<String, Object> activity(String id, String type, String actor) {
    Map<String, Object> activity = new LinkedHashMap<>();
    activity.put("@context", ActorDocuments.ACTIVITY_STREAMS);
    activity.put("id", id);
    activity.put("type", type);
    activity.put("actor", actor);
    return activity;
  }

  private static Map<String, Object> withoutContext(Map<String, Object> object) {
    Map<String, Object> copy = new LinkedHashMap<>(object);
    copy.remove("@context");
    return copy;
  }
}
