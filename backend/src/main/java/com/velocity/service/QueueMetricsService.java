package com.velocity.service;

import com.velocity.model.QueueMetric;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Computes simulated queue metrics for the Events & Queues dashboard. Tracks
 * order-ingest, dispatch-pipeline, and delivery-status queues, with simulated
 * backpressure and autoscale. Optionally caches snapshots in Redis.
 */
@Slf4j
@Service
public class QueueMetricsService {

    @Autowired(required = false)
    private StringRedisTemplate redis;

    private int orderQueueDepth = 0;
    private int dispatchQueueDepth = 0;
    private int deliveryQueueDepth = 0;
    private int orderWorkers = 2;
    private int dispatchWorkers = 2;
    private int deliveryWorkers = 2;

    public void update(int pendingOrders, int inProgressOrders, long eventsProduced) {
        orderQueueDepth = pendingOrders;
        dispatchQueueDepth = Math.max(0, pendingOrders - 2);
        deliveryQueueDepth = inProgressOrders;

        // simulated autoscale
        orderWorkers = autoscale(orderQueueDepth, orderWorkers);
        dispatchWorkers = autoscale(dispatchQueueDepth, dispatchWorkers);
        deliveryWorkers = autoscale(deliveryQueueDepth, deliveryWorkers);

        cacheToRedis(eventsProduced);
    }

    public List<QueueMetric> snapshot() {
        List<QueueMetric> qs = new ArrayList<>();
        qs.add(buildMetric("order-ingest", orderQueueDepth, orderWorkers));
        qs.add(buildMetric("dispatch-pipeline", dispatchQueueDepth, dispatchWorkers));
        qs.add(buildMetric("delivery-status", deliveryQueueDepth, deliveryWorkers));
        return qs;
    }

    private QueueMetric buildMetric(String name, int depth, int workers) {
        QueueMetric q = new QueueMetric();
        q.setName(name);
        q.setDepth(depth);
        q.setWorkers(workers);
        q.setIngestRate(Math.round(depth * 1.2 * 10) / 10.0);
        q.setConsumeRate(Math.round(workers * 3.5 * 10) / 10.0);
        q.setConsumerLag(Math.max(0, depth - workers * 2));
        q.setHealth(depth > workers * 5 ? "saturated" : depth > workers * 2 ? "backpressure" : "healthy");
        return q;
    }

    private int autoscale(int depth, int currentWorkers) {
        if (depth > currentWorkers * 5 && currentWorkers < 8) return currentWorkers + 1;
        if (depth < currentWorkers && currentWorkers > 1) return currentWorkers - 1;
        return currentWorkers;
    }

    private void cacheToRedis(long eventsProduced) {
        if (redis == null) return;
        try {
            redis.opsForValue().set("velocity:queue:order-ingest", String.valueOf(orderQueueDepth));
            redis.opsForValue().set("velocity:queue:dispatch-pipeline", String.valueOf(dispatchQueueDepth));
            redis.opsForValue().set("velocity:queue:delivery-status", String.valueOf(deliveryQueueDepth));
            redis.opsForValue().set("velocity:events:produced", String.valueOf(eventsProduced));
        } catch (Exception e) {
            log.debug("Redis cache write skipped: {}", e.getMessage());
        }
    }
}
