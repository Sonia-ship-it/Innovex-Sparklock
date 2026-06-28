package com.aloys.history_service.repository;

import com.aloys.history_service.entity.Event;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface EventRepository extends JpaRepository<Event, Long> {
    Page<Event> findAllByOrderByCreatedAtDesc(Pageable pageable);

    List<Event> findByType(String type);

    List<Event> findBySeverity(String severity);

    List<Event> findByCreatedAtBetween(LocalDateTime start, LocalDateTime end);

    @Query("SELECT e.type, COUNT(e) FROM Event e GROUP BY e.type")
    List<Object[]> countByType();

    @Query("SELECT e.severity, COUNT(e) FROM Event e GROUP BY e.severity")
    List<Object[]> countBySeverity();

    @Query("SELECT COUNT(e) FROM Event e WHERE e.createdAt >= :since")
    long countSince(LocalDateTime since);
}
