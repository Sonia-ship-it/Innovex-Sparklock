package com.aloys.history_service.dto;

import com.aloys.history_service.entity.Alert;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
@Builder
public class EventDetailResponse {
    private EventResponse event;
    private String rawData;
    private List<Alert> alerts;
}
