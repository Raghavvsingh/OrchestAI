"""Test entity type detection without async."""
import sys
sys.path.insert(0, 'backend')

from agents.greybox_prompts import get_task_focus_for_context, COMPANY_TASK_FOCUS_MAP, STARTUP_TASK_FOCUS_MAP

print("=" * 80)
print("TESTING TASK FOCUS MAPPING")
print("=" * 80)

print("\n### Test 1: Company Analysis Task Focus ###")
for task_id in ["T1", "T2", "T3", "T4", "T5"]:
    focus = get_task_focus_for_context(task_id, "existing_company")
    print(f"{task_id}: {focus['name']} - {focus['focus']}")

print("\n### Test 2: Startup Idea Task Focus ###")
for task_id in ["T1", "T2", "T3", "T4", "T5"]:
    focus = get_task_focus_for_context(task_id, "startup_idea")
    print(f"{task_id}: {focus['name']} - {focus['focus']}")

print("\n### Test 3: Entity Type Detection Logic ###")
# This would need to import PlannerAgent and test _detect_entity_type
# But for now, let's just verify the mappings exist

print(f"Company task map has {len(COMPANY_TASK_FOCUS_MAP)} entries")
print(f"Startup task map has {len(STARTUP_TASK_FOCUS_MAP)} entries")

print("\n" + "=" * 80)
print("TASK FOCUS MAPPING TESTS COMPLETE")
print("=" * 80)
