const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

// Table names (set via environment variables or CloudFormation)
const TABLES = {
  METRICS: process.env.METRICS_TABLE || 'ai-ops-metrics',
  ALERTS: process.env.ALERTS_TABLE || 'ai-ops-alerts',
  AUDIT: process.env.AUDIT_TABLE || 'ai-ops-audit',
  DECISIONS: process.env.DECISIONS_TABLE || 'ai-ops-decisions',
};

// GSI names
const GSIS = {
  ALERTS_STATUS: 'StatusIndex',
  AUDIT_ALERT: 'AlertIndex',
  AUDIT_TIME: 'TimeIndex',
};

// Metrics Table Operations
const MetricsTable = {
  async putMetric(stationId, timestamp, metricData) {
    const item = {
      stationId,
      timestamp,
      ...metricData,
      ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days TTL
    };
    
    await docClient.send(new PutCommand({
      TableName: TABLES.METRICS,
      Item: item,
    }));
    
    return item;
  },

  async getRecentMetrics(stationId, limit = 10) {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLES.METRICS,
      KeyConditionExpression: 'stationId = :stationId',
      ExpressionAttributeValues: {
        ':stationId': stationId,
      },
      ScanIndexForward: false, // Descending order (newest first)
      Limit: limit,
    }));
    
    return result.Items || [];
  },

  async getMetricsByTimeRange(stationId, startTime, endTime) {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLES.METRICS,
      KeyConditionExpression: 'stationId = :stationId AND #ts BETWEEN :start AND :end',
      ExpressionAttributeNames: {
        '#ts': 'timestamp',
      },
      ExpressionAttributeValues: {
        ':stationId': stationId,
        ':start': startTime,
        ':end': endTime,
      },
      ScanIndexForward: false,
    }));
    
    return result.Items || [];
  },
};

// Alerts Table Operations
const AlertsTable = {
  async createAlert(alertData) {
    const alertId = alertData.alertId || require('crypto').randomUUID();
    const now = Date.now();
    
    const item = {
      alertId,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
      ...alertData,
    };
    
    await docClient.send(new PutCommand({
      TableName: TABLES.ALERTS,
      Item: item,
    }));
    
    return item;
  },

  async getAlert(alertId) {
    const result = await docClient.send(new GetCommand({
      TableName: TABLES.ALERTS,
      Key: { alertId },
    }));
    
    return result.Item || null;
  },

  async getAllAlerts(status = null) {
    if (status) {
      // Query by status using GSI
      const result = await docClient.send(new QueryCommand({
        TableName: TABLES.ALERTS,
        IndexName: GSIS.ALERTS_STATUS,
        KeyConditionExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': status,
        },
        ScanIndexForward: false, // Newest first
      }));
      
      return result.Items || [];
    }
    
    // Scan all alerts (fallback, less efficient)
    const result = await docClient.send(new ScanCommand({
      TableName: TABLES.ALERTS,
    }));
    
    return result.Items || [];
  },

  async updateAlertStatus(alertId, status, userId, additionalData = {}) {
    const now = Date.now();
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    
    updateExpressions.push('#status = :status');
    expressionAttributeNames['#status'] = 'status';
    expressionAttributeValues[':status'] = status;
    
    updateExpressions.push('updatedAt = :updatedAt');
    expressionAttributeValues[':updatedAt'] = now;
    
    if (status === 'EXECUTED') {
      updateExpressions.push('executedAt = :executedAt');
      updateExpressions.push('executedBy = :executedBy');
      expressionAttributeValues[':executedAt'] = now;
      expressionAttributeValues[':executedBy'] = userId;
    } else if (status === 'DISMISSED') {
      updateExpressions.push('dismissedAt = :dismissedAt');
      updateExpressions.push('dismissedBy = :dismissedBy');
      expressionAttributeValues[':dismissedAt'] = now;
      expressionAttributeValues[':dismissedBy'] = userId;
      
      if (additionalData.dismissalReason) {
        updateExpressions.push('dismissalReason = :dismissalReason');
        expressionAttributeValues[':dismissalReason'] = additionalData.dismissalReason;
      }
    }
    
    // Legacy support for APPROVED/REJECTED
    if (status === 'APPROVED') {
      updateExpressions.push('approvedAt = :approvedAt');
      updateExpressions.push('approvedBy = :approvedBy');
      expressionAttributeValues[':approvedAt'] = now;
      expressionAttributeValues[':approvedBy'] = userId;
    } else if (status === 'REJECTED') {
      updateExpressions.push('rejectedAt = :rejectedAt');
      updateExpressions.push('rejectedBy = :rejectedBy');
      expressionAttributeValues[':rejectedAt'] = now;
      expressionAttributeValues[':rejectedBy'] = userId;
      
      if (additionalData.rejectionReason) {
        updateExpressions.push('rejectionReason = :rejectionReason');
        expressionAttributeValues[':rejectionReason'] = additionalData.rejectionReason;
      }
    }
    
    // Add any additional fields
    Object.entries(additionalData).forEach(([key, value]) => {
      if (!['rejectionReason', 'dismissalReason'].includes(key)) {
        updateExpressions.push(`${key} = :${key}`);
        expressionAttributeValues[`:${key}`] = value;
      }
    });
    
    const updateParams = {
      TableName: TABLES.ALERTS,
      Key: { alertId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
    };
    
    // Only include ExpressionAttributeNames if it has values
    if (Object.keys(expressionAttributeNames).length > 0) {
      updateParams.ExpressionAttributeNames = expressionAttributeNames;
    }
    
    await docClient.send(new UpdateCommand(updateParams));
    
    return this.getAlert(alertId);
  },
};

// Audit Table Operations
const AuditTable = {
  async logAction(actionData) {
    const taskId = actionData.taskId || require('crypto').randomUUID();
    const timestamp = actionData.timestamp || Date.now();
    
    const item = {
      taskId,
      timestamp,
      status: actionData.status || 'SUCCESS',
      ...actionData,
      ttl: Math.floor(timestamp / 1000) + (90 * 24 * 60 * 60), // 90 days TTL
    };
    
    await docClient.send(new PutCommand({
      TableName: TABLES.AUDIT,
      Item: item,
    }));
    
    return item;
  },

  async getActionsByAlert(alertId) {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLES.AUDIT,
      IndexName: GSIS.AUDIT_ALERT,
      KeyConditionExpression: 'alertId = :alertId',
      ExpressionAttributeValues: {
        ':alertId': alertId,
      },
      ScanIndexForward: false, // Newest first
    }));
    
    return result.Items || [];
  },

  async getActionsByType(actionType, startTime = null, endTime = null) {
    const keyCondition = 'actionType = :actionType';
    const expressionAttributeValues = {
      ':actionType': actionType,
    };
    
    if (startTime && endTime) {
      keyCondition += ' AND #ts BETWEEN :start AND :end';
      expressionAttributeValues[':start'] = startTime;
      expressionAttributeValues[':end'] = endTime;
    }
    
    const result = await docClient.send(new QueryCommand({
      TableName: TABLES.AUDIT,
      IndexName: GSIS.AUDIT_TIME,
      KeyConditionExpression: keyCondition,
      ExpressionAttributeNames: startTime ? { '#ts': 'timestamp' } : undefined,
      ExpressionAttributeValues,
      ScanIndexForward: false,
    }));
    
    return result.Items || [];
  },
};

module.exports = {
  docClient,
  TABLES,
  GSIS,
  MetricsTable,
  AlertsTable,
  AuditTable,
};
