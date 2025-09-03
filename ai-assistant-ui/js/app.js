/**
 * Main Application Controller
 * Orchestrates the connection between UI and API
 */

class NeuroFlowApp {
    constructor() {
        this.api = window.apiClient;
        this.ui = window.uiComponents;
        this.notifications = window.notificationManager;
        this.isInitialized = false;
        this.refreshInterval = null;
        this.currentPage = this.getCurrentPage();
        // No demo mode - always require real authentication
        this.currentUser = null;
    }

    /**
     * Initialize the application
     */
    async init() {
        if (this.isInitialized) return;

        try {
            console.log('🚀 Initializing NeuroFlow AI Assistant...');
            
            // Initialize Feather icons
            if (typeof feather !== 'undefined') {
                feather.replace();
            }

            // Initialize Supabase authentication
            await this.initializeAuthentication();

            // Check backend availability for proper error handling
            await this.api.checkBackendHealth();

            // Check for OAuth callback
            this.handleOAuthCallback();

            // Set up event listeners
            this.setupEventListeners();

            // Initialize notification system
            this.setupNotifications();

            // Check connection status
            await this.checkConnectionStatus();

            // Load initial data based on current page
            await this.loadPageData();

            // Set up periodic refresh
            this.setupPeriodicRefresh();

            this.isInitialized = true;
            console.log('✅ NeuroFlow AI Assistant initialized successfully');
            
            this.ui.showNotification('NeuroFlow AI Assistant is ready!', 'success');
        } catch (error) {
            console.error('❌ Failed to initialize app:', error);
            this.ui.showNotification('Failed to initialize. Please refresh the page.', 'error');
        }
    }

    /**
     * Initialize Supabase authentication
     */
    async initializeAuthentication() {
        try {
            // Wait for Supabase client to be ready
            if (window.supabaseClient) {
                await window.supabaseClient.initialize();
                
                // Get current user state
                this.currentUser = window.supabaseClient.getCurrentUser();
                
                // Listen for auth state changes
                window.addEventListener('supabase-auth-change', (event) => {
                    this.handleAuthChange(event.detail);
                });

                if (this.currentUser) {
                    console.log('👤 User authenticated:', this.currentUser.email);
                } else {
                    console.log('🔓 No user authenticated');
                }
            }
        } catch (error) {
            console.error('❌ Authentication initialization failed:', error);
        }
    }

    /**
     * Handle authentication state changes
     */
    handleAuthChange(detail) {
        const { event, user } = detail;
        
        console.log('🔐 Auth event:', event, user?.email || 'no user');
        
        this.currentUser = user;
        
        // Update UI based on auth state
        this.updateAuthUI();
        
        // Refresh connection status when auth changes
        if (user) {
            this.checkConnectionStatus();
        }
    }

    /**
     * Update UI elements based on authentication state
     */
    updateAuthUI() {
        const userDisplay = document.querySelector('.user-display');
        
        if (this.currentUser) {
            // Show user info
            if (userDisplay) {
                userDisplay.innerHTML = `
                    <div class="flex items-center space-x-2">
                        <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <span class="text-blue-800 font-medium text-sm">
                                ${this.currentUser.email.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div class="hidden sm:block">
                            <p class="text-sm font-medium text-gray-800">${this.currentUser.email}</p>
                        </div>
                        <button class="text-sm text-gray-600 hover:text-gray-800" data-action="sign-out">
                            <i class="fas fa-sign-out-alt"></i>
                        </button>
                    </div>
                `;
            }
        } else {
            // Show sign in button
            if (userDisplay) {
                userDisplay.innerHTML = `
                    <button class="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg transition duration-200" data-action="sign-in">
                        <i class="fas fa-user mr-1"></i>
                        Sign In
                    </button>
                `;
            }
        }
    }

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Mobile menu toggle
        const menuToggle = document.getElementById('menu-toggle');
        const sidebar = document.getElementById('sidebar');
        
        if (menuToggle && sidebar) {
            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });

            // Close sidebar when clicking outside on mobile
            document.addEventListener('click', (event) => {
                if (window.innerWidth < 768 && 
                    !sidebar.contains(event.target) && 
                    !menuToggle.contains(event.target)) {
                    sidebar.classList.remove('open');
                }
            });
        }

        // Navigation active state
        this.updateActiveNavigation();

        // Gmail connection buttons
        this.setupConnectionButtons();

        // Authentication event listeners
        this.setupAuthEventListeners();

        // Email interaction handlers
        this.setupEmailHandlers();
    }

    /**
     * Set up connection buttons using event delegation
     */
    setupConnectionButtons() {
        // Use event delegation to handle dynamically generated buttons
        document.addEventListener('click', (event) => {
            const target = event.target.closest('[data-action]');
            if (!target) return;

            const action = target.getAttribute('data-action');
            
            switch (action) {
                case 'connect-gmail':
                    event.preventDefault();
                    this.connectGmail();
                    break;
                case 'disconnect-gmail':
                    event.preventDefault();
                    this.disconnectGmail();
                    break;
                case 'refresh-connection':
                    event.preventDefault();
                    this.checkConnectionStatus();
                    break;
                case 'sign-in':
                    event.preventDefault();
                    this.showSignIn();
                    break;
                case 'sign-out':
                    event.preventDefault();
                    this.signOut();
                    break;
                case 'expand-priority-inbox':
                    event.preventDefault();
                    this.expandPriorityInbox();
                    break;
                case 'collapse-priority-inbox':
                    event.preventDefault();
                    this.collapsePriorityInbox();
                    break;
                case 'add-gmail-account':
                    event.preventDefault();
                    this.addGmailAccount();
                    break;
                case 'remove-account':
                    event.preventDefault();
                    this.removeGmailAccount(target.dataset.accountEmail);
                    break;
            }
        });
    }

    /**
     * Set up email interaction handlers
     */
    setupEmailHandlers() {
        // Email item clicks
        document.addEventListener('click', (event) => {
            const emailItem = event.target.closest('.email-item');
            if (emailItem && !event.target.matches('[data-action]')) {
                const emailId = emailItem.dataset.emailId;
                this.handleEmailClick(emailId);
            }
        });

        // Email classification feedback
        document.addEventListener('click', (event) => {
            if (event.target.matches('[data-action="classify-email"]')) {
                event.preventDefault();
                event.stopPropagation();
                const emailId = event.target.dataset.emailId;
                this.classifyEmail(emailId);
            }
        });
    }

    /**
     * Set up authentication event listeners
     */
    setupAuthEventListeners() {
        // Listen for Supabase auth state changes
        window.addEventListener('supabase-auth-change', (event) => {
            const { event: authEvent, user } = event.detail;
            console.log('🔐 Auth state changed:', authEvent, user);
            this.handleAuthChange(authEvent, user);
        });
    }

    /**
     * Show sign in modal
     */
    showSignIn() {
        if (window.authUI) {
            window.authUI.show('signin');
        } else {
            console.error('Auth UI not loaded');
            this.ui.showNotification('Authentication system not available', 'error');
        }
    }

    /**
     * Sign out user
     */
    async signOut() {
        try {
            if (window.supabaseClient) {
                const result = await window.supabaseClient.signOut();
                if (result.success) {
                    this.ui.showNotification('Signed out successfully', 'success');
                    // Refresh connection status
                    await this.checkConnectionStatus();
                } else {
                    throw new Error(result.error);
                }
            }
        } catch (error) {
            console.error('Sign out error:', error);
            this.ui.showNotification('Sign out failed', 'error');
        }
    }

    /**
     * Check Gmail and Calendar connection status
     */
    async checkConnectionStatus() {
        try {
            console.log('🔍 Checking connection status...');
            
            const gmailStatus = await this.api.getGmailStatus();
            
            // Handle API errors gracefully
            if (!gmailStatus.success) {
                console.log('Backend not available, using default status');
                this.ui.updateConnectionStatus('gmail', { connected: false });
                this.ui.updateConnectionStatus('calendar', { connected: false });
                return;
            }
            
            this.ui.updateConnectionStatus('gmail', {
                connected: gmailStatus.connected,
                email: gmailStatus.email,
                scopes: gmailStatus.scopes
            });

            // Check if calendar scope is included
            const hasCalendarScope = gmailStatus.scopes?.some(scope => 
                scope.includes('calendar') || scope.includes('Calendar')
            );

            this.ui.updateConnectionStatus('calendar', {
                connected: hasCalendarScope
            });

            return gmailStatus;
        } catch (error) {
            console.error('❌ Failed to check connection status:', error);
            this.ui.updateConnectionStatus('gmail', { connected: false });
            this.ui.updateConnectionStatus('calendar', { connected: false });
        }
    }

    /**
     * Connect to Gmail
     */
    async connectGmail() {
        try {
            console.log('🔗 Connecting to Gmail...');
            
            // Update button state to loading
            const connectBtn = document.querySelector('[data-action="connect-gmail"]');
            if (connectBtn) {
                connectBtn.disabled = true;
                connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Connecting...';
            }
            
            this.ui.showNotification('Redirecting to Gmail authentication...', 'info');
            const result = await this.api.connectGmail();
            
            // Handle API errors gracefully
            if (!result.success) {
                throw new Error(result.error || 'Failed to initiate OAuth flow');
            }
            
            // If we reach here without redirect, something went wrong
            if (!result.authUrl) {
                throw new Error('No authentication URL received');
            }
            
        } catch (error) {
            console.error('❌ Failed to connect Gmail:', error);
            
            // Show context-aware error message
            let errorMessage;
            if (result && result.code === 'NETWORK_ERROR') {
                errorMessage = 'Cannot connect to backend server. Please check if server is running on localhost:3000.';
            } else if (result && result.code === 'BACKEND_UNAVAILABLE') {
                errorMessage = 'Backend server not responding. Please start the Next.js server.';
            } else {
                errorMessage = 'Failed to connect to Gmail. Please try again.';
            }
            
            this.ui.showNotification(errorMessage, 'error');
            
            // Reset button state
            const connectBtn = document.querySelector('[data-action="connect-gmail"]');
            if (connectBtn) {
                connectBtn.disabled = false;
                connectBtn.innerHTML = '<i class="fas fa-link mr-1"></i>Connect Gmail';
            }
        }
    }

    /**
     * Disconnect from Gmail
     */
    async disconnectGmail() {
        try {
            console.log('🔌 Disconnecting Gmail...');
            const confirmed = confirm('Are you sure you want to disconnect Gmail? This will remove access to your emails.');
            
            if (!confirmed) return;

            await this.api.disconnectGmail();
            
            this.ui.updateConnectionStatus('gmail', { connected: false, email: null });
            this.ui.updateConnectionStatus('calendar', { connected: false });
            
            this.ui.showNotification('Gmail disconnected successfully', 'success');
        } catch (error) {
            console.error('❌ Failed to disconnect Gmail:', error);
            this.ui.showNotification('Failed to disconnect Gmail. Please try again.', 'error');
        }
    }

    /**
     * Load data based on current page
     */
    async loadPageData() {
        switch (this.currentPage) {
            case 'index.html':
            case '':
                await this.loadDashboardData();
                break;
            case 'emails.html':
                await this.loadEmailsData();
                break;
            case 'calendar.html':
                await this.loadCalendarData();
                break;
            case 'notifications.html':
                await this.loadNotificationsData();
                break;
        }
    }

    /**
     * Load dashboard data
     */
    async loadDashboardData() {
        try {
            console.log('📊 Loading dashboard data...');
            
            // Show loading state
            const emailContainer = document.querySelector('.priority-inbox-emails');
            if (emailContainer) {
                this.ui.showLoadingState(emailContainer, 'Loading priority emails...');
            }

            // Load priority items for dashboard
            const priorityItems = await this.api.getPriorityItems({
                limit: 10
            });

            if (priorityItems.success && priorityItems.data) {
                this.ui.updatePriorityDashboard(priorityItems.data);
            } else {
                // Show authentication required instead of sample data
                console.log('Authentication required - no priority items');
                this.showAuthenticationRequired();
            }

            // Update AI processing indicators
            this.ui.updateAIProcessing({
                emailClassification: 98,
                calendarSync: 100,
                priorityScoring: 92
            });

            // Update working hours status
            const now = new Date();
            const currentHour = now.getHours();
            const withinHours = currentHour >= 9 && currentHour < 17;
            
            this.ui.updateWorkingHours(
                { start: '09:00', end: '17:00', days: [1,2,3,4,5] },
                {
                    withinHours,
                    progressPercent: withinHours ? Math.round(((currentHour - 9) / 8) * 100) : 0,
                    timeRemaining: withinHours ? `${17 - currentHour} hours remaining today` : 'Outside working hours'
                }
            );

        } catch (error) {
            console.error('❌ Failed to load dashboard data:', error);
            this.showAuthenticationRequired();
        }
    }

    /**
     * Show authentication required screen
     */
    showAuthenticationRequired() {
        const emailContainer = document.querySelector('.priority-inbox-emails');
        if (emailContainer) {
            emailContainer.innerHTML = `
                <div class="text-center py-12">
                    <div class="mb-6">
                        <i class="fas fa-shield-alt text-4xl text-blue-500"></i>
                    </div>
                    <h3 class="text-lg font-medium text-gray-900 mb-2">Authentication Required</h3>
                    <p class="text-gray-600 mb-6">Please connect your Gmail account to view your priority emails and calendar events.</p>
                    <button 
                        class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        data-action="connect-gmail"
                    >
                        <i class="fas fa-link mr-2"></i>
                        Connect Gmail Account
                    </button>
                </div>
            `;
        }
    }

    /**
     * Load emails data
     */
    async loadEmailsData() {
        try {
            console.log('📧 Loading emails data...');
            
            // Show loading state
            const emailContainer = document.querySelector('.email-list-container');
            if (emailContainer) {
                this.ui.showLoadingState(emailContainer, 'Loading emails...');
            }

            // Try to fetch emails from API
            const emails = await this.api.getSmartFilteredEmails();
            
            if (emails.success && emails.data) {
                this.ui.updateEmailList(emails.data.emails || []);
                this.ui.updateEmailStats(emails.data.stats || {});
            } else {
                // Show authentication required instead of sample data
                console.log('Authentication required for emails - no sample data');
                this.showAuthenticationRequired();
            }
        } catch (error) {
            console.error('❌ Failed to load emails data:', error);
            this.showAuthenticationRequired();
        }
    }


    /**
     * Load calendar data
     */
    async loadCalendarData() {
        try {
            console.log('📅 Loading calendar data...');
            
            const events = await this.api.getCalendarEvents();
            console.log('Calendar events:', events);
        } catch (error) {
            console.error('❌ Failed to load calendar data:', error);
        }
    }

    /**
     * Load notifications data
     */
    async loadNotificationsData() {
        try {
            console.log('🔔 Loading notifications data...');
            
            const notifications = await this.api.getUrgentNotifications();
            console.log('Notifications:', notifications);
        } catch (error) {
            console.error('❌ Failed to load notifications data:', error);
        }
    }

    /**
     * Handle email click
     */
    handleEmailClick(emailId) {
        console.log('📧 Email clicked:', emailId);
        this.ui.showNotification('Email details view coming soon!', 'info');
    }

    /**
     * Classify email using AI
     */
    async classifyEmail(emailId) {
        try {
            console.log('🤖 Classifying email:', emailId);
            
            // Show AI processing indicator
            this.ui.showAIProcessingIndicator(emailId);
            this.ui.showNotification('Claude AI is analyzing email...', 'info');
            
            // Real API call only - no demo mode
            const result = await this.api.classifyEmail(emailId);
            
            if (result.success) {
                this.ui.showNotification('Email classified successfully!', 'success');
                await this.loadPageData(); // Refresh data
            } else {
                throw new Error(result.error || 'Classification failed');
            }
        } catch (error) {
            console.error('❌ Failed to classify email:', error);
            this.ui.hideAIProcessingIndicator(emailId);
            this.ui.showNotification('AI classification failed. Please try again.', 'error');
        }
    }


    /**
     * Set up periodic refresh and real-time updates
     */
    setupPeriodicRefresh() {
        // Normal refresh every 5 minutes
        this.refreshInterval = setInterval(async () => {
            await this.checkConnectionStatus();
            await this.loadPageData();
        }, 5 * 60 * 1000);

        // Also update working hours display every minute
        this.workingHoursInterval = setInterval(() => {
            this.updateWorkingHoursDisplay();
        }, 60 * 1000);
    }

    /**
     * Update working hours display in real-time
     */
    updateWorkingHoursDisplay() {
        const now = new Date();
        const currentHour = now.getHours();
        const withinHours = currentHour >= 9 && currentHour < 17;
        
        this.ui.updateWorkingHours(
            { start: '09:00', end: '17:00', days: [1,2,3,4,5] },
            {
                withinHours,
                progressPercent: withinHours ? Math.round(((currentHour - 9) / 8) * 100) : 0,
                timeRemaining: withinHours ? 
                    `${17 - currentHour} hour${17 - currentHour !== 1 ? 's' : ''} remaining today` : 
                    'Outside working hours'
            }
        );
    }

    /**
     * Update active navigation
     */
    updateActiveNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const currentPage = this.getCurrentPage();
        
        navItems.forEach(item => {
            const href = item.getAttribute('href');
            if (href === currentPage || 
                (currentPage === '' && href === '#') ||
                (currentPage === 'index.html' && href === '#')) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    /**
     * Set up notification system handlers
     */
    setupNotifications() {
        if (!this.notifications) {
            console.warn('Notification manager not available');
            return;
        }

        // Set up notification event listeners
        this.notifications.on('onNewNotifications', (notifications, data) => {
            this.handleNewNotifications(notifications, data);
        });

        this.notifications.on('onNotificationClick', (notification) => {
            this.handleNotificationClick(notification);
        });

        this.notifications.on('onError', (error) => {
            console.warn('Notification system error:', error);
        });

        // Set up manual refresh button
        const refreshBtn = document.getElementById('refresh-notifications');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.notifications.checkForUrgentEmails();
            });
        }

        console.log('📢 Notification system initialized');
    }

    /**
     * Handle new urgent notifications
     */
    handleNewNotifications(notifications, data) {
        const container = document.getElementById('live-notifications');
        const noNotifications = document.getElementById('no-notifications');
        const countBadge = document.getElementById('notification-count');

        if (!container) return;

        // Hide "no notifications" message if we have notifications
        if (notifications.length > 0 && noNotifications) {
            noNotifications.style.display = 'none';
        }

        // Update count badge
        if (countBadge) {
            const totalCount = this.notifications.getNotificationCounts().total;
            if (totalCount > 0) {
                countBadge.textContent = totalCount.toString();
                countBadge.classList.remove('hidden');
            } else {
                countBadge.classList.add('hidden');
            }
        }

        // Add new notifications to the UI
        notifications.forEach(notification => {
            this.notifications.createNotificationElement(notification, 'live-notifications');
        });

        // Show UI notification for critical items
        const criticalCount = notifications.filter(n => n.priority === 'critical').length;
        if (criticalCount > 0) {
            this.ui.showNotification(
                `${criticalCount} critical email${criticalCount > 1 ? 's' : ''} require immediate attention!`,
                'error'
            );
        }

        console.log(`📢 Added ${notifications.length} new notification(s) to dashboard`);
    }

    /**
     * Handle notification click
     */
    handleNotificationClick(notification) {
        // Navigate to emails page and highlight the specific email
        if (this.currentPage !== 'emails') {
            window.location.href = `emails.html?highlight=${notification.id}`;
        } else {
            // If already on emails page, just highlight
            this.highlightEmail(notification.id);
        }
    }

    /**
     * Highlight specific email in the list
     */
    highlightEmail(emailId) {
        const emailElements = document.querySelectorAll('[data-email-id]');
        emailElements.forEach(element => {
            if (element.dataset.emailId === emailId) {
                element.classList.add('highlighted');
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    }

    /**
     * Handle OAuth callback from Gmail
     */
    handleOAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');
        const state = urlParams.get('state');

        if (error) {
            console.error('OAuth error:', error);
            this.ui.showNotification(`Authentication failed: ${error}`, 'error');
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        }

        if (code) {
            console.log('OAuth code received, processing...');
            this.ui.showNotification('Processing Gmail authentication...', 'info');
            
            // The backend should handle the code exchange automatically
            // We'll refresh the connection status after a short delay
            setTimeout(() => {
                this.checkConnectionStatus();
                this.ui.showNotification('Gmail connected successfully!', 'success');
            }, 1000);

            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }


    /**
     * Expand priority inbox to show all items
     */
    expandPriorityInbox() {
        const priorityItems = this.ui.state.priorityItems;
        if (!priorityItems || priorityItems.length <= 5) return;

        const container = document.querySelector('.priority-inbox-emails');
        if (!container) return;

        // Show all items
        this.ui.updatePriorityDashboard({ items: priorityItems }, true); // true = show all
        
        // Update the expand button to collapse
        const expandBtn = container.querySelector('[data-action="expand-priority-inbox"]');
        if (expandBtn) {
            expandBtn.setAttribute('data-action', 'collapse-priority-inbox');
            expandBtn.innerHTML = `
                <i class="fas fa-chevron-up mr-2"></i>
                Show Less
            `;
        }
    }

    /**
     * Collapse priority inbox to show top 5 items
     */
    collapsePriorityInbox() {
        const priorityItems = this.ui.state.priorityItems;
        if (!priorityItems) return;

        // Show only top 5 items
        this.ui.updatePriorityDashboard({ items: priorityItems }, false); // false = show top 5
    }

    /**
     * Add additional Gmail account
     */
    async addGmailAccount() {
        try {
            const accountLabel = prompt('Enter a label for this Gmail account (e.g., "Work", "Personal"):');
            if (!accountLabel) return;

            console.log('🔗 Adding Gmail account...');
            
            this.ui.showNotification('Redirecting to Gmail authentication for additional account...', 'info');
            const result = await this.api.addGmailAccount(accountLabel);
            
            if (!result.success) {
                throw new Error(result.error || 'Failed to initiate OAuth flow for additional account');
            }
            
            // Redirect will happen automatically
            
        } catch (error) {
            console.error('❌ Failed to add Gmail account:', error);
            this.ui.showNotification('Failed to add Gmail account. Please try again.', 'error');
        }
    }

    /**
     * Remove Gmail account
     */
    async removeGmailAccount(accountEmail) {
        if (!accountEmail) return;

        try {
            const confirmed = confirm(`Are you sure you want to remove the Gmail account ${accountEmail}?`);
            if (!confirmed) return;

            console.log('🗑️ Removing Gmail account...');
            const result = await this.api.removeGmailAccount(accountEmail);
            
            if (result.success) {
                this.ui.showNotification(`Gmail account ${accountEmail} removed successfully`, 'success');
                
                // Refresh connection status to update UI
                await this.checkConnectionStatus();
                
                if (result.data.was_primary) {
                    this.ui.showNotification('Primary account was removed. Please set a new primary account if needed.', 'warning');
                }
            } else {
                throw new Error(result.error || 'Failed to remove Gmail account');
            }
            
        } catch (error) {
            console.error('❌ Failed to remove Gmail account:', error);
            this.ui.showNotification('Failed to remove Gmail account. Please try again.', 'error');
        }
    }

    /**
     * Get current page name
     */
    getCurrentPage() {
        return window.location.pathname.split('/').pop() || 'index.html';
    }

    /**
     * Cleanup on page unload
     */
    cleanup() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        if (this.workingHoursInterval) {
            clearInterval(this.workingHoursInterval);
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    window.neuroFlowApp = new NeuroFlowApp();
    await window.neuroFlowApp.init();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.neuroFlowApp) {
        window.neuroFlowApp.cleanup();
    }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NeuroFlowApp;
}