import { useState, useRef, useEffect } from 'react';
import { Bell, Search, User, X, Building2, Briefcase, CreditCard, MessageSquare, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { chatAPI, dailyReportsAPI } from '../services/api';
import ProfilePopup from './ProfilePopup';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Header = () => {
  const { user } = useAuthStore();
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [showLargeProfile, setShowLargeProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const popupRef = useRef(null);
  const notifRef = useRef(null);

  // Fetch notifications
  useEffect(() => {
    if (showNotifications) {
      fetchNotifications();
    }
  }, [showNotifications]);

  // Fetch unread count periodically
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await chatAPI.getUnreadCount();
        setUnreadChatCount(response.data?.data?.unread_count || 0);
      } catch (error) {
        console.log('Failed to fetch unread count');
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Fetch every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    setLoadingNotifications(true);
    try {
      // Fetch unread chat messages
      const unreadResponse = await chatAPI.getUnreadCount();
      const chatCount = unreadResponse.data?.data?.unread_count || 0;

      let allNotifications = [];

      // Chat notifications
      if (chatCount > 0) {
        allNotifications.push({
          id: 'chat-unread',
          type: 'chat',
          title: 'New Messages',
          message: `You have ${chatCount} unread message${chatCount > 1 ? 's' : ''}`,
          icon: MessageSquare,
          color: 'blue',
          timestamp: new Date(),
          read: false
        });
      }

      // Try to fetch recent report submissions as system notifications
      try {
        const reportsResponse = await dailyReportsAPI.getAll({ limit: 5 });
        const reports = reportsResponse.data?.data || [];
        
        // Show notification if there are recent reports (last 24 hours)
        const recentReports = reports.filter(r => {
          const reportDate = new Date(r.created_at || r.report_date);
          const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          return reportDate > twentyFourHoursAgo;
        });

        if (recentReports.length > 0) {
          allNotifications.unshift({
            id: 'reports-submitted',
            type: 'report',
            title: 'Reports Submitted',
            message: `${recentReports.length} report${recentReports.length > 1 ? 's' : ''} submitted in the last 24 hours`,
            icon: CheckCircle,
            color: 'green',
            timestamp: new Date(recentReports[0]?.created_at || recentReports[0]?.report_date),
            read: false
          });
        }
      } catch (error) {
        console.log('Could not fetch reports');
      }

      // If no notifications, add a default message
      if (allNotifications.length === 0) {
        allNotifications.push({
          id: 'no-notif',
          type: 'empty',
          title: 'No Notifications',
          message: 'You\'re all caught up!',
          icon: AlertCircle,
          color: 'gray',
          timestamp: new Date(),
          read: true
        });
      }

      setNotifications(allNotifications);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        setShowProfilePopup(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    if (showProfilePopup || showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfilePopup, showNotifications]);

  // Construct full image URL
  const getProfileImageUrl = (profileImage) => {
    if (!profileImage) return null;
    if (profileImage.startsWith('http')) return profileImage;
    return `${API_URL}${profileImage}`;
  };

  const profileImageUrl = getProfileImageUrl(user?.profile_image);

  const totalUnread = Math.max(unreadChatCount, notifications.filter(n => !n.read).length);

  return (
    <header className="bg-white/80 backdrop-blur-md shadow-lg border-b border-gray-200 sticky top-0 z-40">
      <div className="flex items-center justify-between px-8 py-4">
        {/* Search */}
        <div className="flex-1 max-w-2xl">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-cyan-500 transition-colors" />
            <input
              type="text"
              placeholder="Search anything..."
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-2xl 
                         focus:bg-white focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 
                         outline-none transition-all duration-300"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-3 text-gray-600 hover:bg-gradient-to-r hover:from-cyan-50 hover:to-fuchsia-50 rounded-2xl transition-all duration-300 group"
            >
              <Bell className="w-5 h-5 group-hover:text-cyan-600 transition-colors" />
              {totalUnread > 0 && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 top-full mt-3 w-96 bg-white rounded-3xl shadow-2xl border-2 border-gray-100 z-50 overflow-hidden max-h-[80vh] overflow-y-auto custom-scrollbar">
                {/* Header */}
                <div className="bg-gradient-to-r from-cyan-500 to-fuchsia-600 p-6 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12 blur-xl"></div>
                  
                  <div className="flex items-center justify-between relative z-10">
                    <h3 className="font-bold text-lg">Notifications</h3>
                    <button 
                      onClick={() => setShowNotifications(false)}
                      className="p-1.5 hover:bg-white/20 rounded-xl transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Notification List */}
                <div className="max-h-[calc(80vh-100px)]">
                  {loadingNotifications ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">
                      <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No notifications yet</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {notifications.map((notif) => {
                        const Icon = notif.icon;
                        const colorClass = {
                          blue: 'bg-cyan-100 text-cyan-600',
                          green: 'bg-green-100 text-green-600',
                          yellow: 'bg-yellow-100 text-yellow-600',
                          red: 'bg-red-100 text-red-600',
                          gray: 'bg-gray-100 text-gray-600'
                        }[notif.color] || 'bg-gray-100 text-gray-600';

                        return (
                          <div 
                            key={notif.id}
                            className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                              notif.read ? 'opacity-60' : 'font-medium'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`p-3 rounded-xl flex-shrink-0 ${colorClass}`}>
                                <Icon className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-semibold text-gray-900">{notif.title}</h4>
                                <p className="text-sm text-gray-600 mt-1">{notif.message}</p>
                                <p className="text-xs text-gray-400 mt-2">
                                  {new Date(notif.timestamp).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                              {!notif.read && (
                                <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 flex-shrink-0 mt-1.5"></div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="relative">
            <button 
              onClick={() => setShowProfilePopup(!showProfilePopup)}
              className="flex items-center gap-3 hover:bg-gradient-to-r hover:from-cyan-50 hover:to-fuchsia-50 rounded-2xl p-1.5 transition-all duration-300"
            >
              {/* Profile Picture - Clickable for enlarged view */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLargeProfile(true);
                }}
                className="w-11 h-11 rounded-full bg-gradient-to-br from-cyan-500 to-fuchsia-500 p-0.5 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer"
              >
                <div className="w-full h-full rounded-full bg-white p-0.5">
                  {profileImageUrl ? (
                    <img 
                      src={profileImageUrl} 
                      alt="Profile" 
                      className="w-full h-full object-cover rounded-full"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : (
                    <User className="w-6 h-6 text-cyan-600" />
                  )}
                  <User className="w-6 h-6 text-cyan-600 hidden" />
                </div>
              </div>

              {/* User greeting */}
              <div className="hidden lg:block text-left pr-2">
                <p className="text-sm font-bold text-gray-900">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-gray-500 capitalize font-medium">{user?.role?.replace('_', ' ')}</p>
              </div>
            </button>

            {/* Profile Popup */}
            {showProfilePopup && (
              <div 
                ref={popupRef}
                className="absolute right-0 top-full mt-3 w-80 bg-white rounded-3xl shadow-2xl border-2 border-gray-100 z-50 overflow-hidden max-h-[80vh] overflow-y-auto custom-scrollbar"
              >
                {/* Gradient Header */}
                <div className="bg-gradient-to-r from-cyan-500 to-fuchsia-600 p-6 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12 blur-xl"></div>
                  
                  <div className="flex items-center justify-between relative z-10">
                    <h3 className="font-bold text-lg">My Profile</h3>
                    <button 
                      onClick={() => setShowProfilePopup(false)}
                      className="p-1.5 hover:bg-white/20 rounded-xl transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  {/* Profile Info */}
                  <div className="flex items-center gap-4 mb-6 pb-6 border-b-2 border-gray-100">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-fuchsia-500 p-1 shadow-xl">
                      <div className="w-full h-full rounded-full bg-white p-1">
                        {profileImageUrl ? (
                          <img 
                            src={profileImageUrl} 
                            alt="Profile" 
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          <User className="w-10 h-10 text-cyan-600" />
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="font-bold text-xl text-gray-900">
                        {user?.first_name} {user?.last_name}
                      </p>
                      <p className="text-sm text-gray-500 capitalize font-medium">{user?.role?.replace('_', ' ')}</p>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="space-y-3">
                    {/* User ID */}
                    <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl hover:shadow-md transition-all duration-300">
                      <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-cyan-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-semibold">User ID</p>
                        <p className="text-sm font-bold text-gray-900 truncate max-w-[200px]">{user?.id}</p>
                      </div>
                    </div>

                    {/* Department - For team leads and team members */}
                    {(user?.role === 'team_leader' || user?.role === 'team_member') && (
                      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl hover:shadow-md transition-all duration-300">
                        <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-500 font-semibold">Department</p>
                          <p className="text-sm font-bold text-gray-900 truncate" title={user?.department_name || user?.department?.name || ''}>
                            {user?.department_name || (user?.department?.name && user.department.name) || 'Not Assigned'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Position/Role */}
                    <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl hover:shadow-md transition-all duration-300">
                      <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center">
                        <Briefcase className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-semibold">Position</p>
                        <p className="text-sm font-bold text-gray-900 capitalize">{user?.role?.replace('_', ' ')}</p>
                      </div>
                    </div>

                    {/* Email */}
                    <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl hover:shadow-md transition-all duration-300">
                      <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-cyan-600 font-bold">@</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 font-semibold">Email</p>
                        <p className="text-sm font-bold text-gray-900 truncate" title={user?.email}>{user?.email}</p>
                      </div>
                    </div>

                    {/* Phone Number */}
                    {user?.phone && (
                      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl hover:shadow-md transition-all duration-300">
                        <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-green-600 font-bold">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-500 font-semibold">Phone</p>
                          <p className="text-sm font-bold text-gray-900 truncate" title={user?.phone}>{user?.phone}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Large Profile Popup - Shows when clicking on profile picture */}
      {showLargeProfile && (
        <ProfilePopup 
          user={user} 
          onClose={() => setShowLargeProfile(false)}
          isLarge={true}
        />
      )}
    </header>
  );
};

export default Header;
