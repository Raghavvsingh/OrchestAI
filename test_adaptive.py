"""Quick test of the adaptive analysis system."""
import sys
sys.path.insert(0, 'backend')

import asyncio
from agents.planner import PlannerAgent
from agents.greybox_prompts import get_task_focus_for_context

async def test_planner():
    print("=" * 80)
    print("TESTING ADAPTIVE ANALYSIS SYSTEM")
    print("=" * 80)
    
    # Test 1: Analyze Swiggy (existing company)
    print("\n### Test 1: Analyze Swiggy ###")
    planner = PlannerAgent("test_run_1")
    result = await planner.execute({"goal": "Analyze Swiggy"})
    
    classification = result.get("classification", {})
    print(f"Goal Type: {result.get('goal_type')}")
    print(f"Entity Type: {classification.get('entity_type')}")
    print(f"Entities: {classification.get('entities')}")
    print(f"Domain: {classification.get('domain')}")
    print(f"\nTasks Generated:")
    
    tasks = result.get("plan", {}).get("tasks", result.get("tasks", []))
    for task in tasks:
        print(f"  {task.get('id')}: {task.get('task')[:120]}...")
    
    # Test task focus mapping
    print(f"\nTask Focus for T1 (existing_company):")
    focus = get_task_focus_for_context("T1", "existing_company")
    print(f"  Name: {focus.get('name')}")
    print(f"  Focus: {focus.get('focus')}")
    
    # Test 2: Startup idea
    print("\n\n### Test 2: Startup idea: AI fitness coach ###")
    planner2 = PlannerAgent("test_run_2")
    result2 = await planner2.execute({"goal": "Startup idea: AI fitness coach for personalized workouts"})
    
    classification2 = result2.get("classification", {})
    print(f"Goal Type: {result2.get('goal_type')}")
    print(f"Entity Type: {classification2.get('entity_type')}")
    print(f"Entities: {classification2.get('entities')}")
    
    print(f"\nTasks Generated:")
    tasks2 = result2.get("plan", {}).get("tasks", result2.get("tasks", []))
    for task in tasks2[:3]:  # First 3 tasks
        print(f"  {task.get('id')}: {task.get('task')[:120]}...")
    
    # Test task focus mapping
    print(f"\nTask Focus for T1 (startup_idea):")
    focus2 = get_task_focus_for_context("T1", "startup_idea")
    print(f"  Name: {focus2.get('name')}")
    print(f"  Focus: {focus2.get('focus')}")
    
    # Test 3: Comparison
    print("\n\n### Test 3: Compare Uber vs Ola ###")
    planner3 = PlannerAgent("test_run_3")
    result3 = await planner3.execute({"goal": "Compare Uber vs Ola"})
    
    classification3 = result3.get("classification", {})
    print(f"Goal Type: {result3.get('goal_type')}")
    print(f"Entities: {classification3.get('entities')}")
    
    print("\n" + "=" * 80)
    print("TESTS COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(test_planner())
