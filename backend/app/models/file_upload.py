from datetime import datetime
from app import mongo

class FileUpload:
    """Model for file uploads stored in MongoDB."""
    
    @staticmethod
    def create(file_data):
        """Create a new file upload record in the database."""
        upload_record = {
            '_id': file_data.get('_id'),
            'filename': file_data['filename'],
            'original_name': file_data.get('original_name', file_data['filename']),
            'file_path': file_data['file_path'],
            'file_url': file_data['file_url'],
            'file_size': file_data.get('file_size', 0),
            'mime_type': file_data.get('mime_type', 'application/octet-stream'),
            'uploaded_by': file_data['uploaded_by'],
            'uploaded_at': file_data.get('uploaded_at', datetime.utcnow()),
            'description': file_data.get('description', ''),
            'metadata': file_data.get('metadata', {}),
            'download_count': file_data.get('download_count', 0),
            'is_active': file_data.get('is_active', True)
        }
        
        mongo.db.file_uploads.insert_one(upload_record)
        return upload_record
    
    @staticmethod
    def get_by_id(file_id):
        """Get a file upload record by ID."""
        return mongo.db.file_uploads.find_one({'_id': file_id})
    
    @staticmethod
    def get_by_user(user_id, limit=100):
        """Get all files uploaded by a specific user."""
        cursor = mongo.db.file_uploads.find({
            'uploaded_by': user_id,
            'is_active': True
        }).sort('uploaded_at', -1).limit(limit)
        return list(cursor)
    
    @staticmethod
    def update_metadata(file_id, metadata):
        """Update metadata for a file."""
        mongo.db.file_uploads.update_one(
            {'_id': file_id},
            {'$set': {'metadata': metadata, 'updated_at': datetime.utcnow()}}
        )
    
    @staticmethod
    def increment_download_count(file_id):
        """Increment the download count for a file."""
        mongo.db.file_uploads.update_one(
            {'_id': file_id},
            {'$inc': {'download_count': 1, 'updated_at': datetime.utcnow()}}
        )
    
    @staticmethod
    def delete(file_id):
        """Soft delete a file record."""
        mongo.db.file_uploads.update_one(
            {'_id': file_id},
            {'$set': {'is_active': False, 'updated_at': datetime.utcnow()}}
        )
    
    @staticmethod
    def serialize(upload_doc):
        """Serialize a file upload document for API responses."""
        if not upload_doc:
            return None
        
        return {
            'id': upload_doc['_id'],
            'filename': upload_doc['filename'],
            'original_name': upload_doc.get('original_name', upload_doc['filename']),
            'file_url': upload_doc['file_url'],
            'file_path': upload_doc['file_path'],
            'file_size': upload_doc.get('file_size', 0),
            'mime_type': upload_doc.get('mime_type', 'application/octet-stream'),
            'uploaded_by': upload_doc['uploaded_by'],
            'uploaded_at': upload_doc['uploaded_at'].isoformat() if isinstance(upload_doc['uploaded_at'], datetime) else upload_doc['uploaded_at'],
            'description': upload_doc.get('description', ''),
            'download_count': upload_doc.get('download_count', 0),
            'metadata': upload_doc.get('metadata', {})
        }
