import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';

interface LoginModalContextType {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

const LoginModalContext = createContext<LoginModalContextType | undefined>(undefined);

export function LoginModalProvider({ 
  children, 
  initialOpen = false 
}: { 
  children: React.ReactNode;
  initialOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(initialOpen);

  useEffect(() => {
    // Listen for custom login required events
    const handleLoginRequired = () => {
      setIsOpen(true);
    };

    const handleAuthRequired = () => {
      setIsOpen(true);
    };

    window.addEventListener('login:required', handleLoginRequired);
    window.addEventListener('auth:required', handleAuthRequired);
    
    return () => {
      window.removeEventListener('login:required', handleLoginRequired);
      window.removeEventListener('auth:required', handleAuthRequired);
    };
  }, []);

  useEffect(() => {
    // Check auth status on mount only if initialOpen is true
    if (initialOpen) {
      const checkInitialAuth = async () => {
        try {
          const isAuthenticated = await authService.initializeAuth();
          if (!isAuthenticated) {
            setIsOpen(true);
          } else {
            setIsOpen(false);
          }
        } catch (error) {
          console.error('Error checking initial auth:', error);
          setIsOpen(true);
        }
      };

      checkInitialAuth();
    }
  }, [initialOpen]);

  const onOpen = () => setIsOpen(true);
  const onClose = () => setIsOpen(false);

  return (
    <LoginModalContext.Provider value={{ isOpen, onOpen, onClose }}>
      {children}
    </LoginModalContext.Provider>
  );
}

export function useLoginModal() {
  const context = useContext(LoginModalContext);
  if (context === undefined) {
    throw new Error('useLoginModal must be used within a LoginModalProvider');
  }
  return context;
}