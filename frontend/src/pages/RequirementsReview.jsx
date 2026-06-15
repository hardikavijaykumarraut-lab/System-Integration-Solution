import { useState, useEffect } from 'react';
import { requirementsAPI, usersAPI } from '../services/api';
import { 
  ClipboardList, 
  User, 
  Calendar, 
  DollarSign, 
  CheckCircle,
  X,
  UserCheck,
  AlertCircle,
  Search,
  Filter
} from 'lucide-react';
import toast from 'react-hot-toast';

const RequirementsReview = () => {
  const [requirements, setRequirements] = useState([]);
  const [teamLeads, setTeamLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequirement, setSelectedRequirement] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTeamLead, setSelectedTeamLead] = useState('');
  const [filterStatus, setFilterStatus] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchRequirements();
    fetchTeamLeads();
  }, [filterStatus]);

  const fetchRequirements = async () => {
    try {
      setLoading(true);
      const response = await requirementsAPI.getAll({ status: filterStatus });
      setRequirements(response.data.data || []);
    } catch (error) {
      toast.error('Failed to load requirements');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamLeads = async () => {
    try {
      const response = await usersAPI.getAll({ role: 'team_leader' });
      setTeamLeads(response.data.data || []);
    } catch (error) {
      toast.error('Failed to load team leads');
    }
  };

  const handleAssign = async () => {
    if (!selectedTeamLead) {
      toast.error('Please select a team lead');
      return;
    }

    try {
      await requirementsAPI.assignTeamLead(selectedRequirement.id, {
        team_lead_id: selectedTeamLead
      });
      toast.success('Team lead assigned successfully');
      setShowAssignModal(false);
      setSelectedRequirement(null);
      setSelectedTeamLead('');
      fetchRequirements();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to assign team lead');
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

  const filteredRequirements = requirements.filter(req =>
    req.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.project_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.package_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Project Requirements</h1>
          <p className="text-gray-600">Review and assign client requirements to team leads</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search requirements..."
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
                  {requirements.filter(r => r.status === status).length}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${getStatusColor(status)}`}>
                <ClipboardList className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Requirements List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredRequirements.length === 0 ? (
        <div className="card text-center py-12">
          <ClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No requirements found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequirements.map((req) => (
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
                  
                  <div className="grid grid-cols-3 gap-4 text-sm mb-4">
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
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <p className="text-sm text-gray-700 line-clamp-3">{req.full_requirements}</p>
                  </div>

                  {req.assigned_team_lead_name && (
                    <div className="flex items-center text-sm text-primary-600">
                      <UserCheck className="w-4 h-4 mr-2" />
                      Assigned to: {req.assigned_team_lead_name}
                    </div>
                  )}
                </div>

                <div className="ml-6">
                  {req.status === 'pending' && (
                    <button
                      onClick={() => {
                        setSelectedRequirement(req);
                        setShowAssignModal(true);
                      }}
                      className="btn-primary flex items-center"
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
      {showAssignModal && selectedRequirement && (
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
                <h3 className="font-medium mb-2">{selectedRequirement.project_title || selectedRequirement.package_name}</h3>
                <p className="text-sm text-gray-600">Client: {selectedRequirement.client_name}</p>
                <p className="text-sm text-gray-600">Amount: ₹{selectedRequirement.amount_paid?.toLocaleString()}</p>
              </div>

              <div className="mb-6">
                <label className="label">Select Team Lead</label>
                <select
                  value={selectedTeamLead}
                  onChange={(e) => setSelectedTeamLead(e.target.value)}
                  className="input"
                >
                  <option value="">Choose a team lead...</option>
                  {teamLeads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.first_name} {lead.last_name} - {lead.department_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowAssignModal(false)}
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
    </div>
  );
};

export default RequirementsReview;
