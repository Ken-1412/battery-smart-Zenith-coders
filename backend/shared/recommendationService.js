const generateRecommendation = (flags, stationId, metadata = {}) => {
  const recommendations = [];
  const actions = [];
  const priority = [];
  
  if (flags.CRITICAL) {
    recommendations.push({
      type: 'CRITICAL',
      priority: 1,
      humanReadable: `CRITICAL: Station ${stationId} requires immediate attention. Multiple critical issues detected simultaneously.`,
      actions: [
        {
          type: 'REROUTE',
          description: 'Reroute drivers to nearby low-load stations',
          details: {
            reason: 'High congestion detected',
            targetStations: metadata.congestion?.nearbyStations || ['AUTO_DETECT'],
          },
        },
        {
          type: 'TRANSFER',
          description: 'Transfer charged batteries from nearby stations',
          details: {
            reason: 'Low inventory detected',
            requiredBatteries: metadata.inventory?.requiredBatteries || 10,
            sourceStations: metadata.inventory?.sourceStations || ['AUTO_DETECT'],
          },
        },
        {
          type: 'MAINTENANCE',
          description: 'Schedule immediate maintenance',
          details: {
            reason: 'Hardware faults detected',
            faultCount: metadata.hardware?.totalFaults || 0,
            recurringFaults: metadata.hardware?.recurringFaults || [],
          },
        },
        {
          type: 'ESCALATE',
          description: 'Escalate to operations manager',
          details: {
            reason: 'Critical condition requires immediate intervention',
            escalationLevel: 'HIGH',
          },
        },
      ],
    });
    
    return {
      recommendation: recommendations[0],
      json: {
        alertType: 'CRITICAL',
        stationId,
        priority: 1,
        humanReadable: recommendations[0].humanReadable,
        actions: recommendations[0].actions,
        metadata: {
          flags,
          ...metadata,
        },
      },
    };
  }
  
  if (flags.CONGESTION && flags.OPTIMIZE) {
    recommendations.push({
      type: 'REROUTE',
      priority: 1,
      humanReadable: `Reroute drivers from ${stationId} to nearby underutilized stations. High congestion detected while other stations are underutilized.`,
      actions: [
        {
          type: 'REROUTE',
          description: 'Reroute drivers to nearby low-load stations',
          details: {
            reason: 'Congestion + Underutilized stations available',
            currentQueue: metadata.congestion?.avgQueue || 0,
            targetStations: metadata.optimize?.underutilizedStations || ['AUTO_DETECT'],
            estimatedRelief: '30-50% queue reduction',
          },
        },
      ],
    });
  } else if (flags.CONGESTION) {
    recommendations.push({
      type: 'REROUTE',
      priority: 2,
      humanReadable: `Reroute drivers from ${stationId} to nearby low-load stations. Queue length: ${metadata.congestion?.avgQueue || 'N/A'}.`,
      actions: [
        {
          type: 'REROUTE',
          description: 'Reroute drivers to nearby low-load stations',
          details: {
            reason: 'High queue congestion',
            currentQueue: metadata.congestion?.avgQueue || 0,
            targetStations: ['AUTO_DETECT'],
            estimatedRelief: '20-40% queue reduction',
          },
        },
      ],
    });
  }
  
  if (flags.LOW_INVENTORY) {
    recommendations.push({
      type: 'TRANSFER',
      priority: 2,
      humanReadable: `Transfer charged batteries to ${stationId}. Current inventory: ${metadata.inventory?.chargedBatteries || 0} charged batteries (threshold: ${metadata.inventory?.threshold || 8}).`,
      actions: [
        {
          type: 'TRANSFER',
          description: 'Transfer charged batteries from nearby stations',
          details: {
            reason: 'Low inventory detected',
            currentCharged: metadata.inventory?.chargedBatteries || 0,
            requiredBatteries: Math.max(8 - (metadata.inventory?.chargedBatteries || 0), 5),
            sourceStations: ['AUTO_DETECT'],
            urgency: metadata.inventory?.chargedBatteries === 0 ? 'CRITICAL' : 'HIGH',
          },
        },
      ],
    });
  }
  
  if (flags.HARDWARE) {
    recommendations.push({
      type: 'MAINTENANCE',
      priority: 2,
      humanReadable: `Schedule maintenance for ${stationId}. ${metadata.hardware?.totalFaults || 0} faults detected in last 30 minutes.`,
      actions: [
        {
          type: 'MAINTENANCE',
          description: 'Raise maintenance ticket with probable root cause',
          details: {
            reason: 'Recurring hardware faults',
            faultCount: metadata.hardware?.totalFaults || 0,
            recurringFaults: metadata.hardware?.recurringFaults || [],
            faultPatterns: metadata.hardware?.faultCounts || {},
            estimatedDowntime: '1-2 hours',
          },
        },
      ],
    });
  }
  
  if (flags.DEMAND) {
    recommendations.push({
      type: 'REROUTE',
      priority: 3,
      humanReadable: `Demand spike detected at ${stationId}. Swap rate increased by ${metadata.demand?.spikePercentage || 'N/A'}%. Consider rerouting.`,
      actions: [
        {
          type: 'REROUTE',
          description: 'Reroute drivers to nearby low-load stations',
          details: {
            reason: 'Demand spike',
            currentSwapRate: metadata.demand?.currentSwapRate || 0,
            baselineSwapRate: metadata.demand?.baselineSwapRate || 0,
            spikePercentage: metadata.demand?.spikePercentage || 0,
            targetStations: ['AUTO_DETECT'],
          },
        },
      ],
    });
  }
  
  if (flags.OPTIMIZE && !flags.CONGESTION) {
    recommendations.push({
      type: 'OPTIMIZE',
      priority: 4,
      humanReadable: `Station ${stationId} is underutilized (${(metadata.optimize?.utilization * 100 || 0).toFixed(1)}% utilization). Consider rebalancing inventory.`,
      actions: [
        {
          type: 'OPTIMIZE',
          description: 'Consider rebalancing inventory or adjusting station capacity',
          details: {
            reason: 'Underutilized station',
            utilization: metadata.optimize?.utilization || 0,
            avgSwapRate: metadata.optimize?.avgSwapRate || 0,
            maxCapacity: metadata.optimize?.maxCapacity || 100,
            suggestion: 'Transfer excess inventory to high-demand stations',
          },
        },
      ],
    });
  }
  
  recommendations.sort((a, b) => a.priority - b.priority);
  
  const primaryRecommendation = recommendations[0];
  const allActions = recommendations.flatMap(r => r.actions);
  
  const humanReadable = recommendations
    .map(r => r.humanReadable)
    .join(' ');
  
  return {
    recommendation: primaryRecommendation,
    allRecommendations: recommendations,
    humanReadable,
    json: {
      stationId,
      flags,
      primaryAction: primaryRecommendation?.type || 'MONITOR',
      humanReadable,
      actions: allActions,
      recommendations: recommendations.map(r => ({
        type: r.type,
        priority: r.priority,
        humanReadable: r.humanReadable,
        actions: r.actions,
      })),
      metadata: {
        ...metadata,
        flags,
      },
    },
  };
};

const formatRecommendationForAlert = (flags, stationId, metadata = {}) => {
  const result = generateRecommendation(flags, stationId, metadata);
  
  const recommendedAction = result.humanReadable || 'Monitor station status';
  
  return {
    recommendedAction,
    recommendationDetails: result.json,
    primaryAction: result.recommendation?.type || 'MONITOR',
  };
};

module.exports = {
  generateRecommendation,
  formatRecommendationForAlert,
};
