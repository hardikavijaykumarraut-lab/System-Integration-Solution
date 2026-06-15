import { X, Mail, Phone, MapPin, Building, Calendar, User } from 'lucide-react';

const ProfilePopup = ({ user, onClose, isLarge = false }) => {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const getProfileImageUrl = (profileImage) => {
    if (!profileImage) return null;
    if (profileImage.startsWith('http')) return profileImage;
    return `${API_URL}${profileImage}`;
  };

  const profileImageUrl = getProfileImageUrl(user?.profile_image);

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className={`bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar ${
          isLarge ? 'max-w-3xl w-full' : 'max-w-md w-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with gradient */}
        <div className="relative h-32 bg-gradient-to-r from-cyan-500 to-fuchsia-600">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Content */}
        <div className="px-6 pb-6">
          {/* Profile Picture - Larger when clicked */}
          <div className="-mt-16 mb-4 flex justify-center">
            <div className={`relative rounded-full bg-gradient-to-br from-cyan-500 to-fuchsia-500 p-1 shadow-xl ${
              isLarge ? 'w-40 h-40' : 'w-32 h-32'
            }`}>
              <div className="w-full h-full rounded-full bg-white p-1">
                {profileImageUrl ? (
                  <img
                    src={profileImageUrl}
                    alt={`${user?.first_name} ${user?.last_name}`}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center">
                    <User className={`text-gray-400 ${isLarge ? 'w-16 h-16' : 'w-12 h-12'}`} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Name and Role */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {user?.first_name} {user?.last_name}
            </h2>
            <p className="text-gray-600 capitalize font-medium mt-1">
              {user?.role?.replace('_', ' ')}
            </p>
            {user?.department_name && (
              <p className="text-sm text-gray-500 mt-1">{user.department_name}</p>
            )}
          </div>

          {/* Information Grid */}
          <div className="space-y-3">
            {/* Email */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Mail className="w-5 h-5 text-cyan-600" />
              <div>
                <p className="text-xs text-gray-500 font-medium">Email</p>
                <p className="text-sm text-gray-900">{user?.email}</p>
              </div>
            </div>

            {/* Phone */}
            {user?.phone && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Phone className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-xs text-gray-500 font-medium">Phone</p>
                  <p className="text-sm text-gray-900">{user.phone}</p>
                </div>
              </div>
            )}

            {/* Company */}
            {user?.company_name && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Building className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-xs text-gray-500 font-medium">Company</p>
                  <p className="text-sm text-gray-900">{user.company_name}</p>
                </div>
              </div>
            )}

            {/* Location */}
            {(user?.city || user?.country) && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <MapPin className="w-5 h-5 text-red-600" />
                <div>
                  <p className="text-xs text-gray-500 font-medium">Location</p>
                  <p className="text-sm text-gray-900">
                    {[user?.city, user?.country].filter(Boolean).join(', ')}
                  </p>
                </div>
              </div>
            )}

            {/* Member Since */}
            {user?.created_at && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Calendar className="w-5 h-5 text-orange-600" />
                <div>
                  <p className="text-xs text-gray-500 font-medium">Member Since</p>
                  <p className="text-sm text-gray-900">{formatDate(user.created_at)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Bio */}
          {user?.bio && (
            <div className="mt-4 p-4 bg-cyan-50 border border-cyan-200 rounded-lg">
              <p className="text-xs text-cyan-700 font-semibold mb-1">About</p>
              <p className="text-sm text-gray-700 leading-relaxed">{user.bio}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePopup;
