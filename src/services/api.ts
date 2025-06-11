const BASE_URL_CUSTOMER = '/api';
console.log('BASE_URL_CUSTOMER:', BASE_URL_CUSTOMER);

interface LoginResponse {
  token: string;
  user: {
    id: string;
    name: string;
    mobile: string;
  };
}

export const authService = {
  // Send OTP
  async sendOTP(mobile: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log('[sendOTP] Sending OTP request');

      const response = await fetch(`/api/auth/sendotp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mobile }),
        credentials: 'include',
      });

      console.log('[sendOTP] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send OTP');
      }

      console.log('[sendOTP] OTP sent successfully');
      return { success: true, message: 'OTP sent successfully' };
    } catch (error: any) {
      console.error('[sendOTP] Error:', error.message);
      throw new Error(error.message || 'Failed to send OTP');
    }
  },

  // Verify OTP
  async verifyOTP(mobile: string, otp: string): Promise<LoginResponse & { profile?: any }> {
    try {
      console.log('[verifyOTP] Verifying OTP for mobile:', mobile);
      
      const response = await fetch(`/api/auth/verifyotp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, otp: parseInt(otp, 10), deviceId: 'web' }),
        credentials: 'include',
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to verify OTP');

      console.log('[verifyOTP] ✅ OTP verification successful');

      // Wait for HttpOnly cookies to be set by browser, then fetch profile
      setTimeout(async () => {
        try {
          console.log('[verifyOTP] Fetching user profile...');
          const profileResp = await fetch(`/api/auth/profile`, {
            method: 'GET',
            credentials: 'include', // This will send the HttpOnly cookies
          });
          
          if (profileResp.ok) {
            const profile = await profileResp.json();
            console.log('[verifyOTP] ✅ Profile fetched successfully');
            
            // Store user data in localStorage
            const userObj = {
              id: profile.id || profile.user_id || data.user?.id,
              mobile: profile.mobile || profile.phone || data.user?.mobile || mobile,
              name: profile.name || data.user?.name || null
            };
            
            console.log('[verifyOTP] Storing user data:', { id: userObj.id, mobile: userObj.mobile });
            localStorage.setItem('user', JSON.stringify(userObj));
            localStorage.setItem('auth_validated', 'true');
            
            // Trigger auth success events
            window.dispatchEvent(new Event('storage'));
            window.dispatchEvent(new CustomEvent('auth:success'));
            
          } else {
            console.warn('[verifyOTP] Profile fetch failed, using fallback data');
            // Store basic user data as fallback
            if (data.user) {
              const fallbackUserObj = {
                id: data.user.id,
                mobile: data.user.mobile || data.user.phone || mobile,
                name: data.user.name || null
              };
              localStorage.setItem('user', JSON.stringify(fallbackUserObj));
              localStorage.setItem('auth_validated', 'true');
              window.dispatchEvent(new Event('storage'));
              window.dispatchEvent(new CustomEvent('auth:success'));
            }
          }
        } catch (profileError) {
          console.error('[verifyOTP] Profile fetch error, using fallback:', profileError);
          // Fallback: store user data from verifyOTP response
          if (data.user) {
            const fallbackUserObj = {
              id: data.user.id,
              mobile: data.user.mobile || data.user.phone || mobile,
              name: data.user.name || null
            };
            localStorage.setItem('user', JSON.stringify(fallbackUserObj));
            localStorage.setItem('auth_validated', 'true');
            window.dispatchEvent(new Event('storage'));
            window.dispatchEvent(new CustomEvent('auth:success'));
          }
        }
      }, 300);

      return { ...data, profile: data.user };
    } catch (error: any) {
      console.error('[verifyOTP] Error:', error.message);
      throw new Error(error.message || 'Failed to verify OTP');
    }
  },

  // Resend OTP
  async resendOTP(mobile: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`/api/auth/resendotp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mobile }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to resend OTP');
      }

      return { success: true, message: 'OTP resent successfully' };
    } catch (error: any) {
      console.error('[resendOTP] Error:', error.message);
      throw new Error(error.message || 'Failed to resend OTP');
    }
  },

  // Logout
  async logout(): Promise<void> {
    try {
      console.log('[logout] Logging out...');
      
      const response = await fetch(`/api/auth/logout`, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        console.warn('[logout] Server logout failed, clearing local data anyway');
      } else {
        console.log('[logout] ✅ Server logout successful');
      }
      
    } catch (error) {
      console.error('[logout] Error:', (error as any).message);
    } finally {
      // Always clear local auth data
      this.clearAuth();
    }
  },

  // Get Profile
  async getProfile(): Promise<any> {
    try {
      console.log('[getProfile] Fetching profile...');
      
      const response = await fetch(`/api/auth/profile`, {
        method: 'GET',
        credentials: 'include', // HttpOnly cookies sent automatically
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.log('[getProfile] 401 - Session expired');
          throw new Error('Session expired');
        }
        throw new Error(`Profile fetch failed: ${response.status}`);
      }

      const profile = await response.json();
      console.log('[getProfile] ✅ Profile received');
      
      // Store/update user data
      const userObj = {
        id: profile.id || profile.user_id,
        mobile: profile.mobile || profile.phone,
        name: profile.name || null
      };
      
      if (userObj.id && userObj.mobile) {
        localStorage.setItem('user', JSON.stringify(userObj));
        localStorage.setItem('auth_validated', 'true');
      }

      return profile;
    } catch (error: any) {
      console.error('[getProfile] Error:', error.message);
      if (error.message === 'Session expired') {
        this.clearAuth();
      }
      throw error;
    }
  },

  // Clear Authentication Data
  clearAuth() {
    console.log('[clearAuth] Clearing local authentication data');
    localStorage.removeItem('user');
    localStorage.removeItem('sessionId');
    localStorage.removeItem('auth_validated');
  },

  // Get User from LocalStorage
  getUser() {
    const userStr = localStorage.getItem('user');
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('[getUser] Error parsing user data:', error);
      localStorage.removeItem('user');
      return null;
    }
  },

  // Check if user is authenticated (based on localStorage, not cookies)
  isAuthenticated(): boolean {
    const user = this.getUser();
    const authValidated = localStorage.getItem('auth_validated') === 'true';
    const result = !!(user && user.id && authValidated);
    
    console.log('[isAuthenticated]', result ? '✅ Authenticated' : '❌ Not authenticated');
    return result;
  },

  // Test authentication by making a server request
  async testAuthentication(): Promise<boolean> {
    try {
      console.log('[testAuthentication] Testing with server...');
      
      const response = await fetch('/api/auth/profile', {
        method: 'GET',
        credentials: 'include', // HttpOnly cookies sent automatically
      });
      
      const isValid = response.ok;
      console.log('[testAuthentication]', isValid ? '✅ Server confirmed auth' : '❌ Server rejected auth');
      return isValid;
    } catch (error) {
      console.error('[testAuthentication] Error:', error);
      return false;
    }
  },

  // Refresh token
  async refreshToken(): Promise<boolean> {
    try {
      console.log('[refreshToken] Attempting token refresh...');
      
      const refreshResponse = await fetch('/api/auth/refresh-token', {
        method: 'POST',
        credentials: 'include', // Sends refresh_token cookie
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const success = refreshResponse.ok;
      console.log('[refreshToken]', success ? '✅ Token refreshed' : '❌ Refresh failed');

      return success;
    } catch (error) {
      console.error('[refreshToken] Error:', error);
      return false;
    }
  },

  // Fetch with automatic token refresh
  async fetchWithRefresh(url: string, opts: RequestInit = {}): Promise<Response> {
    console.log(`[fetchWithRefresh] ${opts.method || 'GET'} ${url}`);
    
    // Ensure credentials are included to send HttpOnly cookies
    const options: RequestInit = { 
      ...opts, 
      credentials: 'include',
      headers: {
        ...opts.headers,
      }
    };
    
    // First attempt
    let response = await fetch(url, options);
    console.log(`[fetchWithRefresh] Status: ${response.status}`);

    // Handle 401 (unauthorized) - token expired
    if (response.status === 401) {
      console.log('[fetchWithRefresh] 401 received, attempting token refresh...');
      
      const refreshed = await this.refreshToken();
      
      if (refreshed) {
        console.log('[fetchWithRefresh] Retrying original request...');
        response = await fetch(url, options);
        console.log(`[fetchWithRefresh] Retry status: ${response.status}`);
        
        if (response.status === 401) {
          console.log('[fetchWithRefresh] Still 401 after refresh - session truly expired');
          this.clearAuth();
          window.dispatchEvent(new CustomEvent('auth:required'));
          throw new Error('Session expired');
        }
      } else {
        console.log('[fetchWithRefresh] Refresh failed - clearing auth');
        this.clearAuth();
        window.dispatchEvent(new CustomEvent('auth:required'));
        throw new Error('Session expired');
      }
    }

    return response;
  },

  // Initialize authentication
  async initializeAuth(): Promise<boolean> {
    console.log('[initializeAuth] 🔍 Checking authentication...');
    
    const user = this.getUser();
    const authValidated = localStorage.getItem('auth_validated') === 'true';

    console.log('[initializeAuth] Local state:', {
      hasUser: !!user,
      userId: user?.id,
      authValidated: authValidated
    });

    // If we have user data and validation flag, test with server
    if (user && user.id && authValidated) {
      console.log('[initializeAuth] Testing existing authentication with server...');
      const isValid = await this.testAuthentication();
      
      if (isValid) {
        console.log('[initializeAuth] ✅ Authentication confirmed by server');
        return true;
      } else {
        console.log('[initializeAuth] ❌ Server rejected auth, clearing local data');
        this.clearAuth();
        return false;
      }
    }

    // If no local data, test for existing server session
    if (!user && !authValidated) {
      console.log('[initializeAuth] No local data, checking for existing server session...');
      const isValid = await this.testAuthentication();
      
      if (isValid) {
        console.log('[initializeAuth] Found valid server session, restoring user data...');
        try {
          await this.getProfile();
          const updatedUser = this.getUser();
          if (updatedUser && updatedUser.id) {
            console.log('[initializeAuth] ✅ Session restored successfully');
            return true;
          }
        } catch (error) {
          console.error('[initializeAuth] Failed to restore session:', error);
        }
      }
    }

    console.log('[initializeAuth] ❌ No valid authentication found');
    return false;
  },
};

// Utility functions for making authenticated API calls
export async function apiCall(url: string, options: RequestInit = {}): Promise<Response> {
  return authService.fetchWithRefresh(url, options);
}

export async function apiCallJson<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await authService.fetchWithRefresh(url, options);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(errorData.message || `Request failed with status ${response.status}`);
  }
  
  return response.json();
}