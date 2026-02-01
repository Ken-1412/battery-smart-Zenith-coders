# Decisions Table Schema

## Decisions Table (`ai-ops-decisions`)

**Purpose:** Track ops manager decisions (approve/reject) for alerts

**Key Structure:**
- **Partition Key (PK):** `decisionId` (String) - UUID v4
- **Sort Key:** Not used

**Attributes:**
- `decisionId` (String) - Unique decision identifier (UUID)
- `alertId` (String) - Related alert ID
- `decision` (String) - "APPROVE" | "REJECT"
- `status` (String) - "EXECUTED" (if APPROVE) | "DISMISSED" (if REJECT)
- `userId` (String) - User who made the decision
- `timestamp` (Number) - Unix epoch milliseconds
- `reason` (String) - Optional reason for decision
- `metadata` (Map) - Additional context
  - `previousStatus`: Previous alert status
  - `alertType`: Type of alert
  - `severity`: Alert severity
  - `stationId`: Station ID

**Access Patterns:**
1. Write: `PutItem` when decision is made
2. Read by Alert: `Query` on GSI by alertId
3. Read by User: `Query` on GSI by userId

**GSI:**
- **GSI-1: AlertIndex**
  - Partition Key: `alertId` (String)
  - Sort Key: `timestamp` (Number)
  - Purpose: Get all decisions for a specific alert

- **GSI-2: UserIndex**
  - Partition Key: `userId` (String)
  - Sort Key: `timestamp` (Number)
  - Purpose: Get all decisions by a specific user

---

## Updated Alerts Table Status Values

**Status Field Values:**
- `PENDING` - Alert created, awaiting decision
- `EXECUTED` - Alert approved, action executed
- `DISMISSED` - Alert rejected, dismissed

**Additional Audit Fields:**
- `executedAt` (Number) - When alert was approved
- `executedBy` (String) - User who approved
- `dismissedAt` (Number) - When alert was rejected
- `dismissedBy` (String) - User who rejected
- `dismissalReason` (String) - Reason for rejection
- `decisionId` (String) - Reference to decision record

---

## Decision Flow

1. Alert created with status `PENDING`
2. Ops manager makes decision via POST /alerts/decision
3. Decision record created in Decisions table
4. Alert status updated:
   - APPROVE → `EXECUTED`
   - REJECT → `DISMISSED`
5. Audit log entry created
6. Response returned with decision details

---

## Example Decision Record

```json
{
  "decisionId": "660e8400-e29b-41d4-a716-446655440001",
  "alertId": "550e8400-e29b-41d4-a716-446655440000",
  "decision": "APPROVE",
  "status": "EXECUTED",
  "userId": "ops-manager",
  "timestamp": 1704067200000,
  "reason": null,
  "metadata": {
    "previousStatus": "PENDING",
    "alertType": "CONGESTION",
    "severity": "MEDIUM",
    "stationId": "STATION_001"
  }
}
```
