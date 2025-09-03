/**
 * Notification Manager
 * Handles urgent email notifications and browser notifications
 */

class NotificationManager {
    constructor() {
        this.notifications = [];
        this.isEnabled = false;
        this.checkInterval = null;
        this.checkFrequencyMs = 5 * 60 * 1000; // 5 minutes
        this.browserNotificationsGranted = false;
        this.lastCheckTime = null;
        this.callbacks = {
            onNewNotifications: [],
            onNotificationClick: [],
            onError: [],
        };
    }

    /**
     * Initialize notification system
     */
    async initialize() {
        console.log('📢 Initializing Notification Manager...');
        
        // Request browser notification permission
        await this.requestNotificationPermission();
        
        // Start checking for notifications if user is authenticated
        if (window.supabaseClient && window.supabaseClient.isAuthenticated()) {
            this.startPeriodicChecks();
        }

        // Listen for auth state changes
        document.addEventListener('supabase-auth-change', (event) => {
            if (event.detail.isAuthenticated) {
                this.startPeriodicChecks();
            } else {
                this.stopPeriodicChecks();
                this.clearNotifications();
            }
        });

        return this;
    }

    /**
     * Request browser notification permission
     */
    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            console.warn('Browser notifications not supported');
            return false;
        }

        if (Notification.permission === 'granted') {
            this.browserNotificationsGranted = true;
            return true;
        }

        if (Notification.permission !== 'denied') {
            try {
                const permission = await Notification.requestPermission();
                this.browserNotificationsGranted = permission === 'granted';
                
                if (this.browserNotificationsGranted) {
                    console.log('✅ Browser notifications enabled');
                } else {
                    console.log('⚠️ Browser notifications denied by user');
                }
                
                return this.browserNotificationsGranted;
            } catch (error) {
                console.warn('Failed to request notification permission:', error);
                return false;
            }
        }

        return false;
    }

    /**
     * Start periodic notification checks
     */
    startPeriodicChecks(frequencyMs = this.checkFrequencyMs) {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        this.isEnabled = true;
        this.checkFrequencyMs = frequencyMs;
        
        console.log(`📢 Starting notification checks every ${frequencyMs / 1000}s`);
        
        // Check immediately
        this.checkForUrgentEmails();
        
        // Set up periodic checks
        this.checkInterval = setInterval(() => {
            this.checkForUrgentEmails();
        }, frequencyMs);
    }

    /**
     * Stop periodic notification checks
     */
    stopPeriodicChecks() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        
        this.isEnabled = false;
        console.log('📢 Stopped notification checks');
    }

    /**
     * Check for urgent emails
     */
    async checkForUrgentEmails() {
        if (!window.apiClient) {
            console.warn('API client not available for notification check');
            return;
        }

        try {
            // Build query parameters
            const params = new URLSearchParams();
            if (this.lastCheckTime) {
                params.set('checkSince', this.lastCheckTime.toISOString());
            }
            params.set('minUrgency', '4'); // Only check for high urgency (4-5)
            params.set('includeActionRequired', 'true');
            params.set('respectWorkingHours', 'true');

            const response = await window.apiClient.request(`/api/notifications/urgent?${params}`);
            
            if (response.success && response.data) {
                await this.processNotifications(response.data);
                this.lastCheckTime = new Date();
            } else if (response.code === 'NETWORK_ERROR') {
                // Handle backend unavailable gracefully
                console.warn('Backend unavailable for notifications');
                this.triggerError('Backend temporarily unavailable');
            } else {
                throw new Error(response.error || 'Failed to check notifications');
            }
            
        } catch (error) {
            console.error('Error checking urgent emails:', error);
            this.triggerError(error.message);
        }
    }

    /**
     * Process new notifications
     */
    async processNotifications(data) {
        const newNotifications = data.notifications || [];
        
        if (newNotifications.length === 0) {
            // No new notifications
            return;
        }

        console.log(`📢 Found ${newNotifications.length} urgent notification(s)`);
        
        // Filter out notifications we've already seen
        const unseenNotifications = newNotifications.filter(notification => 
            !this.notifications.some(existing => existing.id === notification.id)
        );

        if (unseenNotifications.length === 0) {
            return; // All notifications already processed
        }

        // Add to our notifications list
        this.notifications.push(...unseenNotifications);

        // Show browser notifications for critical/high priority
        for (const notification of unseenNotifications) {
            if (notification.priority === 'critical' || notification.priority === 'high') {
                this.showBrowserNotification(notification);
            }
        }

        // Trigger callbacks
        this.triggerNewNotifications(unseenNotifications, data);
    }

    /**
     * Show browser notification
     */
    showBrowserNotification(notification) {
        if (!this.browserNotificationsGranted) {
            return;
        }

        const title = this.getBrowserNotificationTitle(notification);
        const options = {
            body: this.getBrowserNotificationBody(notification),
            icon: '/assets/notification-icon.png', // Add icon if available
            badge: '/assets/notification-badge.png', // Add badge if available
            tag: `urgent-email-${notification.id}`, // Prevent duplicates
            requireInteraction: notification.priority === 'critical',
            data: {
                emailId: notification.id,
                priority: notification.priority,
                action: 'open_email',
            },
        };

        try {
            const browserNotification = new Notification(title, options);
            
            browserNotification.onclick = () => {
                this.triggerNotificationClick(notification);
                browserNotification.close();
                
                // Focus the window if possible
                if (window.focus) {
                    window.focus();
                }
            };

            // Auto-close after 10 seconds unless it's critical
            if (notification.priority !== 'critical') {
                setTimeout(() => {
                    browserNotification.close();
                }, 10000);
            }
            
        } catch (error) {
            console.warn('Failed to show browser notification:', error);
        }
    }

    /**
     * Generate browser notification title
     */
    getBrowserNotificationTitle(notification) {
        const priorityEmoji = {
            critical: '🔥',
            high: '⚡',
            medium: '📬'
        };

        const senderName = notification.sender.name || notification.sender.email;
        return `${priorityEmoji[notification.priority]} ${senderName}`;
    }

    /**
     * Generate browser notification body
     */
    getBrowserNotificationBody(notification) {
        const subject = notification.subject || '(No subject)';
        const snippet = notification.snippet || '';
        
        let body = subject;
        if (snippet && snippet !== subject) {
            body += `\n${snippet}`;
        }
        
        if (notification.suggestedAction) {
            body += `\n${notification.suggestedAction}`;
        }

        // Limit body length
        return body.length > 200 ? body.slice(0, 200) + '...' : body;
    }

    /**
     * Create notification UI element
     */
    createNotificationElement(notification, containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn('Notification container not found:', containerId);
            return null;
        }

        const notificationEl = document.createElement('div');
        notificationEl.className = `notification notification-${notification.priority}`;
        notificationEl.dataset.notificationId = notification.id;
        
        const timeAgo = this.formatTimeAgo(new Date(notification.date));
        const senderName = notification.sender.name || notification.sender.email;
        
        notificationEl.innerHTML = `
            <div class="notification-header">
                <span class="notification-priority ${notification.priority}">${this.getPriorityIcon(notification.priority)}</span>
                <span class="notification-sender">${this.escapeHtml(senderName)}</span>
                <span class="notification-time">${timeAgo}</span>
                <button class="notification-close" aria-label="Dismiss">&times;</button>
            </div>
            <div class="notification-subject">${this.escapeHtml(notification.subject || '(No subject)')}</div>
            <div class="notification-snippet">${this.escapeHtml(notification.snippet)}</div>
            <div class="notification-reason">${this.escapeHtml(notification.urgencyReason)}</div>
            ${notification.suggestedAction ? `<div class="notification-action">${this.escapeHtml(notification.suggestedAction)}</div>` : ''}
            <div class="notification-actions">
                <button class="btn btn-primary btn-sm notification-open">Open Email</button>
                <button class="btn btn-secondary btn-sm notification-mark-read">Mark Read</button>
            </div>
        `;

        // Add event listeners
        notificationEl.querySelector('.notification-close').addEventListener('click', () => {
            this.dismissNotification(notification.id, notificationEl);
        });
        
        notificationEl.querySelector('.notification-open').addEventListener('click', () => {
            this.triggerNotificationClick(notification);
        });
        
        notificationEl.querySelector('.notification-mark-read').addEventListener('click', () => {
            this.markNotificationAsRead(notification.id, notificationEl);
        });

        // Add CSS if not already present
        this.addNotificationStyles();
        
        // Add to container (newest first)
        container.insertBefore(notificationEl, container.firstChild);
        
        return notificationEl;
    }

    /**
     * Add CSS styles for notifications
     */
    addNotificationStyles() {
        if (document.querySelector('#notification-manager-styles')) {
            return; // Already added
        }

        const styles = document.createElement('style');
        styles.id = 'notification-manager-styles';
        styles.textContent = `
            .notification {
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 10px;
                background: white;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                transition: all 0.3s ease;
            }
            .notification:hover {
                box-shadow: 0 4px 8px rgba(0,0,0,0.15);
            }
            .notification-critical {
                border-left: 4px solid #ff4757;
                background: #fff5f5;
            }
            .notification-high {
                border-left: 4px solid #ffa726;
                background: #fffbf0;
            }
            .notification-medium {
                border-left: 4px solid #42a5f5;
                background: #f5f9ff;
            }
            .notification-header {
                display: flex;
                align-items: center;
                margin-bottom: 8px;
                font-size: 0.9em;
            }
            .notification-priority {
                margin-right: 8px;
                font-weight: bold;
            }
            .notification-priority.critical { color: #ff4757; }
            .notification-priority.high { color: #ffa726; }
            .notification-priority.medium { color: #42a5f5; }
            .notification-sender {
                font-weight: bold;
                flex-grow: 1;
            }
            .notification-time {
                color: #666;
                font-size: 0.85em;
            }
            .notification-close {
                background: none;
                border: none;
                font-size: 1.2em;
                cursor: pointer;
                color: #999;
                margin-left: 10px;
            }
            .notification-close:hover {
                color: #666;
            }
            .notification-subject {
                font-weight: bold;
                margin-bottom: 5px;
            }
            .notification-snippet {
                color: #666;
                font-size: 0.9em;
                margin-bottom: 5px;
                line-height: 1.4;
            }
            .notification-reason {
                color: #888;
                font-size: 0.8em;
                font-style: italic;
                margin-bottom: 8px;
            }
            .notification-action {
                background: #e8f4fd;
                padding: 5px 8px;
                border-radius: 4px;
                font-size: 0.85em;
                margin-bottom: 10px;
                color: #1976d2;
            }
            .notification-actions {
                display: flex;
                gap: 8px;
            }
            .btn {
                padding: 4px 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.85em;
            }
            .btn-primary {
                background: #1976d2;
                color: white;
                border-color: #1976d2;
            }
            .btn-primary:hover {
                background: #1565c0;
            }
            .btn-secondary {
                background: white;
                color: #666;
            }
            .btn-secondary:hover {
                background: #f5f5f5;
            }
        `;
        document.head.appendChild(styles);
    }

    /**
     * Get priority icon
     */
    getPriorityIcon(priority) {
        const icons = {
            critical: '🔥',
            high: '⚡',
            medium: '📬'
        };
        return icons[priority] || '📬';
    }

    /**
     * Format time ago
     */
    formatTimeAgo(date) {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Dismiss notification
     */
    dismissNotification(notificationId, element) {
        // Remove from our list
        this.notifications = this.notifications.filter(n => n.id !== notificationId);
        
        // Remove from DOM with animation
        if (element) {
            element.style.opacity = '0';
            element.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (element.parentNode) {
                    element.parentNode.removeChild(element);
                }
            }, 300);
        }
    }

    /**
     * Mark notification as read
     */
    async markNotificationAsRead(notificationId, element) {
        // Note: This would typically make an API call to mark the email as read
        // For now, just dismiss the notification
        this.dismissNotification(notificationId, element);
    }

    /**
     * Clear all notifications
     */
    clearNotifications() {
        this.notifications = [];
        this.lastCheckTime = null;
    }

    /**
     * Event listener management
     */
    on(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event].push(callback);
        }
    }

    off(event, callback) {
        if (this.callbacks[event]) {
            const index = this.callbacks[event].indexOf(callback);
            if (index > -1) {
                this.callbacks[event].splice(index, 1);
            }
        }
    }

    triggerNewNotifications(notifications, data) {
        this.callbacks.onNewNotifications.forEach(callback => {
            try {
                callback(notifications, data);
            } catch (error) {
                console.error('Error in notification callback:', error);
            }
        });
    }

    triggerNotificationClick(notification) {
        this.callbacks.onNotificationClick.forEach(callback => {
            try {
                callback(notification);
            } catch (error) {
                console.error('Error in notification click callback:', error);
            }
        });
    }

    triggerError(error) {
        this.callbacks.onError.forEach(callback => {
            try {
                callback(error);
            } catch (error) {
                console.error('Error in notification error callback:', error);
            }
        });
    }

    /**
     * Get current notifications
     */
    getNotifications() {
        return [...this.notifications];
    }

    /**
     * Get notification count by priority
     */
    getNotificationCounts() {
        return this.notifications.reduce((counts, notification) => {
            counts[notification.priority] = (counts[notification.priority] || 0) + 1;
            counts.total++;
            return counts;
        }, { critical: 0, high: 0, medium: 0, total: 0 });
    }
}

// Create global instance
window.notificationManager = new NotificationManager();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.notificationManager.initialize();
    });
} else {
    window.notificationManager.initialize();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationManager;
}