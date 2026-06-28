package com.aloys.history_service.service;

import com.aloys.history_service.dto.EventDetailResponse;
import com.aloys.history_service.dto.EventResponse;
import com.aloys.history_service.entity.Alert;
import com.aloys.history_service.entity.Event;
import com.aloys.history_service.repository.AlertRepository;
import com.aloys.history_service.repository.EventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class EventService {

    private final EventRepository eventRepository;
    private final AlertRepository alertRepository;

    public Page<EventResponse> getAllEvents(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return eventRepository.findAllByOrderByCreatedAtDesc(pageable)
                .map(EventResponse::fromEntity);
    }

    public EventDetailResponse getEventById(Long id) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Event not found with id: " + id));

        List<Alert> alerts = alertRepository.findByEventId(id);

        return EventDetailResponse.builder()
                .event(EventResponse.fromEntity(event))
                .rawData(event.getData())
                .alerts(alerts)
                .build();
    }

    public Event createEvent(Event event) {
        Event saved = eventRepository.save(event);
        log.info("Event stored: {} (type: {}, severity: {})", saved.getId(), saved.getType(), saved.getSeverity());
        return saved;
    }
}
