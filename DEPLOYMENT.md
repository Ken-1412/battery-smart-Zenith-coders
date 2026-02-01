# Serverless Deployment Guide

Complete guide for deploying the AI Ops Copilot MVP to AWS using Serverless Framework.

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **Node.js 18+** installed
3. **AWS CLI** configured with credentials
4. **Serverless Framework** installed globally or locally

## Installation

### 1. Install Serverless Framework

```bash
npm install -g serverless
# OR
npm install
```

### 2. Configure AWS Credentials

```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Enter default region (e.g., us-east-1)
# Enter default output format (json)
```

Or set environment variables:
```bash
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_REGION=us-east-1
```

## Project Structure

```
ai-ops-mvp/
├── serverless.yml          # Serverless Framework configuration
├── package.json            # Node.js dependencies
├── backend/
│   ├── lambdas/
│   │   ├── metrics-ingestion/
│   │   ├── alerts-handler/
│   │   └── rule-engine/
│   └── shared/             # Shared modules
└── .serverlessignore       # Files to exclude from deployment
```

## Configuration

### Environment Variables

The `serverless.yml` automatically sets environment variables:
- `AWS_REGION`: AWS region
- `STAGE`: Deployment stage (dev/prod)
- `METRICS_TABLE`: DynamoDB metrics table name
- `ALERTS_TABLE`: DynamoDB alerts table name
- `AUDIT_TABLE`: DynamoDB audit table name
- `DECISIONS_TABLE`: DynamoDB decisions table name
- `SNS_TOPIC_ARN`: SNS topic ARN

### Custom Configuration

Edit `serverless.yml` to customize:
- Region: `--region us-west-2`
- Stage: `--stage prod`
- Memory size: `memorySize: 1024`
- Timeout: `timeout: 60`

## Deployment Steps

### 1. Install Dependencies

```bash
cd backend/lambdas/metrics-ingestion && npm install
cd ../alerts-handler && npm install
cd ../rule-engine && npm install
cd ../../..
```

### 2. Deploy to Development

```bash
npm run deploy:dev
# OR
serverless deploy --stage dev
```

### 3. Deploy to Production

```bash
npm run deploy:prod
# OR
serverless deploy --stage prod
```

### 4. Deploy Specific Function

```bash
serverless deploy function -f metricsIngestion
serverless deploy function -f alertsHandler
serverless deploy function -f ruleEngine
```

## Deployment Output

After deployment, you'll see:

```
Service Information
service: ai-ops-mvp
stage: dev
region: us-east-1
stack: ai-ops-mvp-dev
resources: 15
api keys:
  None
endpoints:
  POST - https://xxxxx.execute-api.us-east-1.amazonaws.com/metrics
  GET - https://xxxxx.execute-api.us-east-1.amazonaws.com/alerts
  POST - https://xxxxx.execute-api.us-east-1.amazonaws.com/alerts/decision
functions:
  metricsIngestion: ai-ops-mvp-dev-metricsIngestion
  alertsHandler: ai-ops-mvp-dev-alertsHandler
  ruleEngine: ai-ops-mvp-dev-ruleEngine
```

## API Endpoints

After deployment, your API endpoints will be:

- **POST /metrics** - Ingest station metrics
- **GET /alerts** - Retrieve alerts
- **POST /alerts/decision** - Approve/reject alerts

Base URL format:
```
https://{api-id}.execute-api.{region}.amazonaws.com
```

## Resources Created

### DynamoDB Tables

1. **ai-ops-metrics-{stage}**
   - Partition Key: `stationId`
   - Sort Key: `timestamp`
   - TTL: 30 days

2. **ai-ops-alerts-{stage}**
   - Partition Key: `alertId`
   - GSI: `StatusIndex` (status, createdAt)

3. **ai-ops-audit-{stage}**
   - Partition Key: `taskId`
   - GSIs: `AlertIndex`, `TimeIndex`
   - TTL: 90 days

4. **ai-ops-decisions-{stage}**
   - Partition Key: `decisionId`
   - GSIs: `AlertIndex`, `UserIndex`

### SNS Topic

- **ops-alerts-{stage}** - For alert notifications

### Lambda Functions

1. **metricsIngestion** - POST /metrics
2. **alertsHandler** - GET /alerts, POST /alerts/decision
3. **ruleEngine** - Scheduled (every 5 minutes)

## Testing Deployment

### 1. Test Metrics Ingestion

```bash
curl -X POST https://{api-id}.execute-api.us-east-1.amazonaws.com/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "stationId": "STATION_001",
    "queue": 15,
    "chargedBatteries": 5,
    "swapRate": 45
  }'
```

### 2. Test Get Alerts

```bash
curl https://{api-id}.execute-api.us-east-1.amazonaws.com/alerts
```

### 3. Test Decision

```bash
curl -X POST https://{api-id}.execute-api.us-east-1.amazonaws.com/alerts/decision \
  -H "Content-Type: application/json" \
  -d '{
    "alertId": "550e8400-e29b-41d4-a716-446655440000",
    "decision": "APPROVE"
  }'
```

## Monitoring

### View Logs

```bash
# All functions
serverless logs -f metricsIngestion --tail
serverless logs -f alertsHandler --tail
serverless logs -f ruleEngine --tail

# Specific time range
serverless logs -f metricsIngestion --startTime 1h
```

### CloudWatch Metrics

- Lambda invocations
- Lambda errors
- Lambda duration
- API Gateway requests
- DynamoDB read/write capacity

## Updating Frontend

After deployment, update frontend API URL:

```bash
# .env file
VITE_API_URL=https://{api-id}.execute-api.us-east-1.amazonaws.com
```

## Troubleshooting

### Deployment Fails

1. Check AWS credentials: `aws sts get-caller-identity`
2. Verify IAM permissions
3. Check CloudFormation stack: `aws cloudformation describe-stacks`
4. Review logs: `serverless logs -f {functionName}`

### API Gateway CORS Issues

CORS is configured in `serverless.yml`. If issues persist:
1. Check `httpApi.cors` configuration
2. Verify frontend origin matches allowed origins
3. Check browser console for CORS errors

### Lambda Timeout

Increase timeout in `serverless.yml`:
```yaml
provider:
  timeout: 60  # seconds
```

### DynamoDB Errors

1. Verify table names match environment variables
2. Check IAM permissions
3. Verify table exists: `aws dynamodb list-tables`

## Cleanup

### Remove All Resources

```bash
npm run remove
# OR
serverless remove --stage dev
```

**Warning:** This deletes all resources including DynamoDB tables and data!

### Remove Specific Stage

```bash
serverless remove --stage prod
```

## Cost Optimization

### Development

- Use `PAY_PER_REQUEST` billing mode (already configured)
- Disable rule engine: `enabled: false` in schedule event
- Use smaller memory: `memorySize: 256`

### Production

- Monitor DynamoDB usage
- Set up CloudWatch alarms
- Use reserved capacity for high-traffic tables
- Enable DynamoDB auto-scaling if needed

## Security

### IAM Roles

Each Lambda has minimal required permissions:
- DynamoDB: Only required tables and operations
- SNS: Only publish to ops-alerts topic
- Step Functions: Only start execution

### API Gateway

- CORS configured for frontend
- No authentication (MVP - add later)
- Consider API keys for production

## Next Steps

1. Add authentication (Cognito)
2. Set up CloudWatch alarms
3. Configure custom domain
4. Add API Gateway throttling
5. Set up CI/CD pipeline

## Useful Commands

```bash
# Deploy
serverless deploy

# Deploy specific function
serverless deploy function -f metricsIngestion

# View logs
serverless logs -f metricsIngestion --tail

# Invoke function locally
serverless invoke local -f metricsIngestion -d '{"body": "{}"}'

# Remove all resources
serverless remove

# Get service info
serverless info
```
