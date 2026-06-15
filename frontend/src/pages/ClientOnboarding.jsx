import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { servicesAPI, requirementsAPI, paymentsAPI } from '../services/api';
import { 
  Building2, 
  Globe, 
  TrendingUp, 
  Users, 
  Check, 
  ArrowRight,
  ArrowLeft,
  CreditCard,
  FileText,
  Send,
  Smartphone,
  Building,
  Wallet
} from 'lucide-react';
import toast from 'react-hot-toast';

const ClientOnboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [departments, setDepartments] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedDept, setSelectedDept] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [requirements, setRequirements] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentMode, setPaymentMode] = useState('');
  const [transactionId, setTransactionId] = useState('');
  
  const paymentModes = [
    { id: 'credit_card', label: 'Credit Card', icon: CreditCard },
    { id: 'debit_card', label: 'Debit Card', icon: CreditCard },
    { id: 'upi', label: 'UPI', icon: Smartphone },
    { id: 'net_banking', label: 'Net Banking', icon: Building },
    { id: 'wallet', label: 'Digital Wallet', icon: Wallet },
  ];

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await servicesAPI.getDepartments();
      setDepartments(response.data.data || []);
    } catch (error) {
      toast.error('Failed to load departments');
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
    setStep(2);
  };

  const handlePackageSelect = (pkg) => {
    setSelectedPackage(pkg);
    setStep(3);
  };

  const handlePayment = async () => {
    if (!paymentMode) {
      toast.error('Please select a payment mode');
      return;
    }
    
    setLoading(true);
    try {
      // Record the payment
      const paymentData = {
        amount: selectedPackage.price,
        payment_mode: paymentMode,
        package_id: selectedPackage.id,
        package_name: selectedPackage.name,
        department_id: selectedDept.id,
        transaction_id: transactionId || `TXN-${Date.now()}`,
      };
      
      const paymentResponse = await paymentsAPI.create(paymentData);
      
      if (paymentResponse.data.success) {
        toast.success(`Payment successful! Receipt ID: ${paymentResponse.data.data.receipt_id}`);
        setStep(4);
      } else {
        toast.error('Payment failed. Please try again.');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Payment processing failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequirements = async () => {
    if (!requirements.trim()) {
      toast.error('Please enter your requirements');
      return;
    }
    
    setLoading(true);
    try {
      await requirementsAPI.submit({
        package_id: selectedPackage.id,
        package_name: selectedPackage.name,
        department_id: selectedDept.id,
        amount_paid: selectedPackage.price,
        requirements: requirements,
        priority: 'medium'
      });
      toast.success('Requirements submitted successfully!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit requirements');
    } finally {
      setLoading(false);
    }
  };

  const getDeptIcon = (icon) => {
    switch (icon) {
      case 'globe': return <Globe className="w-8 h-8" />;
      case 'trending': return <TrendingUp className="w-8 h-8" />;
      case 'people': return <Users className="w-8 h-8" />;
      default: return <Building2 className="w-8 h-8" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step >= s 
                    ? 'bg-primary-600 text-white' 
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {s}
                </div>
                {s < 4 && (
                  <div className={`w-16 h-1 mx-2 ${
                    step > s ? 'bg-primary-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-center mt-2 space-x-12 text-sm text-gray-600">
            <span>Select Department</span>
            <span>Choose Package</span>
            <span>Payment</span>
            <span>Requirements</span>
          </div>
        </div>

        {/* Step 1: Select Department */}
        {step === 1 && (
          <div>
            <h1 className="text-3xl font-bold text-center mb-2">Select a Department</h1>
            <p className="text-gray-600 text-center mb-8">Choose the department that matches your needs</p>
            
            <div className="grid md:grid-cols-3 gap-6">
              {departments.map((dept) => (
                <button
                  key={dept.id}
                  onClick={() => handleDeptSelect(dept)}
                  className="card hover:shadow-lg transition-all text-left group"
                >
                  <div 
                    className="w-16 h-16 rounded-xl flex items-center justify-center mb-4 text-white"
                    style={{ backgroundColor: dept.color }}
                  >
                    {getDeptIcon(dept.icon)}
                  </div>
                  <h3 className="text-xl font-semibold mb-2 group-hover:text-primary-600">
                    {dept.name}
                  </h3>
                  <p className="text-gray-600 text-sm mb-4">{dept.description}</p>
                  <div className="flex items-center text-primary-600 font-medium">
                    <span>{dept.service_count} Packages</span>
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Select Package */}
        {step === 2 && selectedDept && (
          <div>
            <div className="flex items-center mb-6">
              <button
                onClick={() => setStep(1)}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-5 h-5 mr-1" />
                Back
              </button>
              <h1 className="text-2xl font-bold ml-4">{selectedDept.name} Packages</h1>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {services.map((pkg) => (
                <div
                  key={pkg.id}
                  className="card hover:shadow-lg transition-all border-2 border-transparent hover:border-primary-200"
                >
                  <h3 className="text-lg font-semibold mb-2">{pkg.name}</h3>
                  <p className="text-gray-600 text-sm mb-4">{pkg.description}</p>
                  
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-primary-600">₹{pkg.price.toLocaleString()}</span>
                    <span className="text-gray-500"> / {pkg.duration_days} days</span>
                  </div>
                  
                  <ul className="space-y-2 mb-6">
                    {pkg.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center text-sm text-gray-600">
                        <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  
                  <button
                    onClick={() => handlePackageSelect(pkg)}
                    className="btn-primary w-full"
                  >
                    Select Package
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Payment */}
        {step === 3 && selectedPackage && (
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center mb-6">
              <button
                onClick={() => setStep(2)}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-5 h-5 mr-1" />
                Back
              </button>
              <h1 className="text-2xl font-bold ml-4">Complete Payment</h1>
            </div>
            
            <div className="card mb-6">
              <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Package</span>
                <span className="font-medium">{selectedPackage.name}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Duration</span>
                <span className="font-medium">{selectedPackage.duration_days} days</span>
              </div>
              <div className="flex justify-between py-4 text-xl font-bold">
                <span>Total</span>
                <span className="text-primary-600">₹{selectedPackage.price.toLocaleString()}</span>
              </div>
            </div>
            
            <div className="card">
              <h2 className="text-lg font-semibold mb-4 flex items-center">
                <CreditCard className="w-5 h-5 mr-2" />
                Select Payment Mode
              </h2>
              
              {/* Payment Mode Selection */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                {paymentModes.map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => setPaymentMode(mode.id)}
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
              
              {/* Transaction ID (Optional) */}
              <div className="mb-6">
                <label className="label">Transaction ID (Optional)</label>
                <input 
                  type="text" 
                  placeholder="Enter transaction reference number if available"
                  className="input"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  If you have already made the payment, enter the transaction ID here
                </p>
              </div>
              
              {/* Selected Payment Mode Display */}
              {paymentMode && (
                <div className="p-4 bg-blue-50 rounded-lg mb-6">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">Selected:</span>{' '}
                    {paymentModes.find(m => m.id === paymentMode)?.label}
                  </p>
                </div>
              )}
              
              <button
                onClick={handlePayment}
                disabled={loading || !paymentMode}
                className="btn-primary w-full"
              >
                {loading ? 'Processing...' : `Pay ₹${selectedPackage.price.toLocaleString()}`}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Submit Requirements */}
        {step === 4 && (
          <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-2">Project Requirements</h1>
            <p className="text-gray-600 mb-6">
              Please provide detailed requirements for your project. This will help us assign the right team.
            </p>
            
            <div className="card">
              <div className="flex items-center mb-4 text-green-600 bg-green-50 p-4 rounded-lg">
                <Check className="w-5 h-5 mr-2" />
                <span className="font-medium">Payment completed successfully!</span>
              </div>
              
              <div className="mb-4">
                <label className="label flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  Project Requirements
                </label>
                <textarea
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  placeholder="Describe your project requirements in detail...\n\nExample:\n- Website type: E-commerce\n- Number of products: 500+\n- Payment methods: Credit Card, UPI\n- Special features: Wishlist, Reviews"
                  className="input h-48 resize-none"
                />
              </div>
              
              <button
                onClick={handleSubmitRequirements}
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center"
              >
                <Send className="w-4 h-4 mr-2" />
                {loading ? 'Submitting...' : 'Submit Requirements'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientOnboarding;
