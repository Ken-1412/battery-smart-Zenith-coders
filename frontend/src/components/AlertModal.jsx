import { useState } from 'react';

const AlertModal = ({ alert, onClose, onDecision }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const handleApprove = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      await onDecision(alert.alertId, 'APPROVE');
      onClose();
    } catch (err) {
      console.error('Error approving alert:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (isProcessing) return;
    
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    
    setIsProcessing(true);
    try {
      await onDecision(alert.alertId, 'REJECT', rejectionReason);
      onClose();
    } catch (err) {
      console.error('Error rejecting alert:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const getSeverityClass = (severity) => {
    const severityLower = severity?.toLowerCase() || 'low';
    return severityLower;
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  const canMakeDecision = alert.status === 'PENDING' && !isProcessing;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{alert.title}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-section">
            <h3>Status</h3>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span className={`severity-badge ${getSeverityClass(alert.severity)}`}>
                {alert.severity || 'LOW'}
              </span>
              <span className={`status-badge ${alert.status?.toLowerCase() || 'pending'}`}>
                {alert.status}
              </span>
              <span style={{ fontSize: '0.9rem', color: '#666' }}>
                {alert.alertType}
              </span>
            </div>
          </div>

          <div className="modal-section">
            <h3>Station</h3>
            <p>{alert.stationId}</p>
          </div>

          <div className="modal-section">
            <h3>Description</h3>
            <p>{alert.description}</p>
          </div>

          {alert.recommendedAction && (
            <div className="modal-section">
              <h3>Recommended Action</h3>
              <p>{alert.recommendedAction}</p>
            </div>
          )}

          {alert.metadata?.recommendation && (
            <div className="modal-section">
              <h3>Recommendation Details</h3>
              <div className="modal-metadata">
                <pre>{JSON.stringify(alert.metadata.recommendation, null, 2)}</pre>
              </div>
            </div>
          )}

          <div className="modal-section">
            <h3>Timestamps</h3>
            <p>
              <strong>Created:</strong> {formatTimestamp(alert.createdAt)}<br />
              {alert.executedAt && (
                <>
                  <strong>Executed:</strong> {formatTimestamp(alert.executedAt)} by {alert.executedBy}<br />
                </>
              )}
              {alert.dismissedAt && (
                <>
                  <strong>Dismissed:</strong> {formatTimestamp(alert.dismissedAt)} by {alert.dismissedBy}<br />
                  {alert.dismissalReason && (
                    <>
                      <strong>Reason:</strong> {alert.dismissalReason}
                    </>
                  )}
                </>
              )}
            </p>
          </div>

          {alert.decisions && alert.decisions.length > 0 && (
            <div className="modal-section">
              <h3>Decision History</h3>
              {alert.decisions.map((decision) => (
                <div key={decision.decisionId} style={{ marginBottom: '0.5rem', padding: '0.75rem', background: '#f5f5f5', borderRadius: '4px' }}>
                  <strong>{decision.decision}</strong> by {decision.userId} at {formatTimestamp(decision.timestamp)}
                  {decision.reason && <div style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}>Reason: {decision.reason}</div>}
                </div>
              ))}
            </div>
          )}

          {alert.metadata && (
            <div className="modal-section">
              <h3>Metadata</h3>
              <div className="modal-metadata">
                <pre>{JSON.stringify(alert.metadata, null, 2)}</pre>
              </div>
            </div>
          )}

          {canMakeDecision && (
            <div className="modal-section">
              <h3>Rejection Reason</h3>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter reason for rejection (required if rejecting)"
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                  resize: 'vertical',
                }}
              />
            </div>
          )}
        </div>

        {canMakeDecision && (
          <div className="modal-footer">
            <button
              className="btn btn-approve"
              onClick={handleApprove}
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Approve'}
            </button>
            <button
              className="btn btn-reject"
              onClick={handleReject}
              disabled={isProcessing || !rejectionReason.trim()}
            >
              {isProcessing ? 'Processing...' : 'Reject'}
            </button>
            <button
              className="btn btn-view"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        )}

        {!canMakeDecision && (
          <div className="modal-footer">
            <button
              className="btn btn-view"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertModal;
