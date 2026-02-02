# AI Ops Copilot MVP
LIVE AWS LINK:-http://35.88.110.174:8501

AWS Serverless AI Operations Copilot for Swap Station Operations.

## Architecture

- **Frontend**: React (Vite) - S3 + CloudFront
- **Backend**: AWS Lambda (Node.js 18) - Serverless Framework
- **API**: API Gateway (REST)
- **Database**: DynamoDB
- **Notifications**: SNS
- **Workflow**: Step Functions (future)
- **Hosting**: S3 + CloudFront

## Quick Start

### Prerequisites

1. AWS Account with credentials configured
2. Node.js 18+
3. Serverless Framework

### Installation

```bash
# Install Serverless Framework
npm install -g serverless

# Install dependencies
npm install

# Install Lambda dependencies
cd backend/lambdas/metrics-ingestion && npm install && cd ../..
cd backend/lambdas/alerts-handler && npm install && cd ../..
cd backend/lambdas/rule-engine && npm install && cd ../..
```

### Deployment

```bash
# Deploy to development
npm run deploy:dev

# Deploy to production
npm run deploy:prod
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## Project Structure

```
ai-ops-mvp/
├── serverless.yml              # Serverless Framework config
├── backend/
│   ├── lambdas/
│   │   ├── metrics-ingestion/  # POST /metrics
│   │   ├── alerts-handler/     # GET /alerts, POST /alerts/decision
│   │   └── rule-engine/         # Scheduled rule evaluation
│   └── shared/                 # Shared modules
├── frontend/                   # React dashboard
└── infra/                      # Documentation
```

## API Endpoints

- `POST /metrics` - Ingest station metrics
- `GET /alerts` - Retrieve alerts
- `POST /alerts/decision` - Approve/reject alerts

## Features

- ✅ Real-time metrics ingestion
- ✅ Rule-based alert generation
- ✅ Ops approval workflow
- ✅ SNS notifications
- ✅ React dashboard
- ✅ Auto-refresh alerts
- ✅ Full audit trail

## Documentation

- [Deployment Guide](./DEPLOYMENT.md)
- [API Examples](./infra/api-examples.md)
- [DynamoDB Schema](./infra/dynamodb-schema.md)
- [Frontend Integration](./frontend/INTEGRATION.md)

## License

Copyright © 2025 by Battery Smart. All rights reserved.
