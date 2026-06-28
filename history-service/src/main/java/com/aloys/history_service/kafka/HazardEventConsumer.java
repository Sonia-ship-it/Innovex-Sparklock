package com.aloys.history_service.kafka;

import com.aloys.history_service.entity.Event;
import com.aloys.history_service.service.EventService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class HazardEventConsumer {

    private final EventService eventService;
    private final ObjectMapper objectMapper;

    @KafkaListener(topics = "hazard-events", groupId = "history-service-group")
    public void consumeHazardEvent(String message) {
        log.info("Received hazard event from Kafka: {}", message);

        try {
            JsonNode json = objectMapper.readTree(message);

            Event event = Event.builder()
                    .type(json.has("type") ? json.get("type").asText() : "unknown")
                    .sensorId(json.has("sensorId") ? json.get("sensorId").asText() : null)
                    .severity(json.has("severity") ? json.get("severity").asText() : "WARNING")
                    .location(json.has("location") ? json.get("location").asText() : null)
                    .message(json.has("message") ? json.get("message").asText() : null)
                    .data(message) // Store raw JSON
                    .build();

            eventService.createEvent(event);
            log.info("Hazard event persisted: type={}, severity={}", event.getType(), event.getSeverity());

        } catch (Exception e) {
            log.error("Failed to process hazard event: {}", e.getMessage(), e);
        }
    }
}
