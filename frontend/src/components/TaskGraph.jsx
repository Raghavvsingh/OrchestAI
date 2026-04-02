import React from 'react';
import { CheckCircle, XCircle, Clock, AlertTriangle, Loader2, Activity } from 'lucide-react';

const statusColors = {
  pending: '#64748b',
  in_progress: '#3b82f6',
  validating: '#eab308',
  completed: '#22c55e',
  failed: '#ef4444',
  blocked_by_failed_dependency: '#f97316',
  skipped: '#6b7280',
};

function TaskGraph({ tasks, currentTaskId }) {
  if (!tasks || tasks.length === 0) {
    return (
      <div className="p-8 bg-slate-800 rounded-xl border border-slate-700 text-center">
        <p className="text-slate-400">No tasks to display</p>
      </div>
    );
  }

  // Calculate positions for tasks
  const levels = {};
  const taskMap = {};
  
  tasks.forEach((task) => {
    taskMap[task.id] = task;
  });

  // Assign levels based on dependencies
  const assignLevel = (taskId, visited = new Set()) => {
    if (visited.has(taskId)) return 0;
    visited.add(taskId);
    
    const task = taskMap[taskId];
    if (!task) return 0;
    
    if (levels[taskId] !== undefined) return levels[taskId];
    
    const deps = task.depends_on || [];
    if (deps.length === 0) {
      levels[taskId] = 0;
    } else {
      const maxDepLevel = Math.max(...deps.map(d => assignLevel(d, visited)));
      levels[taskId] = maxDepLevel + 1;
    }
    
    return levels[taskId];
  };

  tasks.forEach((task) => assignLevel(task.id));

  // Group tasks by level
  const levelGroups = {};
  Object.entries(levels).forEach(([taskId, level]) => {
    if (!levelGroups[level]) levelGroups[level] = [];
    levelGroups[level].push(taskId);
  });

  const maxLevel = Math.max(...Object.keys(levelGroups).map(Number));
  const nodeWidth = 200;
  const nodeHeight = 60;
  const levelGap = 150;
  const nodeGap = 80;

  // Calculate positions
  const positions = {};
  Object.entries(levelGroups).forEach(([level, taskIds]) => {
    const levelNum = Number(level);
    const x = 50 + levelNum * levelGap;
    const startY = 50;
    
    taskIds.forEach((taskId, idx) => {
      positions[taskId] = {
        x,
        y: startY + idx * (nodeHeight + nodeGap),
      };
    });
  });

  // Calculate SVG dimensions
  const svgWidth = 100 + (maxLevel + 1) * levelGap;
  const maxTasksInLevel = Math.max(...Object.values(levelGroups).map(g => g.length));
  const svgHeight = 100 + maxTasksInLevel * (nodeHeight + nodeGap);

  // Generate edges
  const edges = [];
  tasks.forEach((task) => {
    const deps = task.depends_on || [];
    deps.forEach((depId) => {
      if (positions[depId] && positions[task.id]) {
        edges.push({
          from: depId,
          to: task.id,
          fromPos: positions[depId],
          toPos: positions[task.id],
        });
      }
    });
  });

  return (
    <div className="p-4 bg-slate-800 rounded-xl border border-slate-700 overflow-auto">
      <svg width={svgWidth} height={svgHeight} className="min-w-full">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((edge, idx) => (
          <line
            key={idx}
            x1={edge.fromPos.x + nodeWidth}
            y1={edge.fromPos.y + nodeHeight / 2}
            x2={edge.toPos.x}
            y2={edge.toPos.y + nodeHeight / 2}
            stroke="#475569"
            strokeWidth="2"
            markerEnd="url(#arrowhead)"
          />
        ))}

        {/* Nodes */}
        {tasks.map((task) => {
          const pos = positions[task.id];
          if (!pos) return null;

          const isActive = task.id === currentTaskId || task.status === 'in_progress';
          const color = statusColors[task.status] || statusColors.pending;

          return (
            <g key={task.id} transform={`translate(${pos.x}, ${pos.y})`}>
              <rect
                width={nodeWidth}
                height={nodeHeight}
                rx="8"
                fill={isActive ? '#1e3a5f' : '#1e293b'}
                stroke={color}
                strokeWidth={isActive ? 3 : 2}
                className={isActive ? 'animate-pulse' : ''}
              />
              <text
                x={nodeWidth / 2}
                y={22}
                textAnchor="middle"
                fill={color}
                fontSize="14"
                fontWeight="600"
              >
                {task.id}
              </text>
              <text
                x={nodeWidth / 2}
                y={42}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="11"
              >
                {task.task_description?.slice(0, 25)}
                {task.task_description?.length > 25 ? '...' : ''}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-slate-700">
        {Object.entries(statusColors).map(([status, color]) => (
          <div key={status} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-slate-400 capitalize">
              {status.replace(/_/g, ' ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TaskGraph;
