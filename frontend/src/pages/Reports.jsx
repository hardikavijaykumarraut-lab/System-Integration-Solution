import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { reportsAPI, dailyReportsAPI, accountingAPI, dashboardAPI } from '../services/api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  LineChart, Line, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  Treemap, ScatterChart, Scatter, Legend
} from 'recharts';
import { 
  Download, 
  Filter, 
  FileText, 
  CheckCircle, 
  Clock, 
  ChevronDown, 
  ChevronRight,
  Send,
  MessageSquare,
  User,
  Calendar,
  AlertCircle,
  CheckCircle2,
  X,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Target,
  Activity,
  Award,
  Briefcase,
  Building2,
  Star,
  Zap,
  Eye,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

const Reports = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState('30days');
  const queryClient = useQueryClient();

  // Enhanced API calls for comprehensive analytics
  const { data: projectProgressData } = useQuery(
    'projectProgress',
    () => reportsAPI.getProjectProgress(),
    { select: (res) => res.data.data }
  );

  const { data: departmentPerformanceData } = useQuery(
    'departmentPerformance',
    () => reportsAPI.getDepartmentPerformance(),
    { select: (res) => res.data.data }
  );

  const { data: teamProductivityData } = useQuery(
    'teamProductivity',
    () => reportsAPI.getTeamProductivity(),
    { select: (res) => res.data.data }
  );

  const { data: dailyReportsData } = useQuery(
    'dailyReportsAdmin',
    () => dailyReportsAPI.getAll(),
    { select: (res) => res.data.data || [] }
  );

  const { data: financialData } = useQuery(
    'financialAnalytics',
    () => accountingAPI.getSummary(),
    { select: (res) => res.data.data }
  );

  const { data: adminDashboardData } = useQuery(
    'adminDashboard',
    () => dashboardAPI.getAdmin(),
    { select: (res) => res.data.data }
  );

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  const dashboardStats = adminDashboardData?.stats || {};
  const financeSummary = useMemo(() => ({
    total_income: financialData?.summary?.total_income ?? dashboardStats.finance?.income ?? 0,
    total_expenses: financialData?.summary?.total_expenses ?? dashboardStats.finance?.expenses ?? 0,
    net_profit: financialData?.summary?.net_profit ?? dashboardStats.finance?.profit ?? 0,
  }), [financialData, dashboardStats]);

  const refreshData = () => {
    queryClient.invalidateQueries([
      'projectProgress',
      'departmentPerformance',
      'teamProductivity',
      'dailyReportsAdmin',
      'financialAnalytics',
      'adminDashboard'
    ]);
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const monthlyTrendData = useMemo(() => {
    if (!financialData?.monthly_trend) return [];
    const monthMap = {};

    financialData.monthly_trend.forEach((entry) => {
      const year = entry?._id?.year;
      const month = entry?._id?.month;
      const type = entry?._id?.type;
      const total = entry?.total || 0;

      if (!year || !month || !type) return;
      const key = `${year}-${month}`;

      if (!monthMap[key]) {
        monthMap[key] = {
          month: `${monthNames[month - 1] || month} ${year}`,
          income: 0,
          expense: 0,
        };
      }

      if (type === 'income') {
        monthMap[key].income += total;
      }
      if (type === 'expense') {
        monthMap[key].expense += total;
      }
    });

    return Object.values(monthMap);
  }, [financialData]);

  const financeCategoryData = useMemo(() => {
    if (!financialData?.category_breakdown) return [];
    return financialData.category_breakdown.map((item, index) => ({
      name: `${item._id?.category || 'Other'} (${item._id?.type || 'unknown'})`,
      value: item.total,
      fill: COLORS[index % COLORS.length],
    }));
  }, [financialData]);

  const projectBudgetScatterData = useMemo(() => {
    return (projectProgressData || [])
      .filter((project) => project?.budget || project?.actual_cost)
      .map((project) => ({
        name: project.project_name,
        budget: project.budget || 0,
        actual_cost: project.actual_cost || 0,
        progress: project.progress_percentage || 0,
      }));
  }, [projectProgressData]);

  const projectCompletionDistribution = useMemo(() => {
    const buckets = [
      { name: '0-25%', min: 0, max: 25, count: 0 },
      { name: '26-50%', min: 26, max: 50, count: 0 },
      { name: '51-75%', min: 51, max: 75, count: 0 },
      { name: '76-100%', min: 76, max: 100, count: 0 },
    ];

    (projectProgressData || []).forEach((project) => {
      const pct = Number(project?.progress_percentage) || 0;
      const bucket = buckets.find((b) => pct >= b.min && pct <= b.max);
      if (bucket) bucket.count += 1;
    });

    return buckets;
  }, [projectProgressData]);

  const teamProductivityChartData = useMemo(() => {
    return (teamProductivityData || []).map((member) => ({
      ...member,
      completed_tasks: Number(member.completed_tasks) || 0,
      in_progress_tasks: Number(member.in_progress_tasks) || 0,
      pending_tasks: Number(member.pending_tasks) || 0,
      completion_rate: Number(member.completion_rate) || 0,
    }));
  }, [teamProductivityData]);

  const teamStatusDistribution = useMemo(() => {
    const totals = { completed: 0, in_progress: 0, pending: 0 };
    teamProductivityChartData.forEach((member) => {
      totals.completed += member.completed_tasks;
      totals.in_progress += member.in_progress_tasks;
      totals.pending += member.pending_tasks;
    });

    return [
      { name: 'Completed', value: totals.completed, fill: '#10b981' },
      { name: 'In Progress', value: totals.in_progress, fill: '#3b82f6' },
      { name: 'Pending', value: totals.pending, fill: '#f59e0b' },
    ];
  }, [teamProductivityChartData]);

  const projectProgressByDepartment = useMemo(() => {
    const map = {};
    (projectProgressData || []).forEach((project) => {
      const dept = project.department_name || 'Unassigned';
      if (!map[dept]) {
        map[dept] = {
          department_name: dept,
          projects: [],
          average_progress: 0,
        };
      }
      map[dept].projects.push({
        ...project,
        progress_percentage: Number(project.progress_percentage) || 0,
      });
    });

    return Object.values(map).map((group) => {
      const totalProgress = group.projects.reduce((sum, proj) => sum + proj.progress_percentage, 0);
      return {
        ...group,
        average_progress: group.projects.length > 0 ? Number((totalProgress / group.projects.length).toFixed(2)) : 0,
      };
    });
  }, [projectProgressData]);

  const departmentProgressSummary = useMemo(() => {
    return projectProgressByDepartment.map((group) => ({
      department_name: group.department_name,
      project_count: group.projects.length,
      average_progress: group.average_progress,
      completed_projects: group.projects.filter((p) => p.progress_percentage === 100).length,
    }));
  }, [projectProgressByDepartment]);

  const recentActivity = useMemo(() => {
    const result = [];

    (adminDashboardData?.recent_projects || []).slice(0, 2).forEach((project) => {
      result.push({
        label: `Project started: ${project.name}`,
        time: project.created_at,
      });
    });

    (adminDashboardData?.recent_tasks || []).slice(0, 2).forEach((task) => {
      result.push({
        label: `Task updated: ${task.title || task.name || 'Task'}`,
        time: task.created_at,
      });
    });

    return result;
  }, [adminDashboardData]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'departments', label: 'Department Analytics', icon: Building2 },
    { id: 'sales', label: 'Sales & Revenue', icon: DollarSign },
    { id: 'projects', label: 'Project Progress', icon: Briefcase },
    { id: 'team', label: 'Team Productivity', icon: Users },
    { id: 'daily', label: 'Daily Reports', icon: FileText },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-500 to-fuchsia-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Analytics Dashboard</h1>
            <p className="text-blue-100">Comprehensive insights and performance metrics</p>
          </div>
          <div className="flex items-center gap-4">
            <select 
              value={dateRange} 
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-2 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              <option value="7days" className="text-gray-900">Last 7 Days</option>
              <option value="30days" className="text-gray-900">Last 30 Days</option>
              <option value="90days" className="text-gray-900">Last 90 Days</option>
              <option value="1year" className="text-gray-900">Last Year</option>
            </select>
            <button onClick={refreshData} className="bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-2 text-white hover:bg-white/30 transition-colors flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button className="bg-white text-cyan-600 rounded-lg px-4 py-2 hover:bg-cyan-50 transition-colors flex items-center gap-2 font-medium">
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Trend */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-500" />
                Revenue Trend
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                    <Area type="monotone" dataKey="income" stackId="1" stroke="#3b82f6" fill="#3b82f6" name="Income" />
                    <Area type="monotone" dataKey="expense" stackId="1" stroke="#10b981" fill="#10b981" name="Expense" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Department Performance */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-500" />
                Department Performance
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={departmentPerformanceData?.map(dept => ({
                    department: dept.department_name,
                    efficiency: dept.task_completion_rate,
                    quality: 85,
                    collaboration: 75,
                    innovation: 70,
                  })) || []}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="department" />
                    <PolarRadiusAxis />
                    <Radar name="Performance" dataKey="efficiency" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Live Snapshot */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-500" />
                Live Snapshot
              </h4>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Active Projects</span>
                  <span className="font-semibold">{dashboardStats.projects?.active || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Departments</span>
                  <span className="font-semibold">{dashboardStats.departments || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Completed Tasks</span>
                  <span className="font-semibold">{dashboardStats.tasks?.completed || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Clients</span>
                  <span className="font-semibold">{dashboardStats.clients || 0}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-cyan-500" />
                Recent Activity
              </h4>
              <div className="space-y-3">
                {recentActivity.length > 0 ? (
                  recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-cyan-500 rounded-full"></div>
                      <p className="text-sm text-gray-700">{activity.label}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No recent activity available.</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5 text-indigo-500" />
                Finance Snapshot
              </h4>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Income</span>
                  <span className="font-semibold">₹{financeSummary.total_income?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Expenses</span>
                  <span className="font-semibold">₹{financeSummary.total_expenses?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Net Profit</span>
                  <span className="font-semibold">₹{financeSummary.net_profit?.toLocaleString() || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Department Analytics Tab */}
      {activeTab === 'departments' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Department Performance Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-500" />
                Department Performance Overview
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentPerformanceData || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="department_name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="task_completion_rate" fill="#8b5cf6" name="Completion Rate %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Department Distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-500" />
                Department Distribution
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={departmentPerformanceData?.map(dept => ({
                        name: dept.department_name,
                        value: dept.total_members
                      })) || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {departmentPerformanceData?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Department Details Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-500" />
              Department Analytics Details
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium">Department</th>
                    <th className="text-left py-3 px-4 font-medium">Members</th>
                    <th className="text-left py-3 px-4 font-medium">Active Projects</th>
                    <th className="text-left py-3 px-4 font-medium">Task Completion</th>
                    <th className="text-left py-3 px-4 font-medium">Efficiency</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {departmentPerformanceData?.map((dept) => (
                    <tr key={dept.department_id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center text-white font-bold">
                            {dept.department_name?.charAt(0) || 'D'}
                          </div>
                          <div>
                            <p className="font-medium">{dept.department_name}</p>
                            <p className="text-sm text-gray-500">ID: {dept.department_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{dept.total_members}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-4 h-4 text-gray-400" />
                          <span>{dept.completed_projects} / {dept.total_projects}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${dept.task_completion_rate}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">{dept.task_completion_rate.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            dept.task_completion_rate >= 80 ? 'bg-green-500' : 
                            dept.task_completion_rate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}></div>
                          <span className="text-sm">
                            {dept.task_completion_rate >= 80 ? 'High' : 
                             dept.task_completion_rate >= 60 ? 'Medium' : 'Low'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          dept.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {dept.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sales & Revenue Tab */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Trend */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                Revenue Trend
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                    <Legend />
                    <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} name="Income" />
                    <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} name="Expense" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Sales by Department */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-500" />
                Sales by Department
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <Treemap
                    data={financeCategoryData}
                    dataKey="value"
                    aspectRatio={4 / 3}
                    stroke="#fff"
                  />
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
              <div className="flex items-center justify-between mb-4">
                <DollarSign className="w-8 h-8 text-green-600" />
                <span className="text-green-600 text-sm font-medium">+23%</span>
              </div>
              <p className="text-green-800 text-sm mb-1">Total Revenue</p>
              <p className="text-2xl font-bold text-green-900">₹{financialData?.total_revenue?.toLocaleString() || '0'}</p>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200">
              <div className="flex items-center justify-between mb-4">
                <TrendingDown className="w-8 h-8 text-red-600" />
                <span className="text-red-600 text-sm font-medium">+15%</span>
              </div>
              <p className="text-red-800 text-sm mb-1">Total Expenses</p>
              <p className="text-2xl font-bold text-red-900">₹{financialData?.total_expenses?.toLocaleString() || '0'}</p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
              <div className="flex items-center justify-between mb-4">
                <TrendingUp className="w-8 h-8 text-blue-600" />
                <span className="text-blue-600 text-sm font-medium">+31%</span>
              </div>
              <p className="text-blue-800 text-sm mb-1">Net Profit</p>
              <p className="text-2xl font-bold text-blue-900">₹{financialData?.net_profit?.toLocaleString() || '0'}</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
              <div className="flex items-center justify-between mb-4">
                <Target className="w-8 h-8 text-purple-600" />
                <span className="text-purple-600 text-sm font-medium">On Track</span>
              </div>
              <p className="text-purple-800 text-sm mb-1">Target Achievement</p>
              <p className="text-2xl font-bold text-purple-900">87%</p>
            </div>
          </div>
        </div>
      )}

      {/* Project Progress Tab */}
      {activeTab === 'projects' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-cyan-500" />
                Department Project Progress
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentProgressSummary} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="department_name" angle={-20} textAnchor="end" interval={0} height={80} />
                    <YAxis />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Legend />
                    <Bar dataKey="average_progress" fill="#3b82f6" name="Avg Progress" />
                    <Bar dataKey="project_count" fill="#10b981" name="Projects" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-500" />
                Project Status Distribution
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Active', value: projectProgressData?.filter(p => p.status === 'active').length || 0 },
                        { name: 'Completed', value: projectProgressData?.filter(p => p.status === 'completed').length || 0 },
                        { name: 'In Progress', value: projectProgressData?.filter(p => p.status === 'in_progress').length || 0 },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      dataKey="value"
                    >
                      <Cell fill="#3b82f6" />
                      <Cell fill="#10b981" />
                      <Cell fill="#f59e0b" />
                    </Pie>
                    <Tooltip formatter={(value) => `${value} projects`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {projectProgressByDepartment.length > 0 ? (
            projectProgressByDepartment.map((department) => (
              <div key={department.department_name} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
                  <div>
                    <h4 className="text-xl font-semibold">{department.department_name}</h4>
                    <p className="text-sm text-gray-500">{department.projects.length} projects • Avg progress {department.average_progress}%</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <span className="rounded-full bg-green-50 text-green-800 px-3 py-1 text-sm">Completed {department.projects.filter(p => p.status === 'completed').length}</span>
                    <span className="rounded-full bg-blue-50 text-blue-800 px-3 py-1 text-sm">Active {department.projects.filter(p => p.status === 'active').length}</span>
                    <span className="rounded-full bg-yellow-50 text-yellow-800 px-3 py-1 text-sm">In Progress {department.projects.filter(p => p.status === 'in_progress').length}</span>
                  </div>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={department.projects} layout="vertical" margin={{ top: 20, right: 20, left: 120, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                      <YAxis dataKey="project_name" type="category" width={140} />
                      <Tooltip formatter={(value) => `${value}%`} />
                      <Bar dataKey="progress_percentage" fill="#3b82f6" name="Progress %" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
              <p className="text-gray-500">No project progress data available yet.</p>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-purple-500" />
              Budget vs Actual Cost Relationship
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="budget" name="Budget" tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                    <YAxis type="number" dataKey="actual_cost" name="Actual Cost" tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value) => `₹${Number(value).toLocaleString()}`} cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter name="Projects" data={projectBudgetScatterData} fill="#3b82f6" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={projectCompletionDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Team Productivity Tab */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-500" />
                Team Productivity Overview
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={teamProductivityChartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-20} textAnchor="end" height={80} interval={0} />
                    <YAxis />
                    <Tooltip formatter={(value) => Number(value).toLocaleString()} />
                    <Legend />
                    <Bar dataKey="completed_tasks" fill="#10b981" name="Completed" />
                    <Bar dataKey="in_progress_tasks" fill="#3b82f6" name="In Progress" />
                    <Bar dataKey="pending_tasks" fill="#f59e0b" name="Pending" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-cyan-500" />
                Task Status Distribution
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={teamStatusDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={90}
                      dataKey="value"
                    >
                      {teamStatusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => Number(value).toLocaleString()} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-500" />
                Productivity Snapshot
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Team Members</span>
                  <span className="font-semibold">{teamProductivityData?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Tasks</span>
                  <span className="font-semibold">{teamProductivityChartData.reduce((sum, member) => sum + member.completed_tasks + member.in_progress_tasks + member.pending_tasks, 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Average Completion</span>
                  <span className="font-semibold">{teamProductivityChartData.length ? `${(teamProductivityChartData.reduce((sum, member) => sum + member.completion_rate, 0) / teamProductivityChartData.length).toFixed(1)}%` : '0%'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Top Performers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {teamProductivityChartData?.slice(0, 3).map((member, index) => (
              <div key={member.user_id || member.email || index} className="bg-gradient-to-br from-cyan-50 to-fuchsia-50 rounded-xl p-6 border border-cyan-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {index + 1}
                  </div>
                  <div className="flex items-center gap-1 text-green-600">
                    <Star className="w-4 h-4 fill-current" />
                    <span className="text-sm font-medium">Top Performer</span>
                  </div>
                </div>
                <h4 className="font-semibold text-lg mb-2">{member.name}</h4>
                <p className="text-gray-600 text-sm mb-4">{member.department || 'Team Member'}</p>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Completed</span>
                    <span className="font-semibold">{member.completed_tasks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">In Progress</span>
                    <span className="font-semibold">{member.in_progress_tasks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Completion Rate</span>
                    <span className="font-semibold text-green-600">{member.completion_rate}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Reports Tab */}
      {activeTab === 'daily' && (
        <DailyReportsAdmin 
          reports={dailyReportsData} 
          queryClient={queryClient}
        />
      )}
    </div>
  );
};

// Daily Reports Admin Component
const DailyReportsAdmin = ({ reports, queryClient }) => {
  const [expandedReport, setExpandedReport] = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showUpdateClientModal, setShowUpdateClientModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [clientUpdate, setClientUpdate] = useState('');

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

  // Add feedback mutation
  const feedbackMutation = useMutation(
    ({ reportId, feedback }) => dailyReportsAPI.addFeedback(reportId, { feedback }),
    {
      onSuccess: () => {
        toast.success('Feedback added successfully');
        queryClient.invalidateQueries(['dailyReportsAdmin']);
        setShowFeedbackModal(false);
        setFeedback('');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to add feedback');
      }
    }
  );

  // Send update to client mutation
  const sendToClientMutation = useMutation(
    (data) => chatAPI.sendMessage({
      receiver_id: data.client_id,
      content: `Project Update - ${data.project_name}:\n\n${data.message}\n\n---\nBased on daily report from ${data.team_lead_name} on ${new Date(data.report_date).toLocaleDateString()}`
    }),
    {
      onSuccess: () => {
        toast.success('Update sent to client successfully');
        setShowUpdateClientModal(false);
        setClientUpdate('');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to send update to client');
      }
    }
  );

  const handleAddFeedback = (e) => {
    e.preventDefault();
    if (!feedback.trim()) {
      toast.error('Please enter feedback');
      return;
    }
    feedbackMutation.mutate({ reportId: selectedReport.id, feedback });
  };

  const handleSendToClient = (e) => {
    e.preventDefault();
    if (!clientUpdate.trim()) {
      toast.error('Please enter update message');
      return;
    }
    sendToClientMutation.mutate({
      client_id: selectedReport.client_id,
      project_name: selectedReport.project_name,
      team_lead_name: selectedReport.team_lead_name,
      report_date: selectedReport.report_date,
      message: clientUpdate
    });
  };

  const openFeedbackModal = (report, e) => {
    e.stopPropagation();
    setSelectedReport(report);
    setShowFeedbackModal(true);
  };

  const openUpdateClientModal = (report, e) => {
    e.stopPropagation();
    setSelectedReport(report);
    // Pre-fill with report summary
    setClientUpdate(
      `Daily Progress Report for ${report.project_name}:\n\n` +
      `Progress: ${report.overall_progress}%\n` +
      `Status: ${report.status}\n\n` +
      `Your project is progressing well. Our team is working diligently to meet the deadlines.`
    );
    setShowUpdateClientModal(true);
  };

  return (
    <div className="space-y-6">
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
              <p className="text-sm text-gray-600">Pending Review</p>
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
              <BarChart className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Reports List */}
      {reports.length === 0 ? (
        <div className="card text-center py-12">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No daily reports submitted yet</p>
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
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {report.team_lead_name}
                      </span>
                      <span className="mx-2">•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(report.report_date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
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
                        <CheckCircle2 className="w-4 h-4 mr-2" />
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

                  {/* Admin Actions */}
                  <div className="mt-6 flex gap-3 pt-4 border-t">
                    <button
                      onClick={(e) => openFeedbackModal(report, e)}
                      className="btn-secondary flex items-center gap-2"
                    >
                      <MessageSquare className="w-4 h-4" />
                      {report.status === 'reviewed' ? 'Update Feedback' : 'Add Feedback'}
                    </button>
                    <button
                      onClick={(e) => openUpdateClientModal(report, e)}
                      className="btn-primary flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      Update Client
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold">Add Feedback</h2>
              <button 
                onClick={() => setShowFeedbackModal(false)} 
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddFeedback} className="p-6 space-y-4">
              <div>
                <label className="label">Report</label>
                <p className="text-sm text-gray-600">
                  {selectedReport.project_name} - {selectedReport.team_lead_name}
                </p>
              </div>
              <div>
                <label className="label">Feedback</label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="input h-32 resize-none"
                  placeholder="Enter your feedback on this report..."
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowFeedbackModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={feedbackMutation.isLoading}
                >
                  {feedbackMutation.isLoading ? 'Saving...' : 'Save Feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Client Modal */}
      {showUpdateClientModal && selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold">Update Client</h2>
              <button 
                onClick={() => setShowUpdateClientModal(false)} 
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSendToClient} className="p-6 space-y-4">
              <div>
                <label className="label">Client</label>
                <p className="text-sm text-gray-600">{selectedReport.client_name || 'Client'}</p>
              </div>
              <div>
                <label className="label">Project</label>
                <p className="text-sm text-gray-600">{selectedReport.project_name}</p>
              </div>
              <div>
                <label className="label">Update Message</label>
                <textarea
                  value={clientUpdate}
                  onChange={(e) => setClientUpdate(e.target.value)}
                  className="input h-40 resize-none"
                  placeholder="Enter update message for client..."
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowUpdateClientModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={sendToClientMutation.isLoading}
                >
                  {sendToClientMutation.isLoading ? 'Sending...' : 'Send Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
