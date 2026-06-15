import bcrypt
import uuid
from datetime import datetime
from flask import current_app

def hash_password(password):
    """Hash a password using bcrypt."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(password, hashed):
    """Verify a password against its hash."""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def generate_unique_id():
    """Generate a unique identifier."""
    return str(uuid.uuid4())

def allowed_file(filename):
    """Check if file extension is allowed."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in current_app.config['ALLOWED_EXTENSIONS']

def format_datetime(dt):
    """Format datetime object to ISO string."""
    if isinstance(dt, datetime):
        return dt.isoformat()
    return dt

def parse_datetime(date_string):
    """Parse ISO format datetime string."""
    if isinstance(date_string, str):
        try:
            return datetime.fromisoformat(date_string.replace('Z', '+00:00'))
        except ValueError:
            return None
    return date_string

def serialize_document(doc):
    """Serialize MongoDB document for JSON response."""
    if doc is None:
        return None
    
    if isinstance(doc, list):
        return [serialize_document(item) for item in doc]
    
    if isinstance(doc, dict):
        serialized = {}
        for key, value in doc.items():
            if key == '_id':
                serialized['id'] = str(value)
            elif isinstance(value, datetime):
                serialized[key] = value.isoformat()
            elif isinstance(value, (dict, list)):
                serialized[key] = serialize_document(value)
            else:
                serialized[key] = value
        return serialized
    
    return doc

def paginate_results(query, page=1, per_page=10):
    """Paginate MongoDB query results."""
    skip = (page - 1) * per_page
    
    # Handle both Cursor and Collection objects
    if hasattr(query, 'count_documents'):
        # It's a Collection
        total = query.count_documents({})
        items = list(query.find().skip(skip).limit(per_page))
    elif hasattr(query, 'collection'):
        # It's a Cursor - get count from the collection with the same filter
        # Clone the cursor to get the count without consuming it
        total = len(list(query.clone()))
        items = list(query.skip(skip).limit(per_page))
    else:
        # Fallback: convert to list and count
        all_items = list(query)
        total = len(all_items)
        items = all_items[skip:skip + per_page]
    
    return {
        'items': items,
        'total': total,
        'page': page,
        'per_page': per_page,
        'total_pages': (total + per_page - 1) // per_page if total > 0 else 1
    }

def generate_project_code(department_code, sequence):
    """Generate unique project code."""
    timestamp = datetime.now().strftime('%Y%m')
    return f"{department_code}-{timestamp}-{sequence:04d}"

def calculate_task_progress(tasks):
    """Calculate overall progress percentage from tasks."""
    if not tasks:
        return 0
    
    total_progress = sum(task.get('progress', 0) for task in tasks)
    return round(total_progress / len(tasks), 2)

def get_status_color(status):
    """Get color code for status."""
    colors = {
        'pending': '#FFC107',
        'in_progress': '#2196F3',
        'completed': '#4CAF50',
        'on_hold': '#FF9800',
        'cancelled': '#F44336',
        'active': '#4CAF50',
        'inactive': '#9E9E9E'
    }
    return colors.get(status.lower(), '#9E9E9E')
