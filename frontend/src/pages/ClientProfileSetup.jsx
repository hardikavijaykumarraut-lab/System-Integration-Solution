import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { clientsAPI, uploadAPI } from '../services/api';
import { 
  User, 
  Building2, 
  Phone, 
  MapPin, 
  Camera,
  Check,
  Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

const ClientProfileSetup = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuthStore();
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    client_id: user?.client_id || '',
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    phone: user?.phone || '',
    company_name: user?.company_name || '',
    address: user?.address || '',
    city: user?.city || '',
    country: user?.country || '',
  });
  
  const [profileImage, setProfileImage] = useState(user?.profile_image || null);
  const [previewImage, setPreviewImage] = useState(user?.profile_image || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewImage(reader.result);
    };
    reader.readAsDataURL(file);

    // Upload image
    setIsUploading(true);
    try {
      const response = await uploadAPI.uploadProfilePhoto(file);
      const photoUrl = response.data.data.photo_url || response.data.data.url;
      setProfileImage(photoUrl);
      toast.success('Profile photo uploaded successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload profile photo');
      setPreviewImage(profileImage);
    } finally {
      setIsUploading(false);
    }
  };

  const validateForm = () => {
    if (!formData.client_id.trim()) {
      toast.error('Client ID is required');
      return false;
    }
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      toast.error('First name and last name are required');
      return false;
    }
    if (!formData.phone.trim()) {
      toast.error('Contact number is required');
      return false;
    }
    if (!formData.company_name.trim()) {
      toast.error('Company name is required');
      return false;
    }
    if (!formData.address.trim()) {
      toast.error('Address is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const updateData = {
        ...formData,
        profile_image: profileImage,
        profile_completed: true,
      };
      
      const response = await clientsAPI.updateProfile(user?.id || user?._id, updateData);
      
      // Update local user state
      updateUser({
        ...updateData,
        id: user?.id || user?._id,
      });
      
      // Mark profile as complete in auth store
      const { setProfileComplete } = useAuthStore.getState();
      setProfileComplete(true);
      
      toast.success('Profile completed successfully!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Complete Your Profile</h1>
          <p className="text-gray-600 mt-2">
            Please fill in your details to get started with our services
          </p>
        </div>

        {/* Profile Form */}
        <form onSubmit={handleSubmit} className="card space-y-6">
          {/* Profile Picture */}
          <div className="flex flex-col items-center">
            <div 
              onClick={handleImageClick}
              className="relative w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-300 transition-colors overflow-hidden border-4 border-white shadow-lg"
            >
              {previewImage ? (
                <img 
                  src={previewImage} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-16 h-16 text-gray-400" />
              )}
              
              {/* Overlay */}
              <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <Camera className="w-8 h-8 text-white" />
              </div>
              
              {/* Uploading indicator */}
              {isUploading && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
            
            <p className="text-sm text-gray-500 mt-2">
              Click to upload profile picture
            </p>
          </div>

          {/* Client ID */}
          <div>
            <label htmlFor="client_id" className="label flex items-center">
              <User className="w-4 h-4 mr-2" />
              Client ID (Unique)
            </label>
            <input
              type="text"
              id="client_id"
              name="client_id"
              value={formData.client_id}
              onChange={handleChange}
              placeholder="Enter a unique client ID"
              className="input"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              This will be your unique identifier in our system
            </p>
          </div>

          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="first_name" className="label">First Name</label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                placeholder="First name"
                className="input"
                required
              />
            </div>
            <div>
              <label htmlFor="last_name" className="label">Last Name</label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                placeholder="Last name"
                className="input"
                required
              />
            </div>
          </div>

          {/* Contact Number */}
          <div>
            <label htmlFor="phone" className="label flex items-center">
              <Phone className="w-4 h-4 mr-2" />
              Contact Number
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+1 (555) 123-4567"
              className="input"
              required
            />
          </div>

          {/* Company Name */}
          <div>
            <label htmlFor="company_name" className="label flex items-center">
              <Building2 className="w-4 h-4 mr-2" />
              Company Name
            </label>
            <input
              type="text"
              id="company_name"
              name="company_name"
              value={formData.company_name}
              onChange={handleChange}
              placeholder="Your company name"
              className="input"
              required
            />
          </div>

          {/* Address */}
          <div>
            <label htmlFor="address" className="label flex items-center">
              <MapPin className="w-4 h-4 mr-2" />
              Address
            </label>
            <textarea
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Street address, building, suite, etc."
              className="input h-24 resize-none"
              required
            />
          </div>

          {/* City & Country */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="city" className="label">City</label>
              <input
                type="text"
                id="city"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="City"
                className="input"
              />
            </div>
            <div>
              <label htmlFor="country" className="label">Country</label>
              <input
                type="text"
                id="country"
                name="country"
                value={formData.country}
                onChange={handleChange}
                placeholder="Country"
                className="input"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || isUploading}
            className="btn-primary w-full flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Complete Profile
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ClientProfileSetup;
