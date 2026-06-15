import { useState, useEffect } from 'react';
import { requirementsAPI, dailyReportsAPI } from '../services/api';
import { 
  FileText, 
  Calendar, 
  Plus, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  X,
  ChevronDown,
  ChevronRight,
  Send,
  BarChart3,
  Users
} from 'lucide-react';
import toast from 'react-hot-toast';

const DailyReports = () => {
  const [projects, setProjects] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [expandedReport, setExpandedReport] = useState(null);

  // Report form state
  const [reportForm, setReportForm] = useState({
    report_date: new Date().toISOString().split('T')[0],
    tasks_completed: [''],
    tasks_in_progress: [''],
    tasks_planned: [''],
    issues_blockers: '',
    overall_progress: 0,
    notes: ''
  });

  useEffect(() => {
    fetchProjects();
    fetchReports();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await requirementsAPI.getAssigned();
      setProjects(response.data.data || []);
    } catch (error) {
      toast.error('Failed to load projects');
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await dailyReportsAPI.getAll();
      setReports(response.data.data || []);
    } catch (error) {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTaskField = (field) => {
    setReportForm({
      ...reportForm,
      [field]: [...reportForm[field], '']
    });
  };

  const handleRemoveTaskField = (field, index) => {
    const updated = reportForm[field].filter((_, i) => i !== index);
    setReportForm({
      ...reportForm,
      [field]: updated
    });
  };

  const handleTaskChange = (field, index, value) => {
    const updated = [...reportForm[field]];
    updated[index] = value;
    setReportForm({
      ...reportForm,
      [field]: updated
    });
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();

    if (!selectedProject) {
      toast.error('Please select a project');
      return;
    }

    // Filter out empty tasks
    const data = {
      ...reportForm,
      project_id: selectedProject.project_id,
      tasks_completed: reportForm.tasks_completed.filter(t => t.trim()),
      tasks_in_progress: reportForm.tasks_in_progress.filter(t => t.trim()),
      tasks_planned: reportForm.tasks_planned.filter(t => t.trim())
    };

    try {
      await dailyReportsAPI.submit(data);
      toast.success('Daily report submitted successfully');
      setShowReportModal(false);
      setSelectedProject(null);
      setReportForm({
        report_date: new Date().toISOString().split('T')[0],
        tasks_completed: [''],
        tasks_in_progress: [''],
        tasks_planned: [''],
        issues_blockers: '',
        overall_progress: 0,
        notes: ''
      });
      fetchReports();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit report');
    }
  };

  const toggleReport = (reportId) => {
    setExpandedReport(expandedReport === reportId ? null : reportId);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'reviewed': return 'bg-green-100 text-green-800';
      case 'submitted': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Daily Reports</h1>
          <p className="text-gray-600">Submit daily progress reports to admin</p>
        </div>
        <button
          onClick={() => setShowReportModal(true)}
          className="btn-primary flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Submit New Report
        </button>
      </div>

      {/* Team Member Work Summary */}
      {reports.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Member Work Summary
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Team Member</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Project</th>
                  <th className="text-center py-2 px-3 text-sm font-medium text-gray-600">Reports</th>
                  <th className="text-center py-2 px-3 text-sm font-medium text-gray-600">Tasks Completed</th>
                  <th className="text-center py-2 px-3 text-sm font-medium text-gray-600">Avg Progress</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(
                  reports.reduce((acc, report) => {
                    const memberName = report.team_lead_name || report.submitted_by_name || 'Unknown';
                    const key = `${memberName}-${report.project_name}`;
                    if (!acc[key]) {
                      acc[key] = {
                        member: memberName,
                        project: report.project_name,
                        reports: 0,
                        tasksCompleted: 0,
                        totalProgress: 0
                      };
                    }
                    acc[key].reports++;
                    acc[key].tasksCompleted += report.tasks_completed_count || 0;
                    acc[key].totalProgress += report.overall_progress || 0;
                    return acc;
                  }, {})
                ).map(([key, data]) => (
                  <tr key={key} className="border-b last:border-0">
                    <td className="py-2 px-3 text-sm">{data.member}</td>
                    <td className="py-2 px-3 text-sm">{data.project}</td>
                    <td className="py-2 px-3 text-sm text-center">{data.reports}</td>
                    <td className="py-2 px-3 text-sm text-center">{data.tasksCompleted}</td>
                    <td className="py-2 px-3 text-sm text-center">
                      <span className="px-2 py-1 rounded-full text-xs bg-primary-100 text-primary-600">
                        {Math.round(data.totalProgress / data.reports)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Reports</p>
              <p className="text-2xl font-bold">{reports.length}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Submitted</p>
              <p className="text-2xl font-bold">
                {reports.filter(r => r.status === 'submitted').length}
              </p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Reviewed</p>
              <p className="text-2xl font-bold">
                {reports.filter(r => r.status === 'reviewed').length}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Progress</p>
              <p className="text-2xl font-bold">
                {reports.length > 0 
                  ? Math.round(reports.reduce((acc, r) => acc + r.overall_progress, 0) / reports.length)
                  : 0}%
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <BarChart3 className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : reports.length === 0 ? (
        <div className="card text-center py-12">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No reports submitted yet</p>
          <button
            onClick={() => setShowReportModal(true)}
            className="btn-primary mt-4"
          >
            Submit Your First Report
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report.id} className="card">
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleReport(report.id)}
              >
                <div className="flex items-center gap-4">
                  {expandedReport === report.id ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                  <div>
                    <h3 className="font-semibold">{report.project_name}</h3>
                    <p className="text-sm text-gray-600">
                      {new Date(report.report_date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Progress</p>
                    <p className="font-semibold text-primary-600">{report.overall_progress}%</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                    {report.status}
                  </span>
                </div>
              </div>

              {/* Expanded Report Details */}
              {expandedReport === report.id && (
                <div className="mt-6 pt-6 border-t">
                  <div className="grid grid-cols-3 gap-6">
                    {/* Tasks Completed */}
                    <div>
                      <h4 className="font-medium text-green-700 mb-3 flex items-center">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Completed ({report.tasks_completed_count})
                      </h4>
                      <ul className="space-y-2">
                        {report.tasks_completed?.map((task, idx) => (
                          <li key={idx} className="text-sm text-gray-700 flex items-start">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
                            {task}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Tasks In Progress */}
                    <div>
                      <h4 className="font-medium text-blue-700 mb-3 flex items-center">
                        <Clock className="w-4 h-4 mr-2" />
                        In Progress ({report.tasks_in_progress_count})
                      </h4>
                      <ul className="space-y-2">
                        {report.tasks_in_progress?.map((task, idx) => (
                          <li key={idx} className="text-sm text-gray-700 flex items-start">
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
                            {task}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Planned Tasks */}
                    <div>
                      <h4 className="font-medium text-purple-700 mb-3 flex items-center">
                        <Calendar className="w-4 h-4 mr-2" />
                        Planned ({report.tasks_planned?.length || 0})
                      </h4>
                      <ul className="space-y-2">
                        {report.tasks_planned?.map((task, idx) => (
                          <li key={idx} className="text-sm text-gray-700 flex items-start">
                            <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
                            {task}
                          </li>
                        ))}
                      </ul>
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
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-medium mb-2">Additional Notes</h4>
                      <p className="text-sm text-gray-700">{report.notes}</p>
                    </div>
                  )}

                  {report.admin_feedback && (
                    <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                      <h4 className="font-medium text-green-800 mb-2">Admin Feedback</h4>
                      <p className="text-sm text-green-700">{report.admin_feedback}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Submit Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full mx-4 my-8">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold">Submit Daily Report</h2>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReport} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Project Selection */}
              <div>
                <label className="label">Select Project *</label>
                <select
                  value={selectedProject?.id || ''}
                  onChange={(e) => {
                    const project = projects.find(p => p.id === e.target.value);
                    setSelectedProject(project);
                  }}
                  className="input"
                  required
                >
                  <option value="">Choose a project...</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.project_title || project.project_name || project.package_name || project.name || 'Project'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Report Date */}
              <div>
                <label className="label">Report Date *</label>
                <input
                  type="date"
                  value={reportForm.report_date}
                  onChange={(e) => setReportForm({...reportForm, report_date: e.target.value})}
                  className="input"
                  required
                />
              </div>

              {/* Overall Progress */}
              <div>
                <label className="label">Overall Progress (%)</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={reportForm.overall_progress}
                  onChange={(e) => setReportForm({...reportForm, overall_progress: parseInt(e.target.value)})}
                  className="w-full"
                />
                <div className="text-center font-semibold text-primary-600">
                  {reportForm.overall_progress}%
                </div>
              </div>

              {/* Tasks Completed */}
              <div>
                <label className="label">Tasks Completed</label>
                {reportForm.tasks_completed.map((task, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={task}
                      onChange={(e) => handleTaskChange('tasks_completed', index, e.target.value)}
                      placeholder="Enter completed task..."
                      className="input flex-1"
                    />
                    {reportForm.tasks_completed.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTaskField('tasks_completed', index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => handleAddTaskField('tasks_completed')}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  + Add another completed task
                </button>
              </div>

              {/* Tasks In Progress */}
              <div>
                <label className="label">Tasks In Progress</label>
                {reportForm.tasks_in_progress.map((task, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={task}
                      onChange={(e) => handleTaskChange('tasks_in_progress', index, e.target.value)}
                      placeholder="Enter in-progress task..."
                      className="input flex-1"
                    />
                    {reportForm.tasks_in_progress.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTaskField('tasks_in_progress', index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => handleAddTaskField('tasks_in_progress')}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  + Add another in-progress task
                </button>
              </div>

              {/* Tasks Planned */}
              <div>
                <label className="label">Tasks Planned for Tomorrow</label>
                {reportForm.tasks_planned.map((task, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={task}
                      onChange={(e) => handleTaskChange('tasks_planned', index, e.target.value)}
                      placeholder="Enter planned task..."
                      className="input flex-1"
                    />
                    {reportForm.tasks_planned.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTaskField('tasks_planned', index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => handleAddTaskField('tasks_planned')}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  + Add another planned task
                </button>
              </div>

              {/* Issues & Blockers */}
              <div>
                <label className="label">Issues & Blockers</label>
                <textarea
                  value={reportForm.issues_blockers}
                  onChange={(e) => setReportForm({...reportForm, issues_blockers: e.target.value})}
                  placeholder="Describe any issues or blockers..."
                  className="input h-24 resize-none"
                />
              </div>

              {/* Additional Notes */}
              <div>
                <label className="label">Additional Notes</label>
                <textarea
                  value={reportForm.notes}
                  onChange={(e) => setReportForm({...reportForm, notes: e.target.value})}
                  placeholder="Any additional notes or comments..."
                  className="input h-24 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex items-center">
                  <Send className="w-4 h-4 mr-2" />
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyReports;
