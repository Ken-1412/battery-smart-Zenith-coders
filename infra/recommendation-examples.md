# Recommendation Service Examples

## Overview

The recommendation service generates actionable recommendations based on alert flags and station metadata. It provides both human-readable text and structured JSON output.

## Recommendation Rules

1. **CRITICAL** → Combines all actions (reroute + transfer + maintenance + escalate)
2. **CONGESTION + OPTIMIZE** → Reroute to underutilized stations
3. **CONGESTION** → Reroute to low-load stations
4. **LOW_INVENTORY** → Transfer batteries from nearby stations
5. **HARDWARE** → Schedule maintenance
6. **DEMAND** → Reroute during demand spike
7. **OPTIMIZE** → Rebalance inventory

---

## Example 1: CRITICAL Alert

**Input Flags:**
```json
{
  "CONGESTION": true,
  "LOW_INVENTORY": true,
  "HARDWARE": false,
  "CRITICAL": true,
  "DEMAND": false,
  "OPTIMIZE": false
}
```

**Human-Readable Output:**
```
CRITICAL: Station STATION_004 requires immediate attention. Multiple critical issues detected simultaneously.
```

**JSON Output:**
```json
{
  "stationId": "STATION_004",
  "flags": {
    "CONGESTION": true,
    "LOW_INVENTORY": true,
    "HARDWARE": false,
    "CRITICAL": true,
    "DEMAND": false,
    "OPTIMIZE": false
  },
  "primaryAction": "CRITICAL",
  "humanReadable": "CRITICAL: Station STATION_004 requires immediate attention. Multiple critical issues detected simultaneously.",
  "actions": [
    {
      "type": "REROUTE",
      "description": "Reroute drivers to nearby low-load stations",
      "details": {
        "reason": "High congestion detected",
        "targetStations": ["AUTO_DETECT"]
      }
    },
    {
      "type": "TRANSFER",
      "description": "Transfer charged batteries from nearby stations",
      "details": {
        "reason": "Low inventory detected",
        "requiredBatteries": 10,
        "sourceStations": ["AUTO_DETECT"]
      }
    },
    {
      "type": "MAINTENANCE",
      "description": "Schedule immediate maintenance",
      "details": {
        "reason": "Hardware faults detected",
        "faultCount": 0,
        "recurringFaults": []
      }
    },
    {
      "type": "ESCALATE",
      "description": "Escalate to operations manager",
      "details": {
        "reason": "Critical condition requires immediate intervention",
        "escalationLevel": "HIGH"
      }
    }
  ],
  "recommendations": [
    {
      "type": "CRITICAL",
      "priority": 1,
      "humanReadable": "CRITICAL: Station STATION_004 requires immediate attention. Multiple critical issues detected simultaneously.",
      "actions": [...]
    }
  ]
}
```

---

## Example 2: CONGESTION + OPTIMIZE

**Input Flags:**
```json
{
  "CONGESTION": true,
  "LOW_INVENTORY": false,
  "HARDWARE": false,
  "CRITICAL": false,
  "DEMAND": false,
  "OPTIMIZE": true
}
```

**Human-Readable Output:**
```
Reroute drivers from STATION_001 to nearby underutilized stations. High congestion detected while other stations are underutilized.
```

**JSON Output:**
```json
{
  "stationId": "STATION_001",
  "flags": {
    "CONGESTION": true,
    "OPTIMIZE": true
  },
  "primaryAction": "REROUTE",
  "humanReadable": "Reroute drivers from STATION_001 to nearby underutilized stations. High congestion detected while other stations are underutilized.",
  "actions": [
    {
      "type": "REROUTE",
      "description": "Reroute drivers to nearby low-load stations",
      "details": {
        "reason": "Congestion + Underutilized stations available",
        "currentQueue": 15.5,
        "targetStations": ["AUTO_DETECT"],
        "estimatedRelief": "30-50% queue reduction"
      }
    }
  ]
}
```

---

## Example 3: LOW_INVENTORY

**Input Flags:**
```json
{
  "CONGESTION": false,
  "LOW_INVENTORY": true,
  "HARDWARE": false,
  "CRITICAL": false,
  "DEMAND": false,
  "OPTIMIZE": false
}
```

**Human-Readable Output:**
```
Transfer charged batteries to STATION_003. Current inventory: 5 charged batteries (threshold: 8).
```

**JSON Output:**
```json
{
  "stationId": "STATION_003",
  "flags": {
    "LOW_INVENTORY": true
  },
  "primaryAction": "TRANSFER",
  "humanReadable": "Transfer charged batteries to STATION_003. Current inventory: 5 charged batteries (threshold: 8).",
  "actions": [
    {
      "type": "TRANSFER",
      "description": "Transfer charged batteries from nearby stations",
      "details": {
        "reason": "Low inventory detected",
        "currentCharged": 5,
        "requiredBatteries": 3,
        "sourceStations": ["AUTO_DETECT"],
        "urgency": "HIGH"
      }
    }
  ]
}
```

---

## Example 4: HARDWARE

**Input Flags:**
```json
{
  "CONGESTION": false,
  "LOW_INVENTORY": false,
  "HARDWARE": true,
  "CRITICAL": false,
  "DEMAND": false,
  "OPTIMIZE": false
}
```

**Human-Readable Output:**
```
Schedule maintenance for STATION_005. 4 faults detected in last 30 minutes.
```

**JSON Output:**
```json
{
  "stationId": "STATION_005",
  "flags": {
    "HARDWARE": true
  },
  "primaryAction": "MAINTENANCE",
  "humanReadable": "Schedule maintenance for STATION_005. 4 faults detected in last 30 minutes.",
  "actions": [
    {
      "type": "MAINTENANCE",
      "description": "Raise maintenance ticket with probable root cause",
      "details": {
        "reason": "Recurring hardware faults",
        "faultCount": 4,
        "recurringFaults": [
          { "fault": "FAULT_PATTERN_A", "count": 2 },
          { "fault": "FAULT_PATTERN_B", "count": 2 }
        ],
        "faultPatterns": {
          "FAULT_PATTERN_A": 2,
          "FAULT_PATTERN_B": 2
        },
        "estimatedDowntime": "1-2 hours"
      }
    }
  ]
}
```

---

## Example 5: DEMAND Spike

**Input Flags:**
```json
{
  "CONGESTION": false,
  "LOW_INVENTORY": false,
  "HARDWARE": false,
  "CRITICAL": false,
  "DEMAND": true,
  "OPTIMIZE": false
}
```

**Human-Readable Output:**
```
Demand spike detected at STATION_006. Swap rate increased by 75.0%. Consider rerouting.
```

**JSON Output:**
```json
{
  "stationId": "STATION_006",
  "flags": {
    "DEMAND": true
  },
  "primaryAction": "REROUTE",
  "humanReadable": "Demand spike detected at STATION_006. Swap rate increased by 75.0%. Consider rerouting.",
  "actions": [
    {
      "type": "REROUTE",
      "description": "Reroute drivers to nearby low-load stations",
      "details": {
        "reason": "Demand spike",
        "currentSwapRate": 75,
        "baselineSwapRate": 30,
        "spikePercentage": "75.0",
        "targetStations": ["AUTO_DETECT"]
      }
    }
  ]
}
```

---

## Example 6: OPTIMIZE (Underutilized)

**Input Flags:**
```json
{
  "CONGESTION": false,
  "LOW_INVENTORY": false,
  "HARDWARE": false,
  "CRITICAL": false,
  "DEMAND": false,
  "OPTIMIZE": true
}
```

**Human-Readable Output:**
```
Station STATION_007 is underutilized (15.0% utilization). Consider rebalancing inventory.
```

**JSON Output:**
```json
{
  "stationId": "STATION_007",
  "flags": {
    "OPTIMIZE": true
  },
  "primaryAction": "OPTIMIZE",
  "humanReadable": "Station STATION_007 is underutilized (15.0% utilization). Consider rebalancing inventory.",
  "actions": [
    {
      "type": "OPTIMIZE",
      "description": "Consider rebalancing inventory or adjusting station capacity",
      "details": {
        "reason": "Underutilized station",
        "utilization": 0.15,
        "avgSwapRate": 15,
        "maxCapacity": 100,
        "suggestion": "Transfer excess inventory to high-demand stations"
      }
    }
  ]
}
```

---

## Example 7: Multiple Recommendations

**Input Flags:**
```json
{
  "CONGESTION": true,
  "LOW_INVENTORY": true,
  "HARDWARE": true,
  "CRITICAL": false,
  "DEMAND": false,
  "OPTIMIZE": false
}
```

**Human-Readable Output:**
```
Reroute drivers from STATION_008 to nearby low-load stations. Queue length: 18. Transfer charged batteries to STATION_008. Current inventory: 4 charged batteries (threshold: 8). Schedule maintenance for STATION_008. 5 faults detected in last 30 minutes.
```

**JSON Output:**
```json
{
  "stationId": "STATION_008",
  "flags": {
    "CONGESTION": true,
    "LOW_INVENTORY": true,
    "HARDWARE": true
  },
  "primaryAction": "REROUTE",
  "humanReadable": "Reroute drivers from STATION_008 to nearby low-load stations. Queue length: 18. Transfer charged batteries to STATION_008. Current inventory: 4 charged batteries (threshold: 8). Schedule maintenance for STATION_008. 5 faults detected in last 30 minutes.",
  "actions": [
    {
      "type": "REROUTE",
      "description": "Reroute drivers to nearby low-load stations",
      "details": {
        "reason": "High queue congestion",
        "currentQueue": 18,
        "targetStations": ["AUTO_DETECT"],
        "estimatedRelief": "20-40% queue reduction"
      }
    },
    {
      "type": "TRANSFER",
      "description": "Transfer charged batteries from nearby stations",
      "details": {
        "reason": "Low inventory detected",
        "currentCharged": 4,
        "requiredBatteries": 4,
        "sourceStations": ["AUTO_DETECT"],
        "urgency": "HIGH"
      }
    },
    {
      "type": "MAINTENANCE",
      "description": "Raise maintenance ticket with probable root cause",
      "details": {
        "reason": "Recurring hardware faults",
        "faultCount": 5,
        "recurringFaults": [...],
        "estimatedDowntime": "1-2 hours"
      }
    }
  ],
  "recommendations": [
    {
      "type": "REROUTE",
      "priority": 2,
      "humanReadable": "Reroute drivers from STATION_008 to nearby low-load stations. Queue length: 18.",
      "actions": [...]
    },
    {
      "type": "TRANSFER",
      "priority": 2,
      "humanReadable": "Transfer charged batteries to STATION_008. Current inventory: 4 charged batteries (threshold: 8).",
      "actions": [...]
    },
    {
      "type": "MAINTENANCE",
      "priority": 2,
      "humanReadable": "Schedule maintenance for STATION_008. 5 faults detected in last 30 minutes.",
      "actions": [...]
    }
  ]
}
```

---

## Integration with Alert Creation

When an alert is created, the recommendation service is automatically called and the output is stored in the alert's metadata:

```json
{
  "alertId": "550e8400-e29b-41d4-a716-446655440000",
  "stationId": "STATION_001",
  "alertType": "CONGESTION",
  "severity": "MEDIUM",
  "status": "PENDING",
  "title": "Queue Congestion Detected",
  "description": "Queue length exceeded 12 for 2 consecutive cycles...",
  "recommendedAction": "Reroute drivers from STATION_001 to nearby low-load stations. Queue length: 15.5.",
  "metadata": {
    "avgQueue": 15.5,
    "maxQueue": 18,
    "recommendation": {
      "stationId": "STATION_001",
      "flags": { "CONGESTION": true },
      "primaryAction": "REROUTE",
      "humanReadable": "...",
      "actions": [...]
    },
    "primaryAction": "REROUTE"
  }
}
```
