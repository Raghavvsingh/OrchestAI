"""Reset database - delete and recreate all tables."""
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

# Delete SQLite database if it exists
db_path = os.path.join(os.path.dirname(__file__), "orchestai.db")
if os.path.exists(db_path):
    os.remove(db_path)
    print(f"Deleted: {db_path}")

# Now import and recreate
from database import engine, Base, init_db, is_using_sqlite
from models.db_models import Run, Task, Log, CostTracking

print(f"Using SQLite: {is_using_sqlite()}")
print(f"Engine URL: {engine.url}")

# Drop ALL tables (including in PostgreSQL)
print("Dropping all existing tables...")
try:
    Base.metadata.drop_all(bind=engine)
    print("Tables dropped successfully")
except Exception as e:
    print(f"Warning during drop: {e}")

# Create all tables with new schema
print("Creating tables with new schema...")
Base.metadata.create_all(bind=engine)

print("Database tables created successfully!")
print("Tables created: runs, tasks, logs, cost_tracking")
print("You can now start the backend server.")
