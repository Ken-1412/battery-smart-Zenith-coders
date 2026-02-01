const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

const publishAlert = async (topicArn, alert) => {
  const message = {
    alertId: alert.alertId,
    stationId: alert.stationId,
    alertType: alert.alertType,
    severity: alert.severity,
    status: alert.status,
    title: alert.title,
    description: alert.description,
    recommendedAction: alert.recommendedAction,
    createdAt: alert.createdAt,
    metadata: alert.metadata || {},
    recommendation: alert.metadata?.recommendation || null,
    primaryAction: alert.metadata?.primaryAction || null,
  };
  
  const params = {
    TopicArn: topicArn,
    Message: JSON.stringify(message, null, 2),
    Subject: `[${alert.severity}] ${alert.alertType} Alert: ${alert.stationId}`,
    MessageAttributes: {
      alertType: {
        DataType: 'String',
        StringValue: alert.alertType,
      },
      severity: {
        DataType: 'String',
        StringValue: alert.severity,
      },
      stationId: {
        DataType: 'String',
        StringValue: alert.stationId,
      },
    },
  };
  
  try {
    const result = await snsClient.send(new PublishCommand(params));
    return {
      success: true,
      messageId: result.MessageId,
    };
  } catch (error) {
    console.error('sns: Error publishing alert:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  publishAlert,
  snsClient,
};
