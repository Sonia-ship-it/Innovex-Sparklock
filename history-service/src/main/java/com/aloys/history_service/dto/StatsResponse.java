package com.aloys.history_service.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.util.Map;

@Data
@AllArgsConstructor
@Builder
public class StatsResponse {
    private long totalEvents;
    private long eventsLast24h;
    private long eventsLast7d;
    private Map<String, Long> eventsByType;
    private Map<String, Long> eventsBySeverity;
}
