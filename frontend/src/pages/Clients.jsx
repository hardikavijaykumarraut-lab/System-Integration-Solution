import { useState } from 'react';
import { useQuery } from 'react-query';
import { clientsAPI } from '../services/api';
import { Plus, Search, Mail, Phone, Building2, MapPin, User, X, Eye } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Clients = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const { data: clientsData, isLoading } = useQuery(
    'clients',
    () => clientsAPI.getAll(),
    {
      select: (res) => res.data.data,
    }
  );

  const clients = clientsData?.clients || [];

  const filteredClients = clients.filter((client) =>
    `${client.first_name} ${client.last_name} ${client.email} ${client.company_name}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  const getProfileImageUrl = (profileImage) => {
    if (!profileImage) return null;
    if (profileImage.startsWith('http')) return profileImage;
    return `${API_URL}${profileImage}`;
  };

  const handleViewDetails = (client) => {
    setSelectedClient(client);
    setShowDetailsModal(true);
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
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-600">Manage your clients and view their complete information</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Add Client
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search clients..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input pl-10 w-full max-w-md"
        />
      </div>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.map((client) => (
          <div key={client.id} className="card hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden">
                {client.profile_image ? (
                  <img 
                    src={getProfileImageUrl(client.profile_image)} 
                    alt={`${client.first_name} ${client.last_name}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : (
                  <span className="text-primary-600 font-bold text-lg">
                    {client.first_name[0]}{client.last_name[0]}
                  </span>
                )}
                <span className="text-primary-600 font-bold text-lg hidden">
                  {client.first_name[0]}{client.last_name[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">
                  {client.first_name} {client.last_name}
                </h3>
                {client.company_name && (
                  <p className="text-sm text-gray-600 flex items-center gap-1 truncate">
                    <Building2 className="w-3 h-3 flex-shrink-0" />
                    {client.company_name}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Mail className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{client.email}</span>
              </div>
              {client.phone && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="w-4 h-4 flex-shrink-0" />
                  <span>{client.phone}</span>
                </div>
              )}
              {client.address && (
                <div className="flex items-start gap-2 text-gray-600">
                  <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{client.address}</span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t flex items-center justify-between">
              <div className="text-sm">
                <span className="text-gray-500">Projects: </span>
                <span className="font-medium">{client.project_count || 0}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">Active: </span>
                <span className="font-medium text-green-600">
                  {client.active_project_count || 0}
                </span>
              </div>
            </div>

            <button
              onClick={() => handleViewDetails(client)}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            >
              <Eye className="w-4 h-4" />
              View Full Details
            </button>
          </div>
        ))}
      </div>

      {filteredClients.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No clients found
        </div>
      )}

      {/* Client Details Modal */}
      {showDetailsModal && selectedClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold">Client Details</h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Profile Header */}
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden">
                  {selectedClient.profile_image ? (
                    <img 
                      src={getProfileImageUrl(selectedClient.profile_image)} 
                      alt={`${selectedClient.first_name} ${selectedClient.last_name}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : (
                    <User className="w-10 h-10 text-primary-600" />
                  )}
                  <User className="w-10 h-10 text-primary-600 hidden" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold">
                    {selectedClient.first_name} {selectedClient.last_name}
                  </h3>
                  <p className="text-gray-500">{selectedClient.email}</p>
                  {selectedClient.client_id && (
                    <p className="text-sm text-gray-400 mt-1">
                      Client ID: {selectedClient.client_id}
                    </p>
                  )}
                </div>
              </div>

              {/* Contact Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Contact Information
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Phone:</span>
                      <p className="font-medium">{selectedClient.phone || 'Not provided'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Email:</span>
                      <p className="font-medium">{selectedClient.email}</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Company Details
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Company:</span>
                      <p className="font-medium">{selectedClient.company_name || 'Not provided'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Client ID:</span>
                      <p className="font-medium">{selectedClient.client_id || 'Not assigned'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Address
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Street Address:</span>
                    <p className="font-medium">{selectedClient.address || 'Not provided'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">City:</span>
                    <p className="font-medium">{selectedClient.city || 'Not provided'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Country:</span>
                    <p className="font-medium">{selectedClient.country || 'Not provided'}</p>
                  </div>
                </div>
              </div>

              {/* Project Statistics */}
              <div className="p-4 bg-primary-50 rounded-lg">
                <h4 className="font-medium mb-3 text-primary-800">Project Statistics</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary-600">
                      {selectedClient.project_count || 0}
                    </p>
                    <p className="text-sm text-gray-600">Total Projects</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {selectedClient.active_project_count || 0}
                    </p>
                    <p className="text-sm text-gray-600">Active Projects</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-600">
                      {(selectedClient.project_count || 0) - (selectedClient.active_project_count || 0)}
                    </p>
                    <p className="text-sm text-gray-600">Completed</p>
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              {selectedClient.profile_completed && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  Profile completed
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;
