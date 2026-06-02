package com.velocity.model;

import lombok.Data;

@Data
public class ZoneHeat {
    private String zoneName;
    private int orderCount;
    private String intensity;   // LOW | MEDIUM | HIGH | SURGE
}
