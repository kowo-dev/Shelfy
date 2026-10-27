package com.shelfy.api.anilist.client;

import java.util.Map;

record GraphQlRequestDto(String query, Map<String, Object> variables) {}
