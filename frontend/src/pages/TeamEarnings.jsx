import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { accountingAPI } from '../services/api';
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  Calendar,
  CreditCard,
  FolderKanban,
  User,
  Wallet,
  PieChart
} from 'lucide-react';
import toast from 'react-hot-toast';

const TeamEarnings = () => {
  const { user } = useAuthStore();
  const [earningsData, setEarningsData] = useState({ payments: [], total_earnings: 0, total_hours: 0 });
  const [hoursData, setHoursData] = useState({ projects: [], total_hours: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch earnings data
      const earningsResponse = await accountingAPI.getTeamMemberEarnings();
      setEarningsData(earningsResponse.data.data || { payments: [], total_earnings: 0, total_hours: 0 });
      
      // Fetch hours worked data
      const hoursResponse = await accountingAPI.getTeamMemberHours();
      setHoursData(hoursResponse.data.data || { projects: [], total_hours: 0 });
    } catch (error) {
      toast.error('Failed to load earnings data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">My Earnings</h1>
        <p className="text-gray-600">Track your payments and work hours across all projects</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-gradient-to-br from-green-50 to-emerald-100 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 font-medium">Total Earnings</p>
              <p className="text-3xl font-bold text-green-900 mt-1">₹{earningsData.total_earnings.toLocaleString()}</p>
              <p className="text-xs text-green-600 mt-1">All time earnings</p>
            </div>
            <div className="p-4 rounded-full bg-white/80 shadow-md">
              <Wallet className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-medium">Total Hours Worked</p>
              <p className="text-3xl font-bold text-blue-900 mt-1">{hoursData.total_hours.toFixed(1)}</p>
              <p className="text-xs text-blue-600 mt-1">Across all projects</p>
            </div>
            <div className="p-4 rounded-full bg-white/80 shadow-md">
              <Clock className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-50 to-pink-100 border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-700 font-medium">Payments Received</p>
              <p className="text-3xl font-bold text-purple-900 mt-1">{earningsData.payments.length}</p>
              <p className="text-xs text-purple-600 mt-1">Total transactions</p>
            </div>
            <div className="p-4 rounded-full bg-white/80 shadow-md">
              <DollarSign className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Hours Breakdown by Project */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <PieChart className="w-5 h-5" />
          Hours Breakdown by Project
        </h3>

        {hoursData.projects.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No hours recorded yet</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hoursData.projects.map((project) => (
              <div key={project.project_id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <FolderKanban className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm">{project.project_name}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">{project.project_code}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Clock className="w-3 h-3 text-blue-600" />
                      <span className="text-sm font-bold text-blue-600">{project.hours.toFixed(1)} hrs</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment History */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Payment History
        </h3>

        {earningsData.payments.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No payments received yet. Your team lead will process payments based on hours worked.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Project</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Paid By</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Hours Paid</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Amount</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Payment Mode</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Reference</th>
                </tr>
              </thead>
              <tbody>
                {earningsData.payments.map((payment) => (
                  <tr key={payment.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700">
                          {new Date(payment.payment_date).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-sm font-medium">{payment.project_name}</p>
                        <p className="text-xs text-gray-500">{payment.project_code}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium">{payment.team_lead_name}</p>
                          <p className="text-xs text-gray-500">Team Lead</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-600">{payment.hours_paid} hrs</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-bold text-green-600">₹{payment.amount.toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full capitalize">
                        {payment.payment_mode.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-600 font-mono">
                        {payment.transaction_id || '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Additional Info Card */}
      <div className="card bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-full bg-white shadow-md">
            <DollarSign className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-blue-900 mb-2">How Payments Work</h4>
            <ul className="space-y-1 text-sm text-blue-800">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>Your team lead tracks the hours you work on each project</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>Admin transfers funds to your team lead for client projects</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>Team lead processes your payment based on hours worked and hourly rate</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>All payments are recorded here for your reference</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamEarnings;
