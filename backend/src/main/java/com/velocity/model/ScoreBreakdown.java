package com.velocity.model;

import lombok.Data;

@Data
public class ScoreBreakdown {
    private double distanceScore;
    private double etaScore;
    private double orderAgeScore;
    private double vehicleBonus;
    private double experienceBonus;
    private double batchBonus;
    private double total;
}
