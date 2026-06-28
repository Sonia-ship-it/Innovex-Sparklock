package com.aloys.history_service.dto;

import com.aloys.history_service.entity.Event;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@Builder
public class EventResponse {
    private Long id;
    private String type;
    private String sensorId;
    private String severity;
    private String location;
    private String message;
    private LocalDateTime createdAt;

    public static EventResponse fromEntity(Event event) {
        return EventResponse.builder()
                .id(event.getId())
                .type(event.getType() != null ? event.getType() : "UNKNOWN")
                .sensorId(event.getSensorId() != null ? event.getSensorId() : "")
                .severity(event.getSeverity() != null ? event.getSeverity() : "INFO")
                .location(event.getLocation() != null ? event.getLocation() : "Building")
                .message(event.getMessage() != null ? event.getMessage() : "System event recorded.")
                .createdAt(event.getCreatedAt())
                .build();
    }
}
