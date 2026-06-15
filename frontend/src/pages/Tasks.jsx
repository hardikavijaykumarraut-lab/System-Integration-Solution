import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { tasksAPI } from '../services/api';
import { Plus, Search, Filter, Calendar, User, FolderKanban } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

const Tasks = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: tasksData, isLoading } = useQuery(
    ['tasks', filter],
    () => tasksAPI.getAll({ status: filter !== 'all' ? filter : undefined }),
    {
      select: (res) => res.data.data,
    }
  );

  const tasks = tasksData?.tasks || [];

  // Mutation to update task status
  const updateStatusMutation = useMutation(
    ({ taskId, status }) => tasksAPI.update(taskId, { status }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['tasks']);
        toast.success('Task status updated successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update task status');
      }
    }
  );

  const handleStatusChange = (taskId, newStatus) => {
    updateStatusMutation.mutate({ taskId, status: newStatus });
  };

  const filteredTasks = tasks.filter((task) =>
    task.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'text-red-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
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
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-600">Manage your tasks and track progress</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          New Task
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search tasks..."
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
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Tasks List */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-medium text-gray-700">Task</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Project ID</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Project Name</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Priority</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Assigned To</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => (
                <tr key={task.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium text-gray-900">{task.title}</p>
                      <p className="text-sm text-gray-500 truncate max-w-xs">
                        {task.description}
                      </p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <FolderKanban className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {task.project?.code || task.project_id || 'N/A'}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-gray-900">
                      {task.project?.project_title || task.project?.project_name || task.project?.name || task.project?.package_name || task.project_name || 'No project'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {user?.role === 'team_member' ? (
                      <select
                        value={task.status}
                        onChange={(e) => handleStatusChange(task.id, e.target.value)}
                        disabled={updateStatusMutation.isLoading}
                        className={`px-2 py-1 text-xs rounded-full border-0 cursor-pointer ${
                          task.status === 'completed' 
                            ? 'bg-green-100 text-green-800' 
                            : task.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    ) : (
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${getStatusColor(
                          task.status
                        )}`}
                      >
                        {task.status.replace('_', ' ')}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-sm capitalize ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">
                        {task.assigned_to_user
                          ? `${task.assigned_to_user.first_name} ${task.assigned_to_user.last_name}`
                          : 'Unassigned'}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">
                        {task.due_date
                          ? new Date(task.due_date).toLocaleDateString()
                          : 'No date'}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredTasks.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No tasks found
          </div>
        )}
      </div>
    </div>
  );
};

export default Tasks;
