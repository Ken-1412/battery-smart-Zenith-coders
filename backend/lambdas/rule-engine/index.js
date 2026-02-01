const { MetricsTable, AlertsTable, AuditTable, docClient, TABLES } = require('../../shared/dynamodb');
const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { evaluateAllRules } = require('../../shared/ruleEngine');

const getActiveStations = async () => {
  const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
  const result = await docClient.send(new ScanCommand({
    TableName: TABLES.METRICS,
    FilterExpression: '#ts > :fiveMinutesAgo',
    ExpressionAttributeNames: {
      '#ts': 'timestamp',
    },
    ExpressionAttributeValues: {
      ':fiveMinutesAgo': fiveMinutesAgo,
    },
  }));
  
  const stationIds = [...new Set((result.Items || []).map(item => item.stationId))];
  return stationIds;
};

const hasActiveAlert = async (stationId, alertType) => {
  const pendingAlerts = await AlertsTable.getAllAlerts('PENDING');
  
  return pendingAlerts.some(alert => 
    alert.stationId === stationId && 
    alert.alertType === alertType &&
    alert.status === 'PENDING'
  );
};

const processStation = async (stationId) => {
  const results = {
    stationId,
    alertsCreated: [],
    alertsSkipped: [],
    flags: {},
  };
  
  try {
    const fiveMinutesAgo = Date.now() - (60 * 60 * 1000);
    const now = Date.now();
    const metrics = await MetricsTable.getMetricsByTimeRange(stationId, fiveMinutesAgo, now);
    
    if (metrics.length === 0) {
      console.log(`rule-engine: No recent metrics for station ${stationId}`);
      return results;
    }
    
    const evaluationResult = evaluateAllRules(metrics);
    results.flags = evaluationResult.flags;
    
    console.log(`rule-engine: Evaluation for ${stationId}:`, {
      flags: evaluationResult.flags,
      triggeredCount: evaluationResult.triggeredAlerts.length,
      maxSeverity: evaluationResult.maxSeverity,
    });
    
    if (evaluationResult.triggeredAlerts.length === 0) {
      return results;
    }
    
    const alertsToCreate = [];
    
    if (evaluationResult.flags.CRITICAL) {
      const criticalAlert = evaluationResult.rules.R3;
      alertsToCreate.push({
        alertType: 'CRITICAL',
        alert: criticalAlert,
        priority: 1,
      });
    } else {
      if (evaluationResult.flags.CONGESTION) {
        alertsToCreate.push({
          alertType: 'CONGESTION',
          alert: evaluationResult.rules.R1,
          priority: 2,
        });
      }
      
      if (evaluationResult.flags.LOW_INVENTORY) {
        alertsToCreate.push({
          alertType: 'LOW_INVENTORY',
          alert: evaluationResult.rules.R2,
          priority: 2,
        });
      }
    }
    
    if (evaluationResult.flags.HARDWARE) {
      alertsToCreate.push({
        alertType: 'HARDWARE',
        alert: evaluationResult.rules.R4,
        priority: 3,
      });
    }
    
    if (evaluationResult.flags.DEMAND) {
      alertsToCreate.push({
        alertType: 'DEMAND',
        alert: evaluationResult.rules.R5,
        priority: 3,
      });
    }
    
    if (evaluationResult.flags.OPTIMIZE) {
      alertsToCreate.push({
        alertType: 'OPTIMIZE',
        alert: evaluationResult.rules.R6,
        priority: 4,
      });
    }
    
    alertsToCreate.sort((a, b) => a.priority - b.priority);
    
    for (const { alertType, alert } of alertsToCreate) {
      const hasActive = await hasActiveAlert(stationId, alertType);
      
      if (hasActive) {
        console.log(`rule-engine: Skipping duplicate ${alertType} alert for ${stationId}`);
        results.alertsSkipped.push(alertType);
      } else {
        const createdAlert = await AlertsTable.createAlert({
          stationId,
          alertType,
          severity: alert.severity,
          title: alert.title,
          description: alert.description,
          recommendedAction: alert.recommendedAction,
          metadata: {
            ...alert.metadata,
            ruleEvaluation: {
              flags: evaluationResult.flags,
              maxSeverity: evaluationResult.maxSeverity,
            },
          },
        });
        
        await AuditTable.logAction({
          actionType: 'ALERT_CREATED',
          alertId: createdAlert.alertId,
          stationId,
          status: 'SUCCESS',
          userId: 'system',
          details: {
            alertType,
            severity: createdAlert.severity,
            flags: evaluationResult.flags,
          },
        });
        
        results.alertsCreated.push({
          alertId: createdAlert.alertId,
          type: alertType,
          severity: createdAlert.severity,
        });
        
        console.log(`rule-engine: Created ${alertType} alert ${createdAlert.alertId} for ${stationId}`);
      }
    }
    
  } catch (error) {
    console.error(`rule-engine: Error processing station ${stationId}:`, error);
    results.error = error.message;
  }
  
  return results;
};

exports.handler = async (event) => {
  console.log('rule-engine: Event received:', JSON.stringify(event, null, 2));
  
  const startTime = Date.now();
  const summary = {
    stationsProcessed: 0,
    alertsCreated: 0,
    alertsSkipped: 0,
    errors: [],
    results: [],
    ruleStats: {
      CONGESTION: 0,
      LOW_INVENTORY: 0,
      CRITICAL: 0,
      HARDWARE: 0,
      DEMAND: 0,
      OPTIMIZE: 0,
    },
  };
  
  try {
    const stationIds = await getActiveStations();
    console.log(`rule-engine: Found ${stationIds.length} active stations`);
    
    if (stationIds.length === 0) {
      console.log('rule-engine: No active stations found');
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'No active stations to process',
          summary,
        }),
      };
    }
    
    for (const stationId of stationIds) {
      const result = await processStation(stationId);
      summary.stationsProcessed++;
      summary.alertsCreated += result.alertsCreated.length;
      summary.alertsSkipped += result.alertsSkipped.length;
      
      Object.keys(result.flags).forEach(flag => {
        if (result.flags[flag]) {
          summary.ruleStats[flag] = (summary.ruleStats[flag] || 0) + 1;
        }
      });
      
      if (result.error) {
        summary.errors.push({ stationId, error: result.error });
      }
      
      summary.results.push(result);
    }
    
    const duration = Date.now() - startTime;
    
    await AuditTable.logAction({
      actionType: 'RULE_ENGINE_EXECUTION',
      timestamp: startTime,
      status: 'SUCCESS',
      userId: 'system',
      details: {
        stationsProcessed: summary.stationsProcessed,
        alertsCreated: summary.alertsCreated,
        alertsSkipped: summary.alertsSkipped,
        ruleStats: summary.ruleStats,
        durationMs: duration,
      },
    });
    
    console.log(`rule-engine: Execution complete. Created ${summary.alertsCreated} alerts, skipped ${summary.alertsSkipped} duplicates`);
    console.log(`rule-engine: Rule stats:`, summary.ruleStats);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Rule engine execution completed',
        summary: {
          ...summary,
          durationMs: duration,
        },
      }),
    };
    
  } catch (error) {
    console.error('rule-engine: Fatal error:', error);
    
    await AuditTable.logAction({
      actionType: 'RULE_ENGINE_EXECUTION',
      timestamp: startTime,
      status: 'FAILED',
      userId: 'system',
      errorMessage: error.message,
    }).catch(auditError => {
      console.error('rule-engine: Failed to log audit:', auditError);
    });
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Rule engine execution failed',
        message: error.message,
        summary,
      }),
    };
  }
};
