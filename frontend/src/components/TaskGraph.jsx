import React, { useMemo } from 'react';

// Status colors for minimal theme
const statusColors = {
  pending: { bg: '#ffffff', border: '#e5e5e5', text: '#6b7280' },
  in_progress: { bg: '#fef3e2', border: '#f59e0b', text: '#92400e' },
  validating: { bg: '#fefce8', border: '#eab308', text: '#854d0e' },
  completed: { bg: '#ecfdf5', border: '#10b981', text: '#065f46' },
  failed: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' },
  blocked_by_failed_dependency: { bg: '#fff7ed', border: '#f97316', text: '#9a3412' },
  skipped: { bg: '#f9fafb', border: '#d1d5db', text: '#6b7280' },
};

// Helper to extract short task name
const getShortTaskName = (task) => {
  if (task.name) return task.name;
  const desc = task.task_description || '';
  // Extract first 2-3 meaningful words
  const words = desc.split(' ').slice(0, 3).join(' ');
  return words.length > 20 ? words.slice(0, 20) + '...' : words || 'Task';
};

function TaskGraph({ tasks, currentTaskId }) {
  // Build task dependency graph
  const { levels, taskMap, maxNodesInLevel } = useMemo(() => {
    if (!tasks || tasks.length === 0) {
      return { levels: {}, taskMap: {}, maxNodesInLevel: 0 };
    }

    const taskMap = {};
    tasks.forEach((task) => {
      taskMap[task.id] = task;
    });

    // Assign levels based on dependencies
    const levels = {};
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

    // Group by level
    const levelGroups = {};
    Object.entries(levels).forEach(([taskId, level]) => {
      if (!levelGroups[level]) levelGroups[level] = [];
      levelGroups[level].push(taskId);
    });

    const maxNodesInLevel = Math.max(...Object.values(levelGroups).map(g => g.length), 1);

    return { levels, taskMap, maxNodesInLevel, levelGroups };
  }, [tasks]);

  if (!tasks || tasks.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-12 text-center card-shadow">
        <p className="text-gray-500">No tasks to display</p>
      </div>
    );
  }

  // Group tasks by level for rendering
  const levelGroups = {};
  Object.entries(levels).forEach(([taskId, level]) => {
    if (!levelGroups[level]) levelGroups[level] = [];
    levelGroups[level].push(taskId);
  });

  const maxLevel = Math.max(...Object.keys(levelGroups).map(Number), 0);

  // Calculate positions for centered tree layout
  const nodeWidth = 160;
  const nodeHeight = 70;
  const levelGap = 100; // Vertical gap between levels
  const nodeGap = 30; // Horizontal gap between nodes

  const positions = {};
  const svgWidth = Math.max((maxNodesInLevel * (nodeWidth + nodeGap)) + 100, 600);
  
  Object.entries(levelGroups).forEach(([level, taskIds]) => {
    const levelNum = Number(level);
    const y = 60 + levelNum * (nodeHeight + levelGap);
    const totalWidth = taskIds.length * nodeWidth + (taskIds.length - 1) * nodeGap;
    const startX = (svgWidth - totalWidth) / 2;
    
    taskIds.forEach((taskId, idx) => {
      positions[taskId] = {
        x: startX + idx * (nodeWidth + nodeGap),
        y,
        centerX: startX + idx * (nodeWidth + nodeGap) + nodeWidth / 2,
        centerY: y + nodeHeight / 2,
      };
    });
  });

  const svgHeight = 100 + (maxLevel + 1) * (nodeHeight + levelGap);

  // Generate connection paths
  const connections = [];
  tasks.forEach((task) => {
    const deps = task.depends_on || [];
    deps.forEach((depId) => {
      if (positions[depId] && positions[task.id]) {
        const fromPos = positions[depId];
        const toPos = positions[task.id];
        connections.push({
          from: depId,
          to: task.id,
          path: generatePath(fromPos, toPos, nodeHeight),
        });
      }
    });
  });

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 card-shadow overflow-auto">
      <svg width={svgWidth} height={svgHeight} className="mx-auto">
        {/* Connection lines */}
        {connections.map((conn, idx) => (
          <path
            key={idx}
            d={conn.path}
            fill="none"
            stroke="#d1d5db"
            strokeWidth="1.5"
          />
        ))}

        {/* Task nodes */}
        {tasks.map((task) => {
          const pos = positions[task.id];
          if (!pos) return null;

          const isActive = task.id === currentTaskId || task.status === 'in_progress';
          const colors = statusColors[task.status] || statusColors.pending;

          return (
            <g key={task.id} className={isActive ? 'graph-node-active' : ''}>
              {/* Node rectangle */}
              <rect
                x={pos.x}
                y={pos.y}
                width={nodeWidth}
                height={nodeHeight}
                rx="12"
                fill={colors.bg}
                stroke={colors.border}
                strokeWidth={isActive ? 2 : 1}
              />
              
              {/* Task ID ONLY - centered */}
              <text
                x={pos.x + nodeWidth / 2}
                y={pos.y + nodeHeight / 2 + 5}
                textAnchor="middle"
                fill={colors.text}
                fontSize="16"
                fontWeight="700"
                fontFamily="Inter, system-ui, sans-serif"
              >
                {task.id}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Generate smooth path between nodes
function generatePath(fromPos, toPos, nodeHeight) {
  const startX = fromPos.centerX;
  const startY = fromPos.y + nodeHeight;
  const endX = toPos.centerX;
  const endY = toPos.y;
  
  const midY = (startY + endY) / 2;
  
  // Create a smooth path with corners
  return `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`;
}

export default TaskGraph;
