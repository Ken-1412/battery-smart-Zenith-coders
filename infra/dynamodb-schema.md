# DynamoDB Table Schema

## 1. Metrics Table (`ai-ops-metrics`)

**Purpose:** Store real-time station metrics ingested via API

**Key Structure:**
- **Partition Key (PK):** `stationId` (String) - e.g., "STATION_001"
- **Sort Key (SK):** `timestamp` (Number) - Unix epoch in milliseconds

**Attributes:**
- `stationId` (String) - Station identifier
- `timestamp` (Number) - Metric timestamp (Unix epoch ms)
- `swapRate` (Number) - Swaps per hour
- `demandSurge` (Boolean) - High demand indicator
- `chargerUptime` (Number) - Percentage (0-100)
- `chargerHealth` (String) - "healthy" | "degraded" | "down"
- `chargedBatteries` (Number) - Count of charged batteries
- `unchargedBatteries` (Number) - Count of uncharged batteries
- `errorLogs` (List) - Array of error codes/messages
- `faultPatterns` (List) - Recurring fault identifiers
- `ttl` (Number) - TTL attribute for auto-deletion (30 days)

**Access Patterns:**
1. Write: `PutItem` with stationId + timestamp
2. Read: `Query` by stationId, sorted by timestamp DESC (last N metrics)
3. Rule Engine: `Query` by stationId, filter by timestamp (last 5 minutes)

**GSI:** None required (all queries use PK)

---

## 2. Alerts Table (`ai-ops-alerts`)

**Purpose:** Store generated alerts from rule engine, track approval status

**Key Structure:**
- **Partition Key (PK):** `alertId` (String) - UUID v4
- **Sort Key:** Not used (single item per alert)

**Attributes:**
- `alertId` (String) - Unique alert identifier (UUID)
- `stationId` (String) - Station that triggered alert
- `alertType` (String) - "LOW_INVENTORY" | "CHARGER_DOWN" | "HIGH_DEMAND" | "FAULT_PATTERN"
- `severity` (String) - "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
- `status` (String) - "PENDING" | "APPROVED" | "REJECTED"
- `title` (String) - Alert title
- `description` (String) - Detailed description
- `recommendedAction` (String) - Action suggested by copilot
- `createdAt` (Number) - Unix epoch milliseconds
- `updatedAt` (Number) - Unix epoch milliseconds
- `approvedAt` (Number) - Optional, when approved
- `approvedBy` (String) - Optional, user identifier
- `rejectedAt` (Number) - Optional, when rejected
- `rejectedBy` (String) - Optional, user identifier
- `rejectionReason` (String) - Optional, reason for rejection
- `stepFunctionExecutionArn` (String) - Optional, ARN if Step Functions triggered
- `metadata` (Map) - Additional context (original metrics, thresholds, etc.)

**Access Patterns:**
1. Write: `PutItem` when rule engine creates alert
2. Read All: `Scan` or `Query` on GSI by status
3. Read One: `GetItem` by alertId
4. Update: `UpdateItem` to change status (approve/reject)

**GSI:**
- **GSI-1: StatusIndex**
  - Partition Key: `status` (String)
  - Sort Key: `createdAt` (Number)
  - Purpose: Query alerts by status (PENDING, APPROVED, REJECTED)

---

## 3. Audit/Tasks Table (`ai-ops-audit`)

**Purpose:** Log all actions for audit trail (approvals, rejections, Step Functions executions)

**Key Structure:**
- **Partition Key (PK):** `taskId` (String) - UUID v4
- **Sort Key:** Not used

**Attributes:**
- `taskId` (String) - Unique task identifier (UUID)
- `alertId` (String) - Related alert ID
- `actionType` (String) - "ALERT_CREATED" | "ALERT_APPROVED" | "ALERT_REJECTED" | "STEP_FUNCTION_STARTED" | "SNS_NOTIFICATION_SENT"
- `timestamp` (Number) - Unix epoch milliseconds
- `userId` (String) - User who performed action (or "system")
- `details` (Map) - Action-specific details
  - For APPROVED: `stepFunctionArn`, `snsTopicArn`
  - For REJECTED: `rejectionReason`
  - For STEP_FUNCTION: `executionArn`, `status`
  - For SNS: `messageId`, `topicArn`
- `status` (String) - "SUCCESS" | "FAILED"
- `errorMessage` (String) - Optional, if status is FAILED
- `ttl` (Number) - TTL attribute for auto-deletion (90 days)

**Access Patterns:**
1. Write: `PutItem` for every action
2. Read by Alert: `Query` on GSI by alertId
3. Read by Time: `Query` on GSI by timestamp range
4. Read All: `Scan` (for admin audit view)

**GSI:**
- **GSI-1: AlertIndex**
  - Partition Key: `alertId` (String)
  - Sort Key: `timestamp` (Number)
  - Purpose: Get all actions for a specific alert

- **GSI-2: TimeIndex**
  - Partition Key: `actionType` (String)
  - Sort Key: `timestamp` (Number)
  - Purpose: Query actions by type and time range

---

## Table Summary

| Table | PK | SK | GSI | TTL | Purpose |
|-------|----|----|-----|-----|---------|
| `ai-ops-metrics` | stationId | timestamp | None | 30 days | Store station metrics |
| `ai-ops-alerts` | alertId | - | StatusIndex (status, createdAt) | None | Store and track alerts |
| `ai-ops-audit` | taskId | - | AlertIndex (alertId, timestamp)<br>TimeIndex (actionType, timestamp) | 90 days | Audit log of all actions |

---

## Key Design Decisions

1. **Metrics Table:**
   - Composite key (stationId + timestamp) enables efficient time-range queries per station
   - TTL set to 30 days to auto-clean old metrics
   - No GSI needed as all queries use partition key

2. **Alerts Table:**
   - Simple key (alertId) for direct lookups
   - GSI on status enables efficient filtering of pending/approved/rejected alerts
   - Stores full alert context including metadata

3. **Audit Table:**
   - Separate table for audit trail (compliance and debugging)
   - Two GSIs: one for alert-centric queries, one for time-based queries
   - TTL set to 90 days for retention policy
   - Flexible `details` map for action-specific data
