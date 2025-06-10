import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLoginModal } from '../context/loginModalContext';
import { useAuth } from '../hooks/useAuth';
import { Moon, Sun } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { ChatMessage } from './ChatMessage';
import ChatInput from './ChatInput';
import { Chat } from '../types/chat';
import { Logo } from './Logo';
import { toast } from 'react-toastify';
import { Toaster } from 'react-hot-toast';
import { authService } from '../services/api';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  createNewSession,
  handleSendMessage,
  handleNewChat,
  loadConversation,
} from '../utils/chatHelpers';

interface LayoutProps {
  chats: Chat[];
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
}

const Layout: React.FC<LayoutProps> = ({ chats, setChats }) => {
  const { theme, toggleTheme } = useTheme();
  const { onOpen } = useLoginModal();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string>('1');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [showLogout, setShowLogout] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  // Add loading states and processed sessions to prevent loops
  const [loadingStates, setLoadingStates] = useState<Set<string>>(new Set());
  const [processedSessions, setProcessedSessions] = useState<Set<string>>(new Set());
  const [initialLoad, setInitialLoad] = useState(false);

  const { sessionId: urlSessionId } = useParams<{ sessionId?: string }>();
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Helper wrappers with memoization
  const createNewSessionHelper = useCallback(
    () => createNewSession(setChats, setSelectedChatId, navigate),
    [setChats, navigate]
  );

  const handleSendMessageHelper = useCallback(
    (content: string) => {
      handleSendMessage(
        content,
        selectedChatId,
        setChats,
        location.pathname,
        createNewSessionHelper
      );
    },
    [selectedChatId, setChats, location.pathname, createNewSessionHelper]
  );

  const handleNewChatHelper = useCallback(
    () => {
      setProcessedSessions(new Set()); // Clear processed sessions for new chat
      handleNewChat(
        chats,
        selectedChatId,
        setChats,
        setSelectedChatId,
        navigate
      );
    },
    [chats, selectedChatId, setChats, navigate]
  );

  const loadConversationHelper = useCallback(
    async (conversationId: string) => {
      // Prevent multiple simultaneous loads of the same conversation
      if (loadingStates.has(conversationId)) {
        console.log('[Layout] Already loading conversation:', conversationId);
        return;
      }
      
      setIsChatLoading(true);
      setLoadingStates(prev => new Set(prev).add(conversationId));
      
      try {
        // Only load conversation if user is authenticated
        if (isAuthenticated) {
        await loadConversation(
          conversationId,
          setChats,
          setSelectedChatId,
          navigate,
          location.pathname
        );
        }
      } catch (error) {
        console.error('Error loading conversation:', error);
      } finally {
        setLoadingStates(prev => {
          const newSet = new Set(prev);
          newSet.delete(conversationId);
          return newSet;
        });
        setIsChatLoading(false);
      }
    },
    [setChats, navigate, location.pathname, isAuthenticated]
  );

  // Simple session ID effect
  useEffect(() => {
    if (sessionId) {
      setSelectedChatId(sessionId);
    }
  }, [sessionId]);

  // Payment status check effect
  useEffect(() => {
    // Check for payment status when chat loads or changes
    const paymentStatusStr = localStorage.getItem('paymentStatus');
    if (paymentStatusStr) {
      try {
        const paymentStatus = JSON.parse(paymentStatusStr);
        if (paymentStatus.sessionId === selectedChatId && paymentStatus.summary) {
          // Add a slight delay to ensure the UI is ready
          setTimeout(async () => {
            const messageContent = paymentStatus.ticketData
              ? { 
                  summary: paymentStatus.summary, 
                  ticketData: paymentStatus.ticketData, 
                  passengerData: paymentStatus.passengerData,
                  billItems: paymentStatus.billItems || []
                }
              : { summary: paymentStatus.summary };

            // Create an AI message with the payment summary
            setChats(prevChats => prevChats.map(chat => {
              if (chat.id === selectedChatId) {
                return {
                  ...chat,
                  messages: [
                    ...chat.messages,
                    {
                      id: `payment-confirmation-${Date.now()}`,
                      role: 'assistant',
                      content: messageContent,
                      timestamp: new Date()
                    }
                  ],
                  lastUpdated: new Date()
                };
              }
              return chat;
            }));

            console.log('[Layout] Ticket confirmation added to local chat state');

            // Remove the payment status from localStorage after using it
            localStorage.removeItem('paymentStatus');
          }, 500);
        }
      } catch (error) {
        console.error('Error parsing payment status:', error);
        localStorage.removeItem('paymentStatus');
      }
    }
  }, [selectedChatId, setChats]);

  // Main session handling effect with proper guards
  useEffect(() => {
    // Don't process if auth is still loading
    if (authLoading) {
      console.log('[Layout] Auth still loading, skipping session processing');
      return;
    }

    // Mark that we've done initial load check
    if (!initialLoad) {
      setInitialLoad(true);
      console.log('[Layout] Initial load marked as complete');
    }

    if (urlSessionId) {
      // Prevent processing the same session multiple times
      if (processedSessions.has(urlSessionId)) {
        console.log('[Layout] Session already processed:', urlSessionId);
        return;
      }

      console.log('[Layout] Processing session:', urlSessionId);
      
      // Mark this session as being processed
      setProcessedSessions(prev => new Set(prev).add(urlSessionId));
      
      setSelectedChatId(urlSessionId);
      localStorage.setItem('sessionId', urlSessionId);

      const chatExists = chats.some(chat => chat.id === urlSessionId);
      console.log('[Layout] Chat exists for session:', urlSessionId, chatExists);
      
      // Only load conversation if chat doesn't exist and user is authenticated
      if (!chatExists && isAuthenticated) {
        console.log('[Layout] Loading conversation for session:', urlSessionId);
        loadConversationHelper(urlSessionId);
      }
    } else if (isAuthenticated && initialLoad) {
      // Only handle navigation after initial load is complete and user is authenticated
      const storedSessionId = localStorage.getItem('sessionId');
      if (storedSessionId && location.pathname === '/') {
        console.log('[Layout] Redirecting to stored session:', storedSessionId);
        navigate(`/c/${storedSessionId}`, { replace: true });
      } else if (location.pathname === '/' && !storedSessionId) {
        console.log('[Layout] Creating new session for authenticated user');
        createNewSessionHelper();
      }
    }
  }, [
    urlSessionId, 
    isAuthenticated, 
    authLoading, 
    chats, 
    navigate, 
    location.pathname, 
    createNewSessionHelper, 
    loadConversationHelper,
    initialLoad
  ]);

  // Clear processed sessions when session ID changes significantly
  useEffect(() => {
    if (urlSessionId && !processedSessions.has(urlSessionId)) {
      // If we have a new sessionId that hasn't been processed, clear the processed set
      setProcessedSessions(new Set());
    }
  }, [urlSessionId]);

  // Listen for auth success events to reset loading states
  useEffect(() => {
    const handleAuthSuccess = () => {
      console.log('[Layout] Auth success event received, resetting states');
      setProcessedSessions(new Set());
      setInitialLoad(false); // Reset initial load to reprocess
    };

    window.addEventListener('auth:success', handleAuthSuccess);
    
    return () => {
      window.removeEventListener('auth:success', handleAuthSuccess);
    };
  }, []);

  // Scroll to bottom effects
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedChatId, chats]);

  const selectedChat = chats.find(chat => chat.id === selectedChatId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedChat?.messages]);

  // Modify the Sidebar onChatSelect to prevent unnecessary auth checks
  const handleChatSelect = useCallback((chatId: string) => {
    // Don't trigger auth check, just update the state and URL
    setIsChatLoading(true);
    setSelectedChatId(chatId);
    navigate(`/c/${chatId}`, { replace: true });
    
    // Check if chat exists in current state
    const chatExists = chats.some(chat => chat.id === chatId);
    if (!chatExists && isAuthenticated) {
      loadConversationHelper(chatId);
    } else {
      setIsChatLoading(false);
    }
  }, [navigate, chats, isAuthenticated, loadConversationHelper]);

  // Remove the full page loading state
  if (authLoading) {
    return null;
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-[var(--color-app-bg)] text-[var(--color-text)] overflow-hidden">
      <Toaster position="top-center" />
      <header
        className="fixed top-0 left-0 w-full h-12 flex items-center justify-between px-2 sm:px-5 bg-[var(--color-header-bg)] whitespace-nowrap z-40"
      >
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setIsSidebarOpen(prev => !prev)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg transition-colors duration-200"
            aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-5 sm:w-6 h-5 sm:h-6"
            >
              <path
                d="M18 4H6C4.89543 4 4 4.89543 4 6V18C4 19.1046 4.89543 20 6 20H18C19.1046 20 20 19.1046 20 18V6C20 4.89543 19.1046 4 18 4Z"
                fill="none"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="stroke-gray-700 dark:stroke-gray-300"
              />
              <path
                d="M9 4V20"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="stroke-gray-700 dark:stroke-gray-300"
              />
              <circle
                cx="6.5"
                cy="8"
                r="1"
                className="fill-gray-700 dark:fill-gray-300"
              />
              <circle
                cx="6.5"
                cy="12"
                r="1"
                className="fill-gray-700 dark:fill-gray-300"
              />
            </svg>
          </button>
          <Logo className="h-6 sm:h-8 w-auto" />
        </div>
        <div className="hidden sm:block absolute left-1/2 transform -translate-x-1/2 text-center font-semibold text-base sm:text-lg">
          <span className="text-[#1765f3] dark:text-[#fbe822]">Ṧ</span>.AI
        </div>
        <div className="ml-auto flex items-center gap-1 flex-shrink-0">
          {isAuthenticated ? (
            <div className="relative">
              <div
                className="w-6 sm:w-6 h-5 sm:h-5 cursor-pointer"
                onClick={() => setShowLogout((prev) => !prev)}
              >
                {/* User icon SVG */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                  <circle
                    cx="256"
                    cy="256"
                    r="256"
                    fill={theme === "dark" ? "#FBE822" : "#1765F3"}
                  />
                  <circle
                    cx="256"
                    cy="192"
                    r="80"
                    fill={theme === "dark" ? "#1765F3" : "#FBE822"}
                  />
                  <path
                    d="M256 288 C 160 288, 80 352, 80 432 L 432 432 C 432 352, 352 288, 256 288 Z"
                    fill={theme === "dark" ? "#1765F3" : "#FBE822"}
                  />
                </svg>
              </div>
              {showLogout && (
                <button
                  onClick={async () => {
                    try {
                      await authService.logout();
                      window.dispatchEvent(new Event("storage"));
                      toast.success("Logged out successfully!");
                      setShowLogout(false);
                      navigate('/', { replace: true });
                      window.location.reload();
                    } catch (error) {
                      console.error('Logout error:', error);
                      toast.error('Failed to logout');
                    }
                  }}
                  className={`absolute top-10 left-1/2 transform -translate-x-1/2 px-3 py-1 text-xs sm:text-sm rounded-lg font-medium transition-all duration-200 ${theme === "dark"
                    ? "bg-[#FBE822] text-[#1765F3] hover:bg-[#fcef4d]"
                    : "bg-[#1765F3] text-[#FBE822] hover:bg-[#1e7af3]"
                    }`}
                >
                  Logout
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={onOpen}
              className={`px-3 py-1 text-xs sm:text-sm rounded-lg font-medium transition-all duration-200 ${theme === "dark"
                ? "bg-[#FBE822] text-[#1765F3] hover:bg-[#fcef4d]"
                : "bg-[#1765F3] text-[#FBE822] hover:bg-[#1e7af3]"
                }`}
            >
              User Login
            </button>
          )}
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg transition-colors duration-200"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? (
              <Moon size={20} className="text-gray-700" />
            ) : (
              <Sun size={20} className="text-gray-300" />
            )}
          </button>
        </div>
      </header>
      <div className="flex-1 flex flex-col" style={{ marginTop: '8vh' }}>
        <div className="flex-1 flex overflow-hidden">
          <Sidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            chats={chats}
            selectedChatId={selectedChatId}
            onChatSelect={handleChatSelect}
            onNewChat={handleNewChatHelper}
            onLoadConversation={loadConversationHelper}
          />
          <div className="flex-1 flex flex-col items-center justify-center">
            {(selectedChat?.messages.length === 0 || !selectedChat) ? (
              <div className="flex flex-col items-center justify-center w-[90%] gap-1">
                <Logo className="h-16 w-auto" />
                <div className="flex items-center justify-center font-semibold text-base sm:text-lg">
                  <span className="text-[#1765f3] dark:text-[#fbe822]">Ṧ</span>.AI
                  <span className="text-gray-700 dark:text-gray-300">- Your assistant for Freshbus bookings</span>
                </div>
                <div className="w-[100%] mx-auto max-w-md">
                  <ChatInput onSend={handleSendMessageHelper} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full w-full pb-20">
                {/* Chat messages area */}
                <div className="fixed left-0 right-0" style={{ top: '3rem', bottom: '4.5rem', zIndex: 10 }}>
                  <div className="w-[98%] sm:w-[75%] mx-auto px-2 sm:px-4 lg:px-6 h-full overflow-y-auto hide-scrollbar">
                    {isChatLoading ? (
                      <div className="h-full flex items-center justify-center">
                        <div className="flex flex-col items-center gap-4">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1765f3] dark:border-[#fbe822]"></div>
                          <p className="text-[var(--color-text)] text-sm">Loading conversation...</p>
                        </div>
                      </div>
                    ) : (
                    <div className="py-1.5 space-y-1">
                      {selectedChat?.messages.map((message) => (
                        <ChatMessage
                          key={message.id}
                          message={message}
                          onBook={() => { }}
                          selectedChatId={selectedChatId}
                          setChats={setChats}
                        />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                    )}
                  </div>
                </div>
                <div
                  className="bg-[var(--color-app-bg)] fixed left-0 bottom-0 w-full flex items-center justify-center"
                  style={{
                    height: '4.5rem',
                  }}
                >
                  <div className="w-[98%] sm:w-[75%] mx-auto px-2 sm:px-4 lg:px-6 flex items-center h-full">
                    <ChatInput onSend={handleSendMessageHelper} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Layout;