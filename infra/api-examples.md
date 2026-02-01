# POST /metrics API Examples

## Request Payloads

### Example 1: Basic Metric (No Alerts Triggered)

```json
POST /metrics
Content-Type: application/json

{
  "stationId": "STATION_001",
  "timestamp": 1704067200000,
  "swapRate": 25,
  "queue": 5,
  "demandSurge": false,
  "chargerUptime": 95,
  "chargerHealth": "healthy",
  "chargedBatteries": 15,
  "unchargedBatteries": 3,
  "errorLogs": [],
  "faultPatterns": [],
  "maxCapacity": 100
}
```

**Response (201):**
```json
{
  "message": "Metric ingested successfully",
  "metric": {
    "stationId": "STATION_001",
    "timestamp": 1704067200000
  },
  "alertsCreated": 0,
  "alerts": []
}
```

---

### Example 2: Congestion Alert (R1 Triggered)

```json
POST /metrics
Content-Type: application/json

{
  "stationId": "STATION_002",
  "timestamp": 1704067260000,
  "swapRate": 45,
  "queue": 15,
  "demandSurge": false,
  "chargerUptime": 90,
  "chargerHealth": "healthy",
  "chargedBatteries": 12,
  "unchargedBatteries": 2,
  "errorLogs": [],
  "faultPatterns": [],
  "maxCapacity": 100
}
```

**Note:** Requires previous metric with `queue > 12` to trigger R1 (2 consecutive cycles).

**Response (201):**
```json
{
  "message": "Metric ingested successfully",
  "metric": {
    "stationId": "STATION_002",
    "timestamp": 1704067260000
  },
  "alertsCreated": 1,
  "alerts": [
    {
      "alertId": "550e8400-e29b-41d4-a716-446655440000",
      "alertType": "CONGESTION",
      "severity": "MEDIUM",
      "title": "Queue Congestion Detected",
      "recommendedAction": "Reroute drivers to nearby low-load stations"
    }
  ]
}
```

---

### Example 3: Low Inventory Alert (R2 Triggered)

```json
POST /metrics
Content-Type: application/json

{
  "stationId": "STATION_003",
  "timestamp": 1704067320000,
  "swapRate": 30,
  "queue": 8,
  "demandSurge": false,
  "chargerUptime": 85,
  "chargerHealth": "degraded",
  "chargedBatteries": 5,
  "unchargedBatteries": 8,
  "errorLogs": [],
  "faultPatterns": [],
  "maxCapacity": 100
}
```

**Response (201):**
```json
{
  "message": "Metric ingested successfully",
  "metric": {
    "stationId": "STATION_003",
    "timestamp": 1704067320000
  },
  "alertsCreated": 1,
  "alerts": [
    {
      "alertId": "660e8400-e29b-41d4-a716-446655440001",
      "alertType": "LOW_INVENTORY",
      "severity": "MEDIUM",
      "title": "Low Inventory Alert",
      "recommendedAction": "Suggest inventory rebalancing between stations"
    }
  ]
}
```

---

### Example 4: Critical Alert (R3 - R1 + R2 Triggered)

```json
POST /metrics
Content-Type: application/json

{
  "stationId": "STATION_004",
  "timestamp": 1704067380000,
  "swapRate": 60,
  "queue": 18,
  "demandSurge": true,
  "chargerUptime": 75,
  "chargerHealth": "degraded",
  "chargedBatteries": 3,
  "unchargedBatteries": 5,
  "errorLogs": ["ERR_CHARGER_001"],
  "faultPatterns": ["FAULT_PATTERN_A"],
  "maxCapacity": 100
}
```

**Note:** Requires previous metrics showing both congestion (queue > 12) and low inventory (charged < 8).

**Response (201):**
```json
{
  "message": "Metric ingested successfully",
  "metric": {
    "stationId": "STATION_004",
    "timestamp": 1704067380000
  },
  "alertsCreated": 1,
  "alerts": [
    {
      "alertId": "770e8400-e29b-41d4-a716-446655440002",
      "alertType": "CRITICAL",
      "severity": "CRITICAL",
      "title": "Critical Station Condition",
      "recommendedAction": "Escalate critical outages early and reroute drivers immediately"
    }
  ]
}
```

---

### Example 5: Hardware Fault Alert (R4 Triggered)

```json
POST /metrics
Content-Type: application/json

{
  "stationId": "STATION_005",
  "timestamp": 1704067440000,
  "swapRate": 20,
  "queue": 3,
  "demandSurge": false,
  "chargerUptime": 60,
  "chargerHealth": "degraded",
  "chargedBatteries": 10,
  "unchargedBatteries": 4,
  "errorLogs": ["ERR_CHARGER_002", "ERR_CHARGER_003"],
  "faultPatterns": ["FAULT_PATTERN_A", "FAULT_PATTERN_B", "FAULT_PATTERN_C"],
  "maxCapacity": 100
}
```

**Note:** Requires ≥3 faults in last 30 minutes across multiple metrics.

**Response (201):**
```json
{
  "message": "Metric ingested successfully",
  "metric": {
    "stationId": "STATION_005",
    "timestamp": 1704067440000
  },
  "alertsCreated": 1,
  "alerts": [
    {
      "alertId": "880e8400-e29b-41d4-a716-446655440003",
      "alertType": "HARDWARE",
      "severity": "MEDIUM",
      "title": "Hardware Fault Pattern Detected",
      "recommendedAction": "Raise maintenance tickets with probable root cause"
    }
  ]
}
```

---

### Example 6: Demand Spike Alert (R5 Triggered)

```json
POST /metrics
Content-Type: application/json

{
  "stationId": "STATION_006",
  "timestamp": 1704067500000,
  "swapRate": 75,
  "queue": 10,
  "demandSurge": true,
  "chargerUptime": 95,
  "chargerHealth": "healthy",
  "chargedBatteries": 18,
  "unchargedBatteries": 2,
  "errorLogs": [],
  "faultPatterns": [],
  "maxCapacity": 100
}
```

**Note:** Requires baseline swap rate < 50 in previous hour, then spike to ≥75 (1.5x baseline).

**Response (201):**
```json
{
  "message": "Metric ingested successfully",
  "metric": {
    "stationId": "STATION_006",
    "timestamp": 1704067500000
  },
  "alertsCreated": 1,
  "alerts": [
    {
      "alertId": "990e8400-e29b-41d4-a716-446655440004",
      "alertType": "DEMAND",
      "severity": "HIGH",
      "title": "Demand Spike Detected",
      "recommendedAction": "Reroute drivers to nearby low-load stations"
    }
  ]
}
```

---

### Example 7: Underutilized Station Alert (R6 Triggered)

```json
POST /metrics
Content-Type: application/json

{
  "stationId": "STATION_007",
  "timestamp": 1704067560000,
  "swapRate": 15,
  "queue": 1,
  "demandSurge": false,
  "chargerUptime": 100,
  "chargerHealth": "healthy",
  "chargedBatteries": 20,
  "unchargedBatteries": 0,
  "errorLogs": [],
  "faultPatterns": [],
  "maxCapacity": 100
}
```

**Note:** Requires average utilization < 20% over last 60 minutes.

**Response (201):**
```json
{
  "message": "Metric ingested successfully",
  "metric": {
    "stationId": "STATION_007",
    "timestamp": 1704067560000
  },
  "alertsCreated": 1,
  "alerts": [
    {
      "alertId": "aa0e8400-e29b-41d4-a716-446655440005",
      "alertType": "OPTIMIZE",
      "severity": "LOW",
      "title": "Underutilized Station",
      "recommendedAction": "Consider rebalancing inventory or adjusting station capacity"
    }
  ]
}
```

---

### Example 8: Multiple Alerts Triggered

```json
POST /metrics
Content-Type: application/json

{
  "stationId": "STATION_008",
  "timestamp": 1704067620000,
  "swapRate": 80,
  "queue": 20,
  "demandSurge": true,
  "chargerUptime": 70,
  "chargerHealth": "degraded",
  "chargedBatteries": 4,
  "unchargedBatteries": 6,
  "errorLogs": ["ERR_CHARGER_004"],
  "faultPatterns": ["FAULT_PATTERN_D", "FAULT_PATTERN_E"],
  "maxCapacity": 100
}
```

**Response (201):**
```json
{
  "message": "Metric ingested successfully",
  "metric": {
    "stationId": "STATION_008",
    "timestamp": 1704067620000
  },
  "alertsCreated": 2,
  "alerts": [
    {
      "alertId": "bb0e8400-e29b-41d4-a716-446655440006",
      "alertType": "CRITICAL",
      "severity": "CRITICAL",
      "title": "Critical Station Condition",
      "recommendedAction": "Escalate critical outages early and reroute drivers immediately"
    },
    {
      "alertId": "cc0e8400-e29b-41d4-a716-446655440007",
      "alertType": "HARDWARE",
      "severity": "MEDIUM",
      "title": "Hardware Fault Pattern Detected",
      "recommendedAction": "Raise maintenance tickets with probable root cause"
    }
  ]
}
```

---

## Error Responses

### 400 Bad Request - Validation Error

```json
POST /metrics
Content-Type: application/json

{
  "stationId": "STATION_001",
  "swapRate": "invalid"
}
```

**Response (400):**
```json
{
  "error": "Validation failed",
  "details": [
    "swapRate must be a number"
  ]
}
```

### 400 Bad Request - Missing Required Field

```json
POST /metrics
Content-Type: application/json

{
  "swapRate": 25
}
```

**Response (400):**
```json
{
  "error": "Validation failed",
  "details": [
    "stationId is required and must be a string"
  ]
}
```

### 500 Internal Server Error

**Response (500):**
```json
{
  "error": "Internal server error",
  "message": "DynamoDB connection failed"
}
```

---

## Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `stationId` | String | Yes | Station identifier (e.g., "STATION_001") |
| `timestamp` | Number | No | Unix epoch milliseconds (defaults to current time) |
| `swapRate` | Number | No | Swaps per hour |
| `queue` | Number | No | Current queue length (drivers waiting) |
| `demandSurge` | Boolean | No | High demand indicator |
| `chargerUptime` | Number | No | Charger uptime percentage (0-100) |
| `chargerHealth` | String | No | "healthy" \| "degraded" \| "down" |
| `chargedBatteries` | Number | No | Count of charged batteries available |
| `unchargedBatteries` | Number | No | Count of uncharged batteries |
| `errorLogs` | Array | No | Array of error codes/messages |
| `faultPatterns` | Array | No | Array of recurring fault identifiers |
| `maxCapacity` | Number | No | Maximum station capacity (for utilization calculation) |

---

## Alert Status

All alerts created via this API have:
- `status`: `"PENDING"` (awaiting ops manager approval)
- `createdAt`: Current timestamp
- `updatedAt`: Current timestamp
- `recommendedAction`: Action suggested by rule engine
- `metadata`: Rule evaluation details and flags
