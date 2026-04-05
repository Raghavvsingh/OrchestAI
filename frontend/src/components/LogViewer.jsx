import React from 'react';

// Format timestamp to HH:MM:SS
const formatTime = (timestamp) => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return '--:--:--';
  }
};

function LogViewer({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-12 text-center card-shadow">
        <p className="text-gray-500">No logs yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 card-shadow overflow-hidden">
      <div className="p-6 space-y-1">
        {logs.map((log, idx) => (
          <div
            key={log.id || idx}
            className="log-entry py-2 flex gap-4 text-gray-600"
          >
            {/* Timestamp */}
            <span className="text-gray-400 font-mono text-sm flex-shrink-0">
              {formatTime(log.created_at || log.timestamp)}
            </span>
            
            {/* Agent tag */}
            <span className="text-amber-700 font-mono text-sm flex-shrink-0">
              [{log.agent || 'System'}]
            </span>
            
            {/* Message */}
            <span className="font-mono text-sm text-gray-700 break-words">
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default LogViewer;
