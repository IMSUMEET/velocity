package com.velocity.repository;

import com.velocity.entity.PlatformEvent;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PlatformEventRepository extends JpaRepository<PlatformEvent, Long> {

    List<PlatformEvent> findByOrderIdOrderByTickAsc(String orderId);

    List<PlatformEvent> findByTypeOrderByIdDesc(String type, Pageable pageable);

    List<PlatformEvent> findAllByOrderByIdDesc(Pageable pageable);

    long countByType(String type);
}
