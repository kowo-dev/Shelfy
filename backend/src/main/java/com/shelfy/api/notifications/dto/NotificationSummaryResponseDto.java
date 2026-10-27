package com.shelfy.api.notifications.dto;

import java.util.Map;

public record NotificationSummaryResponseDto(
    long total, long personal, Map<String, Long> families, long all, Map<String, Long> totals) {}
