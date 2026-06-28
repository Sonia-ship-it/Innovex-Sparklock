package com.aloys.history_service.service;

import com.aloys.history_service.dto.StatsResponse;
import com.aloys.history_service.repository.EventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class StatsService {

    private final EventRepository eventRepository;

    public StatsResponse getStats() {
        long total = eventRepository.count();
        long last24h = eventRepository.countSince(LocalDateTime.now().minusHours(24));
        long last7d = eventRepository.countSince(LocalDateTime.now().minusDays(7));

        Map<String, Long> byType = new LinkedHashMap<>();
        eventRepository.countByType().forEach(row -> {
            byType.put((String) row[0], (Long) row[1]);
        });

        Map<String, Long> bySeverity = new LinkedHashMap<>();
        eventRepository.countBySeverity().forEach(row -> {
            bySeverity.put((String) row[0], (Long) row[1]);
        });

        return StatsResponse.builder()
                .totalEvents(total)
                .eventsLast24h(last24h)
                .eventsLast7d(last7d)
                .eventsByType(byType)
                .eventsBySeverity(bySeverity)
                .build();
    }
}
