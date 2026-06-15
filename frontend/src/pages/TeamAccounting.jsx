import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { accountingAPI } from '../services/api';
import { 
  DollarSign, 
  Users, 
  Clock, 
  Calculator,
  Send,
  History,
  TrendingUp,
  User,
  CreditCard
} from 'lucide-react';
import toast from 'react-hot-toast';

const TeamAccounting = () => {
  const { user } = useAuthStore();
  const [wagesData, setWagesData] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showWageCalculator, setShowWageCalculator] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [balanceInfo, setBalanceInfo] = useState({ balance: 0, total_received: 0, total_paid: 0 });
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    hours_paid: '',
    hourly_rate: '',
    payment_mode: 'bank_transfer',
    transaction_id: '',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch wages data
      const wagesResponse = await accountingAPI.getTeamLeaderWages();
      setWagesData(wagesResponse.data.data || []);
      setBalanceInfo({
        balance: wagesResponse.data.balance || 0,
        total_received: wagesResponse.data.total_received || 0,
        total_paid: wagesResponse.data.total_paid || 0
      });
      
      // Fetch payment history
      const paymentsResponse = await accountingAPI.getTeamLeaderPayments();
      setPayments(paymentsResponse.data.data || []);
    } catch (error) {
      toast.error('Failed to load accounting data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPaymentModal = (member, project) => {
    if (!member.eligible_for_payment) {
      toast.error('Team member is only eligible for payment after completing tasks');
      return;
    }
    
    setSelectedMember(member);
    setSelectedProject(project);
    setPaymentForm({
      hourly_rate: member.hourly_rate || '',
      hours_paid: member.hours_worked || '',
      amount: member.wage_amount || '',
      payment_mode: 'bank_transfer',
      transaction_id: '',
      notes: ''
    });
    setShowWageCalculator(true);
  };

  const calculateWageAmount = () => {
    const hours = parseFloat(paymentForm.hours_paid) || 0;
    const rate = parseFloat(paymentForm.hourly_rate) || 0;
    return (hours * rate).toFixed(2);
  };

  const handleCalculateWages = () => {
    const calculatedAmount = calculateWageAmount();
    setPaymentForm({...paymentForm, amount: calculatedAmount});
    toast.success(`Calculated wage: ₹${calculatedAmount}`);
  };

  const handleProcessPayment = async (e) => {
    e.preventDefault();
    
    if (!selectedMember || !selectedProject) {
      toast.error('Invalid selection');
      return;
    }

    if (parseFloat(paymentForm.amount) > balanceInfo.balance) {
      toast.error('Insufficient balance. Please wait for admin to transfer more funds.');
      return;
    }

    try {
      await accountingAPI.createTeamLeaderPayment({
        member_id: selectedMember.member_id,
        project_id: selectedProject.project_id,
        amount: parseFloat(paymentForm.amount),
        hours_paid: parseFloat(paymentForm.hours_paid),
        payment_mode: paymentForm.payment_mode,
        notes: paymentForm.notes,
        payment_date: new Date().toISOString().split('T')[0]
      });

      // Remove paid member from the current project view immediately
      setWagesData((prevWages) =>
        prevWages
          .map((project) => {
            if (project.project_id !== selectedProject.project_id) return project;

            const remainingMembers = project.team_members.filter(
              (member) => member.member_id !== selectedMember.member_id
            );

            const remainingHours = remainingMembers.reduce(
              (sum, member) => sum + (parseFloat(member.hours_worked) || 0),
              0
            );
            const remainingWages = remainingMembers.reduce(
              (sum, member) => sum + (parseFloat(member.wage_amount) || 0),
              0
            );

            return {
              ...project,
              team_members: remainingMembers,
              total_hours: remainingHours,
              total_wages: remainingWages,
            };
          })
          .filter((project) => project.team_members.length > 0)
      );

      toast.success('Payment processed successfully!');
      setShowWageCalculator(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to process payment');
    }
  };

  const calculateTotals = () => {
    const unpaidHours = wagesData.reduce((sum, p) => sum + (parseFloat(p.total_hours) || 0), 0);
    const totalPaidHours = payments.reduce((sum, p) => sum + (parseFloat(p.hours_paid) || 0), 0);
    const totalWages = wagesData.reduce((sum, p) => sum + (parseFloat(p.total_wages) || 0), 0);
    const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    return { totalHours: unpaidHours + totalPaidHours, totalWages, totalPaid, totalPaidHours };
  };

  const totals = calculateTotals();

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
        <h1 className="text-2xl font-bold">Accounting & Wages</h1>
        <p className="text-gray-600">Manage team member payments and track project hours</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card bg-gradient-to-br from-green-50 to-emerald-100 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 font-medium">Available Balance</p>
              <p className="text-3xl font-bold text-green-900 mt-1">₹{balanceInfo.balance.toLocaleString()}</p>
              <p className="text-xs text-green-600 mt-1">From admin transfers</p>
            </div>
            <div className="p-4 rounded-full bg-white/80 shadow-md">
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-medium">Total Received</p>
              <p className="text-3xl font-bold text-blue-900 mt-1">₹{balanceInfo.total_received.toLocaleString()}</p>
              <p className="text-xs text-blue-600 mt-1">Admin transfers</p>
            </div>
            <div className="p-4 rounded-full bg-white/80 shadow-md">
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-50 to-pink-100 border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-700 font-medium">Total Paid</p>
              <p className="text-3xl font-bold text-purple-900 mt-1">₹{balanceInfo.total_paid.toLocaleString()}</p>
              <p className="text-xs text-purple-600 mt-1">To team members</p>
            </div>
            <div className="p-4 rounded-full bg-white/80 shadow-md">
              <CreditCard className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-orange-50 to-amber-100 border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-700 font-medium">Total Hours Worked</p>
              <p className="text-3xl font-bold text-orange-900 mt-1">{totals.totalHours.toFixed(1)}</p>
              <p className="text-xs text-orange-600 mt-1">Includes paid hours</p>
            </div>
            <div className="p-4 rounded-full bg-white/80 shadow-md">
              <Clock className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Pending Team Member Payments */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold">Pending Team Member Payments</h3>
            <p className="text-gray-500 text-sm">Review team wages and process payments for eligible members.</p>
          </div>
          <div className="text-sm text-gray-600">
            Total projects: <span className="font-semibold">{wagesData.length}</span>
          </div>
        </div>

        {wagesData.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No pending team member payments available.</p>
        ) : (
          <div className="space-y-6">
            {wagesData.map((project) => (
              <div key={project.project_id} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="text-sm text-gray-500">Project</p>
                    <p className="font-semibold text-base">{project.project_name}</p>
                    <p className="text-xs text-gray-400">{project.project_code}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Unpaid Hours</p>
                    <p className="font-semibold">{parseFloat(project.total_hours || 0).toFixed(1)} hrs</p>
                  </div>
                </div>

                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-left">
                    <thead className="bg-white border-b">
                      <tr>
                        <th className="py-3 px-4 text-xs font-semibold uppercase text-gray-500">Team Member</th>
                        <th className="py-3 px-4 text-xs font-semibold uppercase text-gray-500">Project Title</th>
                        <th className="py-3 px-4 text-xs font-semibold uppercase text-gray-500">Hours</th>
                        <th className="py-3 px-4 text-xs font-semibold uppercase text-gray-500">Status</th>
                        <th className="py-3 px-4 text-xs font-semibold uppercase text-gray-500">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {project.team_members.map((member) => (
                        <tr key={member.member_id} className="border-b last:border-b-0 hover:bg-white">
                          <td className="py-3 px-4">
                            <p className="font-medium text-sm">{member.member_name}</p>
                            <p className="text-xs text-gray-500">{member.member_email}</p>
                          </td>
                          <td className="py-3 px-4 text-sm">{project.project_name}</td>
                          <td className="py-3 px-4 text-sm">{parseFloat(member.hours_worked || 0).toFixed(1)} hrs</td>
                          <td className="py-3 px-4 text-sm">
                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${member.eligible_for_payment ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                              {member.eligible_for_payment ? 'Ready to pay' : 'Not eligible'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => handleOpenPaymentModal(member, project)}
                              disabled={!member.eligible_for_payment}
                              className="btn-primary text-xs px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Pay now
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment History */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <History className="w-5 h-5" />
          Payment History
        </h3>

        {payments.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No payments made yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Member</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Project</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Hours Paid</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Amount</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Payment Mode</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Transaction ID</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(payment.payment_date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-sm">{payment.member_name}</p>
                        <p className="text-xs text-gray-500">{payment.member_email}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-sm font-medium">{payment.project_name}</p>
                        <p className="text-xs text-gray-500">{payment.project_code}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm">{payment.hours_paid} hrs</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm font-bold text-green-600">₹{payment.amount.toLocaleString()}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full capitalize">
                        {payment.payment_mode.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-600 font-mono">{payment.transaction_id || '-'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Wage Calculator & Payment Modal */}
      {showWageCalculator && selectedMember && selectedProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">Wage Calculator & Payment</h2>
              <p className="text-sm text-gray-500 mt-1">Calculate and process payment for team member</p>
            </div>

            <div className="max-h-[70vh] overflow-y-auto">
            <form onSubmit={handleProcessPayment} className="p-6 space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-semibold">{selectedMember.member_name}</p>
                    <p className="text-sm text-gray-500">{selectedMember.member_email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Project</p>
                    <p className="font-medium">{selectedProject.project_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Tasks Completed</p>
                    <p className="font-medium text-green-600">{selectedMember.tasks_completed} tasks ✓</p>
                  </div>
                </div>
              </div>

              {/* Wage Calculator Section */}
              <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <Calculator className="w-4 h-4" />
                  Wage Calculator
                </h4>
                
                <div className="space-y-3">
                  <div>
                    <label className="label text-sm">Hours Worked *</label>
                    <input
                      type="number"
                      step="0.5"
                      value={paymentForm.hours_paid}
                      onChange={(e) => setPaymentForm({...paymentForm, hours_paid: e.target.value})}
                      className="input text-sm"
                      placeholder="Enter hours worked"
                      required
                    />
                  </div>

                  <div>
                    <label className="label text-sm">Hourly Rate (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={paymentForm.hourly_rate}
                      onChange={(e) => setPaymentForm({...paymentForm, hourly_rate: e.target.value})}
                      className="input text-sm"
                      placeholder="Enter hourly rate"
                      required
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleCalculateWages}
                    className="w-full btn-secondary text-sm flex items-center justify-center gap-2"
                  >
                    <Calculator className="w-4 h-4" />
                    Calculate Wage Amount
                  </button>

                  <div className="flex items-center justify-between text-sm bg-white p-3 rounded">
                    <span className="text-gray-600">Calculated Amount:</span>
                    <span className="font-bold text-green-600 text-lg">₹{calculateWageAmount()}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="label">Final Payment Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                  className="input"
                  placeholder="Enter final payment amount"
                  required
                />
                {parseFloat(paymentForm.amount) > balanceInfo.balance && (
                  <p className="text-xs text-red-600 mt-1">⚠️ Insufficient balance! Current balance: ₹{balanceInfo.balance.toLocaleString()}</p>
                )}
              </div>

              <div>
                <label className="label">Payment Mode *</label>
                <select
                  value={paymentForm.payment_mode}
                  onChange={(e) => setPaymentForm({...paymentForm, payment_mode: e.target.value})}
                  className="input"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="label">Reference ID</label>
                <div className="p-3 bg-gray-50 rounded border border-gray-200 font-mono text-sm text-gray-700">
                  Generated automatically by the system after payment is processed
                </div>
              </div>

              <div>
                <label className="label">Notes (Optional)</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({...paymentForm, notes: e.target.value})}
                  className="input h-20"
                  placeholder="Any additional notes..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowWageCalculator(false)}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={parseFloat(paymentForm.amount) > balanceInfo.balance}
                  className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CreditCard className="w-4 h-4" />
                  Process Payment
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamAccounting;
