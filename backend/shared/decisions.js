const { docClient, TABLES, AuditTable } = require('./dynamodb');
const { PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const DecisionsTable = {
  async createDecision(decisionData) {
    const decisionId = decisionData.decisionId || require('crypto').randomUUID();
    const timestamp = Date.now();
    
    const item = {
      decisionId,
      alertId: decisionData.alertId,
      decision: decisionData.decision, // 'APPROVE' or 'REJECT'
      status: decisionData.decision === 'APPROVE' ? 'EXECUTED' : 'DISMISSED',
      userId: decisionData.userId || 'ops-manager',
      timestamp,
      reason: decisionData.reason || null,
      metadata: decisionData.metadata || {},
    };
    
    await docClient.send(new PutCommand({
      TableName: TABLES.DECISIONS,
      Item: item,
    }));
    
    await AuditTable.logAction({
      actionType: 'DECISION_CREATED',
      alertId: decisionData.alertId,
      decisionId,
      timestamp,
      status: 'SUCCESS',
      userId: item.userId,
      details: {
        decision: decisionData.decision,
        status: item.status,
        reason: decisionData.reason,
      },
    });
    
    return item;
  },

  async getDecisionsByAlert(alertId) {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLES.DECISIONS,
      IndexName: 'AlertIndex',
      KeyConditionExpression: 'alertId = :alertId',
      ExpressionAttributeValues: {
        ':alertId': alertId,
      },
      ScanIndexForward: false, // Newest first
    }));
    
    return result.Items || [];
  },

  async getDecisionsByUser(userId, limit = 50) {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLES.DECISIONS,
      IndexName: 'UserIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ScanIndexForward: false,
      Limit: limit,
    }));
    
    return result.Items || [];
  },
};

module.exports = {
  DecisionsTable,
};
