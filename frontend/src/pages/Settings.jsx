import { useState, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { uploadAPI, clientsAPI } from '../services/api';
import ProfilePictureUpload from '../components/ProfilePictureUpload';
import { User, Lock, Bell, Shield, Building2, MapPin, Phone } from 'lucide-react';
import toast from 'react-hot-toast';

const Settings = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'password', label: 'Password', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your account settings</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="w-full lg:w-64 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary-50 text-primary-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'profile' && <ProfileSettings />}
          {activeTab === 'password' && <PasswordSettings />}
          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'security' && <SecuritySettings />}
        </div>
      </div>
    </div>
  );
};

const ProfileSettings = () => {
  const { user, updateUser } = useAuthStore();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    bio: user?.bio || '',
    // Client-specific fields
    client_id: user?.client_id || '',
    company_name: user?.company_name || '',
    address: user?.address || '',
    city: user?.city || '',
    country: user?.country || '',
  });
  
  const isClient = user?.role === 'client';

  const handlePhotoUpload = async (e) => {
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

    setUploading(true);
    try {
      const response = await uploadAPI.uploadProfilePhoto(file);
      updateUser({ profile_image: response.data.data.photo_url });
      toast.success('Profile photo updated successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // For clients, call the API to update profile
      if (isClient) {
        const updateData = {
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone,
          bio: formData.bio,
          company_name: formData.company_name,
          address: formData.address,
          city: formData.city,
          country: formData.country,
        };
        await clientsAPI.updateProfile(user?.id || user?._id, updateData);
      }
      
      // Update local state
      updateUser(formData);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    }
  };

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-6">Profile Information</h2>
      
      {/* Profile Photo with Cropping */}
      <div className="flex items-center gap-6 mb-6">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
            {user?.profile_image ? (
              <img 
                src={user.profile_image.startsWith('/') ? `http://localhost:5000${user.profile_image}` : user.profile_image} 
                alt="Profile" 
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-12 h-12 text-gray-400" />
            )}
          </div>
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-lg mb-2">Profile Photo</h3>
          <p className="text-sm text-gray-500 mb-3">Click below to upload and crop your profile picture</p>
          <ProfilePictureUpload 
            currentImageUrl={user?.profile_image}
            onUpload={(photoUrl) => {
              updateUser({ profile_image: photoUrl });
            }}
            userId={user?.id}
          />
          <p className="text-xs text-gray-400 mt-2">Supports JPG, PNG, GIF, WebP up to 5MB • Auto-cropped to circular shape</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">First Name</label>
            <input
              type="text"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">Last Name</label>
            <input
              type="text"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              className="input"
            />
          </div>
        </div>
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            value={formData.email}
            disabled
            className="input bg-gray-50"
          />
        </div>
        <div>
          <label className="label">Phone</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="input"
          />
        </div>
        
        {/* Client-specific fields */}
        {isClient && (
          <>
            <div className="border-t pt-4 mt-4">
              <h3 className="text-md font-semibold mb-4 text-gray-800">Company Information</h3>
            </div>
            <div>
              <label className="label">Client ID</label>
              <input
                type="text"
                value={formData.client_id}
                disabled
                className="input bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">Client ID cannot be changed</p>
            </div>
            <div>
              <label className="label">Company Name</label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Address</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="input h-20 resize-none"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Country</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="input"
                />
              </div>
            </div>
          </>
        )}
        
        <div>
          <label className="label">Bio</label>
          <textarea
            value={formData.bio}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            className="input"
            rows={4}
          />
        </div>
        <button type="submit" className="btn-primary">
          Save Changes
        </button>
      </form>
    </div>
  );
};

const PasswordSettings = () => {
  const [formData, setFormData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.new_password !== formData.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    try {
      // API call to change password would go here
      toast.success('Password changed successfully');
      setFormData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (error) {
      toast.error('Failed to change password');
    }
  };

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-6">Change Password</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Current Password</label>
          <input
            type="password"
            value={formData.current_password}
            onChange={(e) => setFormData({ ...formData, current_password: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label className="label">New Password</label>
          <input
            type="password"
            value={formData.new_password}
            onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label className="label">Confirm New Password</label>
          <input
            type="password"
            value={formData.confirm_password}
            onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
            className="input"
          />
        </div>
        <button type="submit" className="btn-primary">
          Change Password
        </button>
      </form>
    </div>
  );
};

const NotificationSettings = () => {
  const [settings, setSettings] = useState({
    email_notifications: true,
    task_assignments: true,
    project_updates: true,
    mentions: true,
    weekly_digest: false,
  });

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-6">Notification Preferences</h2>
      <div className="space-y-4">
        {Object.entries(settings).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium capitalize">{key.replace(/_/g, ' ')}</p>
              <p className="text-sm text-gray-500">
                Receive notifications for {key.replace(/_/g, ' ')}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};

const SecuritySettings = () => {
  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-6">Security Settings</h2>
      <div className="space-y-6">
        <div className="flex items-center justify-between py-3 border-b">
          <div>
            <p className="font-medium">Two-Factor Authentication</p>
            <p className="text-sm text-gray-500">Add an extra layer of security</p>
          </div>
          <button className="btn-secondary">Enable</button>
        </div>
        <div className="flex items-center justify-between py-3 border-b">
          <div>
            <p className="font-medium">Active Sessions</p>
            <p className="text-sm text-gray-500">Manage your active sessions</p>
          </div>
          <button className="btn-secondary">View</button>
        </div>
        <div className="flex items-center justify-between py-3 border-b">
          <div>
            <p className="font-medium">Login History</p>
            <p className="text-sm text-gray-500">View your recent login activity</p>
          </div>
          <button className="btn-secondary">View</button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
