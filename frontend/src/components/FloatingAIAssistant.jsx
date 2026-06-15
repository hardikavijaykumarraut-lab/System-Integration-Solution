import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, X, Minimize2, Maximize2 } from 'lucide-react';

const FloatingAIAssistant = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const navigate = useNavigate();

  const handleClick = () => {
    if (isExpanded && !isMinimized) {
      // If expanded and not minimized, minimize it
      setIsMinimized(true);
    } else if (isExpanded && isMinimized) {
      // If expanded and minimized, maximize it
      setIsMinimized(false);
    } else {
      // If not expanded, navigate to AI Assistant page
      navigate('/ai-assistant');
    }
  };

  const handleClose = () => {
    setIsExpanded(false);
    setIsMinimized(false);
  };

  return (
    <>
      {/* Floating Button */}
      <div className="fixed bottom-6 right-6 z-50">
        {!isExpanded ? (
          <button
            onClick={handleClick}
            className="w-14 h-14 bg-gradient-to-r from-cyan-500 to-fuchsia-600 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 flex items-center justify-center group"
            title="AI Assistant"
          >
            <Bot className="w-6 h-6 text-white group-hover:animate-pulse" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
          </button>
        ) : (
          <div className="bg-white rounded-lg shadow-2xl border border-gray-200 w-80 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-cyan-500 to-fuchsia-600 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bot className="w-5 h-5 text-white" />
                <h3 className="text-white font-semibold">AI Assistant</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClick}
                  className="p-1 hover:bg-white/20 rounded transition-colors"
                  title={isMinimized ? "Maximize" : "Minimize"}
                >
                  {isMinimized ? (
                    <Maximize2 className="w-4 h-4 text-white" />
                  ) : (
                    <Minimize2 className="w-4 h-4 text-white" />
                  )}
                </button>
                <button
                  onClick={handleClose}
                  className="p-1 hover:bg-white/20 rounded transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* Content */}
            {!isMinimized && (
              <div className="p-4">
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    Hello! I'm your AI assistant. I can help you with:
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-500 mt-1">•</span>
                      <span>Service requests and project tracking</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-500 mt-1">•</span>
                      <span>Billing and payment information</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-500 mt-1">•</span>
                      <span>Task management and collaboration</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-500 mt-1">•</span>
                      <span>System analytics and reporting</span>
                    </li>
                  </ul>
                  <button
                    onClick={() => navigate('/ai-assistant')}
                    className="w-full bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-white py-2 px-4 rounded-lg hover:from-cyan-600 hover:to-fuchsia-700 transition-colors text-sm font-medium"
                  >
                    Open Full Chat
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Backdrop */}
      {isExpanded && !isMinimized && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={handleClose}
        />
      )}
    </>
  );
};

export default FloatingAIAssistant;
