const { AlertsTable, AuditTable } = require('../../shared/dynamodb');
const { DecisionsTable } = require('../../shared/decisions');

const createResponse = (statusCode, body, headers = {}) => {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      ...headers,
    },
    body: JSON.stringify(body),
  };
};

const getUserId = (event) => {
  return event.requestContext?.authorizer?.userId || 
         event.headers?.['x-user-id'] || 
         'ops-manager';
};

exports.handler = async (event) => {
  console.log('alerts-handler: Received event:', JSON.stringify(event, null, 2));
  
  try {
    const requestContext = event.requestContext || {};
    const http = requestContext.http || {};
    const method = http.method || event.httpMethod || requestContext.httpMethod;
    const path = http.path || event.path || requestContext.path || '';
    
    if (method === 'OPTIONS') {
      return createResponse(200, { message: 'OK' });
    }
    
    if (path.includes('/alerts/decision') && method === 'POST') {
      return await handleDecision(event);
    } else if (path.includes('/alerts') && method === 'GET') {
      return await handleGetAlerts(event);
    } else {
      return createResponse(404, { error: 'Not found' });
    }
  } catch (error) {
    console.error('alerts-handler: Error:', error);
    return createResponse(500, {
      error: 'Internal server error',
      message: error.message,
    });
  }
};

const handleDecision = async (event) => {
  let body;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  } catch (parseError) {
    return createResponse(400, { error: 'Invalid JSON in request body' });
  }
  
  const { alertId, decision, reason } = body;
  
  if (!alertId || typeof alertId !== 'string') {
    return createResponse(400, { error: 'alertId is required and must be a string' });
  }
  
  if (!decision || !['APPROVE', 'REJECT'].includes(decision.toUpperCase())) {
    return createResponse(400, { 
      error: 'decision is required and must be "APPROVE" or "REJECT"' 
    });
  }
  
  const userId = getUserId(event);
  const decisionUpper = decision.toUpperCase();
  const newStatus = decisionUpper === 'APPROVE' ? 'EXECUTED' : 'DISMISSED';
  
  try {
    const alert = await AlertsTable.getAlert(alertId);
    
    if (!alert) {
      return createResponse(404, { error: 'Alert not found' });
    }
    
    if (alert.status !== 'PENDING') {
      return createResponse(400, { 
        error: `Alert is already ${alert.status}. Cannot change decision.` 
      });
    }
    
    const decisionRecord = await DecisionsTable.createDecision({
      alertId,
      decision: decisionUpper,
      userId,
      reason: reason || null,
      metadata: {
        previousStatus: alert.status,
        alertType: alert.alertType,
        severity: alert.severity,
        stationId: alert.stationId,
      },
    });
    
    const updatedAlert = await AlertsTable.updateAlertStatus(
      alertId,
      newStatus,
      userId,
      {
        dismissalReason: decisionUpper === 'REJECT' ? reason : undefined,
        decisionId: decisionRecord.decisionId,
      }
    );
    
    await AuditTable.logAction({
      actionType: decisionUpper === 'APPROVE' ? 'ALERT_APPROVED' : 'ALERT_REJECTED',
      alertId,
      decisionId: decisionRecord.decisionId,
      timestamp: Date.now(),
      status: 'SUCCESS',
      userId,
      details: {
        decision: decisionUpper,
        newStatus,
        reason: reason || null,
      },
    });
    
    return createResponse(200, {
      message: `Alert ${decisionUpper === 'APPROVE' ? 'approved' : 'rejected'} successfully`,
      alert: {
        alertId: updatedAlert.alertId,
        status: updatedAlert.status,
        decisionId: decisionRecord.decisionId,
      },
      decision: decisionRecord,
    });
    
  } catch (error) {
    console.error('alerts-handler: Error processing decision:', error);
    
    await AuditTable.logAction({
      actionType: 'ALERT_DECISION_FAILED',
      alertId,
      timestamp: Date.now(),
      status: 'FAILED',
      userId,
      errorMessage: error.message,
    }).catch(auditError => {
      console.error('alerts-handler: Failed to log audit:', auditError);
    });
    
    return createResponse(500, {
      error: 'Failed to process decision',
      message: error.message,
    });
  }
};

const handleGetAlerts = async (event) => {
  const requestContext = event.requestContext || {};
  const queryParams = event.queryStringParameters || requestContext.queryStringParameters || {};
  const status = queryParams.status || null;
  const limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 50;
  
  try {
    const alerts = await AlertsTable.getAllAlerts(status);
    
    const limitedAlerts = alerts.slice(0, limit);
    
    const alertsWithDecisions = await Promise.all(
      limitedAlerts.map(async (alert) => {
        const decisions = await DecisionsTable.getDecisionsByAlert(alert.alertId);
        return {
          ...alert,
          decisions: decisions.map(d => ({
            decisionId: d.decisionId,
            decision: d.decision,
            status: d.status,
            userId: d.userId,
            timestamp: d.timestamp,
            reason: d.reason,
          })),
        };
      })
    );
    
    return createResponse(200, {
      alerts: alertsWithDecisions,
      count: alertsWithDecisions.length,
      total: alerts.length,
      filters: {
        status: status || 'all',
        limit,
      },
    });
    
  } catch (error) {
    console.error('alerts-handler: Error fetching alerts:', error);
    
    return createResponse(500, {
      error: 'Failed to fetch alerts',
      message: error.message,
    });
  }
};
