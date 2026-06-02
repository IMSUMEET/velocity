package com.velocity.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.Instant;

/**
 * Durable audit record of every lifecycle event the simulation emits.
 * This is the control plane's source of truth for "what happened" and powers
 * the Events feed and per-order trace reconstruction.
 */
@Entity
@Table(name = "platform_event", indexes = {
        @Index(name = "idx_event_order", columnList = "orderId"),
        @Index(name = "idx_event_type", columnList = "type"),
        @Index(name = "idx_event_tick", columnList = "tick")
})
@Data
public class PlatformEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String type;
    private String category;
    private String severity;
    private String orderId;
    private String driverId;
    private String traceId;

    @Column(length = 512)
    private String message;

    private long tick;
    private Instant createdAt;
}
