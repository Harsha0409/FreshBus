import { useEffect, useState } from 'react';
import { useRef } from 'react';
import { Plus, X, MoreVertical, Trash2 } from 'lucide-react';
import { Chat } from '../types/chat';
import { Logo } from './Logo';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-hot-toast';
import { authService } from '../services/api';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  chats: Chat[];
  onChatSelect: (chatId: string) => void;
  selectedChatId: string | null;
  onNewChat: () => void;
  onLoadConversation: (conversationId: string) => void;
}

export function Sidebar({ 
  isOpen, 
  onClose, 
  onNewChat,
  onLoadConversation
}: SidebarProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [userChats, setUserChats] = useState<{ session_id: string; preview: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showDeleteFor, setShowDeleteFor] = useState<string | null>(null);

  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (isOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Add delete conversation handler
  const handleDeleteConversation = async (sessionId: string) => {
    try {
      const user = authService.getUser();
      
      if (!user?.id) {
        toast.error("User not found");
        return;
      }

      const response = await authService.fetchWithRefresh(
        `/api/conversations?user_id=${user.id}&session_id=${sessionId}`,
        {
          method: 'DELETE',
        }
      );

      if (response.ok) {
        setUserChats(prevChats => 
          prevChats.filter(chat => chat.session_id !== sessionId)
        );
        toast.success('Conversation deleted');
        
        if (sessionId === activeSessionId) {
          localStorage.removeItem('sessionId');
          setActiveSessionId(null);
          window.location.href = '/';
        }
      } else {
        throw new Error('Failed to delete conversation');
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      if (error instanceof Error && error.message === 'Session expired') {
        toast.error('Session expired. Please login again.');
        window.dispatchEvent(new CustomEvent('login:required'));
      } else {
        toast.error('Failed to delete conversation');
      }
    } finally {
      setShowDeleteFor(null);
    }
  };

  // Track active session from localStorage
  useEffect(() => {
    const currentSessionId = localStorage.getItem('sessionId');
    if (currentSessionId) {
      setActiveSessionId(currentSessionId);
    }
  }, []);

  // Fetch previous chats from backend when authenticated
  useEffect(() => {
    const fetchChats = async () => {
      if (!isAuthenticated || authLoading) {
        setUserChats([]);
        return;
      }
      
      console.log('[Sidebar] Fetching conversations for authenticated user');
      setIsLoading(true);
      
      const user = authService.getUser();
      if (!user?.id) {
        console.log('[Sidebar] No user ID found');
        setIsLoading(false);
        return;
      }
      
      try {
        console.log('[Sidebar] Making API call to fetch conversations');
        const res = await authService.fetchWithRefresh(`/api/conversations?user_id=${user.id}`);
        if (res.ok) {
          const data = await res.json();
          console.log('[Sidebar] Conversations fetched:', data.conversations?.length || 0);
          setUserChats(data.conversations || []);
        } else {
          console.error('[Sidebar] Failed to fetch conversations:', res.status);
        }
      } catch (err) {
        console.error('Error fetching conversations:', err);
        if (err instanceof Error && err.message === 'Session expired') {
          window.dispatchEvent(new CustomEvent('login:required'));
        }
        setUserChats([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchChats();

    // Also listen for auth success to immediately fetch chats
    const handleAuthSuccess = () => {
      console.log('[Sidebar] Auth success event received, fetching chats');
      const AUTH_DELAY_MS = 100; // Small delay to ensure auth state is updated
      setTimeout(fetchChats, AUTH_DELAY_MS);
    };

    window.addEventListener('auth:success', handleAuthSuccess);
    
    return () => {
      window.removeEventListener('auth:success', handleAuthSuccess);
    };
  }, [isAuthenticated, authLoading]);

  const handleLoadConversation = async (sessionId: string) => {
    try {
      localStorage.setItem('sessionId', sessionId);
      setActiveSessionId(sessionId);
      await onLoadConversation(sessionId);
      onClose();
    } catch (error) {
      console.error('Error loading conversation:', error);
      toast.error('Failed to load conversation');
    }
  };

  return (
    <aside
      ref={sidebarRef}
      className={`fixed top-0 left-0 h-full w-64 bg-[var(--color-sidebar-bg)] border-r border-gray-200 dark:border-dark-border ${
        isOpen ? 'translate-x-0 shadow-xl opacity-100' : '-translate-x-full opacity-0'
      } z-50 transition-transform duration-300`}
    >
      {/* Sidebar Header */}
      <div className="fixed top-0 left-0 w-64 h-12 z-60 bg-[var(--color-sidebar-bg)] dark:bg-[#000000] flex items-center justify-between px-4 border-b border-gray-200 dark:border-dark-border">
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg transition-colors duration-200"
          aria-label="Close Sidebar"
        >
          <X size={24} className="text-gray-700 dark:text-gray-300" />
        </button>
        <div>
          <Logo className="h-6 sm:h-8 w-auto" />
        </div>
      </div>

      {/* New Chat Option */}
      <div className="mt-10 p-4">
        <button
          onClick={() => {
            localStorage.removeItem('sessionId');
            setActiveSessionId(null);
            onNewChat();
            onClose();
          }}
          className="w-full flex items-center justify-center gap-2 p-2 bg-blue-500 text-white rounded-lg focus:outline-none hover:bg-blue-600 transition-colors"
        >
          <Plus size={18} />
          New Chat
        </button>
      </div>

      {/* Previous conversations */}
      {isAuthenticated && !authLoading && (
        <div className="h-[calc(100vh-10rem)] overflow-y-auto pb-4 custom-scrollbar">
          <div className="px-2">
            {isLoading ? (
              <div className="text-gray-400 mt-8">Loading conversations...</div>
            ) : userChats.length === 0 ? (
              <div className="text-center text-gray-400 mt-8">No previous chats found.</div>
            ) : (
              userChats.map((chat) => (
                <div
                  key={chat.session_id}
                  className={`relative group w-full p-2 text-left transition-colors duration-200 rounded-lg mb-1
                    ${chat.session_id === activeSessionId 
                      ? 'bg-gray-200 dark:bg-gray-800' 
                      : 'hover:bg-gray-100 dark:hover:bg-dark-hover'
                    }`}
                >
                  <button
                    onClick={() => handleLoadConversation(chat.session_id)}
                    className="w-full text-left"
                  >
                    <h3 className={`font-medium truncate pr-8 
                      ${chat.session_id === activeSessionId
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      {chat.preview ? chat.preview.substring(0, 30) + "..." : "Previous Chat"}
                    </h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 opacity-70">
                      {chat.session_id === activeSessionId
                        ? "Current conversation"
                        : "Click to continue conversation"}
                    </p>
                  </button>

                  {/* More options button */}
                  <button
                    onClick={() => setShowDeleteFor(showDeleteFor === chat.session_id ? null : chat.session_id)}
                    className={`absolute right-2 top-4 p-1 rounded-lg transition-opacity
                      ${showDeleteFor === chat.session_id 
                        ? 'opacity-100' 
                        : 'opacity-0 group-hover:opacity-100'
                      }
                      hover:bg-gray-200 dark:hover:bg-gray-700`}
                  >
                    <MoreVertical size={16} className="text-gray-500" />
                  </button>

                  {/* Delete option popup */}
                  {showDeleteFor === chat.session_id && (
                    <div className="absolute right-2 top-9 bg-blue-500 rounded-lg shadow-lg py-1 z-50 translate-x-4">
                      <button
                        onClick={() => handleDeleteConversation(chat.session_id)}
                        className="flex items-center gap-1 px-0.5 py-0.5 text-[10px] text-white w-full"
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </aside>
  );
}