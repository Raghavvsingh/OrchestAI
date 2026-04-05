-- Correct queries for Neon DB to check run status
-- (since Run model stores errors in final_report JSON, not error column)

-- Query 1: Check run status
SELECT 
    id,
    status, 
    goal,
    goal_type,
    current_task_id,
    final_report,
    created_at,
    updated_at,
    completed_at
FROM runs 
WHERE id = 'd6f01d1b-4780-47d0-bd6c-6232f900ec21';

-- Query 2: Check tasks for this run
SELECT 
    task_id, 
    status, 
    task_description,
    depends_on,
    error,
    last_error,
    retries,
    max_retries,
    validation_score,
    validation_issues
FROM tasks 
WHERE run_id = 'd6f01d1b-4780-47d0-bd6c-6232f900ec21'
ORDER BY order_index;

-- Query 3: Check recent logs
SELECT 
    agent,
    level,
    message,
    details,
    created_at
FROM logs 
WHERE run_id = 'd6f01d1b-4780-47d0-bd6c-6232f900ec21'
ORDER BY id DESC
LIMIT 20;

-- Query 4: Count tasks by status
SELECT 
    status,
    COUNT(*) as count
FROM tasks
WHERE run_id = 'd6f01d1b-4780-47d0-bd6c-6232f900ec21'
GROUP BY status;
