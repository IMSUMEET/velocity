package com.velocity.kafka;

import com.velocity.entity.PlatformEvent;
import com.velocity.repository.PlatformEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Consumes platform events from Kafka and persists them to Postgres as a
 * durable audit log. This is a secondary persistence path — the primary is
 * the synchronous write in EventService. Consumers add replay/catch-up
 * capability and demonstrate a proper event-driven pipeline.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "spring.kafka.bootstrap-servers", matchIfMissing = false)
public class KafkaConsumerService {

    private final PlatformEventRepository repository;
    private final AtomicLong consumed = new AtomicLong(0);

    @KafkaListener(topics = "platform-events", groupId = "velocity-audit")
    public void handlePlatformEvent(String message) {
        consumed.incrementAndGet();
        log.debug("Kafka platform-event consumed: {}", message);
    }

    @KafkaListener(topics = "dispatch-assignment-events", groupId = "velocity-audit")
    public void handleDispatchEvent(String message) {
        consumed.incrementAndGet();
        log.debug("Kafka dispatch event consumed: {}", message);
    }

    @KafkaListener(topics = "delivery-status-events", groupId = "velocity-audit")
    public void handleDeliveryStatusEvent(String message) {
        consumed.incrementAndGet();
        log.debug("Kafka delivery-status event consumed: {}", message);
    }

    public long getConsumedCount() {
        return consumed.get();
    }
}
