import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { LoginModalProvider } from './context/loginModalContext';
import Layout from './components/Layout';
import PaymentCallback from './components/PaymentCallback';
import LoginModal from './components/LoginModal';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Chat } from './types/chat';
import { useAuth } from './hooks/useAuth';

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

  return (
    <BrowserRouter>
      <AppContent chats={chats} setChats={setChats} />
    </BrowserRouter>
  );
}

function AppContent({ chats, setChats }: { chats: Chat[]; setChats: React.Dispatch<React.SetStateAction<Chat[]>> }) {
  const isAuthenticated = useAuth(); // Now useAuth is used within Router context

  return (
    <ThemeProvider>
      <LoginModalProvider initialOpen={!isAuthenticated}>
        <Routes>
          <Route path="/" element={<Layout chats={chats} setChats={setChats} />} />
          <Route path="/c/:sessionId" element={<Layout chats={chats} setChats={setChats} />} />
          <Route path="/dashboard" element={<Layout chats={chats} setChats={setChats} />} />
          <Route path="/payment/callback" element={<PaymentCallback />} />
        </Routes>
        <LoginModal />
        <ToastContainer position="top-right" autoClose={2000} />
      </LoginModalProvider>
    </ThemeProvider>
  );
}

export default App;