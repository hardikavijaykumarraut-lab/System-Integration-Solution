import { useState, useEffect } from 'react';
// Departments component with department management functionality
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { departmentsAPI } from '../services/api';
import { Plus, Users, FolderKanban, MoreVertical, Edit2, Trash2, Eye, EyeOff, Package, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const Departments = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [selectedDept, setSelectedDept] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    icon: 'building'
  });
  const [serviceForm, setServiceForm] = useState({
    name: '',
    description: '',
    price: '',
    duration_days: '',
    features: ['']
  });

  const queryClient = useQueryClient();

  const { data: departmentsData, isLoading } = useQuery(
    'departments',
    () => departmentsAPI.getAll(),
    {
      select: (res) => res.data.data,
    }
  );

  const createDepartmentMutation = useMutation(
    departmentsAPI.create,
    {
      onSuccess: () => {
        queryClient.invalidateQueries('departments');
        setShowAddModal(false);
        setFormData({ name: '', description: '', color: '#3B82F6', icon: 'building' });
        toast.success('Department created successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to create department');
      }
    }
  );

  const updateDepartmentMutation = useMutation(
    ({ id, data }) => departmentsAPI.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('departments');
        setEditingDept(null);
        setFormData({ name: '', description: '', color: '#3B82F6', icon: 'building' });
        toast.success('Department updated successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update department');
      }
    }
  );

  const deleteDepartmentMutation = useMutation(
    departmentsAPI.delete,
    {
      onSuccess: () => {
        queryClient.invalidateQueries('departments');
        toast.success('Department deactivated successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to deactivate department');
      }
    }
  );

  const activateDepartmentMutation = useMutation(
    departmentsAPI.activate,
    {
      onSuccess: () => {
        queryClient.invalidateQueries('departments');
        toast.success('Department activated successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to activate department');
      }
    }
  );

  const addServiceMutation = useMutation(
    ({ deptId, data }) => departmentsAPI.addService(deptId, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('departments');
        setShowServiceModal(false);
        setSelectedDept(null);
        setServiceForm({ name: '', description: '', price: '', duration_days: '', features: [''] });
        toast.success('Service added successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to add service');
      }
    }
  );

  const departments = departmentsData || [];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingDept) {
      updateDepartmentMutation.mutate({ id: editingDept.id, data: formData });
    } else {
      createDepartmentMutation.mutate(formData);
    }
  };

  const handleServiceSubmit = (e) => {
    e.preventDefault();
    const serviceData = {
      ...serviceForm,
      price: parseFloat(serviceForm.price),
      duration_days: parseInt(serviceForm.duration_days),
      features: serviceForm.features.filter(f => f.trim())
    };
    addServiceMutation.mutate({ deptId: selectedDept.id, data: serviceData });
  };

  const addFeatureField = () => {
    setServiceForm(prev => ({ ...prev, features: [...prev.features, ''] }));
  };

  const updateFeature = (index, value) => {
    setServiceForm(prev => ({
      ...prev,
      features: prev.features.map((f, i) => i === index ? value : f)
    }));
  };

  const removeFeature = (index) => {
    setServiceForm(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }));
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (activeDropdown && !event.target.closest('.dropdown-container')) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activeDropdown]);

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
          <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
          <p className="text-gray-600">Manage organization departments and their services</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Department
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.map((dept) => (
          <div key={dept.id} className="card hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: dept.color + '20' }}
              >
                <span
                  className="text-2xl font-bold"
                  style={{ color: dept.color }}
                >
                  {dept.code}
                </span>
              </div>
              <div className="relative dropdown-container">
                <button 
                  className="p-1 hover:bg-gray-100 rounded"
                  onClick={() => setActiveDropdown(activeDropdown === dept.id ? null : dept.id)}
                >
                  <MoreVertical className="w-5 h-5 text-gray-600" />
                </button>
                {activeDropdown === dept.id && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-10">
                    <button
                      onClick={() => {
                        setEditingDept(dept);
                        setFormData({
                          name: dept.name,
                          description: dept.description,
                          color: dept.color,
                          icon: dept.icon
                        });
                        setActiveDropdown(null);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <Edit2 className="w-4 h-4" /> Edit
                    </button>
                    <button
                      onClick={() => {
                        setSelectedDept(dept);
                        setShowServiceModal(true);
                        setActiveDropdown(null);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <Package className="w-4 h-4" /> Add Service
                    </button>
                    {dept.is_active ? (
                      <button
                        onClick={() => {
                          deleteDepartmentMutation.mutate(dept.id);
                          setActiveDropdown(null);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-red-600"
                      >
                        <EyeOff className="w-4 h-4" /> Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          activateDepartmentMutation.mutate(dept.id);
                          setActiveDropdown(null);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-green-600"
                      >
                        <Eye className="w-4 h-4" /> Activate
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <h3 className="font-semibold text-lg mb-2">{dept.name}</h3>
            <p className="text-gray-600 text-sm mb-4">{dept.description}</p>

            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>{dept.member_count || 0} members</span>
              </div>
              <div className="flex items-center gap-1">
                <FolderKanban className="w-4 h-4" />
                <span>{dept.team_leader_count || 0} leaders</span>
              </div>
            </div>

            {!dept.is_active && (
              <div className="mt-3 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full inline-block">
                Inactive
              </div>
            )}
          </div>
        ))}
      </div>

      {departments.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No departments found
        </div>
      )}

      {/* Add/Edit Department Modal */}
      {(showAddModal || editingDept) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {editingDept ? 'Edit Department' : 'Add New Department'}
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingDept(null);
                  setFormData({ name: '', description: '', color: '#3B82F6', icon: 'building' });
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Department Name *</label>
                <input
                  type="text"
                  required
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Web Development"
                />
              </div>

              <div>
                <label className="label">Description</label>
                <textarea
                  className="input h-24 resize-none"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the department"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Color</label>
                  <input
                    type="color"
                    className="input h-10"
                    value={formData.color}
                    onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Icon</label>
                  <select
                    className="input"
                    value={formData.icon}
                    onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                  >
                    <option value="building">Building</option>
                    <option value="globe">Globe</option>
                    <option value="trending">Trending</option>
                    <option value="people">People</option>
                    <option value="code">Code</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingDept(null);
                    setFormData({ name: '', description: '', color: '#3B82F6', icon: 'building' });
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createDepartmentMutation.isLoading || updateDepartmentMutation.isLoading}
                  className="btn-primary flex-1"
                >
                  {createDepartmentMutation.isLoading || updateDepartmentMutation.isLoading ? 'Saving...' : (editingDept ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Service Modal */}
      {showServiceModal && selectedDept && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                Add Service to {selectedDept.name}
              </h2>
              <button
                onClick={() => {
                  setShowServiceModal(false);
                  setSelectedDept(null);
                  setServiceForm({ name: '', description: '', price: '', duration_days: '', features: [''] });
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleServiceSubmit} className="space-y-4">
              <div>
                <label className="label">Service Name *</label>
                <input
                  type="text"
                  required
                  className="input"
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Basic Website Package"
                />
              </div>

              <div>
                <label className="label">Description</label>
                <textarea
                  className="input h-20 resize-none"
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Service description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Price ($) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    className="input"
                    value={serviceForm.price}
                    onChange={(e) => setServiceForm(prev => ({ ...prev, price: e.target.value }))}
                    placeholder="15000"
                  />
                </div>
                <div>
                  <label className="label">Duration (days) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    className="input"
                    value={serviceForm.duration_days}
                    onChange={(e) => setServiceForm(prev => ({ ...prev, duration_days: e.target.value }))}
                    placeholder="30"
                  />
                </div>
              </div>

              <div>
                <label className="label">Features</label>
                {serviceForm.features.map((feature, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      className="input flex-1"
                      value={feature}
                      onChange={(e) => updateFeature(index, e.target.value)}
                      placeholder="Feature description"
                    />
                    {serviceForm.features.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFeature(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addFeatureField}
                  className="btn-secondary text-sm"
                >
                  Add Feature
                </button>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowServiceModal(false);
                    setSelectedDept(null);
                    setServiceForm({ name: '', description: '', price: '', duration_days: '', features: [''] });
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addServiceMutation.isLoading}
                  className="btn-primary flex-1"
                >
                  {addServiceMutation.isLoading ? 'Adding...' : 'Add Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Departments;
