import { useState, useEffect } from 'react';
import { requirementsAPI, tasksAPI, usersAPI, projectsAPI, uploadAPI } from '../services/api';
import { 
  FolderKanban, 
  Plus, 
  Users, 
  Calendar, 
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  ChevronDown,
  ChevronRight,
  UserPlus,
  FileText,
  Share2,
  Upload,
  Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';

const TeamLeadProjects = () => {
  const [projects, setProjects] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [expandedProject, setExpandedProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [projectDetails, setProjectDetails] = useState(null);

  // Task form state
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    assigned_to: '',
    priority: 'medium',
    deadline: '',
    estimated_hours: ''
  });
  const [sharedFiles, setSharedFiles] = useState([]);
  const [newFiles, setNewFiles] = useState([]); // Files to upload with descriptions
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchAssignedProjects();
    fetchTeamMembers();
  }, []);

  const fetchAssignedProjects = async () => {
    try {
      setLoading(true);
      const response = await requirementsAPI.getAssigned();
      setProjects(response.data.data || []);
    } catch (error) {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const response = await usersAPI.getAll({ role: 'team_member' });
      // Handle nested response structure
      const members = response.data.data?.users || response.data.data || [];
      setTeamMembers(members);
    } catch (error) {
      toast.error('Failed to load team members');
      console.error('Error fetching team members:', error);
    }
  };

  const fetchProjectTasks = async (projectId) => {
    try {
      const response = await tasksAPI.getAll({ project_id: projectId });
      // Handle different response structures - tasks could be in data.data.tasks or data.data
      const tasksData = response.data.data;
      const projectTasks = Array.isArray(tasksData) 
        ? tasksData 
        : (tasksData?.tasks || []);
      setTasks(projectTasks);
    } catch (error) {
      toast.error('Failed to load tasks');
      console.error('Error loading tasks:', error);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    
    if (!taskForm.title || !taskForm.assigned_to) {
      toast.error('Please fill in all required fields');
      return;
    }

    setUploading(true);

    try {
      console.log('Starting file upload process...', newFiles.length, 'files');
      
      // Upload new files first
      const uploadedFiles = [];
      for (const fileData of newFiles) {
        if (fileData.file) {
          try {
            console.log('Uploading file:', fileData.file.name, 'Size:', fileData.file.size, 'bytes');
            
            // Create FormData with file and optional description
            const formData = new FormData();
            formData.append('file', fileData.file);
            if (fileData.description) {
              formData.append('description', fileData.description);
            }
            formData.append('source', 'task_creation');
            
            console.log('Sending upload request...');
            const response = await uploadAPI.uploadFileCustom(formData);
            console.log('Upload response:', response.data);
            
            uploadedFiles.push({
              id: response.data.data?.id, // Store file ID for download tracking
              url: response.data.data?.url || response.data.url,
              name: fileData.file.name,
              description: fileData.description,
              uploaded_by: 'team_lead',
              uploaded_at: new Date().toISOString()
            });
          } catch (uploadError) {
            console.error('File upload error:', uploadError);
            console.error('Upload error details:', uploadError.response?.data);
            toast.error(`Failed to upload file: ${fileData.file.name}`);
          }
        }
      }

      // Combine existing shared files and newly uploaded files
      const allSharedFiles = [
        ...sharedFiles.map(url => ({ url })),
        ...uploadedFiles
      ];

      // Convert deadline to ISO format for backend
      const formattedDeadline = taskForm.deadline ? new Date(taskForm.deadline).toISOString() : null;
      
      await tasksAPI.create({
        ...taskForm,
        due_date: formattedDeadline, // Map deadline to due_date in ISO format
        project_id: selectedProject.project_id,
        status: 'pending',
        shared_files: allSharedFiles
      });
      toast.success('Task created successfully');
      setShowTaskModal(false);
      setTaskForm({
        title: '',
        description: '',
        assigned_to: '',
        priority: 'medium',
        deadline: '',
        estimated_hours: ''
      });
      setSharedFiles([]);
      setNewFiles([]);
      // Refresh tasks
      if (expandedProject === selectedProject.id) {
        fetchProjectTasks(selectedProject.project_id);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create task');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const newFileEntries = files.map(file => ({
      file,
      description: '',
      id: Math.random().toString(36).substr(2, 9)
    }));
    setNewFiles([...newFiles, ...newFileEntries]);
  };

  const updateFileDescription = (id, description) => {
    setNewFiles(newFiles.map(f => 
      f.id === id ? { ...f, description } : f
    ));
  };

  const removeNewFile = (id) => {
    setNewFiles(newFiles.filter(f => f.id !== id));
  };

  const toggleSharedFile = (fileUrl) => {
    setSharedFiles(prev => 
      prev.includes(fileUrl) 
        ? prev.filter(f => f !== fileUrl)
        : [...prev, fileUrl]
    );
  };

  const toggleProject = (project) => {
    if (expandedProject === project.id) {
      setExpandedProject(null);
    } else {
      setExpandedProject(project.id);
      fetchProjectTasks(project.project_id);
      fetchProjectDetails(project.project_id);
    }
  };

  const fetchProjectDetails = async (projectId) => {
    if (!projectId) return;
    try {
      const response = await projectsAPI.getById(projectId);
      setProjectDetails(response.data.data);
    } catch (error) {
      console.error('Failed to fetch project details:', error);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const calculateProgress = () => {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.status === 'completed').length;
    return Math.round((completed / tasks.length) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">My Projects</h1>
        <p className="text-gray-600">Manage assigned projects and delegate tasks to team members</p>
      </div>

      {/* Projects List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : projects.length === 0 ? (
        <div className="card text-center py-12">
          <FolderKanban className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No projects assigned yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((project) => (
            <div key={project.id} className="card">
              {/* Project Header */}
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleProject(project)}
              >
                <div className="flex items-center gap-4">
                  {expandedProject === project.id ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                  <div>
                    <h3 className="text-lg font-semibold">{project.project_title || project.project_name || project.name || 'Project'}</h3>
                    {project.package_name && (
                      <p className="text-sm text-gray-500 mt-1">Package: {project.package_name}</p>
                    )}
                    <p className="text-sm text-gray-500 mt-2">{project.requirements?.substring(0, 100) || 'No description'}...</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(project.priority)}`}>
                    {project.priority}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                    {project.status.replace('_', ' ')}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedProject(project);
                      fetchProjectDetails(project.project_id);
                      setShowTaskModal(true);
                    }}
                    className="btn-primary flex items-center text-sm"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Task
                  </button>
                </div>
              </div>

              {/* Expanded Project Details */}
              {expandedProject === project.id && (
                <div className="mt-6 pt-6 border-t">
                  {/* Progress Bar */}
                  <div className="mb-6">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium">Project Progress</span>
                      <span className="text-primary-600">{calculateProgress()}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-primary-600 h-2 rounded-full transition-all"
                        style={{ width: `${calculateProgress()}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Requirements */}
                  <div className="bg-gray-50 p-4 rounded-lg mb-6">
                    <h4 className="font-medium mb-2 flex items-center">
                      <FileText className="w-4 h-4 mr-2" />
                      Client Requirements
                    </h4>
                    <p className="text-sm text-gray-700">{project.requirements}</p>
                  </div>

                  {/* Tasks List */}
                  <div>
                    <h4 className="font-medium mb-4 flex items-center">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Tasks ({tasks.length})
                    </h4>
                    
                    {tasks.length === 0 ? (
                      <p className="text-gray-500 text-sm">No tasks created yet</p>
                    ) : (
                      <div className="space-y-2">
                        {tasks.map((task) => (
                          <div key={task.id} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full ${
                                task.status === 'completed' ? 'bg-green-500' :
                                task.status === 'in_progress' ? 'bg-blue-500' : 'bg-yellow-500'
                              }`}></div>
                              <div>
                                <p className="font-medium text-sm">{task.title}</p>
                                <p className="text-xs text-gray-500">
                                  Assigned to: {task.assigned_to_name} • {task.estimated_hours}h
                                </p>
                              </div>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs ${getPriorityColor(task.priority)}`}>
                              {task.priority}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Task Modal */}
      {showTaskModal && selectedProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex items-center justify-between flex-shrink-0">
              <h2 className="text-xl font-semibold">Create New Task</h2>
              <button
                onClick={() => setShowTaskModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
              <div>
                <label className="label">Task Title *</label>
                <input
                  type="text"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({...taskForm, title: e.target.value})}
                  className="input"
                  placeholder="e.g., Design Homepage"
                  required
                />
              </div>

              <div>
                <label className="label">Description</label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({...taskForm, description: e.target.value})}
                  className="input h-24 resize-none"
                  placeholder="Task details..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Assign To *</label>
                  <select
                    value={taskForm.assigned_to}
                    onChange={(e) => setTaskForm({...taskForm, assigned_to: e.target.value})}
                    className="input"
                    required
                  >
                    <option value="">Select member...</option>
                    {teamMembers.length === 0 && (
                      <option value="" disabled>No team members found</option>
                    )}
                    {teamMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.first_name} {member.last_name}
                        {member.department_name ? ` - ${member.department_name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Priority</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({...taskForm, priority: e.target.value})}
                    className="input"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Deadline</label>
                  <input
                    type="date"
                    value={taskForm.deadline}
                    onChange={(e) => setTaskForm({...taskForm, deadline: e.target.value})}
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">Est. Hours</label>
                  <input
                    type="number"
                    value={taskForm.estimated_hours}
                    onChange={(e) => setTaskForm({...taskForm, estimated_hours: e.target.value})}
                    className="input"
                    placeholder="e.g., 8"
                  />
                </div>
              </div>

              {/* File Upload Section - Upload new files with descriptions */}
              <div className="border-t pt-4">
                <label className="label flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Upload Files to Share
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Upload files with descriptions. These will be shared with the assigned team member and appear in their Data Shared section.
                </p>
                
                {/* File Upload Input */}
                <div className="relative">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    id="task-file-upload"
                  />
                  <label
                    htmlFor="task-file-upload"
                    className="flex items-center justify-center gap-2 w-full p-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-500 hover:bg-gray-50 transition-colors"
                  >
                    <Upload className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-600">Click to upload files</span>
                  </label>
                </div>

                {/* Selected Files with Descriptions */}
                {newFiles.length > 0 && (
                  <div className="mt-4 space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
                    <p className="text-sm font-medium text-gray-700">Files to upload ({newFiles.length}):</p>
                    {newFiles.map((fileData) => (
                      <div key={fileData.id} className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-start gap-2">
                          <FileText className="w-4 h-4 text-blue-500 mt-1 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium truncate">{fileData.file.name}</span>
                              <button
                                type="button"
                                onClick={() => removeNewFile(fileData.id)}
                                className="p-1 text-red-500 hover:bg-red-50 rounded flex-shrink-0"
                                title="Remove file"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <input
                              type="text"
                              value={fileData.description}
                              onChange={(e) => updateFileDescription(fileData.id, e.target.value)}
                              placeholder="Add a description for this file..."
                              className="input text-sm w-full"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Existing Project Files Section */}
              {(projectDetails?.shared_files?.length > 0 || projectDetails?.attachments?.length > 0) && (
                <div className="border-t pt-4">
                  <label className="label flex items-center gap-2">
                    <Share2 className="w-4 h-4" />
                    Share Existing Project Files
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    Select existing files from this project to share with the assigned team member
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3 custom-scrollbar">
                    {/* Show shared_files from admin */}
                    {projectDetails?.shared_files?.map((file, idx) => (
                      <label key={`shared-${idx}`} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors">
                        <input
                          type="checkbox"
                          checked={sharedFiles.includes(file.url || file.path)}
                          onChange={() => toggleSharedFile(file.url || file.path)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 flex-shrink-0"
                        />
                        <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        <span className="text-sm truncate flex-1 min-w-0">{file.name || file.filename}</span>
                        <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full flex-shrink-0">Admin</span>
                      </label>
                    ))}
                    {/* Show project attachments */}
                    {projectDetails?.attachments?.map((file, idx) => (
                      <label key={`att-${idx}`} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors">
                        <input
                          type="checkbox"
                          checked={sharedFiles.includes(file.url || file.path)}
                          onChange={() => toggleSharedFile(file.url || file.path)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 flex-shrink-0"
                        />
                        <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-sm truncate flex-1 min-w-0">{file.name || file.filename}</span>
                      </label>
                    ))}
                  </div>
                  {sharedFiles.length > 0 && (
                    <p className="text-xs text-primary-600 mt-2 font-medium">
                      ✓ {sharedFiles.length} existing file(s) selected to share
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowTaskModal(false);
                    setSharedFiles([]);
                    setNewFiles([]);
                  }}
                  className="btn-secondary"
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={uploading}
                >
                  {uploading ? 'Creating Task...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamLeadProjects;
