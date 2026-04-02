import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const analysisApi = {
  // Start a new analysis
  startAnalysis: async (goal) => {
    const response = await api.post('/start-analysis', { goal });
    return response.data;
  },

  // Get status of a run
  getStatus: async (runId) => {
    const response = await api.get(`/status/${runId}`);
    return response.data;
  },

  // Get final result
  getResult: async (runId) => {
    const response = await api.get(`/result/${runId}`);
    return response.data;
  },

  // Approve or reject a run
  approveRun: async (runId, approved, feedback = null, edits = null) => {
    const response = await api.post(`/approve/${runId}`, {
      approved,
      feedback,
      edits,
    });
    return response.data;
  },

  // Get logs for a run
  getLogs: async (runId, limit = 100, offset = 0) => {
    const response = await api.get(`/logs/${runId}`, {
      params: { limit, offset },
    });
    return response.data;
  },

  // Resume a failed run
  resumeRun: async (runId) => {
    const response = await api.post(`/resume/${runId}`);
    return response.data;
  },
};

// WebSocket connection for live updates
export const createWebSocket = (runId, onMessage, onError) => {
  const wsUrl = `ws://${window.location.hostname}:8000/api/ws/${runId}`;
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connected');
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (e) {
      // Keepalive or pong message
      if (event.data !== 'keepalive' && event.data !== 'pong') {
        console.warn('Failed to parse WebSocket message:', event.data);
      }
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    if (onError) onError(error);
  };

  ws.onclose = () => {
    console.log('WebSocket closed');
  };

  // Send ping every 25 seconds to keep connection alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send('ping');
    }
  }, 25000);

  return {
    ws,
    close: () => {
      clearInterval(pingInterval);
      ws.close();
    },
  };
};

export default api;
