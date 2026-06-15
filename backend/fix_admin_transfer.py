"""
Script to fix missing admin-to-team-lead transfers in database.
This adds the 25,000 transfer that was recorded but not properly tracked.
"""

from pymongo import MongoClient
from datetime import datetime
from bson.objectid import ObjectId

# Connect to MongoDB
client = MongoClient('mongodb://localhost:27017/')
db = client['system_integration_db']  # Your database name

# Find your team lead user
team_lead = db.users.find_one({'role': 'team_leader'})

if not team_lead:
    print("No team lead found!")
    exit()

print(f"Found team lead: {team_lead.get('first_name')} {team_lead.get('last_name')}")

# Find a project assigned to this team lead (or use None)
project = db.projects.find_one({'team_lead_id': team_lead['_id']})
project_id = project['_id'] if project else None

if project:
    print(f"Using project: {project.get('name')}")

# Create transfer record in transactions collection
transfer = {
    '_id': str(ObjectId()),
    'type': 'transfer',
    'from_user_id': 'admin_user_id',  # Replace with actual admin ID
    'from_user_name': 'Admin',
    'to_user_id': team_lead['_id'],
    'to_user_name': f"{team_lead.get('first_name')} {team_lead.get('last_name')}",
    'team_lead_id': team_lead['_id'],
    'project_id': project_id,
    'amount': 25000.0,
    'status': 'completed',
    'category': 'transfer',
    'subcategory': 'team_lead_funding',
    'description': 'Initial funds transferred to team lead for project expenses and wages',
    'notes': 'Manual entry - Previous transfer was not tracked',
    'transaction_date': datetime.utcnow(),
    'created_at': datetime.utcnow(),
    'updated_at': datetime.utcnow()
}

# Create expense record as well
expense = {
    '_id': str(ObjectId()),
    'team_lead_id': team_lead['_id'],
    'project_id': project_id,
    'amount': 25000.0,
    'category': 'transfer',
    'subcategory': 'team_lead_payment',
    'description': f'Transfer to team lead: {team_lead.get("first_name")} {team_lead.get("last_name")}',
    'notes': 'Manual entry - Previous transfer was not tracked',
    'status': 'completed',
    'payment_mode': 'bank_transfer',
    'transaction_id': 'TXN-MANUAL-001',
    'expense_date': datetime.utcnow(),
    'created_at': datetime.utcnow(),
    'updated_at': datetime.utcnow()
}

# Insert into database
print("\nInserting transfer record...")
db.transactions.insert_one(transfer)
print("✓ Transfer added to transactions collection")

print("Inserting expense record...")
db.expenses.insert_one(expense)
print("✓ Expense added to expenses collection")

print("\n✅ Successfully added 25,000 transfer to team lead!")
print(f"Team Lead: {team_lead.get('first_name')} {team_lead.get('last_name')}")
print(f"Amount: ₹25,000")
print(f"Transaction ID: {transfer['_id']}")
