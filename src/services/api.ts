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
      console.log('Sending OTP request to:', `/api/auth/sendotp`);
      console.log('Request payload:', { mobile });

      const response = await fetch(`/api/auth/sendotp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mobile }),
        credentials: 'include',
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response data:', errorData);
        throw new Error(errorData.message || 'Failed to send OTP');
      }

      console.log('OTP sent successfully');
      return { success: true, message: 'OTP sent successfully' };
    } catch (error: any) {
      console.error('Error in sendOTP:', error.message);
      throw new Error(error.message || 'Failed to send OTP');
    }
  },

  // Verify OTP
  async verifyOTP(mobile: string, otp: string): Promise<LoginResponse & { profile?: any }> {
    try {
      const response = await fetch(`/api/auth/verifyotp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, otp: parseInt(otp, 10), deviceId: 'web' }),
        credentials: 'include',
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to verify OTP');

      console.log('OTP verification successful, received data:', data);

      // Wait a moment for cookies to be set, then fetch profile
      setTimeout(async () => {
        try {
          console.log('Fetching user profile after successful OTP verification...');
          const profileResp = await fetch(`/api/auth/profile`, {
            method: 'GET',
            credentials: 'include',
          });
          
          if (profileResp.ok) {
            const profile = await profileResp.json();
            console.log('Profile fetched successfully:', profile);
            
            // Store user data in localStorage
            const userObj = {
              id: profile.id || profile.user_id || data.user?.id,
              mobile: profile.mobile || profile.phone || data.user?.mobile || mobile,
              name: profile.name || data.user?.name || null
            };
            
            console.log('Storing user object:', userObj);
            localStorage.setItem('user', JSON.stringify(userObj));
            
            // Set a flag to indicate we have valid authentication
            localStorage.setItem('auth_validated', 'true');
            
            // Trigger storage event to update auth state
            window.dispatchEvent(new Event('storage'));
            window.dispatchEvent(new CustomEvent('auth:success'));
            
          } else {
            console.error('Failed to fetch profile:', profileResp.status);
            // If profile fetch fails but OTP was successful, store basic user data
            if (data.user) {
              const fallbackUserObj = {
                id: data.user.id,
                mobile: data.user.mobile || data.user.phone || mobile,
                name: data.user.name || null
              };
              console.log('Storing fallback user object:', fallbackUserObj);
              localStorage.setItem('user', JSON.stringify(fallbackUserObj));
              localStorage.setItem('auth_validated', 'true');
              window.dispatchEvent(new Event('storage'));
              window.dispatchEvent(new CustomEvent('auth:success'));
            }
          }
        } catch (profileError) {
          console.error('Error fetching profile:', profileError);
          // Fallback: store user data from verifyOTP response
          if (data.user) {
            const fallbackUserObj = {
              id: data.user.id,
              mobile: data.user.mobile || data.user.phone || mobile,
              name: data.user.name || null
            };
            console.log('Storing fallback user object after error:', fallbackUserObj);
            localStorage.setItem('user', JSON.stringify(fallbackUserObj));
            localStorage.setItem('auth_validated', 'true');
            window.dispatchEvent(new Event('storage'));
            window.dispatchEvent(new CustomEvent('auth:success'));
          }
        }
      }, 300);

      return { ...data, profile: data.user };
    } catch (error: any) {
      console.error('Error in verifyOTP:', error.message);
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
      console.error('Error in resendOTP:', error.message);
      throw new Error(error.message || 'Failed to resend OTP');
    }
  },

  // Logout
  async logout(): Promise<void> {
    try {
      const response = await fetch(`/api/auth/logout`, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Logout failed');
      }
      
      // Clear all auth-related items from localStorage
      localStorage.removeItem('user');
      localStorage.removeItem('sessionId');
      localStorage.removeItem('auth_validated');
      
    } catch (error) {
      console.error('Error in logout:', (error as any).message);
    } finally {
      // Ensure data is cleared even if request fails
      this.clearAuth();
    }
  },

  // Get Profile with proper user data storage
  async getProfile(): Promise<any> {
    try {
      const response = await fetch(`/api/auth/profile`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Session expired');
        }
        throw new Error('Failed to get profile');
      }

      const profile = await response.json();
      console.log('Profile data received:', profile);
      
      // Store/update user data whenever profile is fetched
      const userObj = {
        id: profile.id || profile.user_id,
        mobile: profile.mobile || profile.phone,
        name: profile.name || null
      };
      
      if (userObj.id && userObj.mobile) {
        console.log('Updating user data from profile:', userObj);
        localStorage.setItem('user', JSON.stringify(userObj));
        localStorage.setItem('auth_validated', 'true');
      }

      return profile;
    } catch (error: any) {
      console.error('Error in getProfile:', error.message);
      if (error.message === 'Session expired') {
        this.clearAuth();
      }
      throw new Error(error.message || 'Failed to get profile');
    }
  },

  // Clear Authentication Data
  clearAuth() {
    localStorage.removeItem('user');
    localStorage.removeItem('sessionId');
    localStorage.removeItem('auth_validated');
  },

  // Get User from LocalStorage
  getUser() {
    const userStr = localStorage.getItem('user');
    try {
      const user = userStr ? JSON.parse(userStr) : null;
      console.log('[authService.getUser] User data:', user ? { id: user.id, mobile: user.mobile } : null);
      return user;
    } catch (error) {
      console.error('Error parsing user data:', error);
      localStorage.removeItem('user'); // Remove corrupted data
      return null;
    }
  },

  // Check if user is authenticated (using auth validation flag instead of cookies)
  isAuthenticated(): boolean {
    const user = this.getUser();
    const authValidated = localStorage.getItem('auth_validated') === 'true';
    
    const result = !!(user && user.id && authValidated);
    
    console.log('[authService.isAuthenticated] Authentication check result:', {
      hasUser: !!user,
      userId: user?.id,
      userMobile: user?.mobile,
      authValidated: authValidated,
      isAuthenticated: result
    });
    
    return result;
  },

  // Test if we can make authenticated requests (since we can't read HttpOnly cookies)
  async testAuthentication(): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'GET',
        credentials: 'include',
      });
      
      return response.ok;
    } catch (error) {
      console.error('Auth test failed:', error);
      return false;
    }
  },

  // Refresh Token
  async refreshToken(): Promise<boolean> {
    try {
      console.log('Attempting to refresh token...');
      const refreshResponse = await fetch('/api/auth/refresh-token', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (refreshResponse.ok) {
        console.log('Token refreshed successfully');
        return true;
      } else {
        console.log('Token refresh failed:', refreshResponse.status);
        return false;
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      return false;
    }
  },

  // Generic Fetch with Automatic Token Refresh
  async fetchWithRefresh(url: string, opts: RequestInit = {}): Promise<Response> {
    // Ensure we always include credentials
    const options = { ...opts, credentials: 'include' as RequestCredentials };
    
    // First attempt
    let response = await fetch(url, options);

    // Check if the token was expired
    if (response.status === 401) {
      console.log('Access token expired, attempting to refresh...');
      
      // Try to refresh the token
      const refreshed = await this.refreshToken();
      
      if (refreshed) {
        console.log('Token refreshed, retrying original request...');
        // Retry the original request with the new token
        response = await fetch(url, options);
        
        // If still 401 after refresh, clear auth
        if (response.status === 401) {
          console.log('Still unauthorized after token refresh, clearing auth...');
          this.clearAuth();
          window.dispatchEvent(new CustomEvent('auth:required'));
          return Promise.reject(new Error('Session expired'));
        }
      } else {
        console.log('Token refresh failed, clearing auth state...');
        this.clearAuth();
        // Trigger login modal instead of page reload
        window.dispatchEvent(new CustomEvent('auth:required'));
        return Promise.reject(new Error('Session expired'));
      }
    }

    return response;
  },

  // Initialize authentication check with HttpOnly cookies
  async initializeAuth(): Promise<boolean> {
    console.log('[authService.initializeAuth] Starting initialization...');
    
    const user = this.getUser();
    const authValidated = localStorage.getItem('auth_validated') === 'true';

    console.log('[authService.initializeAuth] Initial check:', {
      hasUser: !!user,
      userId: user?.id,
      userMobile: user?.mobile,
      authValidated: authValidated
    });

    // If we have user data and auth validation flag, test if we're still authenticated
    if (user && user.id && authValidated) {
      console.log('[authService.initializeAuth] Testing authentication with server...');
      const isValid = await this.testAuthentication();
      
      if (isValid) {
        console.log('[authService.initializeAuth] Authentication test passed - user authenticated');
        return true;
      } else {
        console.log('[authService.initializeAuth] Authentication test failed - clearing auth');
        this.clearAuth();
        return false;
      }
    }

    // If we have no user data but want to test for existing session
    if (!user && !authValidated) {
      console.log('[authService.initializeAuth] No local auth data, testing for existing session...');
      const isValid = await this.testAuthentication();
      
      if (isValid) {
        console.log('[authService.initializeAuth] Found valid session, fetching profile...');
        try {
          await this.getProfile();
          const updatedUser = this.getUser();
          if (updatedUser && updatedUser.id) {
            console.log('[authService.initializeAuth] Profile fetched successfully - user authenticated');
            return true;
          }
        } catch (error) {
          console.error('[authService.initializeAuth] Failed to fetch profile despite valid session:', error);
        }
      }
    }

    console.log('[authService.initializeAuth] User not authenticated');
    return false;
  },
};

// Utility function for making authenticated API calls with automatic token refresh
export async function apiCall(url: string, options: RequestInit = {}): Promise<Response> {
  return authService.fetchWithRefresh(url, options);
}

// Utility function for making authenticated API calls and parsing JSON response
export async function apiCallJson<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await authService.fetchWithRefresh(url, options);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(errorData.message || `Request failed with status ${response.status}`);
  }
  
  return response.json();
}