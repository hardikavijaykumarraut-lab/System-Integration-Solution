from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
import os
import uuid
from datetime import datetime
from app import mongo
from app.utils.helpers import allowed_file
from app.models.file_upload import FileUpload

upload_bp = Blueprint('upload', __name__)


def get_upload_folder():
    upload_folder = current_app.config.get('UPLOAD_FOLDER', 'uploads')
    absolute_folder = os.path.abspath(os.path.join(current_app.root_path, '..', upload_folder))
    os.makedirs(absolute_folder, exist_ok=True)
    return absolute_folder

@upload_bp.route('/profile-photo', methods=['POST'])
@jwt_required()
def upload_profile_photo():
    """Upload profile photo for current user."""
    try:
        if 'file' not in request.files:
            print('No file in request.files')
            return jsonify({'success': False, 'message': 'No file provided'}), 400
        
        file = request.files['file']
        print(f'File received: {file.filename}, Type: {file.content_type}')
        
        if file.filename == '':
            return jsonify({'success': False, 'message': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else 'none'
            print(f'File type not allowed: {ext}')
            return jsonify({'success': False, 'message': f'File type not allowed: {ext}'}), 400
        
        current_user_id = get_jwt_identity()
        
        # Generate unique filename
        filename = secure_filename(file.filename)
        ext = filename.rsplit('.', 1)[1].lower()
        unique_filename = f"{uuid.uuid4()}_{current_user_id}.{ext}"
        
        # Save file
        upload_folder = get_upload_folder()
        filepath = os.path.join(upload_folder, unique_filename)
        file.save(filepath)
        
        # Update user profile with photo URL
        photo_url = f"/uploads/{unique_filename}"
        mongo.db.users.update_one(
            {'_id': current_user_id},
            {'$set': {'profile_image': photo_url}}
        )
        
        return jsonify({
            'success': True,
            'message': 'Profile photo uploaded successfully',
            'data': {'photo_url': photo_url}
        }), 200
    except Exception as e:
        print(f'Error uploading profile photo: {str(e)}')
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Upload failed: {str(e)}'}), 500

@upload_bp.route('/general', methods=['POST'])
@jwt_required()
def upload_file():
    """General file upload endpoint with database storage."""
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file provided'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'success': False, 'message': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'success': False, 'message': 'File type not allowed'}), 400
    
    current_user_id = get_jwt_identity()
    
    # Generate unique filename
    original_filename = secure_filename(file.filename)
    ext = original_filename.rsplit('.', 1)[1].lower()
    unique_filename = f"{uuid.uuid4()}.{ext}"
    
    # Get file size
    file.seek(0, 2)  # Move to end of file
    file_size = file.tell()
    file.seek(0)  # Reset to beginning
    
    # Save file to disk
    upload_folder = get_upload_folder()
    filepath = os.path.join(upload_folder, unique_filename)
    file.save(filepath)
    
    file_url = f"/uploads/{unique_filename}"
    
    # Store file metadata in database
    try:
        upload_record = FileUpload.create({
            '_id': generate_unique_id(),
            'filename': unique_filename,
            'original_name': original_filename,
            'file_path': filepath,
            'file_url': file_url,
            'file_size': file_size,
            'mime_type': file.content_type or 'application/octet-stream',
            'uploaded_by': current_user_id,
            'description': request.form.get('description', ''),
            'metadata': {
                'content_type': file.content_type,
                'source': request.form.get('source', 'general')
            }
        })
        
        return jsonify({
            'success': True,
            'message': 'File uploaded successfully',
            'data': FileUpload.serialize(upload_record)
        }), 201
        
    except Exception as e:
        # If DB insert fails, still return success but log the error
        current_app.logger.error(f"Failed to store file metadata in DB: {str(e)}")
        return jsonify({
            'success': True,
            'message': 'File uploaded successfully (metadata not stored)',
            'data': {
                'file_url': file_url,
                'filename': unique_filename,
                'original_name': original_filename
            }
        }), 200

@upload_bp.route('/files', methods=['GET'])
@jwt_required()
def get_all_files():
    """Get all files uploaded by current user or all files for admin."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    try:
        # Admin can see all files, others see only their own
        if current_user.get('role') == 'admin':
            files_cursor = mongo.db.file_uploads.find({'is_active': {'$ne': False}}).sort('uploaded_at', -1)
            files = list(files_cursor)
        else:
            files = FileUpload.get_by_user(current_user_id)
        
        serialized_files = [FileUpload.serialize(f) for f in files]
        
        return jsonify({
            'success': True,
            'data': {
                'files': serialized_files,
                'total': len(serialized_files)
            }
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@upload_bp.route('/files/<file_id>', methods=['GET'])
@jwt_required()
def get_file_info(file_id):
    """Get file information by ID."""
    try:
        file_record = FileUpload.get_by_id(file_id)
        if not file_record:
            return jsonify({'success': False, 'message': 'File not found'}), 404
        
        return jsonify({
            'success': True,
            'data': FileUpload.serialize(file_record)
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@upload_bp.route('/download', methods=['POST'])
@jwt_required()
def download_file_by_url():
    """Download a file by URL or path - universal endpoint for all file types."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
            
        file_url = data.get('url') or data.get('path') or data.get('file_url')
        filename = data.get('name') or data.get('filename') or 'file'
        
        if not file_url:
            return jsonify({'success': False, 'message': 'No file URL provided'}), 400
        
        # Handle different URL formats
        if file_url.startswith('/uploads/'):
            # File is in the upload folder
            upload_folder = get_upload_folder()
            file_path = os.path.join(upload_folder, os.path.basename(file_url))
            if os.path.exists(file_path):
                return send_from_directory(
                    upload_folder,
                    os.path.basename(file_url),
                    as_attachment=True,
                    download_name=filename
                )
            else:
                current_app.logger.error(f"File not found: {file_path}")
                return jsonify({'success': False, 'message': 'File not found on server'}), 404
        elif file_url.startswith('http'):
            # For external URLs, redirect to the URL
            return jsonify({
                'success': True,
                'download_url': file_url
            }), 200
        else:
            # Try to find file in uploads folder
            upload_folder = get_upload_folder()
            file_path = os.path.join(upload_folder, os.path.basename(file_url))
            if os.path.exists(file_path):
                return send_from_directory(
                    upload_folder,
                    os.path.basename(file_url),
                    as_attachment=True,
                    download_name=filename
                )
            else:
                current_app.logger.error(f"File not found: {file_path}")
                return jsonify({'success': False, 'message': 'File not found on server'}), 404
    except Exception as e:
        current_app.logger.error(f"Error downloading file: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@upload_bp.route('/files/<file_id>/download', methods=['GET'])
@jwt_required()
def download_file(file_id):
    """Download a file by ID and increment download count."""
    try:
        file_record = FileUpload.get_by_id(file_id)
        if not file_record:
            return jsonify({'success': False, 'message': 'File not found'}), 404
        
        # Increment download count
        FileUpload.increment_download_count(file_id)
        
        # Send file
        upload_folder = get_upload_folder()
        return send_from_directory(
            upload_folder,
            file_record['filename'],
            as_attachment=True,
            download_name=file_record.get('original_name', file_record['filename'])
        )
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

def generate_unique_id():
    """Generate a unique ID for file uploads."""
    return str(uuid.uuid4())
