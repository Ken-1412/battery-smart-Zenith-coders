const RULE_THRESHOLDS = {
  CONGESTION: {
    queueThreshold: 12,
    cyclesRequired: 2,
  },
  LOW_INVENTORY: {
    minChargedBatteries: 8,
  },
  HARDWARE: {
    faultCountThreshold: 3,
    timeWindowMinutes: 30,
  },
  DEMAND: {
    spikeMultiplier: 1.5,
    baselineWindowMinutes: 60,
  },
  OPTIMIZE: {
    utilizationThreshold: 0.2,
    timeWindowMinutes: 60,
  },
};

const evaluateRule1_Congestion = (metrics) => {
  if (!metrics || metrics.length < 2) {
    return { triggered: false, reason: 'Insufficient metrics' };
  }
  
  const recentMetrics = metrics.slice(0, 2);
  const allAboveThreshold = recentMetrics.every(m => {
    const queue = m.queue || 0;
    return queue > RULE_THRESHOLDS.CONGESTION.queueThreshold;
  });
  
  if (allAboveThreshold) {
    const avgQueue = recentMetrics.reduce((sum, m) => sum + (m.queue || 0), 0) / recentMetrics.length;
    const maxQueue = Math.max(...recentMetrics.map(m => m.queue || 0));
    
    return {
      triggered: true,
      severity: maxQueue > 20 ? 'HIGH' : 'MEDIUM',
      alertType: 'CONGESTION',
      title: `Queue Congestion Detected`,
      description: `Queue length exceeded ${RULE_THRESHOLDS.CONGESTION.queueThreshold} for ${RULE_THRESHOLDS.CONGESTION.cyclesRequired} consecutive cycles. Average queue: ${avgQueue.toFixed(1)}`,
      recommendedAction: 'Reroute drivers to nearby low-load stations',
      metadata: {
        avgQueue: avgQueue.toFixed(1),
        maxQueue,
        threshold: RULE_THRESHOLDS.CONGESTION.queueThreshold,
        cycles: recentMetrics.length,
      },
    };
  }
  
  return { triggered: false };
};

const evaluateRule2_LowInventory = (metrics) => {
  if (!metrics || metrics.length === 0) {
    return { triggered: false, reason: 'No metrics available' };
  }
  
  const latestMetric = metrics[0];
  const chargedBatteries = latestMetric.chargedBatteries || 0;
  const unchargedBatteries = latestMetric.unchargedBatteries || 0;
  const totalBatteries = chargedBatteries + unchargedBatteries;
  
  if (chargedBatteries < RULE_THRESHOLDS.LOW_INVENTORY.minChargedBatteries) {
    const severity = chargedBatteries === 0 ? 'CRITICAL' : 
                     chargedBatteries < 3 ? 'HIGH' : 'MEDIUM';
    
    return {
      triggered: true,
      severity,
      alertType: 'LOW_INVENTORY',
      title: `Low Inventory Alert`,
      description: `Station has only ${chargedBatteries} charged batteries available (total: ${totalBatteries}). Threshold: ${RULE_THRESHOLDS.LOW_INVENTORY.minChargedBatteries}`,
      recommendedAction: 'Suggest inventory rebalancing between stations',
      metadata: {
        chargedBatteries,
        unchargedBatteries,
        totalBatteries,
        threshold: RULE_THRESHOLDS.LOW_INVENTORY.minChargedBatteries,
      },
    };
  }
  
  return { triggered: false };
};

const evaluateRule3_Critical = (rule1Result, rule2Result) => {
  if (rule1Result.triggered && rule2Result.triggered) {
    return {
      triggered: true,
      severity: 'CRITICAL',
      alertType: 'CRITICAL',
      title: `Critical Station Condition`,
      description: `Station experiencing both congestion (queue > ${RULE_THRESHOLDS.CONGESTION.queueThreshold}) and low inventory (charged < ${RULE_THRESHOLDS.LOW_INVENTORY.minChargedBatteries}). Immediate action required.`,
      recommendedAction: 'Escalate critical outages early and reroute drivers immediately',
      metadata: {
        congestion: rule1Result.metadata,
        inventory: rule2Result.metadata,
      },
    };
  }
  
  return { triggered: false };
};

const evaluateRule4_Hardware = (metrics) => {
  if (!metrics || metrics.length === 0) {
    return { triggered: false, reason: 'No metrics available' };
  }
  
  const now = Date.now();
  const windowStart = now - (RULE_THRESHOLDS.HARDWARE.timeWindowMinutes * 60 * 1000);
  
  const metricsInWindow = metrics.filter(m => m.timestamp >= windowStart);
  
  const faultCounts = {};
  metricsInWindow.forEach(metric => {
    const faults = metric.faultPatterns || metric.errorLogs || [];
    faults.forEach(fault => {
      faultCounts[fault] = (faultCounts[fault] || 0) + 1;
    });
  });
  
  const totalFaults = Object.values(faultCounts).reduce((sum, count) => sum + count, 0);
  
  if (totalFaults >= RULE_THRESHOLDS.HARDWARE.faultCountThreshold) {
    const recurringFaults = Object.entries(faultCounts)
      .filter(([_, count]) => count >= 2)
      .map(([fault, count]) => ({ fault, count }));
    
    return {
      triggered: true,
      severity: totalFaults >= 5 ? 'HIGH' : 'MEDIUM',
      alertType: 'HARDWARE',
      title: `Hardware Fault Pattern Detected`,
      description: `Station reported ${totalFaults} faults in the last ${RULE_THRESHOLDS.HARDWARE.timeWindowMinutes} minutes. Threshold: ${RULE_THRESHOLDS.HARDWARE.faultCountThreshold}`,
      recommendedAction: 'Raise maintenance tickets with probable root cause',
      metadata: {
        totalFaults,
        faultCounts,
        recurringFaults,
        timeWindowMinutes: RULE_THRESHOLDS.HARDWARE.timeWindowMinutes,
        threshold: RULE_THRESHOLDS.HARDWARE.faultCountThreshold,
      },
    };
  }
  
  return { triggered: false };
};

const evaluateRule5_Demand = (metrics) => {
  if (!metrics || metrics.length < 2) {
    return { triggered: false, reason: 'Insufficient metrics for baseline' };
  }
  
  const now = Date.now();
  const baselineWindowStart = now - (RULE_THRESHOLDS.DEMAND.baselineWindowMinutes * 60 * 1000);
  
  const recentMetric = metrics[0];
  const baselineMetrics = metrics.filter(m => 
    m.timestamp >= baselineWindowStart && 
    m.timestamp < recentMetric.timestamp
  );
  
  if (baselineMetrics.length === 0) {
    return { triggered: false, reason: 'No baseline metrics available' };
  }
  
  const currentSwapRate = recentMetric.swapRate || 0;
  const baselineSwapRate = baselineMetrics.reduce((sum, m) => sum + (m.swapRate || 0), 0) / baselineMetrics.length;
  
  if (baselineSwapRate > 0 && currentSwapRate >= (baselineSwapRate * RULE_THRESHOLDS.DEMAND.spikeMultiplier)) {
    const spikePercentage = ((currentSwapRate - baselineSwapRate) / baselineSwapRate * 100).toFixed(1);
    
    return {
      triggered: true,
      severity: spikePercentage > 100 ? 'HIGH' : 'MEDIUM',
      alertType: 'DEMAND',
      title: `Demand Spike Detected`,
      description: `Swap rate spiked to ${currentSwapRate}/hour (${spikePercentage}% above baseline of ${baselineSwapRate.toFixed(1)}/hour)`,
      recommendedAction: 'Reroute drivers to nearby low-load stations',
      metadata: {
        currentSwapRate,
        baselineSwapRate: baselineSwapRate.toFixed(1),
        spikePercentage,
        multiplier: RULE_THRESHOLDS.DEMAND.spikeMultiplier,
      },
    };
  }
  
  return { triggered: false };
};

const evaluateRule6_Optimize = (metrics) => {
  if (!metrics || metrics.length === 0) {
    return { triggered: false, reason: 'No metrics available' };
  }
  
  const now = Date.now();
  const windowStart = now - (RULE_THRESHOLDS.OPTIMIZE.timeWindowMinutes * 60 * 1000);
  
  const metricsInWindow = metrics.filter(m => m.timestamp >= windowStart);
  
  if (metricsInWindow.length === 0) {
    return { triggered: false, reason: 'No metrics in time window' };
  }
  
  const avgSwapRate = metricsInWindow.reduce((sum, m) => sum + (m.swapRate || 0), 0) / metricsInWindow.length;
  const maxCapacity = Math.max(...metricsInWindow.map(m => m.maxCapacity || 100));
  const utilization = maxCapacity > 0 ? avgSwapRate / maxCapacity : 0;
  
  if (utilization < RULE_THRESHOLDS.OPTIMIZE.utilizationThreshold) {
    return {
      triggered: true,
      severity: 'LOW',
      alertType: 'OPTIMIZE',
      title: `Underutilized Station`,
      description: `Station utilization is ${(utilization * 100).toFixed(1)}% (threshold: ${(RULE_THRESHOLDS.OPTIMIZE.utilizationThreshold * 100)}%). Average swap rate: ${avgSwapRate.toFixed(1)}/hour`,
      recommendedAction: 'Consider rebalancing inventory or adjusting station capacity',
      metadata: {
        utilization: utilization.toFixed(3),
        avgSwapRate: avgSwapRate.toFixed(1),
        maxCapacity,
        threshold: RULE_THRESHOLDS.OPTIMIZE.utilizationThreshold,
        timeWindowMinutes: RULE_THRESHOLDS.OPTIMIZE.timeWindowMinutes,
      },
    };
  }
  
  return { triggered: false };
};

const evaluateAllRules = (metrics) => {
  const results = {
    stationId: metrics[0]?.stationId || 'unknown',
    timestamp: Date.now(),
    rules: {},
    flags: {
      CONGESTION: false,
      LOW_INVENTORY: false,
      CRITICAL: false,
      HARDWARE: false,
      DEMAND: false,
      OPTIMIZE: false,
    },
    triggeredAlerts: [],
    maxSeverity: null,
  };
  
  const r1 = evaluateRule1_Congestion(metrics);
  results.rules.R1 = r1;
  if (r1.triggered) {
    results.flags.CONGESTION = true;
    results.triggeredAlerts.push(r1);
  }
  
  const r2 = evaluateRule2_LowInventory(metrics);
  results.rules.R2 = r2;
  if (r2.triggered) {
    results.flags.LOW_INVENTORY = true;
    results.triggeredAlerts.push(r2);
  }
  
  const r3 = evaluateRule3_Critical(r1, r2);
  results.rules.R3 = r3;
  if (r3.triggered) {
    results.flags.CRITICAL = true;
    results.triggeredAlerts.push(r3);
  }
  
  const r4 = evaluateRule4_Hardware(metrics);
  results.rules.R4 = r4;
  if (r4.triggered) {
    results.flags.HARDWARE = true;
    results.triggeredAlerts.push(r4);
  }
  
  const r5 = evaluateRule5_Demand(metrics);
  results.rules.R5 = r5;
  if (r5.triggered) {
    results.flags.DEMAND = true;
    results.triggeredAlerts.push(r5);
  }
  
  const r6 = evaluateRule6_Optimize(metrics);
  results.rules.R6 = r6;
  if (r6.triggered) {
    results.flags.OPTIMIZE = true;
    results.triggeredAlerts.push(r6);
  }
  
  const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  const triggeredSeverities = results.triggeredAlerts
    .map(a => a.severity)
    .filter(s => s)
    .sort((a, b) => (severityOrder[b] || 0) - (severityOrder[a] || 0));
  
  results.maxSeverity = triggeredSeverities[0] || null;
  
  return results;
};

module.exports = {
  evaluateAllRules,
  evaluateRule1_Congestion,
  evaluateRule2_LowInventory,
  evaluateRule3_Critical,
  evaluateRule4_Hardware,
  evaluateRule5_Demand,
  evaluateRule6_Optimize,
  RULE_THRESHOLDS,
};
