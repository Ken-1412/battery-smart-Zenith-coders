import { useState, useEffect, useCallback } from 'react';
import { alertsApi } from '../services/api';
import AlertCard from './AlertCard';

const Dashboard = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [decisionProcessing, setDecisionProcessing] = useState(new Set());

  const fetchAlerts = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setRefreshing(true);
    }
    
    try {
      setError(null);
      const result = await alertsApi.getAlerts(statusFilter);
      
      if (result.success) {
        setAlerts(result.data.alerts || []);
        setLastRefresh(new Date());
        setError(null);
      } else {
        const errorMessage = result.error?.message || 'Failed to fetch alerts';
        setError(errorMessage);
        console.error('Error fetching alerts:', result.error);
      }
    } catch (err) {
      const errorMessage = err.message || 'An unexpected error occurred';
      setError(errorMessage);
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    setLoading(true);
    fetchAlerts(true);
  }, [statusFilter, fetchAlerts]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchAlerts(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const handleDecision = async (alertId, decision, reason = null) => {
    if (decisionProcessing.has(alertId)) {
      return;
    }

    setDecisionProcessing(prev => new Set(prev).add(alertId));

    try {
      const result = await alertsApi.makeDecision(alertId, decision, reason);
      
      if (result.success) {
        await fetchAlerts(false);
      } else {
        const errorMessage = result.error?.message || 'Failed to process decision';
        alert(errorMessage);
        console.error('Error making decision:', result.error);
      }
    } catch (err) {
      const errorMessage = err.message || 'An unexpected error occurred';
      alert(errorMessage);
      console.error('Unexpected error making decision:', err);
    } finally {
      setDecisionProcessing(prev => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (!statusFilter) return true;
    return alert.status === statusFilter.toUpperCase();
  });

  return (
    <div className="main">
      <div className="controls">
        <div className="filter-group">
          <button
            className={`filter-button ${statusFilter === null ? 'active' : ''}`}
            onClick={() => setStatusFilter(null)}
          >
            All
          </button>
          <button
            className={`filter-button ${statusFilter === 'PENDING' ? 'active' : ''}`}
            onClick={() => setStatusFilter('PENDING')}
          >
            Pending
          </button>
          <button
            className={`filter-button ${statusFilter === 'EXECUTED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('EXECUTED')}
          >
            Executed
          </button>
          <button
            className={`filter-button ${statusFilter === 'DISMISSED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('DISMISSED')}
          >
            Dismissed
          </button>
        </div>
        <div className="status-indicator">
          <span className="status-dot"></span>
          <span>
            {refreshing ? 'Refreshing...' : `Last refresh: ${lastRefresh.toLocaleTimeString()}`}
          </span>
        </div>
      </div>

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
          <button
            onClick={() => fetchAlerts(true)}
            style={{
              marginLeft: '1rem',
              padding: '0.5rem 1rem',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading alerts...</div>
      ) : filteredAlerts.length === 0 ? (
        <div className="empty-state">
          <h2>No alerts found</h2>
          <p>
            {statusFilter
              ? `No ${statusFilter.toLowerCase()} alerts at this time.`
              : 'No alerts available.'}
          </p>
        </div>
      ) : (
        <div className="alerts-grid">
          {filteredAlerts.map((alert) => (
            <AlertCard
              key={alert.alertId}
              alert={alert}
              onDecision={handleDecision}
              isProcessing={decisionProcessing.has(alert.alertId)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
