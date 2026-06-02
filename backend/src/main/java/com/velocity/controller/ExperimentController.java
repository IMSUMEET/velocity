package com.velocity.controller;

import com.velocity.model.ExperimentResult;
import com.velocity.model.enums.DispatchStrategy;
import com.velocity.service.ExperimentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/experiments")
@RequiredArgsConstructor
public class ExperimentController {

    private final ExperimentService experimentService;

    private static final int DEFAULT_TICKS = 200;
    private static final long DEFAULT_SEED = 42L;

    @PostMapping("/run")
    public ExperimentResult runOne(@RequestBody Map<String, Object> body) {
        DispatchStrategy strategy = DispatchStrategy.valueOf(
                body.getOrDefault("strategy", "BALANCED").toString());
        int ticks = (int) body.getOrDefault("durationTicks", DEFAULT_TICKS);
        long seed = ((Number) body.getOrDefault("seed", DEFAULT_SEED)).longValue();
        return experimentService.runExperiment(strategy, ticks, seed);
    }

    @PostMapping("/compare")
    public List<ExperimentResult> compare(@RequestBody(required = false) Map<String, Object> body) {
        int ticks = body != null ? (int) body.getOrDefault("durationTicks", DEFAULT_TICKS) : DEFAULT_TICKS;
        long seed = body != null ? ((Number) body.getOrDefault("seed", DEFAULT_SEED)).longValue() : DEFAULT_SEED;
        return experimentService.runComparison(ticks, seed);
    }

    @GetMapping("/export/csv")
    public ResponseEntity<String> exportCsv(
            @RequestParam(defaultValue = "200") int ticks,
            @RequestParam(defaultValue = "42") long seed) {
        List<ExperimentResult> results = experimentService.runComparison(ticks, seed);
        String csv = experimentService.exportCsv(results);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=velocity-experiment.csv")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }

    @GetMapping("/export/latex")
    public ResponseEntity<String> exportLatex(
            @RequestParam(defaultValue = "200") int ticks,
            @RequestParam(defaultValue = "42") long seed) {
        List<ExperimentResult> results = experimentService.runComparison(ticks, seed);
        String latex = experimentService.exportLatex(results);
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_PLAIN)
                .body(latex);
    }
}
