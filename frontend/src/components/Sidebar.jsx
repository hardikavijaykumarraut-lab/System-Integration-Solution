import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Logo from './Logo';
import ProfilePopup from './ProfilePopup';
import {
  LayoutDashboard,
  Users,
  Building2,
  FolderKanban,
  CheckSquare,
  MessageSquare,
  DollarSign,
  UserCircle,
  BarChart3,
  Settings,
  LogOut,
  ClipboardList,
  FileText,
  TrendingUp,
  User,
  Inbox,
  Share2,
  Bot,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Sidebar = () => {
  const { user, logout } = useAuthStore();
  const [showLargeProfile, setShowLargeProfile] = useState(false);

  // Construct full image URL
  const getProfileImageUrl = (profileImage) => {
    if (!profileImage) return null;
    if (profileImage.startsWith('http')) return profileImage;
    return `${API_URL}${profileImage}`;
  };

  const getNavItems = () => {
    const commonItems = [
      { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { path: '/chat', icon: MessageSquare, label: 'Chat' },
    ];

    const adminItems = [
      { path: '/client-requests', icon: Inbox, label: 'Client Requests' },
      { path: '/users', icon: Users, label: 'Users' },
      { path: '/departments', icon: Building2, label: 'Departments' },
      { path: '/accounting', icon: DollarSign, label: 'Accounting' },
      { path: '/clients', icon: UserCircle, label: 'Clients' },
      { path: '/reports', icon: BarChart3, label: 'Reports' },
    ];

    const teamLeaderItems = [
      { path: '/team-projects', icon: FolderKanban, label: 'Assigned Projects' },
      { path: '/team-accounting', icon: DollarSign, label: 'Accounting' },
      { path: '/daily-reports', icon: FileText, label: 'Daily Reports' },
    ];

    // Client-specific navigation - Tasks and Projects removed, Project Progress added
    const clientItems = [
      { path: '/my-progress', icon: TrendingUp, label: 'My Project Progress' },
    ];

    let items = [...commonItems];

    if (user?.role === 'admin') {
      items = [...items, ...adminItems];
    } else if (user?.role === 'team_leader') {
      items = [...items, ...teamLeaderItems];
    } else if (user?.role === 'client') {
      items = [...items, ...clientItems];
    } else if (user?.role === 'team_member') {
      // For team members, show Tasks and Earnings
      items.splice(1, 0, 
        { path: '/tasks', icon: CheckSquare, label: 'Tasks' },
        { path: '/team-earnings', icon: DollarSign, label: 'Earnings' }
      );
    } else {
      // For other roles, include Tasks and Projects
      items.splice(1, 0, 
        { path: '/tasks', icon: CheckSquare, label: 'Tasks' },
        { path: '/projects', icon: FolderKanban, label: 'Projects' }
      );
    }

    // Add Data Shared for all authenticated users
    items.push({ path: '/data-shared', icon: Share2, label: 'Data Shared' });
    items.push({ path: '/settings', icon: Settings, label: 'Settings' });

    return items;
  };

  const navItems = getNavItems();

  return (
    <aside className="w-72 bg-gradient-to-b from-white to-gray-50 shadow-xl border-r border-gray-200">
      <div className="h-full flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-100">
          <Logo size="medium" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''} flex items-center py-3 px-4 rounded-xl transition-all duration-300 group`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center mr-3 transition-all duration-300 ${
                    isActive ? 'bg-white/20 shadow-inner' : 'group-hover:bg-white/50'
                  }`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className="font-medium">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-3 mb-4 p-3 bg-white rounded-2xl shadow-md border border-gray-100">
            {/* Profile Picture - Clickable for enlarged view */}
            <button
              type="button"
              onClick={() => setShowLargeProfile(true)}
              className="w-11 h-11 rounded-full bg-gradient-to-br from-cyan-500 to-fuchsia-500 p-0.5 shadow-lg flex-shrink-0 hover:shadow-xl hover:scale-105 transition-all duration-300"
            >
              <div className="w-full h-full rounded-full bg-white p-0.5">
                {user?.profile_image ? (
                  <img 
                    src={getProfileImageUrl(user.profile_image)} 
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
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-xs text-gray-500 capitalize font-medium">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-gradient-to-r hover:from-red-50 hover:to-rose-50 rounded-xl transition-all duration-300 font-semibold group"
          >
            <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span>Logout</span>
          </button>
        </div>

        {/* Enlarged Profile Popup */}
        {showLargeProfile && (
          <ProfilePopup 
            user={user} 
            onClose={() => setShowLargeProfile(false)}
            isLarge={true}
          />
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
