import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { accountingAPI, usersAPI } from '../services/api';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign, 
  MinusCircle, 
  Send,
  X,
  User,
  Calendar,
  FileText
} from 'lucide-react';
import toast from 'react-hot-toast';

const Accounting = () => {
  const [filter, setFilter] = useState('all');
  const [showSpendModal, setShowSpendModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: transactionsData, isLoading } = useQuery(
    ['transactions', filter],
    () => accountingAPI.getTransactions({ type: filter !== 'all' ? filter : undefined }),
    {
      select: (res) => res.data.data,
    }
  );

  const { data: summaryData } = useQuery(
    'financialSummary',
    () => accountingAPI.getSummary(),
    {
      select: (res) => res.data.data,
    }
  );

  const { data: teamLeadsData } = useQuery(
    'teamLeads',
    () => usersAPI.getAll({ role: 'team_leader' }),
    {
      select: (res) => res.data.data?.users || res.data.data || [],
    }
  );

  // Handle different response structures
  const transactions = transactionsData?.transactions || 
                       transactionsData?.items || 
                       (Array.isArray(transactionsData) ? transactionsData : []) ||
                       [];
  const summary = summaryData?.summary || summaryData || {};
  const teamLeads = teamLeadsData || [];

  // Spend Money Mutation
  const spendMutation = useMutation(
    (data) => accountingAPI.createTransaction({
      type: 'expense',
      amount: data.amount,
      description: data.description,
      category: data.category,
      date: new Date().toISOString().split('T')[0],
      payment_method: data.payment_method,
      reference_number: data.reference_number,
      notes: data.notes
    }),
    {
      onSuccess: () => {
        toast.success('Expense recorded successfully');
        queryClient.invalidateQueries(['transactions']);
        queryClient.invalidateQueries(['financialSummary']);
        setShowSpendModal(false);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to record expense');
      }
    }
  );

  // Transfer to Team Lead Mutation
  const transferMutation = useMutation(
    (data) => accountingAPI.createTransaction({
      type: 'expense',
      amount: data.amount,
      description: `Transfer to Team Lead: ${data.team_lead_name}`,
      category: 'transfer',
      date: new Date().toISOString().split('T')[0],
      payment_method: 'bank_transfer',
      reference_number: data.reference_number,
      notes: `Transferred to ${data.team_lead_name} for team wages`,
      team_lead_id: data.team_lead_id
    }),
    {
      onSuccess: () => {
        toast.success('Transfer to team lead recorded successfully');
        queryClient.invalidateQueries(['transactions']);
        queryClient.invalidateQueries(['financialSummary']);
        setShowTransferModal(false);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to record transfer');
      }
    }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounting</h1>
          <p className="text-gray-600">Financial transactions and payments</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowSpendModal(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <MinusCircle className="w-5 h-5" />
            Spend Money
          </button>
          <button 
            onClick={() => setShowTransferModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Send className="w-5 h-5" />
            Transfer to Team Lead
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Income</p>
              <p className="text-2xl font-bold text-green-600">
                ₹{(summary.total_income || 0).toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <ArrowUpRight className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Expenses</p>
              <p className="text-2xl font-bold text-red-600">
                ₹{(summary.total_expenses || 0).toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <ArrowDownRight className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Net Profit</p>
              <p className="text-2xl font-bold text-primary-600">
                ₹{(summary.net_profit || 0).toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-primary-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="input"
        >
          <option value="all">All Transactions</option>
          <option value="income">Client Payments</option>
          <option value="expense">Expenses & Transfers</option>
        </select>
      </div>

      {/* Transactions Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Description</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Category</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Type</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Reference</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">
                    {new Date(transaction.date).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-medium">{transaction.description}</p>
                    {transaction.notes && (
                      <p className="text-xs text-gray-500 italic">
                        {transaction.notes}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="capitalize">
                      {transaction.category?.replace('_', ' ') || 'general'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        transaction.type === 'income'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {transaction.type === 'income' ? 'Payment' : 'Expense'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm font-mono">
                      {transaction.reference_number || '-'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`font-medium ${
                        transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {transaction.type === 'income' ? '+' : '-'}
                      ₹{transaction.amount?.toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {transactions.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p className="mb-2">No transactions found</p>
            <p className="text-sm">Client payments and admin expenses will appear here</p>
          </div>
        )}
      </div>

      {/* Spend Money Modal */}
      {showSpendModal && (
        <SpendMoneyModal 
          onClose={() => setShowSpendModal(false)}
          onSubmit={spendMutation.mutate}
          isLoading={spendMutation.isLoading}
        />
      )}

      {/* Transfer to Team Lead Modal */}
      {showTransferModal && (
        <TransferToTeamLeadModal 
          onClose={() => setShowTransferModal(false)}
          onSubmit={transferMutation.mutate}
          teamLeads={teamLeads}
          isLoading={transferMutation.isLoading}
        />
      )}
    </div>
  );
};

// Spend Money Modal Component
const SpendMoneyModal = ({ onClose, onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    category: 'operational',
    payment_method: 'bank_transfer',
    reference_number: '',
    notes: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.description) {
      toast.error('Amount and description are required');
      return;
    }
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold">Record Expense</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Amount *</label>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({...formData, amount: e.target.value})}
              className="input"
              placeholder="Enter amount"
              required
            />
          </div>
          
          <div>
            <label className="label">Description *</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="input"
              placeholder="What was this expense for?"
              required
            />
          </div>
          
          <div>
            <label className="label">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              className="input"
            >
              <option value="operational">Operational</option>
              <option value="equipment">Equipment</option>
              <option value="software">Software</option>
              <option value="marketing">Marketing</option>
              <option value="salary">Salary</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div>
            <label className="label">Payment Method</label>
            <select
              value={formData.payment_method}
              onChange={(e) => setFormData({...formData, payment_method: e.target.value})}
              className="input"
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="credit_card">Credit Card</option>
              <option value="check">Check</option>
            </select>
          </div>
          
          <div>
            <label className="label">Reference Number</label>
            <input
              type="text"
              value={formData.reference_number}
              onChange={(e) => setFormData({...formData, reference_number: e.target.value})}
              className="input"
              placeholder="Invoice number, receipt number, etc."
            />
          </div>
          
          <div>
            <label className="label">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="input h-20 resize-none"
              placeholder="Additional details..."
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? 'Recording...' : 'Record Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Transfer to Team Lead Modal Component
const TransferToTeamLeadModal = ({ onClose, onSubmit, teamLeads, isLoading }) => {
  const [formData, setFormData] = useState({
    amount: '',
    team_lead_id: '',
    team_lead_name: '',
    reference_number: '',
    notes: ''
  });

  const handleTeamLeadChange = (e) => {
    const selected = teamLeads.find(tl => tl.id === e.target.value);
    setFormData({
      ...formData,
      team_lead_id: e.target.value,
      team_lead_name: selected ? `${selected.first_name} ${selected.last_name}` : ''
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.team_lead_id) {
      toast.error('Amount and team lead are required');
      return;
    }
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold">Transfer to Team Lead</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> This will record a transfer to the team lead for distributing wages to team members.
            </p>
          </div>
          
          <div>
            <label className="label">Amount *</label>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({...formData, amount: e.target.value})}
              className="input"
              placeholder="Enter amount to transfer"
              required
            />
          </div>
          
          <div>
            <label className="label">Select Team Lead *</label>
            <select
              value={formData.team_lead_id}
              onChange={handleTeamLeadChange}
              className="input"
              required
            >
              <option value="">Choose a team lead...</option>
              {teamLeads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.first_name} {lead.last_name} - {lead.department_name || 'No Department'}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="label">Reference Number</label>
            <input
              type="text"
              value={formData.reference_number}
              onChange={(e) => setFormData({...formData, reference_number: e.target.value})}
              className="input"
              placeholder="Transaction reference number"
            />
          </div>
          
          <div>
            <label className="label">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="input h-20 resize-none"
              placeholder="Purpose of transfer..."
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? 'Processing...' : 'Transfer Money'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Accounting;
