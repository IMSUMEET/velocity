package com.velocity.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class KafkaProducerService {

    @Autowired(required = false)
    private KafkaTemplate<String, String> kafkaTemplate;

    private final ObjectMapper objectMapper;

    public KafkaProducerService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void sendEvent(String topic, String key, Object payload) {
        if (kafkaTemplate == null) return;
        try {
            String json = objectMapper.writeValueAsString(payload);
            kafkaTemplate.send(topic, key, json);
        } catch (Exception e) {
            log.warn("Failed to send Kafka event to topic {}: {}", topic, e.getMessage());
        }
    }
}
