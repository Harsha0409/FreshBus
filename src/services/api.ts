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

// Simplified global state - no more testAuth
let profileCache: { data: any; timestamp: number } | null = null;
let profileRequestInProgress = false;
let refreshTokenRequestInProgress = false;

const PROFILE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const PROFILE_REQUEST_THROTTLE = 2000; // 2 seconds between requests

// Simplified request queues
const requestQueues = {
  profile: [] as Array<{ resolve: Function; reject: Function }>,
  refreshToken: [] as Array<{ resolve: Function; reject: Function }>
};

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

      // Clear any existing cache since we have new authentication
      profileCache = null;
      profileRequestInProgress = false;
      refreshTokenRequestInProgress = false;

      // Wait for HttpOnly cookies to be set, then fetch profile ONCE
      setTimeout(async () => {
        try {
          console.log('[verifyOTP] Fetching user profile after login...');
          const profile = await this.getProfile(true); // Force fetch, bypass cache
          
          if (profile) {
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
      
      // Clear cache and reset states
      profileCache = null;
      profileRequestInProgress = false;
      refreshTokenRequestInProgress = false;
      
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
      this.clearAuth();
    }
  },

  // Get Profile with request deduplication
  async getProfile(forceRefresh: boolean = false): Promise<any> {
    // Return cached data if available and not forcing refresh
    if (!forceRefresh && profileCache && Date.now() - profileCache.timestamp < PROFILE_CACHE_DURATION) {
      console.log('[getProfile] ✅ Returning cached profile');
      return profileCache.data;
    }

    // Throttle requests if not forcing refresh
    if (!forceRefresh && profileCache && Date.now() - profileCache.timestamp < PROFILE_REQUEST_THROTTLE) {
      console.log('[getProfile] ⏳ Throttling profile request, using cache');
      return profileCache.data;
    }

    // If request is already in progress, queue this request
    if (profileRequestInProgress) {
      console.log('[getProfile] 📋 Request already in progress, queuing...');
      return new Promise((resolve, reject) => {
        requestQueues.profile.push({ resolve, reject });
      });
    }

    try {
      console.log('[getProfile] 🔄 Fetching fresh profile from server...');
      profileRequestInProgress = true;
      
      const response = await this.fetchWithRefresh('/api/auth/profile', {
        method: 'GET',
      });

      const profile = await response.json();
      console.log('[getProfile] ✅ Fresh profile received');
      
      // Cache the profile
      profileCache = {
        data: profile,
        timestamp: Date.now()
      };
      
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

      // Resolve all queued requests
      requestQueues.profile.forEach(({ resolve }) => resolve(profile));
      requestQueues.profile = [];

      profileRequestInProgress = false;
      return profile;
    } catch (error: any) {
      console.error('[getProfile] Error:', error.message);
      
      // Reject all queued requests
      requestQueues.profile.forEach(({ reject }) => reject(error));
      requestQueues.profile = [];
      
      profileRequestInProgress = false;
      
      if (error.message === 'Session expired' || error.message.includes('Session expired')) {
        this.clearAuth();
        profileCache = null;
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
    profileCache = null;
    profileRequestInProgress = false;
    refreshTokenRequestInProgress = false;
    
    // Clear all queues
    Object.keys(requestQueues).forEach(key => {
      requestQueues[key as keyof typeof requestQueues] = [];
    });
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

  // Check if user is authenticated (only checks localStorage)
  isAuthenticated(): boolean {
    const user = this.getUser();
    const authValidated = localStorage.getItem('auth_validated') === 'true';
    const result = !!(user && user.id && authValidated);
    
    console.log('[isAuthenticated]', result ? '✅ Authenticated' : '❌ Not authenticated');
    return result;
  },

  // Refresh token with request deduplication
  async refreshToken(): Promise<boolean> {
    // If refresh is already in progress, queue this request
    if (refreshTokenRequestInProgress) {
      console.log('[refreshToken] 📋 Refresh already in progress, queuing...');
      return new Promise((resolve, reject) => {
        requestQueues.refreshToken.push({ resolve, reject });
      });
    }

    try {
      console.log('[refreshToken] 🔄 Attempting token refresh...');
      refreshTokenRequestInProgress = true;
      
      const refreshResponse = await fetch('/api/auth/refresh-token', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('[refreshToken] Refresh response status:', refreshResponse.status);

      if (refreshResponse.ok) {
        console.log('[refreshToken] ✅ Token refreshed successfully');
        // Clear cache so next request fetches fresh data with new token
        profileCache = null;
        
        // Resolve all queued requests
        requestQueues.refreshToken.forEach(({ resolve }) => resolve(true));
        requestQueues.refreshToken = [];
        
        refreshTokenRequestInProgress = false;
        return true;
      } else {
        let success = false;
        // Handle specific error codes
        if (refreshResponse.status === 403) {
          console.log('[refreshToken] ❌ 403 Forbidden - Refresh token expired/invalid');
          this.clearAuth();
        } else if (refreshResponse.status === 401) {
          console.log('[refreshToken] ❌ 401 Unauthorized - Refresh token invalid');
          this.clearAuth();
        } else {
          console.log('[refreshToken] ❌ Refresh failed with status:', refreshResponse.status);
        }
        
        // Resolve all queued requests with false
        requestQueues.refreshToken.forEach(({ resolve }) => resolve(success));
        requestQueues.refreshToken = [];
        
        refreshTokenRequestInProgress = false;
        return success;
      }
    } catch (error) {
      console.error('[refreshToken] Error:', error);
      
      // Reject all queued requests
      requestQueues.refreshToken.forEach(({ reject }) => reject(error));
      requestQueues.refreshToken = [];
      
      refreshTokenRequestInProgress = false;
      return false;
    }
  },

  // fetchWithRefresh remains the same
  async fetchWithRefresh(url: string, opts: RequestInit = {}): Promise<Response> {
    console.log(`[fetchWithRefresh] 🚀 ${opts.method || 'GET'} ${url}`);
    
    const options: RequestInit = { 
      ...opts, 
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...opts.headers,
      }
    };
    
    // First attempt
    let response = await fetch(url, options);
    console.log(`[fetchWithRefresh] Initial response: ${response.status}`);

    // Handle 401 (unauthorized) - token might be expired
    if (response.status === 401) {
      console.log('[fetchWithRefresh] 🔑 401 received - attempting token refresh...');
      
      const refreshed = await this.refreshToken();
      
      if (refreshed) {
        console.log('[fetchWithRefresh] 🔄 Token refreshed successfully, retrying original request...');
        response = await fetch(url, options);
        console.log(`[fetchWithRefresh] Retry response: ${response.status}`);
        
        if (response.status === 401) {
          console.log('[fetchWithRefresh] ❌ Still 401 after refresh - session truly expired');
          this.clearAuth();
          window.dispatchEvent(new CustomEvent('auth:required'));
          throw new Error('Session expired - please login again');
        }
      } else {
        console.log('[fetchWithRefresh] ❌ Refresh failed - clearing auth');
        this.clearAuth();
        window.dispatchEvent(new CustomEvent('auth:required'));
        throw new Error('Session expired - please login again');
      }
    }

    return response;
  },

  // Simplified initialization - uses getProfile() directly
  async initializeAuth(): Promise<boolean> {
    console.log('[initializeAuth] 🔍 Checking authentication...');
    
    const user = this.getUser();
    const authValidated = localStorage.getItem('auth_validated') === 'true';

    console.log('[initializeAuth] Local state:', {
      hasUser: !!user,
      userId: user?.id,
      authValidated: authValidated
    });

    // If we have user data and validation flag, test with server using getProfile
    if (user && user.id && authValidated) {
      // Only test with server if cache is old or missing
      if (!profileCache || Date.now() - profileCache.timestamp > PROFILE_CACHE_DURATION) {
        console.log('[initializeAuth] Testing authentication with server...');
        
        try {
          await this.getProfile(); // This will handle token refresh automatically
          console.log('[initializeAuth] ✅ Authentication confirmed');
          return true;
        } catch (error: any) {
          console.error('[initializeAuth] Auth test failed:', error);
          if (error.message.includes('Session expired')) {
            console.log('[initializeAuth] Session expired during test');
            return false;
          }
          this.clearAuth();
          return false;
        }
      } else {
        console.log('[initializeAuth] ✅ Using cached authentication state');
        return true;
      }
    }

    // Only test for existing session if no local data
    if (!user && !authValidated) {
      console.log('[initializeAuth] No local data, testing for existing session...');
      
      try {
        await this.getProfile(true); // Force fetch to test session
        const updatedUser = this.getUser();
        if (updatedUser && updatedUser.id) {
          console.log('[initializeAuth] ✅ Session restored');
          return true;
        }
      } catch (error: any) {
        console.error('[initializeAuth] Session test failed:', error);
        // This is expected if no valid session exists
      }
    }

    console.log('[initializeAuth] ❌ Not authenticated');
    return false;
  },
};

// Utility functions
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