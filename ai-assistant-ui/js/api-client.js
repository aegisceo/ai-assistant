/**
 * API Client - Handles all communication with the Next.js backend
 * Connects the elegant UI to our AI Assistant functionality
 */

class ApiClient {
    constructor(baseUrl = 'http://localhost:3000') {
        this.baseUrl = baseUrl;
        this.user = null;
        this.accessToken = null;
        this.backendAvailable = null; // null = unknown, true/false = checked
    }

    /**
     * Check if backend server is available
     */
    async checkBackendHealth() {
        try {
            const response = await fetch(`${this.baseUrl}/api/health`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                // Quick timeout for health check
                signal: AbortSignal.timeout(3000)
            });
            
            this.backendAvailable = response.ok;
            return this.backendAvailable;
        } catch (error) {
            this.backendAvailable = false;
            return false;
        }
    }

    /**
     * Make authenticated API request
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            credentials: 'include', // Include cookies for Supabase auth
            ...options,
        };

        // Try to get Supabase session token
        if (window.supabaseClient && window.supabaseClient.isAuthenticated()) {
            const token = window.supabaseClient.getAccessToken();
            if (token) {
                config.headers['Authorization'] = `Bearer ${token}`;
            }
        } else if (this.accessToken) {
            // Fallback to stored access token
            config.headers['Authorization'] = `Bearer ${this.accessToken}`;
        }

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Request failed:', error);
            
            // Detect different types of errors for better user messaging
            let errorMessage = error.message;
            let errorCode = 'API_ERROR';
            
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                errorCode = 'NETWORK_ERROR';
                errorMessage = 'Backend server not available. Running in demo mode.';
            } else if (error.message.includes('Failed to fetch')) {
                errorCode = 'BACKEND_UNAVAILABLE';
                errorMessage = 'Cannot connect to backend server (localhost:3000)';
            } else if (error.message.includes('CORS')) {
                errorCode = 'CORS_ERROR';
                errorMessage = 'Backend server found but CORS not configured';
            }
            
            // Return a structured error response for better handling
            return {
                success: false,
                error: errorMessage,
                code: errorCode,
                originalError: error.message
            };
        }
    }

    // Gmail Integration
    async getGmailStatus() {
        return this.request('/api/gmail/status');
    }

    async connectGmail() {
        const response = await this.request('/api/gmail/auth');
        if (response.authUrl) {
            window.location.href = response.authUrl;
        }
        return response;
    }

    async disconnectGmail() {
        return this.request('/api/gmail/status', { method: 'DELETE' });
    }

    async getGmailAccounts() {
        return this.request('/api/gmail/accounts');
    }

    async addGmailAccount(accountLabel) {
        return this.request('/api/gmail/accounts', {
            method: 'POST',
            body: JSON.stringify({ account_label: accountLabel })
        });
    }

    async removeGmailAccount(accountEmail) {
        return this.request('/api/gmail/accounts', {
            method: 'DELETE',
            body: JSON.stringify({ account_email: accountEmail })
        });
    }

    async getEmails(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.request(`/api/gmail/emails?${params}`);
    }

    async getSmartFilteredEmails(options = {}) {
        const params = new URLSearchParams(options);
        return this.request(`/api/emails/smart-filter?${params}`);
    }

    // AI Classification
    async classifyEmail(emailId) {
        return this.request('/api/classify/email', {
            method: 'POST',
            body: JSON.stringify({ emailId })
        });
    }

    async batchClassifyEmails(emailIds) {
        return this.request('/api/classify/batch', {
            method: 'POST',
            body: JSON.stringify({ emailIds })
        });
    }

    // Calendar Integration
    async getCalendarEvents(options = {}) {
        const params = new URLSearchParams(options);
        return this.request(`/api/calendar/events?${params}`);
    }

    async detectMeetings(emails) {
        return this.request('/api/calendar/detect-meetings', {
            method: 'POST',
            body: JSON.stringify({ emails })
        });
    }

    // Notifications
    async getUrgentNotifications(options = {}) {
        const params = new URLSearchParams(options);
        return this.request(`/api/notifications/urgent?${params}`);
    }

    // Dashboard Priority Items
    async getPriorityItems(options = {}) {
        const params = new URLSearchParams(options);
        return this.request(`/api/dashboard/priority-items?${params}`);
    }

    // Feedback
    async submitFeedback(feedbackData) {
        return this.request('/api/feedback/classification', {
            method: 'POST',
            body: JSON.stringify(feedbackData)
        });
    }
}

// Create global API client instance
window.apiClient = new ApiClient();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiClient;
}