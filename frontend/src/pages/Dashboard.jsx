import { useQuery } from 'react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { dashboardAPI, projectsAPI, requirementsAPI, dailyReportsAPI, tasksAPI, paymentsAPI, servicesAPI, uploadAPI } from '../services/api';
import { 
  Users, 
  FolderKanban, 
  CheckSquare, 
  DollarSign,
  TrendingUp,
  Clock,
  CreditCard,
  Package,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  BarChart3,
  AlertCircle,
  User,
  FileText,
  MessageSquare,
  Download,
  Receipt,
  Building2,
  Globe,
  ArrowRight,
  Upload,
  X,
  Send,
  Smartphone,
  Building,
  Wallet,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';

const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
  <div className="card">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-600">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  </div>
);

// Client Dashboard Component with Progress Tracking
const ClientDashboard = ({ data, navigate }) => {
  const [requirement, setRequirement] = useState(null);
  const [reports, setReports] = useState([]);
  const [payments, setPayments] = useState([]);
  const [progressLoading, setProgressLoading] = useState(true);
  const [expandedReport, setExpandedReport] = useState(null);
  const [projectProgress, setProjectProgress] = useState(0); // Admin-controlled progress
  
  // New requirement submission state
  const [departments, setDepartments] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedDept, setSelectedDept] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [projectTitle, setProjectTitle] = useState('');
  const [newRequirements, setNewRequirements] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showNewRequirementForm, setShowNewRequirementForm] = useState(false);
  const [requestStep, setRequestStep] = useState(1); // 1: Dept, 2: Package, 3: Payment, 4: Requirements
  const [paymentMode, setPaymentMode] = useState('');
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [currentPayment, setCurrentPayment] = useState(null);

  // Payment form states
  const [paymentFormData, setPaymentFormData] = useState({
    cardNumber: '',
    cardHolderName: '',
    expiryDate: '',
    cvv: '',
    upiId: '',
    bankName: '',
    netBankingUsername: '',
    netBankingPassword: '',
    walletProvider: '',
    walletUsername: '',
    walletPassword: ''
  });
  const [paymentFormErrors, setPaymentFormErrors] = useState({});

  const paymentModes = [
    { id: 'credit_card', label: 'Credit Card', icon: CreditCard },
    { id: 'debit_card', label: 'Debit Card', icon: CreditCard },
    { id: 'upi', label: 'UPI', icon: Smartphone },
    { id: 'net_banking', label: 'Net Banking', icon: Building },
    { id: 'wallet', label: 'Digital Wallet', icon: Wallet },
  ];

  useEffect(() => {
    fetchProgressData();
    fetchPayments();
    fetchDepartments();
  }, []);

  const fetchProgressData = async () => {
    try {
      setProgressLoading(true);
      
      // Fetch client's requirement
      const reqResponse = await requirementsAPI.getMyRequirement();
      const reqData = reqResponse.data.data;
      
      if (reqData) {
        setRequirement(reqData);
        
        if (reqData.project_id) {
          // Fetch daily reports
          const reportsResponse = await dailyReportsAPI.getAll({
            project_id: reqData.project_id
          });
          setReports(reportsResponse.data.data || []);
          
          // Fetch admin-controlled progress
          const progressResponse = await dashboardAPI.getProjectProgress(reqData.project_id);
          setProjectProgress(progressResponse.data?.progress || 0);
        }
      }
    } catch (error) {
      toast.error('Failed to load progress data');
    } finally {
      setProgressLoading(false);
    }
  };

  const fetchPayments = async () => {
    try {
      const response = await paymentsAPI.getMyPayments();
      setPayments(response.data.data || []);
    } catch (error) {
      console.error('Failed to load payments:', error);
    }
  };

  const handleDownloadReceipt = async (paymentId, receiptId) => {
    try {
      const response = await paymentsAPI.downloadReceipt(paymentId);
      
      // Create a blob from the response
      const blob = new Blob([response.data], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary link and click it
      const link = document.createElement('a');
      link.href = url;
      link.download = `Receipt-${receiptId}.txt`;
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Receipt downloaded successfully');
    } catch (error) {
      toast.error('Failed to download receipt');
    }
  };

  const toggleReport = (reportId) => {
    setExpandedReport(expandedReport === reportId ? null : reportId);
  };

  const fetchDepartments = async () => {
    try {
      const response = await servicesAPI.getDepartments();
      setDepartments(response.data.data || []);
    } catch (error) {
      console.error('Failed to load departments:', error);
    }
  };

  const fetchServices = async (deptId) => {
    try {
      const response = await servicesAPI.getAll({ department_id: deptId });
      setServices(response.data.data || []);
    } catch (error) {
      toast.error('Failed to load services');
    }
  };

  const handleDeptSelect = (dept) => {
    setSelectedDept(dept);
    fetchServices(dept.id);
    setRequestStep(2);
  };

  const handlePackageSelect = (pkg) => {
    setSelectedPackage(pkg);
    setRequestStep(3);
    setPaymentFormData({
      cardNumber: '',
      cardHolderName: '',
      expiryDate: '',
      cvv: '',
      upiId: '',
      bankName: '',
      netBankingUsername: '',
      netBankingPassword: '',
      walletProvider: '',
      walletUsername: '',
      walletPassword: ''
    });
    setPaymentFormErrors({});
  };

  const validatePaymentForm = () => {
    const errors = {};

    if (paymentMode === 'credit_card' || paymentMode === 'debit_card') {
      if (!paymentFormData.cardNumber || !/^\d{13,19}$/.test(paymentFormData.cardNumber.replace(/\s/g, ''))) {
        errors.cardNumber = 'Valid card number required (13-19 digits)';
      }
      if (!paymentFormData.cardHolderName.trim()) {
        errors.cardHolderName = 'Cardholder name is required';
      }
      if (!paymentFormData.expiryDate || !/^\d{2}\/\d{2}$/.test(paymentFormData.expiryDate)) {
        errors.expiryDate = 'Expiry date required (MM/YY format)';
      }
      if (!paymentFormData.cvv || !/^\d{3,4}$/.test(paymentFormData.cvv)) {
        errors.cvv = 'Valid CVV required (3-4 digits)';
      }
    } else if (paymentMode === 'upi') {
      if (!paymentFormData.upiId || !/^[a-zA-Z0-9._-]+@[a-zA-Z]{3,}$/.test(paymentFormData.upiId)) {
        errors.upiId = 'Valid UPI ID required (e.g., username@bank)';
      }
    } else if (paymentMode === 'net_banking') {
      if (!paymentFormData.bankName) {
        errors.bankName = 'Please select a bank';
      }
      if (!paymentFormData.netBankingUsername) {
        errors.netBankingUsername = 'Username is required';
      }
      if (!paymentFormData.netBankingPassword) {
        errors.netBankingPassword = 'Password is required';
      }
    } else if (paymentMode === 'wallet') {
      if (!paymentFormData.walletProvider) {
        errors.walletProvider = 'Please select a wallet provider';
      }
      if (!paymentFormData.walletUsername) {
        errors.walletUsername = 'Username/Email is required';
      }
      if (!paymentFormData.walletPassword) {
        errors.walletPassword = 'Password is required';
      }
    }

    setPaymentFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePayment = async () => {
    if (!paymentMode) {
      toast.error('Please select a payment mode');
      return;
    }

    if (!validatePaymentForm()) {
      toast.error('Please fill in all required payment details correctly');
      return;
    }

    setSubmitLoading(true);
    try {
      const paymentData = {
        amount: selectedPackage.price,
        payment_mode: paymentMode,
        package_id: selectedPackage.id,
        package_name: selectedPackage.name,
        department_id: selectedDept.id,
        transaction_id: `TXN-${Date.now()}`,
        payment_details: {
          ...(paymentMode === 'credit_card' || paymentMode === 'debit_card') && {
            card_number: paymentFormData.cardNumber.replace(/\s/g, '').slice(-4),
            cardholder_name: paymentFormData.cardHolderName,
            payment_method: paymentMode
          },
          ...(paymentMode === 'upi') && {
            upi_id: paymentFormData.upiId,
            payment_method: 'upi'
          },
          ...(paymentMode === 'net_banking') && {
            bank_name: paymentFormData.bankName,
            payment_method: 'net_banking'
          },
          ...(paymentMode === 'wallet') && {
            wallet_provider: paymentFormData.walletProvider,
            payment_method: 'wallet'
          }
        }
      };

      const paymentResponse = await paymentsAPI.create(paymentData);

      if (paymentResponse.data.success) {
        toast.success(`Payment successful! Receipt ID: ${paymentResponse.data.data.receipt_id}`);
        setCurrentPayment(paymentResponse.data.data);
        setPaymentCompleted(true);
        setRequestStep(4);
        // Refresh dashboard data to show updated total spent
        const dashboardResponse = await dashboardAPI.getClient();
        if (dashboardResponse.data.success) {
          // Update the data prop with new total spent
          data.total_spent = dashboardResponse.data.data.total_spent;
        }
      } else {
        toast.error('Payment failed. Please try again.');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Payment processing failed');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setSubmitLoading(true);
    try {
      const uploadedFileUrls = [];
      for (const file of files) {
        const response = await uploadAPI.uploadFile(file);
        uploadedFileUrls.push({
          name: file.name,
          url: response.data.url,
          type: file.type,
          size: file.size,
          description: '' // Will be filled by user
        });
      }
      setUploadedFiles([...uploadedFiles, ...uploadedFileUrls]);
      toast.success('Files uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload files');
    } finally {
      setSubmitLoading(false);
    }
  };

  const removeFile = (index) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const updateFileDescription = (index, description) => {
    const updatedFiles = [...uploadedFiles];
    updatedFiles[index].description = description;
    setUploadedFiles(updatedFiles);
  };

  const handleSubmitNewRequirement = async () => {
    if (!selectedPackage) {
      toast.error('Please select a package');
      return;
    }
    if (!newRequirements.trim()) {
      toast.error('Please enter your requirements');
      return;
    }

    setSubmitLoading(true);
    try {
      await requirementsAPI.submit({
        package_id: selectedPackage.id,
        package_name: selectedPackage.name,
        department_id: selectedDept.id,
        amount_paid: selectedPackage.price,
        project_title: projectTitle.trim() || null, // Optional project title
        requirements: newRequirements,
        priority: 'medium',
        attachments: uploadedFiles,
        payment_id: currentPayment?.payment_id
      });
      toast.success('Requirements submitted successfully! Admin will review your request.');
      // Reset form
      setShowNewRequirementForm(false);
      setSelectedDept(null);
      setSelectedPackage(null);
      setProjectTitle('');
      setNewRequirements('');
      setUploadedFiles([]);
      setRequestStep(1);
      setPaymentMode('');
      setPaymentCompleted(false);
      setCurrentPayment(null);
      setPaymentFormData({
        cardNumber: '',
        cardHolderName: '',
        expiryDate: '',
        cvv: '',
        upiId: '',
        bankName: '',
        netBankingUsername: '',
        netBankingPassword: '',
        walletProvider: '',
        walletUsername: '',
        walletPassword: ''
      });
      setPaymentFormErrors({});
      // Refresh data
      fetchProgressData();
      fetchPayments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit requirements');
    } finally {
      setSubmitLoading(false);
    }
  };

  const resetRequestForm = () => {
    setShowNewRequirementForm(false);
    setSelectedDept(null);
    setSelectedPackage(null);
    setNewRequirements('');
    setUploadedFiles([]);
    setRequestStep(1);
    setPaymentMode('');
    setPaymentCompleted(false);
    setCurrentPayment(null);
    setPaymentFormData({
      cardNumber: '',
      cardHolderName: '',
      expiryDate: '',
      cvv: '',
      upiId: '',
      bankName: '',
      netBankingUsername: '',
      netBankingPassword: '',
      walletProvider: '',
      walletUsername: '',
      walletPassword: ''
    });
    setPaymentFormErrors({});
  };

  const getDeptIcon = (icon) => {
    switch (icon) {
      case 'globe': return <Globe className="w-8 h-8" />;
      case 'trending': return <TrendingUp className="w-8 h-8" />;
      case 'people': return <Users className="w-8 h-8" />;
      default: return <Building2 className="w-8 h-8" />;
    }
  };

  const calculateProgress = () => {
    // Progress is admin-controlled, not calculated from tasks
    return projectProgress || 0;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Dashboard</h1>
        <p className="text-gray-600">Overview of your projects and services</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Projects"
          value={data?.projects?.total || 0}
          icon={FolderKanban}
          color="bg-blue-500"
        />
        <StatCard
          title="Active Projects"
          value={data?.projects?.active || 0}
          icon={TrendingUp}
          color="bg-green-500"
        />
        <StatCard
          title="Total Tasks"
          value={data?.tasks?.total || 0}
          icon={CheckSquare}
          color="bg-yellow-500"
        />
        <StatCard
          title="Total Spent"
          value={`₹${(data?.total_spent || 0).toLocaleString()}`}
          icon={DollarSign}
          color="bg-purple-500"
        />
      </div>

      {/* New Service Request Section */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">Request New Service</h2>
            <p className="text-gray-600">Browse departments, make payment, and submit your requirements</p>
          </div>
          <button
            onClick={() => showNewRequirementForm ? resetRequestForm() : setShowNewRequirementForm(true)}
            className="btn-primary"
          >
            {showNewRequirementForm ? 'Cancel' : 'New Request'}
          </button>
        </div>

        {showNewRequirementForm && (
          <div className="space-y-6">
            {/* Progress Steps */}
            <div className="flex items-center justify-center mb-8">
              <div className="flex items-center space-x-2">
                {[
                  { step: 1, label: 'Department' },
                  { step: 2, label: 'Package' },
                  { step: 3, label: 'Payment' },
                  { step: 4, label: 'Requirements' }
                ].map((item, idx) => (
                  <div key={item.step} className="flex items-center">
                    <div className={`flex flex-col items-center ${requestStep >= item.step ? 'text-primary-600' : 'text-gray-400'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                        requestStep > item.step ? 'bg-green-500 text-white' :
                        requestStep === item.step ? 'bg-primary-600 text-white' : 'bg-gray-200'
                      }`}>
                        {requestStep > item.step ? <Check className="w-4 h-4" /> : item.step}
                      </div>
                      <span className="text-xs mt-1">{item.label}</span>
                    </div>
                    {idx < 3 && (
                      <div className={`w-12 h-1 mx-2 ${requestStep > item.step ? 'bg-green-500' : 'bg-gray-200'}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Step 1: Select Department */}
            {requestStep === 1 && (
              <div>
                <h3 className="text-lg font-medium mb-4">Select a Department</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  {departments.map((dept) => (
                    <button
                      key={dept.id}
                      onClick={() => handleDeptSelect(dept)}
                      className="card hover:shadow-lg transition-all text-left group border-2 border-transparent hover:border-primary-200"
                    >
                      <div 
                        className="w-12 h-12 rounded-lg flex items-center justify-center mb-3 text-white"
                        style={{ backgroundColor: dept.color }}
                      >
                        {getDeptIcon(dept.icon)}
                      </div>
                      <h4 className="font-semibold mb-1 group-hover:text-primary-600">
                        {dept.name}
                      </h4>
                      <p className="text-sm text-gray-600 line-clamp-2">{dept.description}</p>
                      <div className="flex items-center text-primary-600 text-sm mt-2">
                        <span>{dept.service_count} Packages</span>
                        <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Select Package */}
            {requestStep === 2 && (
              <div>
                <div className="flex items-center mb-4">
                  <button
                    onClick={() => setRequestStep(1)}
                    className="text-gray-600 hover:text-gray-900 mr-4"
                  >
                    ← Back
                  </button>
                  <h3 className="text-lg font-medium">{selectedDept.name} Packages</h3>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {services.map((pkg) => (
                    <div
                      key={pkg.id}
                      className="card border-2 border-transparent hover:border-primary-200 transition-all"
                    >
                      <h4 className="font-semibold mb-2">{pkg.name}</h4>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{pkg.description}</p>
                      <div className="mb-3">
                        <span className="text-2xl font-bold text-primary-600">₹{pkg.price.toLocaleString()}</span>
                        <span className="text-gray-500 text-sm"> / {pkg.duration_days} days</span>
                      </div>
                      <ul className="space-y-1 mb-4">
                        {pkg.features.slice(0, 3).map((feature, idx) => (
                          <li key={idx} className="text-sm text-gray-600 flex items-center">
                            <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                            <span className="truncate">{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => handlePackageSelect(pkg)}
                        className="btn-primary w-full text-sm"
                      >
                        Select & Continue
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Payment */}
            {requestStep === 3 && (
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center mb-6">
                  <button
                    onClick={() => setRequestStep(2)}
                    className="text-gray-600 hover:text-gray-900 mr-4"
                  >
                    ← Back
                  </button>
                  <h3 className="text-lg font-medium">Complete Payment</h3>
                </div>

                <div className="card mb-6">
                  <h4 className="font-semibold mb-4">Order Summary</h4>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Package</span>
                    <span className="font-medium">{selectedPackage.name}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Duration</span>
                    <span className="font-medium">{selectedPackage.duration_days} days</span>
                  </div>
                  <div className="flex justify-between py-4 text-xl font-bold">
                    <span>Total Amount</span>
                    <span className="text-primary-600">₹{selectedPackage.price.toLocaleString()}</span>
                  </div>
                </div>

                <div className="card">
                  <h4 className="font-semibold mb-4 flex items-center">
                    <CreditCard className="w-5 h-5 mr-2" />
                    Select Payment Mode
                  </h4>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    {paymentModes.map((mode) => {
                      const Icon = mode.icon;
                      return (
                        <button
                          key={mode.id}
                          onClick={() => {
                            setPaymentMode(mode.id);
                            setPaymentFormErrors({});
                          }}
                          className={`p-4 rounded-lg border-2 text-center transition-all ${
                            paymentMode === mode.id
                              ? 'border-primary-600 bg-primary-50 text-primary-700'
                              : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                          }`}
                        >
                          <Icon className={`w-8 h-8 mx-auto mb-2 ${
                            paymentMode === mode.id ? 'text-primary-600' : 'text-gray-500'
                          }`} />
                          <span className="text-sm font-medium">{mode.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Credit/Debit Card Form */}
                  {(paymentMode === 'credit_card' || paymentMode === 'debit_card') && (
                    <div className="space-y-4 mb-6 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <label className="label">Cardholder Name *</label>
                        <input
                          type="text"
                          placeholder="John Doe"
                          className={`input ${paymentFormErrors.cardHolderName ? 'border-red-500' : ''}`}
                          value={paymentFormData.cardHolderName}
                          onChange={(e) => setPaymentFormData({ ...paymentFormData, cardHolderName: e.target.value })}
                        />
                        {paymentFormErrors.cardHolderName && (
                          <p className="text-sm text-red-500 mt-1">{paymentFormErrors.cardHolderName}</p>
                        )}
                      </div>
                      <div>
                        <label className="label">Card Number *</label>
                        <input
                          type="text"
                          placeholder="1234 5678 9012 3456"
                          maxLength="19"
                          className={`input ${paymentFormErrors.cardNumber ? 'border-red-500' : ''}`}
                          value={paymentFormData.cardNumber}
                          onChange={(e) => {
                            let value = e.target.value.replace(/\s/g, '');
                            value = value.replace(/(\d{4})/g, '$1 ').trim();
                            setPaymentFormData({ ...paymentFormData, cardNumber: value });
                          }}
                        />
                        {paymentFormErrors.cardNumber && (
                          <p className="text-sm text-red-500 mt-1">{paymentFormErrors.cardNumber}</p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="label">Expiry Date (MM/YY) *</label>
                          <input
                            type="text"
                            placeholder="12/25"
                            maxLength="5"
                            className={`input ${paymentFormErrors.expiryDate ? 'border-red-500' : ''}`}
                            value={paymentFormData.expiryDate}
                            onChange={(e) => {
                              let value = e.target.value.replace(/\D/g, '');
                              if (value.length >= 2) {
                                value = value.slice(0, 2) + '/' + value.slice(2, 4);
                              }
                              setPaymentFormData({ ...paymentFormData, expiryDate: value });
                            }}
                          />
                          {paymentFormErrors.expiryDate && (
                            <p className="text-sm text-red-500 mt-1">{paymentFormErrors.expiryDate}</p>
                          )}
                        </div>
                        <div>
                          <label className="label">CVV *</label>
                          <input
                            type="text"
                            placeholder="123"
                            maxLength="4"
                            className={`input ${paymentFormErrors.cvv ? 'border-red-500' : ''}`}
                            value={paymentFormData.cvv}
                            onChange={(e) => setPaymentFormData({ ...paymentFormData, cvv: e.target.value.replace(/\D/g, '') })}
                          />
                          {paymentFormErrors.cvv && (
                            <p className="text-sm text-red-500 mt-1">{paymentFormErrors.cvv}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* UPI Form */}
                  {paymentMode === 'upi' && (
                    <div className="space-y-4 mb-6 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <label className="label">UPI ID *</label>
                        <input
                          type="text"
                          placeholder="username@bankname"
                          className={`input ${paymentFormErrors.upiId ? 'border-red-500' : ''}`}
                          value={paymentFormData.upiId}
                          onChange={(e) => setPaymentFormData({ ...paymentFormData, upiId: e.target.value })}
                        />
                        {paymentFormErrors.upiId && (
                          <p className="text-sm text-red-500 mt-1">{paymentFormErrors.upiId}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">You will be prompted to authorize this payment in your UPI app</p>
                      </div>
                    </div>
                  )}

                  {/* Net Banking Form */}
                  {paymentMode === 'net_banking' && (
                    <div className="space-y-4 mb-6 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <label className="label">Bank Name *</label>
                        <select
                          className={`input ${paymentFormErrors.bankName ? 'border-red-500' : ''}`}
                          value={paymentFormData.bankName}
                          onChange={(e) => setPaymentFormData({ ...paymentFormData, bankName: e.target.value })}
                        >
                          <option value="">Select a bank</option>
                          <option value="HDFC">HDFC Bank</option>
                          <option value="ICICI">ICICI Bank</option>
                          <option value="SBI">State Bank of India</option>
                          <option value="AXIS">Axis Bank</option>
                          <option value="KOTAK">Kotak Mahindra Bank</option>
                          <option value="YESBANK">Yes Bank</option>
                        </select>
                        {paymentFormErrors.bankName && (
                          <p className="text-sm text-red-500 mt-1">{paymentFormErrors.bankName}</p>
                        )}
                      </div>
                      <div>
                        <label className="label">Username *</label>
                        <input
                          type="text"
                          placeholder="Your net banking username"
                          className={`input ${paymentFormErrors.netBankingUsername ? 'border-red-500' : ''}`}
                          value={paymentFormData.netBankingUsername}
                          onChange={(e) => setPaymentFormData({ ...paymentFormData, netBankingUsername: e.target.value })}
                        />
                        {paymentFormErrors.netBankingUsername && (
                          <p className="text-sm text-red-500 mt-1">{paymentFormErrors.netBankingUsername}</p>
                        )}
                      </div>
                      <div>
                        <label className="label">Password *</label>
                        <input
                          type="password"
                          placeholder="Your net banking password"
                          className={`input ${paymentFormErrors.netBankingPassword ? 'border-red-500' : ''}`}
                          value={paymentFormData.netBankingPassword}
                          onChange={(e) => setPaymentFormData({ ...paymentFormData, netBankingPassword: e.target.value })}
                        />
                        {paymentFormErrors.netBankingPassword && (
                          <p className="text-sm text-red-500 mt-1">{paymentFormErrors.netBankingPassword}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Digital Wallet Form */}
                  {paymentMode === 'wallet' && (
                    <div className="space-y-4 mb-6 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <label className="label">Wallet Provider *</label>
                        <select
                          className={`input ${paymentFormErrors.walletProvider ? 'border-red-500' : ''}`}
                          value={paymentFormData.walletProvider}
                          onChange={(e) => setPaymentFormData({ ...paymentFormData, walletProvider: e.target.value })}
                        >
                          <option value="">Select a wallet</option>
                          <option value="Google Pay">Google Pay</option>
                          <option value="Apple Pay">Apple Pay</option>
                          <option value="Paytm">Paytm</option>
                          <option value="PhonePe">PhonePe</option>
                          <option value="Amazon Pay">Amazon Pay</option>
                        </select>
                        {paymentFormErrors.walletProvider && (
                          <p className="text-sm text-red-500 mt-1">{paymentFormErrors.walletProvider}</p>
                        )}
                      </div>
                      <div>
                        <label className="label">Username/Email *</label>
                        <input
                          type="text"
                          placeholder="Your wallet username or email"
                          className={`input ${paymentFormErrors.walletUsername ? 'border-red-500' : ''}`}
                          value={paymentFormData.walletUsername}
                          onChange={(e) => setPaymentFormData({ ...paymentFormData, walletUsername: e.target.value })}
                        />
                        {paymentFormErrors.walletUsername && (
                          <p className="text-sm text-red-500 mt-1">{paymentFormErrors.walletUsername}</p>
                        )}
                      </div>
                      <div>
                        <label className="label">Password *</label>
                        <input
                          type="password"
                          placeholder="Your wallet password"
                          className={`input ${paymentFormErrors.walletPassword ? 'border-red-500' : ''}`}
                          value={paymentFormData.walletPassword}
                          onChange={(e) => setPaymentFormData({ ...paymentFormData, walletPassword: e.target.value })}
                        />
                        {paymentFormErrors.walletPassword && (
                          <p className="text-sm text-red-500 mt-1">{paymentFormErrors.walletPassword}</p>
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handlePayment}
                    disabled={submitLoading || !paymentMode}
                    className="btn-primary w-full"
                  >
                    {submitLoading ? 'Processing...' : `Pay ₹${selectedPackage.price.toLocaleString()}`}
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Submit Requirements */}
            {requestStep === 4 && paymentCompleted && (
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center mb-4">
                  <button
                    onClick={() => setRequestStep(3)}
                    className="text-gray-600 hover:text-gray-900 mr-4"
                  >
                    ← Back
                  </button>
                  <h3 className="text-lg font-medium">Submit Requirements</h3>
                </div>

                <div className="bg-green-50 border border-green-200 p-4 rounded-lg mb-6">
                  <div className="flex items-center text-green-800">
                    <CheckCircle className="w-5 h-5 mr-2" />
                    <span className="font-medium">Payment completed successfully!</span>
                  </div>
                  <p className="text-sm text-green-700 mt-1">
                    Receipt ID: {currentPayment?.receipt_id}
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg mb-6">
                  <p className="text-sm text-gray-600">Selected Package</p>
                  <p className="font-semibold">{selectedPackage.name}</p>
                  <p className="text-primary-600 font-bold">₹{selectedPackage.price.toLocaleString()}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="label flex items-center">
                      <Package className="w-4 h-4 mr-2" />
                      Project Title (Optional)
                    </label>
                    <input
                      type="text"
                      value={projectTitle}
                      onChange={(e) => setProjectTitle(e.target.value)}
                      placeholder="Give your project a name (e.g., E-commerce Website, Mobile App Redesign)"
                      className="input"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This name will be visible to team members working on your project
                    </p>
                  </div>

                  <div>
                    <label className="label flex items-center">
                      <FileText className="w-4 h-4 mr-2" />
                      Project Requirements *
                    </label>
                    <textarea
                      value={newRequirements}
                      onChange={(e) => setNewRequirements(e.target.value)}
                      placeholder="Describe your project requirements in detail...&#10;&#10;Example:&#10;- Website type: E-commerce&#10;- Number of products: 500+&#10;- Payment methods: Credit Card, UPI&#10;- Special features: Wishlist, Reviews"
                      className="input h-40 resize-none"
                    />
                  </div>

                  {/* File Upload with Descriptions */}
                  <div>
                    <label className="label flex items-center">
                      <Upload className="w-4 h-4 mr-2" />
                      Attachments (Optional)
                    </label>
                    <p className="text-sm text-gray-500 mb-3">
                      Upload any reference files, documents, or images. Add a description for each file to help us understand its purpose.
                    </p>
                    <div className="flex items-center gap-4 mb-4">
                      <label className="btn-secondary cursor-pointer">
                        <Upload className="w-4 h-4 mr-2 inline" />
                        Upload Files
                        <input
                          type="file"
                          multiple
                          onChange={handleFileUpload}
                          className="hidden"
                          accept="*/*"
                        />
                      </label>
                      <span className="text-sm text-gray-500">
                        Any file type allowed
                      </span>
                    </div>

                    {/* Uploaded Files List with Descriptions */}
                    {uploadedFiles.length > 0 && (
                      <div className="space-y-3">
                        {uploadedFiles.map((file, index) => (
                          <div key={index} className="p-3 bg-gray-50 rounded-lg border">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center">
                                <FileText className="w-4 h-4 text-gray-500 mr-2" />
                                <span className="text-sm font-medium truncate max-w-xs">{file.name}</span>
                                <span className="text-xs text-gray-400 ml-2">({(file.size / 1024).toFixed(1)} KB)</span>
                              </div>
                              <button
                                onClick={() => removeFile(index)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            <input
                              type="text"
                              placeholder="What is this file about? (e.g., Logo design, Reference website screenshot, Content document)"
                              value={file.description}
                              onChange={(e) => updateFileDescription(index, e.target.value)}
                              className="input text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleSubmitNewRequirement}
                    disabled={submitLoading || !newRequirements.trim()}
                    className="btn-primary w-full flex items-center justify-center"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {submitLoading ? 'Submitting...' : 'Submit Requirements to Admin'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Project Progress Section - From My Progress */}
      {requirement && (
        <div className="card">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold">{requirement.project_title || requirement.package_name}</h2>
              {requirement.project_title && (
                <p className="text-sm text-gray-500 mt-1">Package: {requirement.package_name}</p>
              )}
              <p className="text-gray-600 mt-1">
                Submitted on {new Date(requirement.created_at).toLocaleDateString()}
              </p>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(requirement.status)}`}>
              {requirement.status?.replace('_', ' ')}
            </span>
          </div>

          {/* Show pending message if no project assigned yet */}
          {!requirement.project_id ? (
            <div className="p-6 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-yellow-800">Waiting for Assignment</h3>
                  <p className="text-yellow-700 mt-1">
                    Your requirement has been submitted and is pending review. 
                    An admin will assign a project manager to your project soon.
                  </p>
                  <div className="mt-3 p-3 bg-white rounded border border-yellow-200">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Requirements:</span>
                    </p>
                    <p className="text-sm text-gray-700 mt-1 line-clamp-3">
                      {requirement.requirements}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium">Overall Progress</span>
                  <span className="text-primary-600 font-semibold">{calculateProgress()}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-primary-600 h-3 rounded-full transition-all"
                    style={{ width: `${calculateProgress()}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Progress updated by project administrator</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Admin Updates Section */}
      {reports.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Project Updates
          </h3>
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>Total Updates:</strong> {reports.length} • Updated by project administrator
            </p>
          </div>
          <div className="space-y-4">
            {reports.map((report) => (
              <div key={report.id} className="border rounded-lg overflow-hidden">
                <div 
                  className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleReport(report.id)}
                >
                  <div className="flex items-center gap-3">
                    {expandedReport === report.id ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                    <div>
                      <p className="font-medium">
                        {new Date(report.report_date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                      <p className="text-sm text-gray-500">Admin update</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Progress</p>
                      <p className="font-semibold text-primary-600">{report.overall_progress}%</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      report.status === 'reviewed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {report.status}
                    </span>
                  </div>
                </div>

                {expandedReport === report.id && (
                  <div className="p-4 border-t">
                    {report.issues_blockers && (
                      <div className="mb-4 p-4 bg-red-50 rounded-lg">
                        <h4 className="font-medium text-red-700 mb-2 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-2" />
                          Important Notice
                        </h4>
                        <p className="text-sm text-red-600">{report.issues_blockers}</p>
                      </div>
                    )}

                    {report.notes && (
                      <div className="p-4 bg-gray-100 rounded-lg">
                        <h4 className="font-medium mb-2">Update Summary</h4>
                        <p className="text-sm text-gray-700">{report.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment History & Service History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment History */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center">
              <CreditCard className="w-5 h-5 mr-2 text-primary-600" />
              Payment History
            </h3>
            <span className="text-sm text-gray-500">Recent transactions</span>
          </div>
          <div className="space-y-3">
            {payments.length > 0 ? (
              payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mr-3">
                      <Receipt className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {payment.package_name || 'Payment'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {payment.created_at ? new Date(payment.created_at).toLocaleDateString() : 'N/A'}
                      </p>
                      <p className="text-xs text-gray-400">
                        Receipt: {payment.receipt_id}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary-600">
                      ₹{(payment.amount || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">
                      {payment.payment_mode?.replace('_', ' ')}
                    </p>
                    <button
                      onClick={() => handleDownloadReceipt(payment.id, payment.receipt_id)}
                      className="text-xs text-primary-600 hover:text-primary-800 flex items-center mt-1 ml-auto"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Receipt
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No payment history yet</p>
                <p className="text-sm">Your payments will appear here</p>
              </div>
            )}
          </div>
        </div>

        {/* Service History */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center">
              <Package className="w-5 h-5 mr-2 text-primary-600" />
              Service History
            </h3>
            <span className="text-sm text-gray-500">Purchased services</span>
          </div>
          <div className="space-y-3">
            {data?.service_history?.length > 0 ? (
              data.service_history.map((service, idx) => (
                <div
                  key={service.id || idx}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                      <Package className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{service.package_name || 'Service'}</p>
                      <p className="text-xs text-gray-500">
                        {service.department_name} • ₹{(service.amount_paid || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      service.status === 'assigned' 
                        ? 'bg-blue-100 text-blue-800'
                        : service.status === 'in_progress'
                        ? 'bg-yellow-100 text-yellow-800'
                        : service.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {service.status || 'Pending'}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      {service.created_at ? new Date(service.created_at).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No services purchased yet</p>
                <p className="text-sm">Browse departments to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contact Section */}
      {requirement && (
        <div className="card bg-primary-50 border-primary-200">
          <h3 className="text-lg font-semibold mb-2 flex items-center">
            <MessageSquare className="w-5 h-5 mr-2" />
            Need to Discuss Something?
          </h3>
          <p className="text-gray-600 mb-4">
            Have questions about your project? Use the chat feature to communicate with your project manager.
          </p>
          <button 
            onClick={() => navigate('/chat')}
            className="btn-primary"
          >
            Open Chat
          </button>
        </div>
      )}
    </div>
  );
};

// Team Leader Dashboard Component
const TeamLeaderDashboard = ({ data }) => {
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);

  const teamMembers = data?.team_members || [];
  const recentTasks = data?.recent_tasks || [];
  const recentProjects = data?.recent_projects || [];

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Team Leader Dashboard</h1>
        <p className="text-gray-600">{data?.department?.name}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Team Members"
          value={data?.team_size || 0}
          icon={Users}
          color="bg-blue-500"
        />
        <StatCard
          title="Active Projects"
          value={data?.projects?.active || 0}
          icon={FolderKanban}
          color="bg-green-500"
        />
        <StatCard
          title="Pending Tasks"
          value={data?.tasks?.pending || 0}
          icon={CheckSquare}
          color="bg-yellow-500"
        />
        <StatCard
          title="Completed Tasks"
          value={data?.tasks?.completed || 0}
          icon={TrendingUp}
          color="bg-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Members Section */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Members
          </h3>
          {teamMembers.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No team members found</p>
          ) : (
            <div className="space-y-3">
              {teamMembers.map((member) => (
                <div 
                  key={member.id}
                  onClick={() => setSelectedMember(selectedMember?.id === member.id ? null : member)}
                  className="p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="font-medium">{member.first_name} {member.last_name}</p>
                        <p className="text-sm text-gray-500">{member.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{member.task_stats?.total || 0} tasks</p>
                      <p className="text-xs text-gray-500">
                        {member.task_stats?.completed || 0} completed
                      </p>
                    </div>
                  </div>
                  
                  {/* Expanded Member Details */}
                  {selectedMember?.id === member.id && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="p-2 bg-yellow-50 rounded">
                          <p className="text-lg font-bold text-yellow-600">{member.task_stats?.pending || 0}</p>
                          <p className="text-xs text-gray-600">Pending</p>
                        </div>
                        <div className="p-2 bg-blue-50 rounded">
                          <p className="text-lg font-bold text-blue-600">{member.task_stats?.in_progress || 0}</p>
                          <p className="text-xs text-gray-600">In Progress</p>
                        </div>
                        <div className="p-2 bg-green-50 rounded">
                          <p className="text-lg font-bold text-green-600">{member.task_stats?.completed || 0}</p>
                          <p className="text-xs text-gray-600">Completed</p>
                        </div>
                      </div>
                      <div className="mt-3 text-sm text-gray-600">
                        <p><span className="font-medium">Member ID:</span> {member.id}</p>
                        <p><span className="font-medium">Joined:</span> {new Date(member.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Tasks Section */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckSquare className="w-5 h-5" />
            Recent Tasks
          </h3>
          {recentTasks.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No tasks found</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {recentTasks.map((task) => (
                <div 
                  key={task.id}
                  onClick={() => {
                    setSelectedTask(task);
                    setShowTaskModal(true);
                  }}
                  className="p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium truncate flex-1">{task.title}</p>
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(task.status)}`}>
                      {task.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    <p>Assigned to: {task.assigned_to_user?.first_name} {task.assigned_to_user?.last_name}</p>
                    <p>Project: {task.project?.name || 'N/A'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Task Detail Modal */}
      {showTaskModal && selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold">Task Details</h2>
              <button 
                onClick={() => setShowTaskModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Task Title & Status */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{selectedTask.title}</h3>
                <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(selectedTask.status)}`}>
                  {selectedTask.status}
                </span>
              </div>

              {/* Task Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Project</p>
                  <p className="font-medium">{selectedTask.project?.name || 'N/A'}</p>
                  <p className="text-xs text-gray-400">ID: {selectedTask.project_id}</p>
                </div>
                
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Assigned To</p>
                  <p className="font-medium">
                    {selectedTask.assigned_to_user?.first_name} {selectedTask.assigned_to_user?.last_name}
                  </p>
                  <p className="text-xs text-gray-400">{selectedTask.assigned_to_user?.email}</p>
                </div>
                
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Assigned Date</p>
                  <p className="font-medium">{new Date(selectedTask.created_at).toLocaleDateString()}</p>
                  <p className="text-xs text-gray-400">{new Date(selectedTask.created_at).toLocaleTimeString()}</p>
                </div>
                
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Deadline</p>
                  <p className="font-medium">
                    {selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString() : 'No deadline'}
                  </p>
                </div>
                
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Estimated Hours</p>
                  <p className="font-medium">{selectedTask.estimated_hours || 'Not set'} hrs</p>
                </div>
                
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Priority</p>
                  <p className="font-medium capitalize">{selectedTask.priority || 'Medium'}</p>
                </div>
              </div>

              {/* Description */}
              {selectedTask.description && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Description</p>
                  <p className="text-sm">{selectedTask.description}</p>
                </div>
              )}

              {/* Shared Files */}
              {selectedTask.shared_files && selectedTask.shared_files.length > 0 && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-2">Shared Files</p>
                  <div className="space-y-2">
                    {selectedTask.shared_files.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span className="flex-1 truncate">{file.name || file.filename}</span>
                        {file.description && (
                          <span className="text-xs text-gray-500">{file.description}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Task ID */}
              <div className="pt-4 border-t">
                <p className="text-xs text-gray-400">Task ID: {selectedTask.id}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Dashboard = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [showProjectDetail, setShowProjectDetail] = useState(false);
  const [latestReportProgress, setLatestReportProgress] = useState(null);

  const loadProjectDetails = async (projectId) => {
    setProjectLoading(true);
    setLatestReportProgress(null);
    setShowProjectDetail(true);
    try {
      const response = await projectsAPI.getById(projectId);
      const project = response.data?.data;
      setSelectedProject(project);

      const reportsResponse = await dailyReportsAPI.getAll({ project_id: projectId });
      const projectReports = reportsResponse.data?.data || [];
      setLatestReportProgress(projectReports?.[0]?.overall_progress ?? null);
    } catch (error) {
      toast.error('Failed to load project details.');
      setShowProjectDetail(false);
    } finally {
      setProjectLoading(false);
    }
  };

  // Note: Removed the redirect to onboarding
  // Clients should be able to see their dashboard even with pending requirements
  // The dashboard will show their service history and pending status

  const { data: dashboardData, isLoading } = useQuery(
    ['dashboard', user?.role],
    () => {
      switch (user?.role) {
        case 'admin':
          return dashboardAPI.getAdmin();
        case 'team_leader':
          return dashboardAPI.getTeamLeader();
        case 'team_member':
          return dashboardAPI.getTeamMember();
        case 'client':
          return dashboardAPI.getClient();
        default:
          return Promise.resolve({ data: { data: {} } });
      }
    },
    {
      enabled: !!user?.role,
    }
  );

  const data = dashboardData?.data?.data || {};

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Admin Dashboard
  if (user?.role === 'admin') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600">Overview of your organization</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Users"
            value={data?.stats?.users || 0}
            icon={Users}
            color="bg-blue-500"
          />
          <StatCard
            title="Active Projects"
            value={data?.stats?.projects?.active || 0}
            icon={FolderKanban}
            color="bg-green-500"
            subtitle={`of ${data?.stats?.projects?.total || 0} total`}
          />
          <StatCard
            title="Pending Tasks"
            value={data?.stats?.tasks?.pending || 0}
            icon={CheckSquare}
            color="bg-yellow-500"
            subtitle={`${data?.stats?.tasks?.completed || 0} completed`}
          />
          <StatCard
            title="Net Profit"
            value={`₹${(data?.stats?.finance?.profit || 0).toLocaleString()}`}
            icon={DollarSign}
            color="bg-purple-500"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* All Projects */}
          <div className="card min-h-[220px]">
            <h3 className="text-lg font-semibold mb-4">All Projects</h3>
            {data?.recent_projects?.length > 0 ? (
              <div className="space-y-3">
                {data.recent_projects.map((project) => (
                  <button
                    type="button"
                    key={project.id}
                    onClick={() => loadProjectDetails(project.id)}
                    className="w-full text-left flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <p className="font-medium">{project.name || project.project_name || project.title || 'Untitled Project'}</p>
                      {project.package_name || project.code ? (
                        <p className="text-sm text-gray-500">
                          {project.package_name ? `Package: ${project.package_name}` : project.code}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        project.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {project.status || 'Unknown'}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-gray-500">
                <p className="font-medium">No projects found</p>
                <p className="text-sm mt-2">All projects will appear here.</p>
              </div>
            )}
          </div>

          {showProjectDetail && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="bg-white rounded-3xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between p-6 border-b">
                  <div>
                    <p className="text-sm text-gray-500">Project Details</p>
                    <h2 className="text-2xl font-semibold text-gray-900">
                      {selectedProject?.project_title || selectedProject?.name || 'Project details'}
                    </h2>
                    {selectedProject?.code && (
                      <p className="text-sm text-gray-500 mt-1">Code: {selectedProject.code}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowProjectDetail(false)}
                    className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {projectLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
                    </div>
                  ) : selectedProject ? (
                    <>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <div className="p-4 bg-gray-50 rounded-xl">
                          <p className="text-sm text-gray-500">Department</p>
                          <p className="mt-2 text-lg font-semibold text-gray-900">
                            {selectedProject?.department?.name || 'Not assigned'}
                          </p>
                          {selectedProject?.department?.code && (
                            <p className="text-sm text-gray-500 mt-1">{selectedProject.department.code}</p>
                          )}
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl">
                          <p className="text-sm text-gray-500">Client</p>
                          <p className="mt-2 text-lg font-semibold text-gray-900">
                            {selectedProject?.client?.first_name
                              ? `${selectedProject.client.first_name} ${selectedProject.client.last_name}`
                              : 'Not assigned'}
                          </p>
                          {selectedProject?.client?.email && (
                            <p className="text-sm text-gray-500 mt-1">{selectedProject.client.email}</p>
                          )}
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl">
                          <p className="text-sm text-gray-500">Package amount and requirements</p>
                          <p className="mt-2 text-lg font-semibold text-gray-900">
                            {selectedProject?.project_title || selectedProject?.name || selectedProject?.package_name || selectedProject?.code || 'Not specified'}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            Amount: {selectedProject?.budget ? `₹${selectedProject.budget.toLocaleString()}` : 'Not specified'}
                          </p>
                          <p className="text-sm text-gray-500 mt-3">
                            {selectedProject?.requirements || selectedProject?.description || 'No requirements available.'}
                          </p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl">
                          <p className="text-sm text-gray-500">Team Lead</p>
                          <p className="mt-2 text-lg font-semibold text-gray-900">
                            {selectedProject?.team_lead_user?.first_name
                              ? `${selectedProject.team_lead_user.first_name} ${selectedProject.team_lead_user.last_name}`
                              : 'Not assigned'}
                          </p>
                          {selectedProject?.team_lead_user?.email && (
                            <p className="text-sm text-gray-500 mt-1">{selectedProject.team_lead_user.email}</p>
                          )}
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl">
                          <p className="text-sm text-gray-500">Status</p>
                          <p className="mt-2 text-lg font-semibold text-gray-900 capitalize">
                            {selectedProject?.status || 'Unknown'}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            Progress: {latestReportProgress ?? selectedProject?.progress ?? 0}%
                          </p>
                        </div>
                      </div>

                      <div className="p-4 bg-gray-50 rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm text-gray-500">Project Progress</p>
                          <p className="text-sm font-semibold text-primary-600">
                            {latestReportProgress ?? selectedProject?.progress ?? 0}%
                          </p>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="h-3 rounded-full bg-primary-600 transition-all"
                            style={{ width: `${latestReportProgress ?? selectedProject?.progress ?? 0}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          {latestReportProgress !== null
                            ? 'Based on the latest team lead report'
                            : 'Current project progress'}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="p-4 bg-gray-50 rounded-xl">
                          <p className="text-sm text-gray-500">Start Date</p>
                          <p className="mt-2 font-semibold text-gray-900">
                            {selectedProject?.start_date ? new Date(selectedProject.start_date).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl">
                          <p className="text-sm text-gray-500">End Date</p>
                          <p className="mt-2 font-semibold text-gray-900">
                            {selectedProject?.end_date ? new Date(selectedProject.end_date).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="p-4 bg-gray-50 rounded-xl">
                          <p className="text-sm text-gray-500">Budget</p>
                          <p className="mt-2 font-semibold text-gray-900">
                            {selectedProject?.budget ? `₹${selectedProject.budget.toLocaleString()}` : 'N/A'}
                          </p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl">
                          <p className="text-sm text-gray-500">Tasks</p>
                          <p className="mt-2 font-semibold text-gray-900">
                            {selectedProject?.task_stats?.completed || 0}/{selectedProject?.task_stats?.total || 0} completed
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-base font-semibold text-gray-900">Team Members</p>
                          <span className="text-sm text-gray-500">{selectedProject?.team_members_data?.length || 0}</span>
                        </div>
                        {selectedProject?.team_members_data?.length > 0 ? (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {selectedProject.team_members_data.map((member) => (
                              <div key={member.id} className="p-3 bg-white rounded-xl border">
                                <p className="font-medium">{member.first_name} {member.last_name}</p>
                                <p className="text-sm text-gray-500">{member.email}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No team members assigned yet.</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="p-6 text-center text-gray-500">
                      Unable to load project details.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Recent Tasks */}
          <div className="card min-h-[220px]">
            <h3 className="text-lg font-semibold mb-4">Recent Tasks</h3>
            {data?.recent_tasks?.length > 0 ? (
              <div className="space-y-3">
                {data.recent_tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{task.title || task.name || 'Untitled Task'}</p>
                      <p className="text-sm text-gray-500">{task.status || 'Status unavailable'}</p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        task.priority === 'high'
                          ? 'bg-red-100 text-red-800'
                          : task.priority === 'medium'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {task.priority || 'N/A'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-gray-500">
                <p className="font-medium">No recent tasks found</p>
                <p className="text-sm mt-2">Tasks created in the last 7 days will show here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Team Leader Dashboard
  if (user?.role === 'team_leader') {
    return (
      <TeamLeaderDashboard data={data} />
    );
  }

  // Team Member Dashboard
  if (user?.role === 'team_member') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Dashboard</h1>
          <p className="text-gray-600">Your tasks and projects</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="My Tasks"
            value={data?.task_stats?.total || 0}
            icon={CheckSquare}
            color="bg-blue-500"
          />
          <StatCard
            title="In Progress"
            value={data?.task_stats?.in_progress || 0}
            icon={Clock}
            color="bg-yellow-500"
          />
          <StatCard
            title="Completed"
            value={data?.task_stats?.completed || 0}
            icon={TrendingUp}
            color="bg-green-500"
          />
          <StatCard
            title="Overdue"
            value={data?.task_stats?.overdue || 0}
            icon={FolderKanban}
            color="bg-red-500"
          />
        </div>

        {/* My Tasks */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">My Tasks</h3>
          <div className="space-y-3">
            {data?.my_tasks?.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium">{task.title}</p>
                  <p className="text-sm text-gray-500">
                    Due: {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    task.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : task.status === 'in_progress'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {task.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Client Dashboard
  if (user?.role === 'client') {
    return <ClientDashboard data={data} navigate={navigate} />;
  }

  return null;
};

export default Dashboard;
