import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Departments from './pages/Departments';
import Projects from './pages/Projects';
import Tasks from './pages/Tasks';
import Chat from './pages/Chat';
import AIChatbot from './pages/AIChatbot';
import Accounting from './pages/Accounting';
import Clients from './pages/Clients';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import ClientOnboarding from './pages/ClientOnboarding';
import ClientProfileSetup from './pages/ClientProfileSetup';
import RequirementsReview from './pages/RequirementsReview';
import ClientRequests from './pages/ClientRequests';
import DataShared from './pages/DataShared';
import TeamLeadProjects from './pages/TeamLeadProjects';
import TeamAccounting from './pages/TeamAccounting';
import DailyReports from './pages/DailyReports';
import ClientProgress from './pages/ClientProgress';
import TeamEarnings from './pages/TeamEarnings';

// Protected Route component
const ProtectedRoute = ({ children, allowedRoles = [], requireProfile = true }) => {
  const { isAuthenticated, user, isProfileComplete } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  // Redirect clients with incomplete profiles to profile setup
  // isProfileComplete can be false or null (not checked yet) - both mean incomplete
  if (requireProfile && user?.role === 'client' && !isProfileComplete) {
    return <Navigate to="/profile-setup" replace />;
  }

  return children;
};

// Public Route component (redirects to dashboard if authenticated)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, user, isLoading, isProfileComplete } = useAuthStore();

  // Wait for auth check to complete
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Only redirect if authenticated AND user data is loaded
  if (isAuthenticated && user) {
    // Redirect clients with incomplete profiles to profile setup
    // isProfileComplete can be false or null (not checked yet) - both mean incomplete
    if (user.role === 'client' && !isProfileComplete) {
      return <Navigate to="/profile-setup" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function App() {
  const { fetchUser, logout, setLoading } = useAuthStore();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const validateAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        setLoading(true);
        try {
          await fetchUser();
        } catch (error) {
          // If fetchUser fails (invalid token), clear everything
          logout();
        } finally {
          setLoading(false);
        }
      }
      setIsInitializing(false);
    };
    validateAuth();
  }, []); // Run only once on mount

  // Show loading screen while initializing
  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />

      {/* Client Profile Setup - for first-time login (outside Layout) */}
      <Route
        path="/profile-setup"
        element={
          <ProtectedRoute allowedRoles={['client']} requireProfile={false}>
            <ClientProfileSetup />
          </ProtectedRoute>
        }
      />

      {/* Protected Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="projects" element={<Projects />} />
        
        {/* Team Lead Routes */}
        <Route
          path="team-projects"
          element={
            <ProtectedRoute allowedRoles={['team_leader']}>
              <TeamLeadProjects />
            </ProtectedRoute>
          }
        />
        <Route
          path="team-accounting"
          element={
            <ProtectedRoute allowedRoles={['team_leader']}>
              <TeamAccounting />
            </ProtectedRoute>
          }
        />
        <Route
          path="daily-reports"
          element={
            <ProtectedRoute allowedRoles={['team_leader']}>
              <DailyReports />
            </ProtectedRoute>
          }
        />
        
        {/* Team Member Routes */}
        <Route
          path="team-earnings"
          element={
            <ProtectedRoute allowedRoles={['team_member']}>
              <TeamEarnings />
            </ProtectedRoute>
          }
        />
        
        {/* Client Routes */}
        <Route
          path="my-progress"
          element={
            <ProtectedRoute allowedRoles={['client']}>
              <ClientProgress />
            </ProtectedRoute>
          }
        />
        <Route path="chat" element={<Chat />} />
        <Route path="ai-assistant" element={<AIChatbot />} />
        <Route path="data-shared" element={<DataShared />} />
        <Route path="settings" element={<Settings />} />

        {/* Client Onboarding */}
        <Route
          path="onboarding"
          element={
            <ProtectedRoute allowedRoles={['client']}>
              <ClientOnboarding />
            </ProtectedRoute>
          }
        />

        {/* Admin Only Routes */}
        <Route
          path="client-requests"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ClientRequests />
            </ProtectedRoute>
          }
        />
        <Route
          path="requirements-review"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <RequirementsReview />
            </ProtectedRoute>
          }
        />
        <Route
          path="users"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Users />
            </ProtectedRoute>
          }
        />
        <Route
          path="departments"
          element={
            <ProtectedRoute allowedRoles={['admin', 'team_leader']}>
              <Departments />
            </ProtectedRoute>
          }
        />
        <Route
          path="accounting"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Accounting />
            </ProtectedRoute>
          }
        />
        <Route
          path="clients"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Clients />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports"
          element={
            <ProtectedRoute allowedRoles={['admin', 'team_leader']}>
              <Reports />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Catch all - redirect to login if not authenticated, otherwise dashboard */}
      <Route 
        path="*" 
        element={
          <PublicRoute>
            <Navigate to="/login" replace />
          </PublicRoute>
        } 
      />
    </Routes>
  );
}

export default App;
