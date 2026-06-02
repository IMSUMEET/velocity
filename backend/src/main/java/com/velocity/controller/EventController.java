package com.velocity.controller;

import com.velocity.model.PlatformEventDTO;
import com.velocity.service.EventService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class EventController {

    private final EventService eventService;

    @GetMapping
    public List<PlatformEventDTO> listEvents(
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "100") int limit) {
        if (category != null && !category.isEmpty()) {
            return eventService.recentByCategory(category, limit);
        }
        return eventService.recent(limit);
    }
}
