import { useState, useEffect } from 'react';
import { ChevronDown, CheckCircle, Clock, AlertCircle, Loader, Lock } from 'lucide-react';
import { useUpdateProjectStatus } from '../hooks/useUpdateProjectStatus';

const ProjectStatusDropdown = ({ projectId, currentStatus, onStatusChange, canUpdate = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { mutate: updateStatus, isLoading, error } = useUpdateProjectStatus();

  const statusOptions = [
    {
      value: 'active',
      label: 'Active',
      icon: Clock,
      color: 'bg-blue-100 text-blue-800',
      description: 'Project is in progress',
    },
    {
      value: 'in_progress',
      label: 'In Progress',
      icon: AlertCircle,
      color: 'bg-yellow-100 text-yellow-800',
      description: 'Work is ongoing',
    },
    {
      value: 'completed',
      label: 'Completed',
      icon: CheckCircle,
      color: 'bg-green-100 text-green-800',
      description: 'Project finished',
    },
  ];

  const currentStatusObj = statusOptions.find((s) => s.value === currentStatus);
  const CurrentIcon = currentStatusObj?.icon || AlertCircle;

  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => setShowSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showSuccess]);

  const handleStatusChange = (newStatus) => {
    if (newStatus === currentStatus) {
      setIsOpen(false);
      return;
    }

    updateStatus(
      { projectId, status: newStatus },
      {
        onSuccess: () => {
          onStatusChange(newStatus);
          setShowSuccess(true);
          setIsOpen(false);
        },
      }
    );
  };

  // If user doesn't have permission, show read-only status badge
  if (!canUpdate) {
    return (
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm ${
          currentStatusObj?.color || 'bg-gray-100 text-gray-800'
        } cursor-not-allowed opacity-75`}
        title="Only admins and team leaders can update project status"
      >
        <CurrentIcon className="w-4 h-4" />
        <span className="capitalize hidden sm:inline">{currentStatus?.replace('_', ' ')}</span>
        <Lock className="w-4 h-4 ml-1" />
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      {/* Status Button - Editable */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
          currentStatusObj?.color || 'bg-gray-100 text-gray-800'
        } ${isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-md hover:scale-105'}`}
        title="Click to change project status"
      >
        {isLoading ? (
          <Loader className="w-4 h-4 animate-spin" />
        ) : (
          <CurrentIcon className="w-4 h-4" />
        )}
        <span className="capitalize hidden sm:inline">{currentStatus?.replace('_', ' ')}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Success Toast */}
      {showSuccess && (
        <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap z-50 font-medium">
          ✓ Status updated successfully
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-64 bg-white border border-gray-200 rounded-lg shadow-xl z-50">
          {error && (
            <div className="p-3 bg-red-50 border-b border-red-200 text-red-700 text-sm">
              {error.response?.data?.message || 'Failed to update status'}
            </div>
          )}

          <div className="p-2">
            <div className="px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide border-b mb-2">
              Update Project Status
            </div>
            {statusOptions.map((option) => {
              const OptionIcon = option.icon;
              const isSelected = option.value === currentStatus;

              return (
                <button
                  key={option.value}
                  onClick={() => handleStatusChange(option.value)}
                  disabled={isLoading || isSelected}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all ${
                    isSelected
                      ? 'bg-blue-50 border-2 border-blue-400'
                      : 'hover:bg-gray-50 border-2 border-transparent'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <OptionIcon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                    isSelected ? 'text-blue-600' : 'text-gray-400'
                  }`} />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{option.label}</div>
                    <div className="text-xs text-gray-500">{option.description}</div>
                  </div>
                  {isSelected && (
                    <div className="w-2.5 h-2.5 bg-blue-600 rounded-full mt-1.5 flex-shrink-0"></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default ProjectStatusDropdown;
