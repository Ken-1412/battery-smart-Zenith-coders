# Prompt for New Chat Session

Copy and paste this into a new chat to continue working on the AI Ops Copilot MVP:

---

I'm working on an AWS Serverless AI Ops Copilot MVP project. Here's the context:

**Project Structure:**
- Backend: AWS Lambda (Node.js 18) with Serverless Framework
- Frontend: React (Vite) dashboard
- Database: DynamoDB (4 tables: metrics, alerts, audit, decisions)
- Notifications: SNS topic (ops-alerts)
- API: API Gateway REST API

**Current Status:**
- Successfully deployed to AWS (stage: dev)
- API Base URL: https://6ag0l59zmc.execute-api.us-east-1.amazonaws.com/dev
- Endpoints:
  - POST /metrics - Ingest station metrics
  - GET /alerts - Get alerts
  - POST /alerts/decision - Approve/reject alerts

**Architecture:**
- Metrics ingestion Lambda runs rule engine on each metric
- Rule engine evaluates 6 rules (CONGESTION, LOW_INVENTORY, CRITICAL, HARDWARE, DEMAND, OPTIMIZE)
- Alerts created with status PENDING
- Ops manager can approve (EXECUTED) or reject (DISMISSED) via dashboard
- All actions logged to audit table
- SNS notifications sent on alert creation

**Tech Stack:**
- Backend: Node.js 18, AWS SDK v3, Serverless Framework 3.40.0
- Frontend: React 18, Vite, Axios
- Infrastructure: serverless.yml with DynamoDB, SNS, Lambda, API Gateway

**Project Location:** /home/ashu/ai-ops-mvp

**Key Files:**
- `serverless.yml` - Serverless Framework configuration
- `backend/lambdas/metrics-ingestion/index.js` - Metrics ingestion handler
- `backend/lambdas/alerts-handler/index.js` - Alerts API handler
- `backend/lambdas/rule-engine/index.js` - Scheduled rule engine
- `backend/shared/ruleEngine.js` - Rule evaluation logic
- `backend/shared/recommendationService.js` - Recommendation generation
- `frontend/src/components/Dashboard.jsx` - React dashboard

**Deployment:**
- Deployed using: `npx serverless deploy --stage dev`
- All resources created successfully
- API endpoints working

**Current Task:** [Describe what you need help with]

---
