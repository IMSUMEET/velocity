package com.velocity.service;

import com.velocity.entity.PlatformEvent;
import com.velocity.kafka.KafkaProducerService;
import com.velocity.model.PlatformEventDTO;
import com.velocity.repository.PlatformEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Central audit/event pipeline. Every lifecycle transition flows through here:
 * it is buffered in memory (for fast snapshot reads), persisted to Postgres
 * (durable audit log), streamed to Kafka (event backbone), and pushed to the
 * browser over STOMP.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EventService {

    private static final int RING_SIZE = 300;

    private final PlatformEventRepository repository;
    private final KafkaProducerService kafkaProducerService;
    private final SimpMessagingTemplate messagingTemplate;

    private final Deque<PlatformEventDTO> ring = new ArrayDeque<>();
    private final AtomicLong producedCount = new AtomicLong(0);

    public PlatformEventDTO record(String type, String category, String severity,
                                   String orderId, String driverId, String traceId,
                                   String message, long tick) {
        PlatformEventDTO dto = new PlatformEventDTO();
        dto.setId("evt-" + UUID.randomUUID().toString().substring(0, 8));
        dto.setType(type);
        dto.setCategory(category);
        dto.setSeverity(severity);
        dto.setOrderId(orderId);
        dto.setDriverId(driverId);
        dto.setTraceId(traceId);
        dto.setMessage(message);
        dto.setTick(tick);
        dto.setTimestamp(System.currentTimeMillis());

        synchronized (ring) {
            ring.addFirst(dto);
            while (ring.size() > RING_SIZE) ring.removeLast();
        }
        producedCount.incrementAndGet();

        persistAndStream(dto);
        return dto;
    }

    @Async
    protected void persistAndStream(PlatformEventDTO dto) {
        try {
            PlatformEvent entity = new PlatformEvent();
            entity.setType(dto.getType());
            entity.setCategory(dto.getCategory());
            entity.setSeverity(dto.getSeverity());
            entity.setOrderId(dto.getOrderId());
            entity.setDriverId(dto.getDriverId());
            entity.setTraceId(dto.getTraceId());
            entity.setMessage(dto.getMessage());
            entity.setTick(dto.getTick());
            entity.setCreatedAt(Instant.now());
            repository.save(entity);
        } catch (Exception e) {
            log.debug("Event persist skipped: {}", e.getMessage());
        }
        kafkaProducerService.sendEvent("platform-events", dto.getType(), dto);
        try {
            messagingTemplate.convertAndSend("/topic/events", dto);
        } catch (Exception ignored) {
        }
    }

    public List<PlatformEventDTO> recent(int limit) {
        synchronized (ring) {
            List<PlatformEventDTO> out = new ArrayList<>(ring);
            return out.size() > limit ? out.subList(0, limit) : out;
        }
    }

    public List<PlatformEventDTO> recentByCategory(String category, int limit) {
        synchronized (ring) {
            return ring.stream()
                    .filter(e -> category == null || category.equalsIgnoreCase(e.getCategory()))
                    .limit(limit)
                    .toList();
        }
    }

    public long producedCount() {
        return producedCount.get();
    }
}
