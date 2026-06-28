package com.aloys.history_service.controller;

import com.aloys.history_service.dto.EventDetailResponse;
import com.aloys.history_service.dto.EventResponse;
import com.aloys.history_service.dto.StatsResponse;
import com.aloys.history_service.service.EventService;
import com.aloys.history_service.service.StatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/history")
@RequiredArgsConstructor
public class HistoryController {

    private final EventService eventService;
    private final StatsService statsService;

    @GetMapping("/events")
    public ResponseEntity<Map<String, Object>> getEvents(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Page<EventResponse> events = eventService.getAllEvents(page, size);

        // Use HashMap instead of Map.of() because Map.of() throws NullPointerException on null values
        Map<String, Object> body = new HashMap<>();
        body.put("success", true);
        body.put("data", events.getContent());
        body.put("totalElements", events.getTotalElements());
        body.put("totalPages", events.getTotalPages());
        body.put("currentPage", events.getNumber());
        return ResponseEntity.ok(body);
    }

    @GetMapping("/events/{id}")
    public ResponseEntity<Map<String, Object>> getEvent(@PathVariable Long id) {
        try {
            EventDetailResponse detail = eventService.getEventById(id);
            Map<String, Object> body = new HashMap<>();
            body.put("success", true);
            body.put("data", detail);
            return ResponseEntity.ok(body);
        } catch (IllegalArgumentException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("success", false);
            err.put("message", e.getMessage());
            return ResponseEntity.status(404).body(err);
        }
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        StatsResponse stats = statsService.getStats();
        Map<String, Object> body = new HashMap<>();
        body.put("success", true);
        body.put("data", stats);
        return ResponseEntity.ok(body);
    }
}
