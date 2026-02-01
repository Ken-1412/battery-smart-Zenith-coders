# AWS SNS Setup for Alerts

## Overview

SNS topic `ops-alerts` is used to publish structured JSON notifications when new alerts are created. This enables real-time alerting via email, SMS, or other SNS subscribers.

## SNS Topic Configuration

### Topic Name
- **Topic Name:** `ops-alerts`
- **Display Name:** `AI Ops Alerts`
- **Type:** Standard (for MVP)

### Message Format

Messages are published as structured JSON with the following format:

```json
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
  "metadata": {
    "avgQueue": "15.5",
    "maxQueue": 18,
    "threshold": 12,
    "cycles": 2,
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
    "recommendation": {
      "stationId": "STATION_001",
      "flags": {
        "CONGESTION": true
      },
      "primaryAction": "REROUTE",
      "humanReadable": "Reroute drivers from STATION_001 to nearby low-load stations. Queue length: 15.5.",
      "actions": [
        {
          "type": "REROUTE",
          "description": "Reroute drivers to nearby low-load stations",
          "details": {
            "reason": "High queue congestion",
            "currentQueue": 15.5,
            "targetStations": ["AUTO_DETECT"],
            "estimatedRelief": "20-40% queue reduction"
          }
        }
      ]
    },
    "primaryAction": "REROUTE"
  },
  "recommendation": {
    "stationId": "STATION_001",
    "flags": {
      "CONGESTION": true
    },
    "primaryAction": "REROUTE",
    "humanReadable": "Reroute drivers from STATION_001 to nearby low-load stations. Queue length: 15.5.",
    "actions": [...]
  },
  "primaryAction": "REROUTE"
}
```

### Message Attributes

SNS message attributes are included for filtering:

- `alertType`: String (e.g., "CONGESTION", "LOW_INVENTORY", "CRITICAL")
- `severity`: String (e.g., "LOW", "MEDIUM", "HIGH", "CRITICAL")
- `stationId`: String (e.g., "STATION_001")

### Subject Line Format

```
[SEVERITY] ALERT_TYPE Alert: STATION_ID
```

Example:
```
[MEDIUM] CONGESTION Alert: STATION_001
[CRITICAL] CRITICAL Alert: STATION_004
```

---

## CloudFormation/SAM Template

Add to your `template.yaml`:

```yaml
Resources:
  OpsAlertsTopic:
    Type: AWS::SNS::Topic
    Properties:
      TopicName: ops-alerts
      DisplayName: AI Ops Alerts
      Tags:
        - Key: Project
          Value: ai-ops-mvp
        - Key: Environment
          Value: production

  MetricsIngestionFunction:
    Type: AWS::Serverless::Function
    Properties:
      # ... existing properties ...
      Environment:
        Variables:
          SNS_TOPIC_ARN: !Ref OpsAlertsTopic
      Policies:
        - SNSPublishMessage:
            TopicName: !GetAtt OpsAlertsTopic.TopicName

Outputs:
  OpsAlertsTopicArn:
    Description: ARN of the ops-alerts SNS topic
    Value: !Ref OpsAlertsTopic
    Export:
      Name: OpsAlertsTopicArn
```

---

## IAM Policy

### Lambda Execution Role Policy

Add this policy to your Lambda execution role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sns:Publish"
      ],
      "Resource": "arn:aws:sns:*:*:ops-alerts"
    }
  ]
}
```

### Full IAM Policy (for reference)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SNSPublishAlerts",
      "Effect": "Allow",
      "Action": [
        "sns:Publish"
      ],
      "Resource": "arn:aws:sns:REGION:ACCOUNT_ID:ops-alerts"
    }
  ]
}
```

Replace:
- `REGION`: Your AWS region (e.g., `us-east-1`)
- `ACCOUNT_ID`: Your AWS account ID

---

## Manual Setup (AWS Console)

### 1. Create SNS Topic

1. Go to AWS SNS Console
2. Click "Create topic"
3. Choose "Standard" type
4. Topic name: `ops-alerts`
5. Display name: `AI Ops Alerts`
6. Click "Create topic"

### 2. Get Topic ARN

After creation, copy the Topic ARN:
```
arn:aws:sns:us-east-1:123456789012:ops-alerts
```

### 3. Subscribe to Topic (Optional)

To receive email notifications:

1. Click on the topic
2. Click "Create subscription"
3. Protocol: Email
4. Endpoint: your-email@example.com
5. Click "Create subscription"
6. Confirm subscription via email

### 4. Update Lambda Environment Variable

Add environment variable to your Lambda function:
- Key: `SNS_TOPIC_ARN`
- Value: `arn:aws:sns:us-east-1:123456789012:ops-alerts`

### 5. Update Lambda IAM Role

Add SNS publish permission to Lambda execution role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sns:Publish",
      "Resource": "arn:aws:sns:us-east-1:123456789012:ops-alerts"
    }
  ]
}
```

---

## Testing

### Test SNS Publishing

1. Send a test metric that triggers an alert:
```bash
curl -X POST https://your-api.execute-api.us-east-1.amazonaws.com/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "stationId": "STATION_001",
    "queue": 15,
    "chargedBatteries": 5
  }'
```

2. Check SNS console for published message
3. Check subscriber (email/SMS) for notification

### Verify Message Format

Check CloudWatch Logs for the Lambda function to see:
```
metrics-ingestion: Published alert 550e8400-... to SNS: abc123-def456-...
```

---

## Integration Points

### Metrics Ingestion Lambda

The Lambda automatically publishes to SNS when:
1. Alert is created
2. Alert status is PENDING
3. SNS_TOPIC_ARN environment variable is set

### Error Handling

- If SNS publish fails, error is logged but alert creation continues
- Audit log entry is created for both success and failure
- No retry logic (for MVP simplicity)

---

## Subscriber Examples

### Email Subscription
- Protocol: Email
- Endpoint: ops-team@example.com

### SMS Subscription
- Protocol: SMS
- Endpoint: +1234567890

### Lambda Subscription (for further processing)
- Protocol: Lambda
- Endpoint: arn:aws:lambda:us-east-1:123456789012:function:alert-processor

### SQS Subscription (for queuing)
- Protocol: SQS
- Endpoint: arn:aws:sqs:us-east-1:123456789012:alert-queue

---

## Cost Considerations

- Standard SNS: $0.50 per 1 million requests
- First 1 million requests per month: Free
- Data transfer: Standard AWS data transfer rates

For MVP, costs should be minimal (< $1/month for typical usage).
