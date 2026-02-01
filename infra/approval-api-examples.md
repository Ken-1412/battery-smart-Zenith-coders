# Ops Approval System API Examples

## Overview

The ops approval system allows operations managers to approve or reject alerts, tracking decisions in a separate Decisions table with full audit trail.

---

## GET /alerts

Retrieve all alerts with optional status filtering.

### Request

```http
GET /alerts?status=PENDING&limit=50
```

**Query Parameters:**
- `status` (optional): Filter by status (`PENDING`, `EXECUTED`, `DISMISSED`)
- `limit` (optional): Maximum number of alerts to return (default: 50)

### Response (200)

```json
{
  "alerts": [
    {
      "alertId": "550e8400-e29b-41d4-a716-446655440000",
      "stationId": "STATION_001",
      "alertType": "CONGESTION",
      "severity": "MEDIUM",
      "status": "PENDING",
      "title": "Queue Congestion Detected",
      "description": "Queue length exceeded 12 for 2 consecutive cycles. Average queue: 15.5",
      "recommendedAction": "Reroute drivers from STATION_001 to nearby low-load stations. Queue length: 15.5.",
      "createdAt": 1704067200000,
      "updatedAt": 1704067200000,
      "metadata": {
        "avgQueue": "15.5",
        "maxQueue": 18,
        "recommendation": { ... }
      },
      "decisions": []
    },
    {
      "alertId": "660e8400-e29b-41d4-a716-446655440001",
      "stationId": "STATION_002",
      "alertType": "LOW_INVENTORY",
      "severity": "HIGH",
      "status": "EXECUTED",
      "title": "Low Inventory Alert",
      "description": "Station has only 5 charged batteries available (total: 13). Threshold: 8",
      "recommendedAction": "Transfer charged batteries to STATION_002. Current inventory: 5 charged batteries (threshold: 8).",
      "createdAt": 1704067100000,
      "updatedAt": 1704067300000,
      "executedAt": 1704067300000,
      "executedBy": "ops-manager",
      "decisionId": "770e8400-e29b-41d4-a716-446655440002",
      "decisions": [
        {
          "decisionId": "770e8400-e29b-41d4-a716-446655440002",
          "decision": "APPROVE",
          "status": "EXECUTED",
          "userId": "ops-manager",
          "timestamp": 1704067300000,
          "reason": null
        }
      ]
    }
  ],
  "count": 2,
  "total": 2,
  "filters": {
    "status": "all",
    "limit": 50
  }
}
```

### Example: Filter by Status

```http
GET /alerts?status=PENDING
```

**Response:**
```json
{
  "alerts": [
    {
      "alertId": "550e8400-e29b-41d4-a716-446655440000",
      "status": "PENDING",
      ...
    }
  ],
  "count": 1,
  "total": 1,
  "filters": {
    "status": "PENDING",
    "limit": 50
  }
}
```

---

## POST /alerts/decision

Approve or reject an alert.

### Request Body

```json
{
  "alertId": "550e8400-e29b-41d4-a716-446655440000",
  "decision": "APPROVE",
  "reason": "Optional reason for decision"
}
```

**Fields:**
- `alertId` (required): Alert ID to make decision on
- `decision` (required): `"APPROVE"` or `"REJECT"`
- `reason` (optional): Reason for the decision

### Response (200) - Approve

```json
{
  "message": "Alert approved successfully",
  "alert": {
    "alertId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "EXECUTED",
    "decisionId": "880e8400-e29b-41d4-a716-446655440003"
  },
  "decision": {
    "decisionId": "880e8400-e29b-41d4-a716-446655440003",
    "alertId": "550e8400-e29b-41d4-a716-446655440000",
    "decision": "APPROVE",
    "status": "EXECUTED",
    "userId": "ops-manager",
    "timestamp": 1704067400000,
    "reason": null,
    "metadata": {
      "previousStatus": "PENDING",
      "alertType": "CONGESTION",
      "severity": "MEDIUM",
      "stationId": "STATION_001"
    }
  }
}
```

### Response (200) - Reject

```json
{
  "message": "Alert rejected successfully",
  "alert": {
    "alertId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "DISMISSED",
    "decisionId": "990e8400-e29b-41d4-a716-446655440004"
  },
  "decision": {
    "decisionId": "990e8400-e29b-41d4-a716-446655440004",
    "alertId": "550e8400-e29b-41d4-a716-446655440000",
    "decision": "REJECT",
    "status": "DISMISSED",
    "userId": "ops-manager",
    "timestamp": 1704067500000,
    "reason": "False alarm - queue cleared quickly",
    "metadata": {
      "previousStatus": "PENDING",
      "alertType": "CONGESTION",
      "severity": "MEDIUM",
      "stationId": "STATION_001"
    }
  }
}
```

---

## Error Responses

### 400 Bad Request - Missing alertId

```json
{
  "error": "alertId is required and must be a string"
}
```

### 400 Bad Request - Invalid decision

```json
{
  "error": "decision is required and must be \"APPROVE\" or \"REJECT\""
}
```

### 400 Bad Request - Alert Already Processed

```json
{
  "error": "Alert is already EXECUTED. Cannot change decision."
}
```

### 404 Not Found - Alert Not Found

```json
{
  "error": "Alert not found"
}
```

### 500 Internal Server Error

```json
{
  "error": "Failed to process decision",
  "message": "DynamoDB connection failed"
}
```

---

## Complete Workflow Example

### 1. Get Pending Alerts

```bash
curl -X GET "https://api.example.com/alerts?status=PENDING"
```

### 2. Review Alert

Alert details show:
- Station: STATION_001
- Type: CONGESTION
- Severity: MEDIUM
- Recommendation: Reroute drivers

### 3. Approve Alert

```bash
curl -X POST "https://api.example.com/alerts/decision" \
  -H "Content-Type: application/json" \
  -d '{
    "alertId": "550e8400-e29b-41d4-a716-446655440000",
    "decision": "APPROVE"
  }'
```

**Result:**
- Alert status: `PENDING` → `EXECUTED`
- Decision record created
- Audit log entry created
- Alert now includes `executedAt`, `executedBy`, `decisionId`

### 4. Reject Alert (Alternative)

```bash
curl -X POST "https://api.example.com/alerts/decision" \
  -H "Content-Type: application/json" \
  -d '{
    "alertId": "550e8400-e29b-41d4-a716-446655440000",
    "decision": "REJECT",
    "reason": "Queue cleared before action needed"
  }'
```

**Result:**
- Alert status: `PENDING` → `DISMISSED`
- Decision record created with reason
- Audit log entry created
- Alert now includes `dismissedAt`, `dismissedBy`, `dismissalReason`, `decisionId`

---

## Audit Trail

All decisions are logged in:
1. **Decisions Table** - Full decision record with metadata
2. **Alerts Table** - Status updated with audit fields
3. **Audit Table** - Action log entry

### Audit Fields in Alert

**When Approved (EXECUTED):**
- `status`: `"EXECUTED"`
- `executedAt`: Timestamp
- `executedBy`: User ID
- `decisionId`: Reference to decision record

**When Rejected (DISMISSED):**
- `status`: `"DISMISSED"`
- `dismissedAt`: Timestamp
- `dismissedBy`: User ID
- `dismissalReason`: Reason provided
- `decisionId`: Reference to decision record

---

## User Identification

The system extracts user ID from:
1. API Gateway authorizer: `event.requestContext.authorizer.userId`
2. Custom header: `x-user-id`
3. Default: `"ops-manager"` (for MVP)

**Example with custom header:**
```bash
curl -X POST "https://api.example.com/alerts/decision" \
  -H "Content-Type: application/json" \
  -H "x-user-id: john.doe" \
  -d '{
    "alertId": "550e8400-e29b-41d4-a716-446655440000",
    "decision": "APPROVE"
  }'
```

---

## Status Flow

```
PENDING → [APPROVE] → EXECUTED
       → [REJECT]  → DISMISSED
```

- Once an alert is `EXECUTED` or `DISMISSED`, it cannot be changed
- Each alert can only have one decision
- Multiple decision records can exist (for audit), but only the latest is active
