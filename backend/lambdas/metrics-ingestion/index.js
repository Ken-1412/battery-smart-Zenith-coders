const { MetricsTable, AlertsTable, AuditTable } = require('../../shared/dynamodb');
const { evaluateAllRules } = require('../../shared/ruleEngine');
const { formatRecommendationForAlert } = require('../../shared/recommendationService');
const { publishAlert } = require('../../shared/sns');

const validateMetric = (body) => {
  const errors = [];
  
  if (!body.stationId || typeof body.stationId !== 'string') {
    errors.push('stationId is required and must be a string');
  }
  
  if (body.timestamp !== undefined) {
    if (typeof body.timestamp !== 'number' || body.timestamp <= 0) {
      errors.push('timestamp must be a positive number (Unix epoch milliseconds)');
    }
  }
  
  if (body.swapRate !== undefined && typeof body.swapRate !== 'number') {
    errors.push('swapRate must be a number');
  }
  
  if (body.queue !== undefined && typeof body.queue !== 'number') {
    errors.push('queue must be a number');
  }
  
  if (body.demandSurge !== undefined && typeof body.demandSurge !== 'boolean') {
    errors.push('demandSurge must be a boolean');
  }
  
  if (body.chargerUptime !== undefined) {
    if (typeof body.chargerUptime !== 'number' || body.chargerUptime < 0 || body.chargerUptime > 100) {
      errors.push('chargerUptime must be a number between 0 and 100');
    }
  }
  
  if (body.chargerHealth !== undefined) {
    const validHealth = ['healthy', 'degraded', 'down'];
    if (!validHealth.includes(body.chargerHealth)) {
      errors.push(`chargerHealth must be one of: ${validHealth.join(', ')}`);
    }
  }
  
  if (body.chargedBatteries !== undefined && typeof body.chargedBatteries !== 'number') {
    errors.push('chargedBatteries must be a number');
  }
  
  if (body.unchargedBatteries !== undefined && typeof body.unchargedBatteries !== 'number') {
    errors.push('unchargedBatteries must be a number');
  }
  
  if (body.errorLogs !== undefined && !Array.isArray(body.errorLogs)) {
    errors.push('errorLogs must be an array');
  }
  
  if (body.faultPatterns !== undefined && !Array.isArray(body.faultPatterns)) {
    errors.push('faultPatterns must be an array');
  }
  
  return errors;
};

const createResponse = (statusCode, body, headers = {}) => {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      ...headers,
    },
    body: JSON.stringify(body),
  };
};

exports.handler = async (event) => {
  console.log('metrics-ingestion: Received event:', JSON.stringify(event, null, 2));
  
  try {
    const requestContext = event.requestContext || {};
    const http = requestContext.http || {};
    const method = http.method || event.httpMethod || requestContext.httpMethod;
    
    if (method === 'OPTIONS') {
      return createResponse(200, { message: 'OK' });
    }
    
    if (method !== 'POST') {
      return createResponse(405, { error: 'Method not allowed' });
    }
    
    let body;
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch (parseError) {
      return createResponse(400, { error: 'Invalid JSON in request body' });
    }
    
    const validationErrors = validateMetric(body);
    if (validationErrors.length > 0) {
      return createResponse(400, {
        error: 'Validation failed',
        details: validationErrors,
      });
    }
    
    const stationId = body.stationId;
    const timestamp = body.timestamp || Date.now();
    
    const metricData = {
      swapRate: body.swapRate,
      queue: body.queue,
      demandSurge: body.demandSurge,
      chargerUptime: body.chargerUptime,
      chargerHealth: body.chargerHealth,
      chargedBatteries: body.chargedBatteries,
      unchargedBatteries: body.unchargedBatteries,
      errorLogs: body.errorLogs || [],
      faultPatterns: body.faultPatterns || [],
      maxCapacity: body.maxCapacity,
    };
    
    const savedMetric = await MetricsTable.putMetric(stationId, timestamp, metricData);
    
    await AuditTable.logAction({
      actionType: 'METRIC_INGESTED',
      stationId,
      timestamp,
      status: 'SUCCESS',
      userId: 'system',
      details: {
        metricId: `${stationId}_${timestamp}`,
      },
    });
    
    const alertsCreated = [];
    
    try {
      const oneHourAgo = timestamp - (60 * 60 * 1000);
      const metrics = await MetricsTable.getMetricsByTimeRange(stationId, oneHourAgo, timestamp);
      
      if (metrics.length > 0) {
        const evaluationResult = evaluateAllRules(metrics);
        
        if (evaluationResult.triggeredAlerts.length > 0) {
          const hasActiveAlert = async (alertType) => {
            const pendingAlerts = await AlertsTable.getAllAlerts('PENDING');
            return pendingAlerts.some(alert => 
              alert.stationId === stationId && 
              alert.alertType === alertType &&
              alert.status === 'PENDING'
            );
          };
          
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
            const hasActive = await hasActiveAlert(alertType);
            
            if (!hasActive) {
              const recommendation = formatRecommendationForAlert(
                evaluationResult.flags,
                stationId,
                {
                  congestion: alert.metadata?.avgQueue ? { avgQueue: alert.metadata.avgQueue } : undefined,
                  inventory: alert.metadata?.chargedBatteries !== undefined ? {
                    chargedBatteries: alert.metadata.chargedBatteries,
                    threshold: alert.metadata.threshold,
                  } : undefined,
                  hardware: alert.metadata?.totalFaults !== undefined ? {
                    totalFaults: alert.metadata.totalFaults,
                    recurringFaults: alert.metadata.recurringFaults,
                    faultCounts: alert.metadata.faultCounts,
                  } : undefined,
                  demand: alert.metadata?.currentSwapRate !== undefined ? {
                    currentSwapRate: alert.metadata.currentSwapRate,
                    baselineSwapRate: alert.metadata.baselineSwapRate,
                    spikePercentage: alert.metadata.spikePercentage,
                  } : undefined,
                  optimize: alert.metadata?.utilization !== undefined ? {
                    utilization: alert.metadata.utilization,
                    avgSwapRate: alert.metadata.avgSwapRate,
                    maxCapacity: alert.metadata.maxCapacity,
                  } : undefined,
                }
              );
              
              const createdAlert = await AlertsTable.createAlert({
                stationId,
                alertType,
                severity: alert.severity,
                title: alert.title,
                description: alert.description,
                recommendedAction: recommendation.recommendedAction,
                metadata: {
                  ...alert.metadata,
                  ruleEvaluation: {
                    flags: evaluationResult.flags,
                    maxSeverity: evaluationResult.maxSeverity,
                  },
                  recommendation: recommendation.recommendationDetails,
                  primaryAction: recommendation.primaryAction,
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
              
              const snsTopicArn = process.env.SNS_TOPIC_ARN;
              if (snsTopicArn) {
                try {
                  const snsResult = await publishAlert(snsTopicArn, createdAlert);
                  if (snsResult.success) {
                    await AuditTable.logAction({
                      actionType: 'SNS_NOTIFICATION_SENT',
                      alertId: createdAlert.alertId,
                      stationId,
                      status: 'SUCCESS',
                      userId: 'system',
                      details: {
                        messageId: snsResult.messageId,
                        topicArn: snsTopicArn,
                      },
                    });
                    console.log(`metrics-ingestion: Published alert ${createdAlert.alertId} to SNS: ${snsResult.messageId}`);
                  } else {
                    console.error(`metrics-ingestion: Failed to publish alert to SNS: ${snsResult.error}`);
                  }
                } catch (snsError) {
                  console.error(`metrics-ingestion: Error publishing to SNS:`, snsError);
                }
              }
              
              alertsCreated.push({
                alertId: createdAlert.alertId,
                alertType: createdAlert.alertType,
                severity: createdAlert.severity,
                title: createdAlert.title,
                recommendedAction: createdAlert.recommendedAction,
                recommendation: recommendation.recommendationDetails,
              });
              
              console.log(`metrics-ingestion: Created ${alertType} alert ${createdAlert.alertId} for ${stationId}`);
            }
          }
        }
      }
    } catch (ruleError) {
      console.error('metrics-ingestion: Error running rule engine:', ruleError);
    }
    
    return createResponse(201, {
      message: 'Metric ingested successfully',
      metric: {
        stationId: savedMetric.stationId,
        timestamp: savedMetric.timestamp,
      },
      alertsCreated: alertsCreated.length,
      alerts: alertsCreated,
    });
    
  } catch (error) {
    console.error('metrics-ingestion: Error processing metric:', error);
    
    await AuditTable.logAction({
      actionType: 'METRIC_INGESTED',
      stationId: event.body?.stationId || 'unknown',
      timestamp: Date.now(),
      status: 'FAILED',
      userId: 'system',
      errorMessage: error.message,
    }).catch(auditError => {
      console.error('metrics-ingestion: Failed to log audit:', auditError);
    });
    
    return createResponse(500, {
      error: 'Internal server error',
      message: error.message,
    });
  }
};
