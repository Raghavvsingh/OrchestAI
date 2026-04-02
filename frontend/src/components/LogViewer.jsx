import React from 'react';
import { AlertCircle, Info, AlertTriangle, Bug } from 'lucide-react';

const levelIcons = {
  debug: <Bug className="w-4 h-4 text-gray-400" />,
  info: <Info className="w-4 h-4 text-blue-400" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
  error: <AlertCircle className="w-4 h-4 text-red-400" />,
};

const levelColors = {
  debug: 'border-l-gray-500',
  info: 'border-l-blue-500',
  warning: 'border-l-yellow-500',
  error: 'border-l-red-500',
};

function LogViewer({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="p-8 bg-slate-800 rounded-xl border border-slate-700 text-center">
        <p className="text-slate-400">No logs yet</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div className="max-h-96 overflow-y-auto">
        {logs.map((log, idx) => (
          <div
            key={log.id || idx}
            className={`px-4 py-3 border-l-4 ${levelColors[log.level] || levelColors.info} ${
              idx !== logs.length - 1 ? 'border-b border-slate-700' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              {levelIcons[log.level] || levelIcons.info}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 bg-slate-700 rounded text-xs font-medium text-slate-300">
                    {log.agent}
                  </span>
                  {log.task_id && (
                    <span className="px-2 py-0.5 bg-blue-900 rounded text-xs text-blue-300">
                      {log.task_id}
                    </span>
                  )}
                  {log.latency_ms && (
                    <span className="text-xs text-slate-500">
                      {log.latency_ms}ms
                    </span>
                  )}
                  <span className="text-xs text-slate-500 ml-auto">
                    {new Date(log.created_at || log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-slate-300 text-sm mt-1 break-words">
                  {log.message}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default LogViewer;
