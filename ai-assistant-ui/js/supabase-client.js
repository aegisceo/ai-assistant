/**
 * Supabase Client for Frontend Authentication
 * Handles user authentication and session management
 */

class SupabaseClient {
    constructor() {
        // Supabase configuration from environment
        this.supabaseUrl = 'https://cmbnexhzuoydobsevplb.supabase.co';
        this.supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtYm5leGh6dW95ZG9ic2V2cGxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTQ1NzQsImV4cCI6MjA3MjI5MDU3NH0.FYb6K3iP4WwHqySsN-EIxL11apPUXk0GwH7fWyF7JpY';
        
        this.currentUser = null;
        this.session = null;
        this.isInitialized = false;
        
        // Initialize Supabase if available globally
        if (typeof window.supabase !== 'undefined') {
            this.client = window.supabase.createClient(this.supabaseUrl, this.supabaseAnonKey);
        } else {
            console.warn('Supabase not loaded. Loading via CDN...');
            this.loadSupabaseLibrary().then(() => {
                this.client = window.supabase.createClient(this.supabaseUrl, this.supabaseAnonKey);
                this.initialize();
            });
        }
    }

    /**
     * Load Supabase library from CDN
     */
    async loadSupabaseLibrary() {
        return new Promise((resolve, reject) => {
            if (typeof window.supabase !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://unpkg.com/@supabase/supabase-js@2';
            script.onload = () => {
                console.log('✅ Supabase library loaded');
                resolve();
            };
            script.onerror = () => {
                console.error('❌ Failed to load Supabase library');
                reject(new Error('Failed to load Supabase'));
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Initialize authentication
     */
    async initialize() {
        if (this.isInitialized) return;

        try {
            // Get initial session
            const { data: { session }, error } = await this.client.auth.getSession();
            
            if (error) {
                console.error('Supabase session error:', error);
                return;
            }

            this.session = session;
            this.currentUser = session?.user || null;

            // Listen for auth changes
            this.client.auth.onAuthStateChange((event, session) => {
                console.log('🔐 Auth state changed:', event);
                this.session = session;
                this.currentUser = session?.user || null;
                
                // Notify the app about auth changes
                this.notifyAuthChange(event, session);
            });

            this.isInitialized = true;
            console.log('✅ Supabase authentication initialized');
            
            if (this.currentUser) {
                console.log('👤 User already authenticated:', this.currentUser.email);
            }

        } catch (error) {
            console.error('❌ Supabase initialization failed:', error);
        }
    }

    /**
     * Sign in with email/password
     */
    async signInWithEmail(email, password) {
        try {
            const { data, error } = await this.client.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            return { success: true, user: data.user, session: data.session };
        } catch (error) {
            console.error('Sign in error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Sign up with email/password
     */
    async signUpWithEmail(email, password) {
        try {
            const { data, error } = await this.client.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: `${window.location.origin}`
                }
            });

            if (error) throw error;

            return { success: true, user: data.user, session: data.session };
        } catch (error) {
            console.error('Sign up error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Sign out
     */
    async signOut() {
        try {
            const { error } = await this.client.auth.signOut();
            if (error) throw error;

            this.session = null;
            this.currentUser = null;

            return { success: true };
        } catch (error) {
            console.error('Sign out error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get current user
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Get current session
     */
    getCurrentSession() {
        return this.session;
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!(this.session && this.currentUser);
    }

    /**
     * Get access token for API calls
     */
    getAccessToken() {
        return this.session?.access_token || null;
    }

    /**
     * Notify app about authentication changes
     */
    notifyAuthChange(event, session) {
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('supabase-auth-change', {
            detail: { event, session, user: session?.user || null }
        }));
    }

    /**
     * Make authenticated API request
     */
    async makeAuthenticatedRequest(url, options = {}) {
        const token = this.getAccessToken();
        
        if (!token) {
            throw new Error('User not authenticated');
        }

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers
        };

        return fetch(url, { ...options, headers });
    }
}

// Create global Supabase client instance
window.supabaseClient = new SupabaseClient();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SupabaseClient;
}