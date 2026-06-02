package com.velocity.config;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.AdminClientConfig;
import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
@Configuration
public class KafkaConfig {

    public static final String PLATFORM_EVENTS = "platform-events";
    public static final String DISPATCH_ASSIGNMENT_EVENTS = "dispatch-assignment-events";
    public static final String DELIVERY_STATUS_EVENTS = "delivery-status-events";
    public static final String SIMULATION_TICK = "simulation-tick";

    private static final int PARTITIONS = 3;
    private static final short REPLICAS = 1;

    @Value("${spring.kafka.bootstrap-servers}")
    private String bootstrapServers;

    private boolean kafkaAvailable = false;

    @Bean
    public NewTopic platformEventsTopic() {
        return new NewTopic(PLATFORM_EVENTS, PARTITIONS, REPLICAS);
    }

    @Bean
    public NewTopic dispatchAssignmentTopic() {
        return new NewTopic(DISPATCH_ASSIGNMENT_EVENTS, PARTITIONS, REPLICAS);
    }

    @Bean
    public NewTopic deliveryStatusTopic() {
        return new NewTopic(DELIVERY_STATUS_EVENTS, PARTITIONS, REPLICAS);
    }

    @Bean
    public NewTopic simulationTickTopic() {
        return new NewTopic(SIMULATION_TICK, PARTITIONS, REPLICAS);
    }

    @PostConstruct
    public void checkKafkaAvailability() {
        try (AdminClient adminClient = AdminClient.create(
                Map.of(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers,
                        AdminClientConfig.REQUEST_TIMEOUT_MS_CONFIG, 3000))) {
            adminClient.listTopics().names().get(5, TimeUnit.SECONDS);
            kafkaAvailable = true;
            log.info("Kafka connection established successfully at {}", bootstrapServers);
        } catch (Exception e) {
            kafkaAvailable = false;
            log.warn("Kafka is not available at {}: {}. Application will continue without event streaming.",
                    bootstrapServers, e.getMessage());
        }
    }

    public boolean isKafkaAvailable() {
        return kafkaAvailable;
    }
}
