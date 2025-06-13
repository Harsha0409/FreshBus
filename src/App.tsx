import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { LoginModalProvider } from './context/loginModalContext';
import Layout from './components/Layout';
import PaymentCallback from './components/PaymentCallback';
import LoginModal from './components/LoginModal';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Chat } from './types/chat';
import { authService } from './services/api';
// Remove this line: import CookieDebugger from './CookieDebugger';

const mockChats: Chat[] = [
  {
    id: '1',
    title: 'Getting Started',
    lastUpdated: new Date(),
    messages: [],
  },
];

function App() {
  const [chats, setChats] = useState<Chat[]>(mockChats);
  const [initialAuthCheck, setInitialAuthCheck] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    // Initial authentication check on app load
    const checkAuth = async () => {
      try {
        console.log('[App] Starting initial auth check...');

        // Perform full auth initialization
        const isAuthenticated = await authService.initializeAuth();
        console.log('[App] Initial auth result:', isAuthenticated);
        
        setShowLoginModal(!isAuthenticated);
      } catch (error) {
        console.error('Initial auth check failed:', error);
        setShowLoginModal(true);
      } finally {
        setInitialAuthCheck(true);
        console.log('[App] Initial auth check completed');
      }
    };

    checkAuth();
  }, []);

  // Don't render until initial auth check is complete
  if (!initialAuthCheck) {
    return null;
  }

  return (
    <BrowserRouter>
      <AppContent chats={chats} setChats={setChats} showLoginModal={showLoginModal} />
    </BrowserRouter>
  );
}

function AppContent({ 
  chats, 
  setChats, 
  showLoginModal 
}: { 
  chats: Chat[]; 
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
  showLoginModal: boolean;
}) {
  return (
    <ThemeProvider>
      <LoginModalProvider initialOpen={showLoginModal}>
        <Routes>
          <Route path="/" element={<Layout chats={chats} setChats={setChats} />} />
          <Route path="/c/:sessionId" element={<Layout chats={chats} setChats={setChats} />} />
          <Route path="/dashboard" element={<Layout chats={chats} setChats={setChats} />} />
          <Route path="/payment/callback" element={<PaymentCallback />} />
        </Routes>
        <LoginModal />
        <ToastContainer 
          position="top-right" 
          autoClose={2000} 
          style={{ zIndex: 999999 }}
          toastStyle={{ zIndex: 999999 }}
        />
      </LoginModalProvider>
    </ThemeProvider>
  );
}

export default App;