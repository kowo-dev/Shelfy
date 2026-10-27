package com.shelfy.api.collection;

import java.util.Map;
import java.util.Set;

public record CanonicalMedia(
    String title,
    String coverUrl,
    Map<String, Object> metadata,
    boolean isAdult,
    Set<ExternalMediaReference> externalReferences) {}
