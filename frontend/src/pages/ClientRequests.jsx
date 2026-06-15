import { useState, useEffect } from 'react';
import { requirementsAPI, usersAPI, departmentsAPI } from '../services/api';
import { 
  Inbox, 
  User, 
  Calendar, 
  DollarSign, 
  CheckCircle,
  X,
  UserCheck,
  AlertCircle,
  Search,
  Filter,
  FileText,
  Building2,
  Download,
  Eye,
  ToggleRight,
  ToggleLeft,
  FolderOpen
} from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ClientRequests = () => {
  const [requests, setRequests] = useState([]);
  const [teamLeads, setTeamLeads] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedTeamLead, setSelectedTeamLead] = useState('');
  const [filterStatus, setFilterStatus] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [enablingDocs, setEnablingDocs] = useState({});
  const [selectedFiles, setSelectedFiles] = useState([]);

  useEffect(() => {
    fetchRequests();
    fetchTeamLeads();
    fetchDepartments();
  }, [filterStatus]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await requirementsAPI.getAll({ status: filterStatus });
      // Enrich requests with full client data
      const enrichedRequests = await Promise.all(
        (response.data.data || []).map(async (req) => {
          try {
            // Get full requirement details with attachments
            const fullReq = await requirementsAPI.getById?.(req.id);
            return {
              ...req,
              attachments: fullReq?.data?.data?.attachments || req.attachments || [],
              documents_enabled_for_team_lead: req.documents_enabled_for_team_lead || false
            };
          } catch (e) {
            return req;
          }
        })
      );
      setRequests(enrichedRequests);
    } catch (error) {
      toast.error('Failed to load client requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamLeads = async () => {
    try {
      const response = await usersAPI.getAll({ role: 'team_leader' });
      // Handle nested response structure
      const leads = response.data.data?.users || response.data.data || [];
      setTeamLeads(leads);
    } catch (error) {
      toast.error('Failed to load team leads');
      console.error('Error fetching team leads:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await departmentsAPI.getAll();
      setDepartments(response.data.data || []);
    } catch (error) {
      console.error('Failed to load departments');
    }
  };

  const handleAssign = async () => {
    if (!selectedTeamLead) {
      toast.error('Please select a team lead');
      return;
    }

    try {
      await requirementsAPI.assignTeamLead(selectedRequest.id, {
        team_lead_id: selectedTeamLead,
        shared_files: selectedFiles
      });
      toast.success('Team lead assigned successfully');
      setShowAssignModal(false);
      setSelectedRequest(null);
      setSelectedTeamLead('');
      setSelectedFiles([]);
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to assign team lead');
    }
  };

  const toggleFileSelection = (file) => {
    const fileId = file.url || file.path || file.name;
    setSelectedFiles(prev => {
      const isSelected = prev.some(f => (f.url || f.path || f.name) === fileId);
      if (isSelected) {
        return prev.filter(f => (f.url || f.path || f.name) !== fileId);
      }
      return [...prev, file];
    });
  };

  const handleToggleDocuments = async (requestId, currentStatus) => {
    try {
      setEnablingDocs(prev => ({ ...prev, [requestId]: true }));
      await requirementsAPI.toggleDocumentAccess(requestId, !currentStatus);
      
      setRequests(prev => prev.map(req => 
        req.id === requestId 
          ? { ...req, documents_enabled_for_team_lead: !currentStatus }
          : req
      ));
      toast.success(`Documents ${!currentStatus ? 'enabled' : 'disabled'} for team lead`);
    } catch (error) {
      toast.error('Failed to update document access');
    } finally {
      setEnablingDocs(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'assigned': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getDepartmentName = (deptId) => {
    const dept = departments.find(d => d.id === deptId || d._id === deptId);
    return dept?.name || 'Unknown Department';
  };

  const getFilteredTeamLeads = (deptId) => {
    if (!deptId) return teamLeads;
    // Filter team leads by department - handle both id and _id field names
    const filtered = teamLeads.filter(lead => 
      lead.department_id === deptId || lead.departmentId === deptId
    );
    // If no team leads found in that department, return all team leads
    return filtered.length > 0 ? filtered : teamLeads;
  };

  const filteredRequests = requests.filter(req =>
    req.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.project_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.package_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getProfileImageUrl = (profileImage) => {
    if (!profileImage) return null;
    if (profileImage.startsWith('http')) return profileImage;
    return `${API_URL}${profileImage}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Client Requests</h1>
          <p className="text-gray-600">Review and manage client project requests with uploaded documents</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search requests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10 w-64"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input"
          >
            <option value="pending">Pending</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {['pending', 'assigned', 'in_progress', 'completed'].map((status) => (
          <div key={status} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 capitalize">{status.replace('_', ' ')}</p>
                <p className="text-2xl font-bold">
                  {requests.filter(r => r.status === status).length}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${getStatusColor(status)}`}>
                <Inbox className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="card text-center py-12">
          <Inbox className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No client requests found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((req) => (
            <div key={req.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{req.project_title || req.package_name}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(req.status)}`}>
                      {req.status.replace('_', ' ')}
                    </span>
                    <span className={`text-sm font-medium ${getPriorityColor(req.priority)}`}>
                      {req.priority} priority
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4 text-sm mb-4">
                    <div className="flex items-center text-gray-600">
                      <User className="w-4 h-4 mr-2" />
                      {req.client_name}
                    </div>
                    <div className="flex items-center text-gray-600">
                      <Calendar className="w-4 h-4 mr-2" />
                      {new Date(req.created_at).toLocaleDateString()}
                    </div>
                    <div className="flex items-center text-gray-600">
                      <DollarSign className="w-4 h-4 mr-2" />
                      ₹{req.amount_paid?.toLocaleString()}
                    </div>
                    <div className="flex items-center text-gray-600">
                      <Building2 className="w-4 h-4 mr-2" />
                      {getDepartmentName(req.department_id)}
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <p className="text-sm text-gray-700 line-clamp-2">{req.full_requirements}</p>
                  </div>

                  {/* Attachments Preview */}
                  {req.attachments && req.attachments.length > 0 && (
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600">
                        {req.attachments.length} file(s) uploaded
                      </span>
                    </div>
                  )}

                  {req.assigned_team_lead_name && (
                    <div className="flex items-center text-sm text-primary-600 mb-2">
                      <UserCheck className="w-4 h-4 mr-2" />
                      Assigned to: {req.assigned_team_lead_name}
                    </div>
                  )}
                </div>

                <div className="ml-6 flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setSelectedRequest(req);
                      setShowDetailsModal(true);
                    }}
                    className="btn-secondary flex items-center text-sm"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </button>
                  
                  {req.status === 'pending' && (
                    <button
                      onClick={() => {
                        setSelectedRequest(req);
                        setShowAssignModal(true);
                      }}
                      className="btn-primary flex items-center text-sm"
                    >
                      <UserCheck className="w-4 h-4 mr-2" />
                      Assign Team Lead
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold">Assign Team Lead</h2>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <h3 className="font-medium mb-2">{selectedRequest.project_title || selectedRequest.package_name}</h3>
                <p className="text-sm text-gray-600">Client: {selectedRequest.client_name}</p>
                <p className="text-sm text-gray-600">Department: {getDepartmentName(selectedRequest.department_id)}</p>
                <p className="text-sm text-gray-600">Amount: ₹{selectedRequest.amount_paid?.toLocaleString()}</p>
              </div>

              <div className="mb-6">
                <label className="label">Select Team Lead</label>
                <p className="text-xs text-gray-500 mb-2">
                  Showing team leads from {getDepartmentName(selectedRequest.department_id)}
                </p>
                <select
                  value={selectedTeamLead}
                  onChange={(e) => setSelectedTeamLead(e.target.value)}
                  className="input"
                >
                  <option value="">Choose a team lead...</option>
                  {getFilteredTeamLeads(selectedRequest.department_id).map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.first_name} {lead.last_name} - {lead.department_name || 'No Department'}
                    </option>
                  ))}
                </select>
                {getFilteredTeamLeads(selectedRequest.department_id).length === 0 && (
                  <p className="text-sm text-yellow-600 mt-2">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    No team leads found in this department. Showing all team leads.
                  </p>
                )}
              </div>

              {/* File Sharing Section */}
              {selectedRequest.attachments && selectedRequest.attachments.length > 0 && (
                <div className="mb-6">
                  <label className="label">Share Client Files with Team Lead</label>
                  <p className="text-xs text-gray-500 mb-3">
                    Select which files the team lead should have access to
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                    {selectedRequest.attachments.map((file, index) => (
                      <label 
                        key={index} 
                        className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFiles.some(f => 
                            (f.url || f.path || f.name) === (file.url || file.path || file.name)
                          )}
                          onChange={() => toggleFileSelection(file)}
                          className="mt-1 w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {file.name || file.filename}
                          </p>
                          {file.description && (
                            <p className="text-xs text-gray-500 line-clamp-1">
                              {file.description}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {selectedFiles.length} file(s) selected for sharing
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedFiles([]);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssign}
                  className="btn-primary"
                >
                  Assign Project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold">Client Request Details</h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Client Info */}
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden">
                  {selectedRequest.client_profile_image ? (
                    <img 
                      src={getProfileImageUrl(selectedRequest.client_profile_image)} 
                      alt="Client" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-8 h-8 text-primary-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{selectedRequest.client_name}</h3>
                  <p className="text-gray-600">{selectedRequest.client_email}</p>
                  {selectedRequest.client_company && (
                    <p className="text-gray-600 flex items-center gap-1 mt-1">
                      <Building2 className="w-4 h-4" />
                      {selectedRequest.client_company}
                    </p>
                  )}
                  {selectedRequest.client_address && (
                    <p className="text-gray-500 text-sm mt-1">{selectedRequest.client_address}</p>
                  )}
                </div>
              </div>

              {/* Request Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Package</label>
                  <p className="font-medium">{selectedRequest.package_name}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Department</label>
                  <p className="font-medium">{getDepartmentName(selectedRequest.department_id)}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Amount Paid</label>
                  <p className="font-medium">₹{selectedRequest.amount_paid?.toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Submitted On</label>
                  <p className="font-medium">{new Date(selectedRequest.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Requirements */}
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Requirements</label>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedRequest.full_requirements}</p>
                </div>
              </div>

              {/* Attachments */}
              {selectedRequest.attachments && selectedRequest.attachments.length > 0 && (
                <div>
                  <label className="text-sm text-gray-500 mb-2 block">Uploaded Files</label>
                  <div className="space-y-2">
                    {selectedRequest.attachments.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-gray-500" />
                          <div>
                            <p className="font-medium text-sm">{file.name || file.filename}</p>
                            {file.description && (
                              <p className="text-xs text-gray-500">{file.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={getProfileImageUrl(file.url || file.path)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 hover:bg-gray-200 rounded-lg"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Enable Documents for Team Lead */}
                  {selectedRequest.status !== 'pending' && (
                    <div className="mt-4 flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FolderOpen className="w-5 h-5 text-blue-600" />
                        <div>
                          <p className="font-medium text-sm">Enable documents for team lead</p>
                          <p className="text-xs text-gray-600">Allow assigned team lead to access these files</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleDocuments(selectedRequest.id, selectedRequest.documents_enabled_for_team_lead)}
                        disabled={enablingDocs[selectedRequest.id]}
                        className={`p-2 rounded-lg transition-colors ${
                          selectedRequest.documents_enabled_for_team_lead 
                            ? 'bg-green-100 text-green-600' 
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {enablingDocs[selectedRequest.id] ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current" />
                        ) : selectedRequest.documents_enabled_for_team_lead ? (
                          <ToggleRight className="w-6 h-6" />
                        ) : (
                          <ToggleLeft className="w-6 h-6" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Assigned Team Lead */}
              {selectedRequest.assigned_team_lead_name && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <label className="text-sm text-gray-500 mb-1 block">Assigned Team Lead</label>
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-blue-600" />
                    <span className="font-medium">{selectedRequest.assigned_team_lead_name}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientRequests;
