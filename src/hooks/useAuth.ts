import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/api';

export const useAuth = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        let isMounted = true;

        const initializeAuth = async () => {
            if (!isMounted) return;
            
            console.log('[useAuth] Starting auth initialization on page load');
            setIsLoading(true);
            
            try {
                // Perform authentication check (this will test the server)
                const authenticated = await authService.initializeAuth();
                
                if (!isMounted) return;
                
                console.log('[useAuth] Auth initialization result:', authenticated);
                setIsAuthenticated(authenticated);
                
                // Handle navigation after auth check
                if (authenticated) {
                    const sessionId = localStorage.getItem('sessionId');
                    const isHomePage = location.pathname === '/';
                    
                    if (isHomePage && sessionId) {
                        console.log('[useAuth] Redirecting to existing session:', sessionId);
                        navigate(`/c/${sessionId}`, { replace: true });
                    }
                } else {
                    if (location.pathname.startsWith('/c/')) {
                        console.log('[useAuth] Not authenticated, redirecting to home');
                        navigate('/', { replace: true });
                    }
                }
            } catch (error) {
                console.error('Auth initialization error:', error);
                if (isMounted) {
                    setIsAuthenticated(false);
                }
            } finally {
                if (isMounted) {
                    console.log('[useAuth] Auth initialization complete');
                    setIsLoading(false);
                }
            }
        };

        // Initialize auth check
        initializeAuth();

        // Listen for storage changes (user data updates)
        const handleStorageChange = () => {
            if (!isMounted) return;
            
            console.log('[useAuth] Storage change detected, re-checking auth');
            const authenticated = authService.isAuthenticated();
            console.log('[useAuth] Storage change auth result:', authenticated);
            setIsAuthenticated(authenticated);
        };

        // Listen for custom auth events
        const handleAuthRequired = () => {
            if (!isMounted) return;
            
            console.log('[useAuth] Auth required event received');
            setIsAuthenticated(false);
            window.dispatchEvent(new CustomEvent('login:required'));
        };

        // Listen for successful auth events
        const handleAuthSuccess = async () => {
            if (!isMounted) return;
            
            console.log('[useAuth] Auth success event received');
            // Small delay to ensure everything is processed
            setTimeout(async () => {
                if (!isMounted) return;
                
                try {
                    const authenticated = await authService.initializeAuth();
                    if (isMounted) {
                        console.log('[useAuth] Authentication status updated after success:', authenticated);
                        setIsAuthenticated(authenticated);
                        setIsLoading(false);
                    }
                } catch (error) {
                    console.error('[useAuth] Error re-checking auth after success:', error);
                    if (isMounted) {
                        setIsLoading(false);
                    }
                }
            }, 500);
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('auth:required', handleAuthRequired);
        window.addEventListener('auth:success', handleAuthSuccess);

        return () => {
            isMounted = false;
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('auth:required', handleAuthRequired);
            window.removeEventListener('auth:success', handleAuthSuccess);
        };
    }, [navigate, location.pathname]);

    return { isAuthenticated, isLoading };
};