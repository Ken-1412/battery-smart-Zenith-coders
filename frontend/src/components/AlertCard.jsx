import { useState } from 'react';
import AlertModal from './AlertModal';

const AlertCard = ({ alert, onDecision, isProcessing: externalProcessing = false }) => {
  const [showModal, setShowModal] = useState(false);
  const [localProcessing, setLocalProcessing] = useState(false);

  const isProcessing = externalProcessing || localProcessing;

  const handleApprove = async () => {
    if (isProcessing) return;
    
    setLocalProcessing(true);
    try {
      await onDecision(alert.alertId, 'APPROVE');
    } catch (err) {
      console.error('Error approving alert:', err);
    } finally {
      setLocalProcessing(false);
    }
  };

  const handleReject = async () => {
    if (isProcessing) return;
    
    setLocalProcessing(true);
    try {
      await onDecision(alert.alertId, 'REJECT');
    } catch (err) {
      console.error('Error rejecting alert:', err);
    } finally {
      setLocalProcessing(false);
    }
  };

  const getSeverityClass = (severity) => {
    const severityLower = severity?.toLowerCase() || 'low';
    return severityLower;
  };

  const getStatusClass = (status) => {
    const statusLower = status?.toLowerCase() || 'pending';
    return statusLower;
  };

  const canMakeDecision = alert.status === 'PENDING' && !isProcessing;

  return (
    <>
      <div className={`alert-card ${getStatusClass(alert.status)}`}>
        <div className="alert-header">
          <div>
            <div className="alert-title">{alert.title}</div>
            <div className="alert-station">Station: {alert.stationId}</div>
          </div>
          <div>
            <span className={`severity-badge ${getSeverityClass(alert.severity)}`}>
              {alert.severity || 'LOW'}
            </span>
          </div>
        </div>

        <div className="alert-description">{alert.description}</div>

        {alert.recommendedAction && (
          <div className="alert-recommendation">
            <strong>Recommendation:</strong> {alert.recommendedAction}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span className={`status-badge ${getStatusClass(alert.status)}`}>
            {alert.status}
          </span>
          {alert.createdAt && (
            <span style={{ fontSize: '0.8rem', color: '#999' }}>
              {new Date(alert.createdAt).toLocaleString()}
            </span>
          )}
        </div>

        <div className="alert-actions">
          {canMakeDecision ? (
            <>
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
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : 'Reject'}
              </button>
            </>
          ) : (
            <button
              className="btn btn-view"
              onClick={() => setShowModal(true)}
            >
              View Details
            </button>
          )}
        </div>
      </div>

      {showModal && (
        <AlertModal
          alert={alert}
          onClose={() => setShowModal(false)}
          onDecision={onDecision}
        />
      )}
    </>
  );
};

export default AlertCard;
