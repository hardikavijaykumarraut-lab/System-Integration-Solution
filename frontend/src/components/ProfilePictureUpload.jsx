import { useState, useRef } from 'react';
import ImageCropper from './ImageCropper';
import { X, Upload, Crop, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const ProfilePictureUpload = ({ currentImageUrl, onUpload, userId }) => {
  const [showCropModal, setShowCropModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [crop, setCrop] = useState({ unit: 'px', x: 0, y: 0, width: 100, height: 100, aspect: 1 });
  const [completedCrop, setCompletedCrop] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (JPEG, PNG, GIF, WebP)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    // Create preview URL
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
  };

  const getCroppedImg = async (imageSrc, pixelCrop) => {
    const image = new Image();
    image.src = imageSrc;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx || !pixelCrop) return null;

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        blob.name = `cropped-profile-${Date.now()}.png`;
        resolve(blob);
      }, 'image/png');
    });
  };

  const handleCropAndUpload = async () => {
    if (!completedCrop || !selectedImage) return;

    setIsUploading(true);
    try {
      // Get cropped image
      const croppedBlob = await getCroppedImg(selectedImage, completedCrop);
      
      if (!croppedBlob) {
        toast.error('Failed to crop image');
        return;
      }

      // Create FormData
      const formData = new FormData();
      // Ensure the blob has a filename
      const file = new File([croppedBlob], `profile-${Date.now()}.png`, { type: 'image/png' });
      formData.append('file', file);

      console.log('Uploading profile photo...');

      // Upload to backend
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/upload/profile-photo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: formData,
      });

      console.log('Response status:', response.status);
      const result = await response.json();
      console.log('Response data:', result);
      
      if (result.success) {
        onUpload(result.data.photo_url);
        toast.success('Profile photo updated successfully!');
        setShowCropModal(false);
        setSelectedImage(null);
      } else {
        toast.error(result.message || 'Failed to upload photo');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload profile photo');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      {/* Upload Button */}
      <div className="relative inline-block">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          id="profile-photo-upload"
        />
        <label
          htmlFor="profile-photo-upload"
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white rounded-lg cursor-pointer hover:from-cyan-600 hover:to-fuchsia-600 transition-all shadow-md hover:shadow-lg"
        >
          <Upload className="w-4 h-4" />
          <span>{currentImageUrl ? 'Change Photo' : 'Upload Photo'}</span>
        </label>
      </div>

      {/* Crop Modal */}
      {showCropModal && selectedImage && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Crop Profile Picture</h3>
                <p className="text-sm text-gray-500 mt-1">Adjust the crop area to your preference</p>
              </div>
              <button
                onClick={() => {
                  setShowCropModal(false);
                  setSelectedImage(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Cropper */}
              <ImageCropper
                image={selectedImage}
                crop={crop}
                setCrop={setCrop}
                completedCrop={completedCrop}
                setCompletedCrop={setCompletedCrop}
              />

              {/* Instructions */}
              <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Crop className="w-5 h-5 text-cyan-600 mt-0.5" />
                  <div className="text-sm text-cyan-800">
                    <p className="font-semibold mb-1">How to crop:</p>
                    <ul className="list-disc list-inside space-y-1 text-cyan-700">
                      <li>Drag the corners to resize the crop area</li>
                      <li>Move the crop box to select the desired area</li>
                      <li>The crop is circular - perfect for profile pictures!</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCropModal(false);
                    setSelectedImage(null);
                  }}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCropAndUpload}
                  disabled={isUploading || !completedCrop}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white rounded-lg hover:from-cyan-600 hover:to-fuchsia-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Crop & Upload
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProfilePictureUpload;
