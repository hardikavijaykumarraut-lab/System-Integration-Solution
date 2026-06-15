import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { projectsAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Plus, Search, Filter, Calendar, Users } from 'lucide-react';
import ProjectStatusDropdown from '../components/ProjectStatusDropdown';

const Projects = () => {
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const { data: projectsData, isLoading } = useQuery(
    ['projects', filter],
    () => projectsAPI.getAll({ status: filter !== 'all' ? filter : undefined }),
    {
      select: (res) => res.data.data,
    }
  );

  const projects = projectsData?.projects || [];

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Check if user has permission to update project status
  const canUpdateProjectStatus = user && ['admin', 'team_leader'].includes(user.role);

  const handleStatusChange = useCallback((projectId, newStatus) => {
    // Update the query cache optimistically
    queryClient.setQueryData(['projects', filter], (oldData) => {
      if (!oldData) return oldData;
      
      return {
        ...oldData,
        data: {
          ...oldData.data,
          projects: oldData.data.projects.map((p) =>
            p._id === projectId ? { ...p, status: newStatus } : p
          ),
        },
      };
    });
  }, [filter, queryClient]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600">Manage and track your projects</p>
          {canUpdateProjectStatus && (
            <p className="text-sm text-blue-600 font-medium mt-1">
              ✓ You can update project status
            </p>
          )}
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          New Project
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((project) => (
          <div key={project._id} className="card hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">{project.name}</h3>
                <p className="text-sm text-gray-500">{project.code}</p>
              </div>
              <ProjectStatusDropdown
                projectId={project._id}
                currentStatus={project.status}
                onStatusChange={(newStatus) => handleStatusChange(project._id, newStatus)}
                canUpdate={canUpdateProjectStatus}
              />
            </div>

            <p className="text-gray-600 text-sm mb-4 line-clamp-2">
              {project.description || 'No description'}
            </p>

            {/* Progress */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Progress</span>
                <span>{project.progress || 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all"
                  style={{ width: `${project.progress || 0}%` }}
                ></div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>
                  {project.end_date
                    ? new Date(project.end_date).toLocaleDateString()
                    : 'No deadline'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>{project.team_members?.length || 0} members</span>
              </div>
            </div>

            {/* Task Stats */}
            {project.task_stats && (
              <div className="mt-4 pt-4 border-t flex items-center gap-4 text-xs">
                <span className="text-gray-500">
                  {project.task_stats.total} tasks
                </span>
                <span className="text-green-600">
                  {project.task_stats.completed} done
                </span>
                <span className="text-blue-600">
                  {project.task_stats.in_progress} in progress
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredProjects.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No projects found
        </div>
      )}
    </div>
  );
};

export default Projects;
