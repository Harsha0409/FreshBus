import React, { createContext, useContext, useState, useEffect } from 'react';

interface LoginModalContextType {
    isOpen: boolean;
    onOpen: () => void;
    onClose: () => void;
}

const LoginModalContext = createContext<LoginModalContextType | undefined>(undefined);

interface LoginModalProviderProps {
  children: React.ReactNode;
  initialOpen?: boolean;
}

export const LoginModalProvider: React.FC<LoginModalProviderProps> = ({ children, initialOpen = false }) => {
  const [isOpen, setIsOpen] = useState(initialOpen);
  
  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('access_token');
    const user = localStorage.getItem('user');
    
    // Close modal if user is authenticated
    if (token && user) {
      setIsOpen(false);
    }
  }, []); // Empty dependency array means this runs once on mount

  const onOpen = () => setIsOpen(true);
  const onClose = () => setIsOpen(false);

  return (
    <LoginModalContext.Provider value={{ isOpen, onOpen, onClose }}>
      {children}
    </LoginModalContext.Provider>
  );
};

export function useLoginModal() {
    const context = useContext(LoginModalContext);
    if (context === undefined) {
        throw new Error('useLoginModal must be used within a LoginModalProvider');
    }
    return context;
}
