import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { chatAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Send, Search, MoreVertical, Phone, Video, Plus, X, Users, Shield, User } from 'lucide-react';
import io from 'socket.io-client';
import toast from 'react-hot-toast';

const Chat = () => {
  const { user } = useAuthStore();
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [message, setMessage] = useState('');
  const [socket, setSocket] = useState(null);
  const messagesEndRef = useRef(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [sentMessageIds, setSentMessageIds] = useState(new Set()); // Track sent messages
  const queryClient = useQueryClient();

  // Helper function to get full image URL
  const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    // If path already starts with http, return as is
    if (imagePath.startsWith('http')) return imagePath;
    // Otherwise, prepend backend URL
    return `http://localhost:5000${imagePath}`;
  };

  const { data: conversationsData, refetch: refetchConversations } = useQuery(
    'conversations',
    () => {
      if (user?.role === 'admin') {
        return chatAPI.adminMonitor();
      }
      return chatAPI.getConversations();
    },
    {
      select: (res) => res.data.data,
    }
  );

  const { data: messagesData, refetch: refetchMessages } = useQuery(
    ['messages', selectedConversation?.room_id],
    () => chatAPI.getMessages(selectedConversation.room_id),
    {
      enabled: !!selectedConversation?.room_id,
      select: (res) => res.data.data,
    }
  );

  const createConversationMutation = useMutation(
    chatAPI.createConversation,
    {
      onSuccess: (response) => {
        const newConversation = response.data.data;
        setSelectedConversation(newConversation);
        setShowNewChatModal(false);
        setSearchQuery('');
        setSearchResults([]);
        setSelectedUser(null);
        refetchConversations();
        toast.success('Conversation started successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to start conversation');
      }
    }
  );

  const conversations = conversationsData || [];
  const messages = messagesData || [];

  // Search users
  useEffect(() => {
    if (searchQuery.length >= 2) {
      const searchTimer = setTimeout(() => {
        chatAPI.searchUsers(searchQuery)
          .then(response => {
            setSearchResults(response.data.data || []);
          })
          .catch(error => {
            console.error('Search failed:', error);
            setSearchResults([]);
          });
      }, 300);

      return () => clearTimeout(searchTimer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  useEffect(() => {
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    return () => newSocket.close();
  }, []);

  useEffect(() => {
    if (socket && selectedConversation) {
      socket.emit('join', { room: selectedConversation.room_id });
      
      socket.on('new_message', (data) => {
        // Only process if this message hasn't been seen before
        if (!sentMessageIds.has(data.id)) {
          // Add to sent messages if it's from current user
          if (data.sender_id === user.id) {
            setSentMessageIds(prev => new Set(prev).add(data.id));
          }
          refetchMessages();
          refetchConversations();
        }
      });

      return () => {
        socket.emit('leave', { room: selectedConversation.room_id });
        socket.off('new_message');
      };
    }
  }, [socket, selectedConversation, refetchMessages, refetchConversations, user.id, sentMessageIds]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || !selectedConversation) return;

    const messageContent = message.trim();
    setMessage(''); // Clear input immediately to prevent double sends

    try {
      // Send via REST API first
      await chatAPI.sendMessage({
        room_id: selectedConversation.room_id,
        content: messageContent,
      });

      // Refetch messages to get the latest state
      refetchMessages();
      refetchConversations();
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
      // Restore message on error
      setMessage(messageContent);
    }
  };

  const handleStartConversation = async (targetUser) => {
    try {
      // Validate conversation first
      await chatAPI.validateConversation({ participant_id: targetUser.id });
      
      // Create conversation
      createConversationMutation.mutate({
        participants: [targetUser.id],
        type: 'direct'
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Cannot start conversation with this user');
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return <Shield className="w-4 h-4" />;
      case 'team_leader': return <Users className="w-4 h-4" />;
      case 'team_member': return <User className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-700';
      case 'team_leader': return 'bg-blue-100 text-blue-700';
      case 'team_member': return 'bg-green-100 text-green-700';
      case 'client': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getConversationName = (conversation) => {
    if (conversation.name) return conversation.name;
    
    const otherParticipants = conversation.participants_data?.filter(p => p.id !== user.id) || [];
    if (otherParticipants.length === 0) return 'Unknown';
    
    if (otherParticipants.length === 1) {
      const participant = otherParticipants[0];
      return `${participant.first_name} ${participant.last_name}`;
    }
    
    return `${otherParticipants.length} participants`;
  };

  const getConversationAvatar = (conversation) => {
    const otherParticipants = conversation.participants_data?.filter(p => p.id !== user.id) || [];
    if (otherParticipants.length === 0) return null;
    
    if (otherParticipants.length === 1) {
      const participant = otherParticipants[0];
      return participant.profile_image;
    }
    
    return null; // For group chats, show multiple avatars
  };

  const getInitials = (firstName, lastName) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-6">
      {/* Conversations List */}
      <div className="w-80 bg-white rounded-lg shadow-md flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Messages</h2>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="p-2 hover:bg-gray-100 rounded-lg"
              title="Start new conversation"
            >
              <Plus className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <p>No conversations yet</p>
              <button
                onClick={() => setShowNewChatModal(true)}
                className="mt-2 text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                Start your first conversation
              </button>
            </div>
          ) : (
            conversations.map((conversation) => (
              <button
                key={conversation.id || conversation.room_id}
                onClick={() => setSelectedConversation(conversation)}
                className={`w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                  selectedConversation?.room_id === conversation.room_id ? 'bg-primary-50' : ''
                }`}
              >
                {getConversationAvatar(conversation) ? (
                  <img 
                    src={getImageUrl(getConversationAvatar(conversation))} 
                    alt={getConversationName(conversation)}
                    className="w-10 h-10 rounded-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center"
                  style={{ display: getConversationAvatar(conversation) ? 'none' : 'flex' }}
                >
                  <span className="text-primary-600 font-medium text-sm">
                    {(() => {
                      const otherParticipants = conversation.participants_data?.filter(p => p.id !== user.id) || [];
                      if (otherParticipants.length === 1) {
                        const participant = otherParticipants[0];
                        return getInitials(participant.first_name, participant.last_name);
                      }
                      return otherParticipants.length.toString();
                    })()}
                  </span>
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-sm">
                    {getConversationName(conversation)}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {conversation.last_message?.content || 'No messages yet'}
                  </p>
                </div>
                {conversation.unread_count > 0 && (
                  <span className="bg-primary-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {conversation.unread_count}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      {selectedConversation ? (
        <div className="flex-1 bg-white rounded-lg shadow-md flex flex-col">
          {/* Header */}
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              {(() => {
                const otherParticipants = selectedConversation.participants_data?.filter(p => p.id !== user.id) || [];
                if (otherParticipants.length === 1) {
                  const participant = otherParticipants[0];
                  return participant.profile_image ? (
                    <img 
                      src={getImageUrl(participant.profile_image)} 
                      alt={getConversationName(selectedConversation)}
                      className="w-10 h-10 rounded-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null;
                }
                return null;
              })()}
              <div 
                className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center"
                style={{ display: (() => {
                  const otherParticipants = selectedConversation.participants_data?.filter(p => p.id !== user.id) || [];
                  if (otherParticipants.length === 1) {
                    return otherParticipants[0].profile_image ? 'none' : 'flex';
                  }
                  return 'flex';
                })() }}
              >
                <span className="text-primary-600 font-medium">
                  {(() => {
                    const otherParticipants = selectedConversation.participants_data?.filter(p => p.id !== user.id) || [];
                    if (otherParticipants.length === 1) {
                      const participant = otherParticipants[0];
                      return getInitials(participant.first_name, participant.last_name);
                    }
                    return otherParticipants.length.toString();
                  })()}
                </span>
              </div>
              <div>
                <p className="font-medium">
                  {getConversationName(selectedConversation)}
                </p>
                <div className="flex items-center gap-2">
                  {selectedConversation.participants_data?.slice(0, 2).map((participant, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      {getRoleIcon(participant.role)}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${getRoleColor(participant.role)}`}>
                        {participant.role.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-gray-100 rounded-lg">
                <Phone className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg">
                <Video className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg">
                <MoreVertical className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((msg) => {
                return (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.sender_id === user.id ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {msg.sender_id !== user.id && (
                      <img 
                        src={getImageUrl(msg.sender?.profile_image)} 
                        alt={msg.sender?.first_name}
                        className="w-8 h-8 rounded-full object-cover mr-2"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    )}
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        msg.sender_id === user.id
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p>{msg.content}</p>
                      <p
                        className={`text-xs mt-1 ${
                          msg.sender_id === user.id ? 'text-primary-100' : 'text-gray-500'
                        }`}
                      >
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    {msg.sender_id === user.id && (
                      <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center ml-2">
                        <span className="text-white text-xs font-medium">
                          {getInitials(user.first_name, user.last_name)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
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
                placeholder="Type a message..."
                className="flex-1 input"
              />
              <button
                type="submit"
                disabled={!message.trim()}
                className="btn-primary px-4"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="flex-1 bg-white rounded-lg shadow-md flex items-center justify-center">
          <div className="text-center text-gray-500">
            <p className="text-lg font-medium">Select a conversation</p>
            <p className="text-sm">Choose a conversation to start messaging</p>
          </div>
        </div>
      )}

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Start New Conversation</h3>
              <button
                onClick={() => {
                  setShowNewChatModal(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users..."
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              {searchResults.length === 0 && searchQuery.length >= 2 ? (
                <p className="text-center text-gray-500 py-4">No users found</p>
              ) : (
                searchResults.map((searchUser) => (
                  <button
                    key={searchUser.id}
                    onClick={() => handleStartConversation(searchUser)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    {searchUser.profile_image ? (
                    <img 
                      src={getImageUrl(searchUser.profile_image)} 
                      alt={`${searchUser.first_name} ${searchUser.last_name}`}
                      className="w-10 h-10 rounded-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center"
                    style={{ display: searchUser.profile_image ? 'none' : 'flex' }}
                  >
                    <span className="text-primary-600 font-medium">
                      {getInitials(searchUser.first_name, searchUser.last_name)}
                    </span>
                  </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium">
                        {searchUser.first_name} {searchUser.last_name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {getRoleIcon(searchUser.role)}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${getRoleColor(searchUser.role)}`}>
                          {searchUser.role.replace('_', ' ')}
                        </span>
                        {searchUser.department && (
                          <span className="text-xs text-gray-500">
                            {searchUser.department}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
