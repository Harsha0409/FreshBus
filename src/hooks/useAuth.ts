// hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export const useAuth = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const checkAuth = () => {
            const token = localStorage.getItem('access_token');
            const user = localStorage.getItem('user');
            const isValid = !!token && !!user;
            setIsAuthenticated(isValid);
            
            // Handle session-related navigation
            if (isValid) {
                const sessionId = localStorage.getItem('sessionId');
                const isHomePage = location.pathname === '/';
                
                // If user is at homepage and has a session, redirect to that session
                if (isHomePage && sessionId) {
                    navigate(`/c/${sessionId}`);
                }
            } else {
                // If not authenticated but trying to access a session URL, redirect to home
                if (location.pathname.startsWith('/c/')) {
                    navigate('/', { replace: true });
                }
            }
        };

        // Check immediately
        checkAuth();

        // Listen for storage changes
        window.addEventListener('storage', checkAuth);

        return () => {
            window.removeEventListener('storage', checkAuth);
        };
    }, [navigate, location.pathname]);

    return isAuthenticated;
};
