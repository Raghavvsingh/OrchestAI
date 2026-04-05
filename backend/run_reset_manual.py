#!/usr/bin/env python
"""
Manual database reset script - run this if PowerShell is not available.
This script resets the PostgreSQL database with the correct enum values.
"""

import os
import sys
import subprocess

# Change to backend directory
backend_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(backend_dir)

print(f"Current directory: {os.getcwd()}")
print("=" * 60)
print("OrchestAI Database Reset")
print("=" * 60)

# Run the reset_db.py script
try:
    result = subprocess.run([sys.executable, "reset_db.py"], capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr)
    print("=" * 60)
    if result.returncode == 0:
        print("✓ Database reset completed successfully!")
    else:
        print(f"✗ Database reset failed with return code {result.returncode}")
        sys.exit(1)
except Exception as e:
    print(f"Error running reset_db.py: {e}")
    sys.exit(1)
