import { useState, useEffect } from 'react';
import { dailyReportsAPI, projectsAPI } from '../services/api';
import { 
  CheckCircle, 
  Clock, 
  Calendar, 
  MessageSquare,
  ChevronDown,
  ChevronRight,
  BarChart3,
  AlertCircle,
  FolderKanban,
  Package
} from 'lucide-react';
import toast from 'react-hot-toast';

const ClientProgress = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedReport, setExpandedReport] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch all client's projects
      const projectsResponse = await projectsAPI.getAll();
      // Handle different response structures - projects could be in data.data.projects or data.data
      const projectsData = projectsResponse.data.data;
      const clientProjects = Array.isArray(projectsData) 
        ? projectsData 
        : (projectsData?.projects || []);
      setProjects(clientProjects);
      
      if (clientProjects.length > 0) {
        // Select first project by default
        setSelectedProject(clientProjects[0]);
        await loadProjectDetails(clientProjects[0].id);
      }
    } catch (error) {
      toast.error('Failed to load projects');
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProjectDetails = async (projectId) => {
    try {
      const reportsResponse = await dailyReportsAPI.getAll({ project_id: projectId });
      const reportsData = reportsResponse.data.data;
      const projectReports = Array.isArray(reportsData)
        ? reportsData
        : (reportsData?.reports || []);
      setReports(projectReports);
    } catch (error) {
      console.error('Failed to load project details:', error);
    }
  };

  const handleProjectSelect = async (project) => {
    setSelectedProject(project);
    await loadProjectDetails(project.id);
  };

  const toggleReport = (reportId) => {
    setExpandedReport(expandedReport === reportId ? null : reportId);
  };

  const getLatestReport = () => {
    if (reports.length === 0) return null;
    return [...reports].sort((a, b) => new Date(b.report_date) - new Date(a.report_date))[0];
  };

  const calculateProgress = () => {
    const latestReport = getLatestReport();
    return latestReport?.overall_progress ?? 0;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'reviewed': return 'bg-green-100 text-green-800';
      case 'submitted': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="card text-center py-12">
        <FolderKanban className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Projects Yet</h2>
        <p className="text-gray-500 mb-4">
          You haven't purchased any services yet. Visit your dashboard to request a new service.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">My Project Progress</h1>
        <p className="text-gray-600">Track the status of all your purchased projects</p>
      </div>

      {/* Projects List */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Package className="w-5 h-5 mr-2" />
          Your Projects ({projects.length})
        </h3>
        <div className="space-y-3">
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => handleProjectSelect(project)}
              className={`p-4 rounded-lg cursor-pointer transition-all ${
                selectedProject?.id === project.id
                  ? 'bg-primary-50 border-2 border-primary-200'
                  : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FolderKanban className={`w-5 h-5 ${
                    selectedProject?.id === project.id ? 'text-primary-600' : 'text-gray-500'
                  }`} />
                  <div>
                    <p className="font-medium">{project.name}</p>
                    <p className="text-sm text-gray-500">{project.code}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                    {project.status?.replace('_', ' ')}
                  </span>
                  {selectedProject?.id === project.id && (
                    <CheckCircle className="w-5 h-5 text-primary-600" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Project Details */}
      {selectedProject && (
        <>
          {/* Project Overview Card */}
          <div className="card">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold">{selectedProject.name}</h2>
                <p className="text-gray-600 mt-1">{selectedProject.code}</p>
                <p className="text-sm text-gray-500 mt-1">
                  Started on {new Date(selectedProject.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(selectedProject.status)}`}>
                {selectedProject.status?.replace('_', ' ')}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">Overall Progress</span>
                <span className="text-primary-600 font-semibold">{calculateProgress()}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-primary-600 h-3 rounded-full transition-all"
                  style={{ width: `${calculateProgress()}%` }}
                ></div>
              </div>
            </div>

            {/* Project Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{reports.length}</p>
                <p className="text-sm text-gray-600">Total Updates</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{calculateProgress()}%</p>
                <p className="text-sm text-gray-600">Latest Progress</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">{getLatestReport()?.status || 'N/A'}</p>
                <p className="text-sm text-gray-600">Latest Report Status</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">
                  {getLatestReport() ? new Date(getLatestReport().report_date).toLocaleDateString() : 'N/A'}
                </p>
                <p className="text-sm text-gray-600">Last Update</p>
              </div>
            </div>
          </div>
        </>
      )}


      {/* Daily Reports Section */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <BarChart3 className="w-5 h-5 mr-2" />
          Progress Updates
        </h3>
        
        {reports.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            No progress updates yet. Your project manager will submit daily reports.
          </p>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div key={report.id} className="border rounded-lg overflow-hidden">
                <div 
                  className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleReport(report.id)}
                >
                  <div className="flex items-center gap-3">
                    {expandedReport === report.id ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                    <div>
                      <p className="font-medium">
                        {new Date(report.report_date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                      <p className="text-sm text-gray-500">
                        {report.tasks_completed_count} completed • {report.tasks_in_progress_count} in progress
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Progress</p>
                      <p className="font-semibold text-primary-600">{report.overall_progress}%</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      report.status === 'reviewed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {report.status}
                    </span>
                  </div>
                </div>

                {expandedReport === report.id && (
                  <div className="p-4 border-t">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <h4 className="font-medium text-blue-700 mb-2">Progress Summary</h4>
                        <p className="text-sm text-gray-700">Overall progress is <span className="font-semibold">{report.overall_progress}%</span> based on the latest admin report.</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <h4 className="font-medium text-green-700 mb-2">Report Status</h4>
                        <p className="text-sm text-gray-700">{report.status?.replace('_', ' ')}</p>
                      </div>
                    </div>

                    {report.issues_blockers && (
                      <div className="mt-6 p-4 bg-red-50 rounded-lg">
                        <h4 className="font-medium text-red-700 mb-2 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-2" />
                          Issues & Blockers
                        </h4>
                        <p className="text-sm text-red-600">{report.issues_blockers}</p>
                      </div>
                    )}

                    {report.notes && (
                      <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                        <h4 className="font-medium mb-2">Additional Notes</h4>
                        <p className="text-sm text-gray-700">{report.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contact Section */}
      <div className="card bg-primary-50 border-primary-200">
        <h3 className="text-lg font-semibold mb-2 flex items-center">
          <MessageSquare className="w-5 h-5 mr-2" />
          Need to Discuss Something?
        </h3>
        <p className="text-gray-600 mb-4">
          Have questions about your project? Use the chat feature to communicate with your project manager.
        </p>
        <button 
          onClick={() => window.location.href = '/chat'}
          className="btn-primary"
        >
          Open Chat
        </button>
      </div>
    </div>
  );
};

export default ClientProgress;
