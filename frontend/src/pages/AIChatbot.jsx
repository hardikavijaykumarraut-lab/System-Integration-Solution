import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { aiChatbotAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Send, Bot, User, Trash2, HelpCircle, Sparkles, MessageSquare, Clock, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

const AIChatbot = () => {
  const { user } = useAuthStore();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  // Get AI capabilities for current user role
  const { data: capabilitiesData, isLoading: capabilitiesLoading } = useQuery(
    'ai-capabilities',
    aiChatbotAPI.getCapabilities,
    {
      select: (res) => res.data.data,
      onSuccess: (data) => {
        // Add welcome message if no messages exist
        if (messages.length === 0 && data) {
          setMessages([{
            id: `welcome-${Date.now()}`,
            type: 'ai',
            content: data.greeting,
            timestamp: new Date().toISOString(),
            role: data.role
          }]);
        }
      },
      onError: () => {
        // Set default welcome message if capabilities fail to load
        if (messages.length === 0) {
          setMessages([{
            id: `welcome-${Date.now()}`,
            type: 'ai',
            content: 'Hello! I\'m your AI assistant. How can I help you today?',
            timestamp: new Date().toISOString(),
            role: 'assistant'
          }]);
        }
      }
    }
  );

  const { data: historyData } = useQuery(
    'ai-chat-history',
    () => aiChatbotAPI.getHistory({ page: 1, per_page: 10 }),
    {
      select: (res) => res.data.data,
      enabled: false // Only load when needed
    }
  );

  const chatMutation = useMutation(
    aiChatbotAPI.chat,
    {
      onSuccess: (response) => {
        const responseData = response.data?.data || {};
        const aiMessage = {
          id: responseData.timestamp || Date.now().toString(),
          type: 'ai',
          content: responseData.message || 'Sorry, I could not generate a response.',
          timestamp: responseData.timestamp || new Date().toISOString(),
          role: responseData.role || user?.role || 'assistant'
        };
        setMessages(prev => [...prev, aiMessage]);
        setSessionId(responseData.session_id);
      },
      onError: (error) => {
        toast.error('Failed to get AI response');
        const errorMessage = {
          id: Date.now().toString(),
          type: 'ai',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date().toISOString(),
          isError: true
        };
        setMessages(prev => [...prev, errorMessage]);
      },
      onSettled: () => {
        setIsLoading(false);
      }
    }
  );

  const clearHistoryMutation = useMutation(
    aiChatbotAPI.clearHistory,
    {
      onSuccess: () => {
        toast.success('Chat history cleared');
        setMessages([{
          id: 'welcome',
          type: 'ai',
          content: capabilitiesData?.greeting || 'Hello! How can I help you today?',
          timestamp: new Date().toISOString(),
          role: user?.role || 'client'
        }]);
        queryClient.invalidateQueries('ai-chat-history');
      },
      onError: () => {
        toast.error('Failed to clear chat history');
      }
    }
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setIsLoading(true);

    chatMutation.mutate({
      message: message.trim(),
      session_id: sessionId
    });
  };

  const handleQuickQuestion = (question) => {
    if (isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: question,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setIsLoading(true);

    chatMutation.mutate({
      message: question,
      session_id: sessionId
    });
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear all chat history?')) {
      clearHistoryMutation.mutate();
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return <Settings className="w-4 h-4" />;
      case 'team_leader': return <User className="w-4 h-4" />;
      case 'team_member': return <User className="w-4 h-4" />;
      case 'client': return <User className="w-4 h-4" />;
      default: return <Bot className="w-4 h-4" />;
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-700';
      case 'team_leader': return 'bg-cyan-100 text-cyan-700';
      case 'team_member': return 'bg-green-100 text-green-700';
      case 'client': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-6">
      {/* Chat Interface */}
      <div className="flex-1 bg-white rounded-lg shadow-md flex flex-col">
        {/* Header */}
        <div className="p-4 border-b bg-gradient-to-r from-cyan-50 to-fuchsia-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-800">AI Assistant</h2>
                <div className="flex items-center gap-2">
                  {getRoleIcon(user?.role)}
                  <span className={`text-xs px-2 py-1 rounded-full ${getRoleColor(user?.role)}`}>
                    {user?.role?.replace('_', ' ')} Assistant
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={handleClearHistory}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Clear chat history"
            >
              <Trash2 className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, index) => (
            <div
              key={`${msg.id}-${index}`}
              className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-2xl flex gap-3 ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.type === 'user' 
                    ? 'bg-primary-600' 
                    : msg.isError 
                      ? 'bg-red-100' 
                      : 'bg-gradient-to-r from-blue-500 to-purple-500'
                }`}>
                  {msg.type === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : msg.isError ? (
                    <HelpCircle className="w-4 h-4 text-red-600" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>
                <div className={`px-4 py-3 rounded-lg ${
                  msg.type === 'user'
                    ? 'bg-primary-600 text-white'
                    : msg.isError
                      ? 'bg-red-100 text-red-700 border border-red-200'
                      : 'bg-gray-100 text-gray-900'
                }`}>
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                  <p className={`text-xs mt-2 ${
                    msg.type === 'user' 
                      ? 'text-primary-100' 
                      : msg.isError
                        ? 'text-red-600'
                        : 'text-gray-500'
                  }`}>
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-2xl flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="px-4 py-3 rounded-lg bg-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSendMessage} className="p-4 border-t">
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask me anything..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!message.trim() || isLoading}
              className="px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>

      {/* Sidebar */}
      <div className="w-80 space-y-4">
        {/* Capabilities Card */}
        {capabilitiesData && !capabilitiesLoading && (
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-cyan-500" />
              <h3 className="font-semibold text-gray-800">My Capabilities</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">{capabilitiesData.greeting}</p>
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700 text-sm">I can help you with:</h4>
              <ul className="space-y-1">
                {capabilitiesData.capabilities?.map((capability, index) => (
                  <li key={`capability-${index}`} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-cyan-500 mt-1">•</span>
                    <span>{capability}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Quick Questions */}
        {capabilitiesData && !capabilitiesLoading && (
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center gap-2 mb-3">
              <HelpCircle className="w-5 h-5 text-purple-500" />
              <h3 className="font-semibold text-gray-800">Quick Questions</h3>
            </div>
            <div className="space-y-2">
              {capabilitiesData.sample_questions?.map((question, index) => (
                <button
                  key={`question-${index}`}
                  onClick={() => handleQuickQuestion(question)}
                  className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat Stats */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-5 h-5 text-green-500" />
            <h3 className="font-semibold text-gray-800">Chat Info</h3>
          </div>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Session: {sessionId ? 'Active' : 'New'}</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              <span>Messages: {messages.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>Role: {user?.role?.replace('_', ' ') || 'client'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChatbot;
