# AI Ops Copilot MVP - Complete System Documentation

## System Overview

AI Ops Copilot is a serverless AWS-based system that monitors battery swap station operations in real-time, evaluates metrics against predefined rules, generates actionable alerts, and provides an operations dashboard for managing these alerts.

### Core Functionality

1. **Metrics Ingestion**: Receives real-time station metrics via REST API
2. **Rule Engine**: Evaluates metrics against 6 business rules to detect issues
3. **Alert Generation**: Creates alerts with severity levels and recommendations
4. **Ops Dashboard**: React-based UI for viewing and managing alerts
5. **Approval Workflow**: Ops managers can approve or reject alerts
6. **Notifications**: SNS integration for alert notifications
7. **Audit Trail**: Complete logging of all actions

---

## System Architecture

### AWS Services Used

- **API Gateway (REST)**: Exposes REST endpoints
- **Lambda Functions**: Serverless compute (Node.js 18)
- **DynamoDB**: NoSQL database for metrics, alerts, decisions, and audit logs
- **SNS**: Notification service for alert distribution
- **S3**: Static website hosting for React frontend
- **Serverless Framework**: Infrastructure as Code

### Lambda Functions

1. **metricsIngestion** (`POST /metrics`)
   - Receives station metrics
   - Validates input
   - Stores in DynamoDB
   - Runs rule engine
   - Creates alerts if rules trigger
   - Publishes to SNS

2. **alertsHandler** (`GET /alerts`, `POST /alerts/decision`)
   - Retrieves alerts with filtering
   - Processes approve/reject decisions
   - Updates alert status
   - Logs decisions

3. **ruleEngine** (Scheduled: every 5 minutes)
   - Scans active stations
   - Evaluates metrics against rules
   - Creates alerts for triggered rules
   - Prevents duplicate alerts

---

## Complete Data Flow

### 1. Metrics Ingestion Flow

```
Station → POST /metrics → API Gateway → metricsIngestion Lambda
  ↓
Validate Input
  ↓
Store in DynamoDB (Metrics Table)
  ↓
Fetch Last Hour of Metrics for Station
  ↓
Run Rule Engine (evaluateAllRules)
  ↓
If Rules Triggered:
  - Check for Duplicate Active Alerts
  - Generate Recommendation
  - Create Alert in DynamoDB (Status: PENDING)
  - Publish to SNS Topic
  - Log to Audit Table
  ↓
Return Response with Created Alerts
```

### 2. Alert Approval Flow

```
Ops Manager → Dashboard → GET /alerts
  ↓
View PENDING Alerts
  ↓
Click Approve/Reject → POST /alerts/decision
  ↓
alertsHandler Lambda:
  - Validate Request
  - Check Alert Status (must be PENDING)
  - Create Decision Record
  - Update Alert Status:
    * APPROVE → EXECUTED
    * REJECT → DISMISSED
  - Log to Audit Table
  ↓
Return Updated Alert
```

### 3. Scheduled Rule Engine Flow

```
EventBridge (Every 5 minutes) → ruleEngine Lambda
  ↓
Scan Metrics Table for Active Stations (last 5 min)
  ↓
For Each Station:
  - Fetch Last Hour of Metrics
  - Run Rule Engine
  - Check for Duplicate Active Alerts
  - Create New Alerts if Needed
  - Log Results
  ↓
Return Summary
```

---

## API Endpoints

### Base URL
```
https://6ag0l59zmc.execute-api.us-east-1.amazonaws.com/dev
```

### 1. POST /metrics

**Purpose**: Ingest station metrics and trigger rule evaluation

**Request Body**:
```json
{
  "stationId": "STATION_001",
  "timestamp": 1704067200000,
  "swapRate": 25,
  "queue": 15,
  "demandSurge": false,
  "chargerUptime": 95,
  "chargerHealth": "healthy",
  "chargedBatteries": 10,
  "unchargedBatteries": 3,
  "errorLogs": [],
  "faultPatterns": [],
  "maxCapacity": 100
}
```

**Required Fields**:
- `stationId` (string)

**Optional Fields**:
- `timestamp` (number) - Unix epoch milliseconds (defaults to current time)
- `swapRate` (number) - Swaps per hour
- `queue` (number) - Current queue length
- `demandSurge` (boolean) - High demand indicator
- `chargerUptime` (number) - Percentage 0-100
- `chargerHealth` (string) - "healthy" | "degraded" | "down"
- `chargedBatteries` (number) - Count of charged batteries
- `unchargedBatteries` (number) - Count of uncharged batteries
- `errorLogs` (array) - Error codes/messages
- `faultPatterns` (array) - Recurring fault identifiers
- `maxCapacity` (number) - Maximum station capacity

**Response (201)**:
```json
{
  "message": "Metric ingested successfully",
  "metric": {
    "stationId": "STATION_001",
    "timestamp": 1704067200000
  },
  "alertsCreated": 1,
  "alerts": [
    {
      "alertId": "550e8400-e29b-41d4-a716-446655440000",
      "alertType": "CONGESTION",
      "severity": "MEDIUM",
      "title": "Queue Congestion Detected",
      "recommendedAction": "Reroute drivers from STATION_001 to nearby low-load stations. Queue length: 15.5."
    }
  ]
}
```

**Error Responses**:
- `400`: Validation error (missing/invalid fields)
- `500`: Internal server error

---

### 2. GET /alerts

**Purpose**: Retrieve alerts with optional filtering

**Query Parameters**:
- `status` (optional): Filter by status - `PENDING`, `EXECUTED`, `DISMISSED`
- `limit` (optional): Maximum alerts to return (default: 50)

**Example Request**:
```
GET /alerts?status=PENDING&limit=20
```

**Response (200)**:
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
        "ruleEvaluation": {
          "flags": {
            "CONGESTION": true,
            "LOW_INVENTORY": false,
            "CRITICAL": false,
            "HARDWARE": false,
            "DEMAND": false,
            "OPTIMIZE": false
          },
          "maxSeverity": "MEDIUM"
        },
        "recommendation": { ... }
      },
      "decisions": []
    }
  ],
  "count": 1,
  "total": 1,
  "filters": {
    "status": "PENDING",
    "limit": 20
  }
}
```

---

### 3. POST /alerts/decision

**Purpose**: Approve or reject an alert

**Request Body**:
```json
{
  "alertId": "550e8400-e29b-41d4-a716-446655440000",
  "decision": "APPROVE",
  "reason": "Optional reason for decision"
}
```

**Fields**:
- `alertId` (required, string): Alert ID to make decision on
- `decision` (required, string): `"APPROVE"` or `"REJECT"`
- `reason` (optional, string): Reason for the decision

**Response (200) - Approve**:
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

**Response (200) - Reject**:
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
    "decision": "REJECT",
    "status": "DISMISSED",
    "reason": "False alarm - queue cleared quickly",
    ...
  }
}
```

**Error Responses**:
- `400`: Missing/invalid fields, alert already processed
- `404`: Alert not found
- `500`: Internal server error

---

## Rule Engine - Detailed Logic

The system evaluates metrics against 6 business rules:

### Rule 1: CONGESTION (R1)

**Trigger Condition**:
- Queue length > 12 for 2 consecutive metric cycles

**Severity**:
- `MEDIUM`: Queue 12-20
- `HIGH`: Queue > 20

**Alert Details**:
- Type: `CONGESTION`
- Title: "Queue Congestion Detected"
- Description: Includes average queue and threshold
- Recommendation: Reroute drivers to nearby low-load stations

**Metadata Stored**:
- `avgQueue`: Average queue length
- `maxQueue`: Maximum queue length
- `threshold`: 12
- `cycles`: Number of consecutive cycles

---

### Rule 2: LOW_INVENTORY (R2)

**Trigger Condition**:
- Charged batteries < 8

**Severity**:
- `CRITICAL`: 0 charged batteries
- `HIGH`: 1-2 charged batteries
- `MEDIUM`: 3-7 charged batteries

**Alert Details**:
- Type: `LOW_INVENTORY`
- Title: "Low Inventory Alert"
- Description: Current inventory vs threshold
- Recommendation: Transfer charged batteries from nearby stations

**Metadata Stored**:
- `chargedBatteries`: Current count
- `unchargedBatteries`: Count
- `totalBatteries`: Sum
- `threshold`: 8

---

### Rule 3: CRITICAL (R3)

**Trigger Condition**:
- Both R1 (CONGESTION) AND R2 (LOW_INVENTORY) triggered simultaneously

**Severity**:
- `CRITICAL` (always)

**Alert Details**:
- Type: `CRITICAL`
- Title: "Critical Station Condition"
- Description: Multiple critical issues detected
- Recommendation: Combined actions (reroute + transfer + maintenance + escalate)

**Priority**: Highest (1) - Supersedes individual CONGESTION and LOW_INVENTORY alerts

**Metadata Stored**:
- `congestion`: R1 metadata
- `inventory`: R2 metadata

---

### Rule 4: HARDWARE (R4)

**Trigger Condition**:
- ≥3 faults in last 30 minutes (from `faultPatterns` or `errorLogs`)

**Severity**:
- `MEDIUM`: 3-4 faults
- `HIGH`: ≥5 faults

**Alert Details**:
- Type: `HARDWARE`
- Title: "Hardware Fault Pattern Detected"
- Description: Total faults in time window
- Recommendation: Raise maintenance tickets with root cause

**Metadata Stored**:
- `totalFaults`: Count of all faults
- `faultCounts`: Breakdown by fault type
- `recurringFaults`: Faults appearing ≥2 times
- `timeWindowMinutes`: 30

---

### Rule 5: DEMAND (R5)

**Trigger Condition**:
- Current swap rate ≥ 1.5x baseline (calculated from last 60 minutes)

**Severity**:
- `MEDIUM`: 50-100% increase
- `HIGH`: >100% increase

**Alert Details**:
- Type: `DEMAND`
- Title: "Demand Spike Detected"
- Description: Current rate vs baseline with percentage increase
- Recommendation: Reroute drivers to nearby low-load stations

**Metadata Stored**:
- `currentSwapRate`: Current rate
- `baselineSwapRate`: Average from last hour
- `spikePercentage`: Percentage increase
- `multiplier`: 1.5

---

### Rule 6: OPTIMIZE (R6)

**Trigger Condition**:
- Average utilization < 20% over last 60 minutes
- Utilization = (avg swap rate) / max capacity

**Severity**:
- `LOW` (always)

**Alert Details**:
- Type: `OPTIMIZE`
- Title: "Underutilized Station"
- Description: Utilization percentage and average swap rate
- Recommendation: Consider rebalancing inventory or adjusting capacity

**Metadata Stored**:
- `utilization`: Calculated utilization (0-1)
- `avgSwapRate`: Average from last hour
- `maxCapacity`: Station capacity
- `threshold`: 0.2 (20%)

---

## Rule Evaluation Logic

### Evaluation Process

1. **Fetch Metrics**: Get last hour of metrics for station
2. **Evaluate Each Rule**: Run R1-R6 sequentially
3. **Set Flags**: Mark which rules triggered
4. **Determine Priority**:
   - CRITICAL (R3) = Priority 1
   - CONGESTION/LOW_INVENTORY = Priority 2
   - HARDWARE/DEMAND = Priority 3
   - OPTIMIZE = Priority 4
5. **Check Duplicates**: Skip if active alert of same type exists
6. **Create Alerts**: Create alerts in priority order

### Duplicate Prevention

- Before creating alert, system checks for existing `PENDING` alert of same `alertType` for same `stationId`
- If duplicate exists, alert is skipped
- This prevents alert spam from repeated rule triggers

### Severity Calculation

- Each rule assigns severity based on thresholds
- `maxSeverity` is highest severity from all triggered rules
- Severity order: `CRITICAL` > `HIGH` > `MEDIUM` > `LOW`

---

## Recommendation System

When an alert is created, the system generates actionable recommendations based on triggered rules.

### Recommendation Types

1. **REROUTE**: Redirect drivers to other stations
2. **TRANSFER**: Move batteries between stations
3. **MAINTENANCE**: Schedule hardware maintenance
4. **ESCALATE**: Escalate to operations manager
5. **OPTIMIZE**: Rebalance inventory/capacity

### Recommendation Logic

- **CRITICAL**: Combines all actions (reroute + transfer + maintenance + escalate)
- **CONGESTION + OPTIMIZE**: Reroute to underutilized stations
- **CONGESTION**: Reroute to low-load stations
- **LOW_INVENTORY**: Transfer batteries from nearby stations
- **HARDWARE**: Schedule maintenance with fault details
- **DEMAND**: Reroute to handle spike
- **OPTIMIZE**: Rebalance inventory

### Recommendation Format

Each recommendation includes:
- **Human-readable text**: Plain English description
- **Primary action**: Main action type
- **Structured JSON**: Detailed action plan with:
  - Action type
  - Description
  - Details (reason, quantities, target stations, urgency, etc.)

---

## Database Schema

### 1. Metrics Table (`ai-ops-metrics-{stage}`)

**Purpose**: Store real-time station metrics

**Key Structure**:
- Partition Key: `stationId` (String)
- Sort Key: `timestamp` (Number)

**Attributes**:
- All metric fields from API request
- `ttl`: Auto-delete after 30 days

**Access Pattern**: Query by stationId, sorted by timestamp DESC

---

### 2. Alerts Table (`ai-ops-alerts-{stage}`)

**Purpose**: Store generated alerts and track status

**Key Structure**:
- Partition Key: `alertId` (String, UUID)

**Attributes**:
- `alertId`, `stationId`, `alertType`, `severity`, `status`
- `title`, `description`, `recommendedAction`
- `createdAt`, `updatedAt`
- `executedAt`, `executedBy` (if approved)
- `dismissedAt`, `dismissedBy`, `dismissalReason` (if rejected)
- `decisionId`: Reference to decision record
- `metadata`: Rule evaluation details, recommendations

**Status Values**:
- `PENDING`: Awaiting decision
- `EXECUTED`: Approved
- `DISMISSED`: Rejected

**GSI**: `StatusIndex` (status, createdAt) - Query alerts by status

---

### 3. Decisions Table (`ai-ops-decisions-{stage}`)

**Purpose**: Track ops manager decisions

**Key Structure**:
- Partition Key: `decisionId` (String, UUID)

**Attributes**:
- `decisionId`, `alertId`, `decision` ("APPROVE" | "REJECT")
- `status` ("EXECUTED" | "DISMISSED")
- `userId`, `timestamp`, `reason`
- `metadata`: Previous status, alert details

**GSIs**:
- `AlertIndex` (alertId, timestamp) - Get decisions for alert
- `UserIndex` (userId, timestamp) - Get decisions by user

---

### 4. Audit Table (`ai-ops-audit-{stage}`)

**Purpose**: Complete audit trail of all actions

**Key Structure**:
- Partition Key: `taskId` (String, UUID)

**Attributes**:
- `taskId`, `alertId`, `actionType`, `timestamp`
- `userId`, `status` ("SUCCESS" | "FAILED")
- `details`: Action-specific data
- `errorMessage`: If failed
- `ttl`: Auto-delete after 90 days

**Action Types**:
- `ALERT_CREATED`
- `ALERT_APPROVED`
- `ALERT_REJECTED`
- `ALERT_DECISION_FAILED`
- `SNS_NOTIFICATION_SENT`
- `RULE_ENGINE_EXECUTION`
- `DECISION_CREATED`

**GSIs**:
- `AlertIndex` (alertId, timestamp) - Get audit trail for alert
- `TimeIndex` (actionType, timestamp) - Query by action type

---

## Frontend Dashboard

### Technology Stack

- **React 18** with Vite
- **Axios** for API calls
- **CSS** for styling (no heavy UI library)

### Features

1. **Alert List View**
   - Displays all alerts with severity badges
   - Status filtering (All, PENDING, EXECUTED, DISMISSED)
   - Severity color coding:
     - CRITICAL: Red
     - HIGH: Orange
     - MEDIUM: Yellow
     - LOW: Blue

2. **Alert Detail Modal**
   - Full alert information
   - Rule evaluation details
   - Recommendation details
   - Decision history
   - Approve/Reject buttons

3. **Auto-Refresh**
   - Fetches alerts every 10 seconds
   - Shows refresh indicator
   - Maintains filter state

4. **Decision Making**
   - Approve button: Sets status to EXECUTED
   - Reject button: Opens form for rejection reason, sets status to DISMISSED
   - Loading states during API calls
   - Error handling with user feedback

5. **Responsive Design**
   - Works on desktop and mobile
   - Clean, minimal UI

### Frontend URL

```
http://ai-ops-frontend-dev.s3-website-us-east-1.amazonaws.com
```

### API Configuration

Frontend configured to use:
```
https://6ag0l59zmc.execute-api.us-east-1.amazonaws.com/dev
```

---

## SNS Notifications

### Topic

- **Name**: `ops-alerts-{stage}`
- **Type**: Standard SNS topic

### Message Format

When alert is created, SNS message includes:
- Alert ID, station ID, alert type, severity
- Title, description, recommended action
- Full metadata including rule evaluation
- Timestamp

### Message Attributes

- `alertType`: Alert type string
- `severity`: Severity level
- `stationId`: Station identifier

### Subscription

Currently configured but not subscribed. To receive notifications:
1. Subscribe email addresses to SNS topic
2. Confirm subscription via email
3. Receive notifications when alerts are created

---

## Deployment Information

### Backend Deployment

**Stack Name**: `ai-ops-mvp-dev`

**Region**: `us-east-1`

**API Gateway URL**: 
```
https://6ag0l59zmc.execute-api.us-east-1.amazonaws.com/dev
```

**Deploy Command**:
```bash
npx serverless deploy --stage dev
```

### Frontend Deployment

**S3 Bucket**: `ai-ops-frontend-dev`

**Website URL**:
```
http://ai-ops-frontend-dev.s3-website-us-east-1.amazonaws.com
```

**Deploy Command**:
```bash
./deploy-frontend.sh dev
```

### Environment Variables

All Lambda functions have access to:
- `METRICS_TABLE`: `ai-ops-metrics-dev`
- `ALERTS_TABLE`: `ai-ops-alerts-dev`
- `AUDIT_TABLE`: `ai-ops-audit-dev`
- `DECISIONS_TABLE`: `ai-ops-decisions-dev`
- `SNS_TOPIC_ARN`: ARN of ops-alerts topic
- `STAGE`: `dev`

---

## Key System Behaviors

### 1. Alert Creation

- Alerts are created with status `PENDING`
- Duplicate prevention: Only one active alert per alert type per station
- Recommendations are generated automatically
- SNS notification is sent (if topic is subscribed)
- Audit log entry is created

### 2. Alert Status Flow

```
PENDING → [APPROVE] → EXECUTED
       → [REJECT]  → DISMISSED
```

- Once `EXECUTED` or `DISMISSED`, status cannot be changed
- Each status change is logged in Audit table

### 3. Rule Engine Execution

- Runs every 5 minutes via EventBridge schedule
- Processes all stations with metrics in last 5 minutes
- Evaluates rules against last hour of metrics
- Creates alerts if rules trigger (with duplicate check)
- Logs execution summary to Audit table

### 4. Data Retention

- **Metrics**: Auto-deleted after 30 days (TTL)
- **Audit Logs**: Auto-deleted after 90 days (TTL)
- **Alerts**: Retained indefinitely
- **Decisions**: Retained indefinitely

### 5. Error Handling

- Validation errors return `400` with details
- Database errors return `500` with message
- SNS publish failures are logged but don't block alert creation
- All errors are logged to CloudWatch

---

## Testing the System

### 1. Create Test Alert

```bash
curl -X POST https://6ag0l59zmc.execute-api.us-east-1.amazonaws.com/dev/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "stationId": "STATION_TEST",
    "queue": 15,
    "chargedBatteries": 5,
    "swapRate": 30
  }'
```

This should trigger a `LOW_INVENTORY` alert (chargedBatteries < 8).

### 2. View Alerts

```bash
curl https://6ag0l59zmc.execute-api.us-east-1.amazonaws.com/dev/alerts?status=PENDING
```

### 3. Approve Alert

```bash
curl -X POST https://6ag0l59zmc.execute-api.us-east-1.amazonaws.com/dev/alerts/decision \
  -H "Content-Type: application/json" \
  -d '{
    "alertId": "YOUR_ALERT_ID",
    "decision": "APPROVE"
  }'
```

### 4. Test Script

Use `test-alerts.sh` to simulate various alert scenarios:
```bash
./test-alerts.sh
```

---

## System Limitations (MVP)

1. **No Authentication**: Single ops user, no auth required
2. **No Step Functions**: Approval doesn't trigger workflows (IAM permissions exist but not implemented)
3. **No SNS on Approval**: SNS only sent on alert creation, not approval
4. **Simple Duplicate Prevention**: Only checks for same alert type, not similar alerts
5. **No Alert Escalation**: No automatic escalation for unhandled alerts
6. **No Custom Rules**: Rules are hardcoded, not configurable
7. **No Historical Analytics**: No dashboard for trends/analytics
8. **HTTP Only**: Frontend uses HTTP, not HTTPS (CloudFront not configured)

---

## Key Metrics and Monitoring

### CloudWatch Logs

View logs for each Lambda:
```bash
npx serverless logs -f metricsIngestion --tail
npx serverless logs -f alertsHandler --tail
npx serverless logs -f ruleEngine --tail
```

### Important Log Messages

- `metrics-ingestion: Published alert {alertId} to SNS: {messageId}`
- `alerts-handler: Alert {alertId} {approved/rejected} successfully`
- `rule-engine: Created {alertType} alert {alertId} for {stationId}`

### DynamoDB Metrics

Monitor via AWS Console:
- Read/Write capacity
- Throttling events
- Item counts

---

## Summary

This system provides:

1. **Real-time Monitoring**: Continuous ingestion of station metrics
2. **Intelligent Alerting**: Rule-based detection of operational issues
3. **Actionable Recommendations**: AI-generated suggestions for each alert
4. **Operations Dashboard**: React UI for managing alerts
5. **Approval Workflow**: Ops managers can approve/reject alerts
6. **Complete Audit Trail**: All actions logged for compliance
7. **Scalable Architecture**: Serverless, auto-scaling AWS services

The system is production-ready for MVP use, with clear paths for enhancement (authentication, Step Functions, analytics, etc.).
