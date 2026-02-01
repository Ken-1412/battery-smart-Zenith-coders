import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

const handleError = (error) => {
  if (error.response) {
    return {
      message: error.response.data?.error || error.response.data?.message || 'Request failed',
      status: error.response.status,
      data: error.response.data,
    };
  } else if (error.request) {
    return {
      message: 'Network error: Unable to reach server. Please check your connection.',
      status: 0,
      data: null,
    };
  } else {
    return {
      message: error.message || 'An unexpected error occurred',
      status: 0,
      data: null,
    };
  }
};

export const alertsApi = {
  async getAlerts(status = null, limit = 50) {
    try {
      const params = { limit };
      if (status) {
        params.status = status;
      }
      const response = await api.get('/alerts', { params });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: handleError(error) };
    }
  },

  async makeDecision(alertId, decision, reason = null) {
    try {
      if (!alertId) {
        throw new Error('Alert ID is required');
      }
      if (!decision || !['APPROVE', 'REJECT'].includes(decision.toUpperCase())) {
        throw new Error('Decision must be APPROVE or REJECT');
      }
      
      const response = await api.post('/alerts/decision', {
        alertId,
        decision: decision.toUpperCase(),
        reason: reason || null,
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: handleError(error) };
    }
  },
};

export default api;
