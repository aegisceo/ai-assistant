/**
 * UI Components - Reusable UI components and state management
 * Handles dynamic updates to the elegant interface
 */

class UIComponents {
    constructor() {
        this.components = new Map();
        this.state = {
            gmailStatus: { connected: false, email: null },
            calendarStatus: { connected: false },
            emails: [],
            priorityItems: [],
            notifications: [],
            workingHours: { start: '09:00', end: '17:00', days: [1,2,3,4,5] },
            aiProcessing: {
                emailClassification: 0,
                calendarSync: 0,
                priorityScoring: 0
            }
        };
    }

    /**
     * Update connection status indicators
     */
    updateConnectionStatus(service, status) {
        this.state[`${service}Status`] = { ...this.state[`${service}Status`], ...status };
        
        const serviceCard = document.querySelector(`[data-service="${service}"]`);
        if (!serviceCard) return;

        if (service === 'gmail') {
            this.updateGmailAccountsDisplay(status);
        } else {
            // Handle other services (calendar, etc.)
            const indicator = serviceCard.querySelector('.status-indicator');
            const statusText = serviceCard.querySelector('.status-text');
            const connectionInfo = serviceCard.querySelector('.connection-info');
            
            if (indicator && statusText) {
                if (status.connected) {
                    indicator.className = 'status-indicator status-connected';
                    statusText.textContent = 'Connected';
                    statusText.className = 'ml-2 text-green-600 font-medium status-text';
                } else {
                    indicator.className = 'status-indicator status-disconnected';
                    statusText.textContent = 'Disconnected';
                    statusText.className = 'ml-2 text-red-600 font-medium status-text';
                }
            }

            if (connectionInfo) {
                connectionInfo.textContent = status.connected ? 'Connected' : 'Not connected';
            }
        }
    }

    /**
     * Update Gmail accounts display with multi-account support
     */
    async updateGmailAccountsDisplay(status) {
        const serviceCard = document.querySelector(`[data-service="gmail"]`);
        if (!serviceCard) return;

        const indicator = serviceCard.querySelector('.status-indicator');
        const statusText = serviceCard.querySelector('.status-text');
        const connectionInfo = serviceCard.querySelector('.connection-info');
        const accountsList = serviceCard.querySelector('.connected-accounts-list');
        const connectBtn = serviceCard.querySelector('[data-action="connect-gmail"]');
        const addAccountBtn = serviceCard.querySelector('[data-action="add-gmail-account"]');

        // Fetch all connected accounts
        const accountsResult = await window.apiClient.getGmailAccounts();
        
        if (accountsResult.success && accountsResult.data.accounts.length > 0) {
            const accounts = accountsResult.data.accounts;
            
            // Update status indicators
            if (indicator) indicator.className = 'status-indicator status-connected';
            if (statusText) {
                statusText.textContent = `${accounts.length} Account${accounts.length > 1 ? 's' : ''}`;
                statusText.className = 'ml-2 text-green-600 font-medium status-text';
            }
            
            if (connectionInfo) {
                const primaryAccount = accounts.find(acc => acc.is_primary);
                connectionInfo.textContent = primaryAccount 
                    ? `Primary: ${primaryAccount.account_email}`
                    : `${accounts.length} accounts connected`;
            }

            // Show accounts list
            if (accountsList) {
                accountsList.style.display = 'block';
                accountsList.innerHTML = this.renderGmailAccountsList(accounts);
            }

            // Update buttons
            if (connectBtn) connectBtn.style.display = 'none';
            if (addAccountBtn) addAccountBtn.style.display = 'inline-block';

        } else {
            // No accounts connected
            if (indicator) indicator.className = 'status-indicator status-disconnected';
            if (statusText) {
                statusText.textContent = 'Disconnected';
                statusText.className = 'ml-2 text-red-600 font-medium status-text';
            }
            
            if (connectionInfo) connectionInfo.textContent = 'Not connected';
            if (accountsList) accountsList.style.display = 'none';
            if (connectBtn) connectBtn.style.display = 'inline-block';
            if (addAccountBtn) addAccountBtn.style.display = 'none';
        }
    }

    /**
     * Render Gmail accounts list
     */
    renderGmailAccountsList(accounts) {
        let html = '<div class="space-y-2">';
        
        accounts.forEach(account => {
            html += `
                <div class="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                    <div class="flex items-center">
                        ${account.is_primary ? 
                            '<i class="fas fa-star text-yellow-500 mr-2" title="Primary Account"></i>' : 
                            '<i class="fas fa-envelope text-gray-400 mr-2"></i>'
                        }
                        <span class="text-gray-900">${account.account_email}</span>
                        <span class="ml-2 text-xs text-gray-500">(${account.account_label})</span>
                    </div>
                    <button class="text-xs text-red-600 hover:text-red-800" 
                            data-action="remove-account" 
                            data-account-email="${account.account_email}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }

    /**
     * Update connection buttons based on status
     */
    updateConnectionButtons(connected, email = null) {
        const buttonsContainer = document.querySelector('[data-service="gmail"] .mt-4');
        if (!buttonsContainer) return;

        if (connected) {
            buttonsContainer.innerHTML = `
                <button class="text-sm text-red-600 hover:text-red-800 font-medium" data-action="disconnect-gmail">
                    <i class="fas fa-unlink mr-1"></i>Disconnect Gmail
                </button>
                <button class="text-sm text-gray-600 hover:text-gray-800 font-medium ml-4" data-action="refresh-connection">
                    <i class="fas fa-refresh mr-1"></i>Refresh Status
                </button>
            `;
        } else {
            buttonsContainer.innerHTML = `
                <button class="text-sm text-blue-600 hover:text-blue-800 font-medium" data-action="connect-gmail">
                    <i class="fas fa-link mr-1"></i>Connect Gmail
                </button>
                <button class="text-sm text-gray-600 hover:text-gray-800 font-medium ml-4" data-action="refresh-connection">
                    <i class="fas fa-refresh mr-1"></i>Refresh Status
                </button>
            `;
        }
    }

    /**
     * Update email display in priority inbox or email list
     */
    updateEmailList(emails) {
        this.state.emails = emails;
        
        // Try both selectors - dashboard uses .priority-inbox-emails, emails page uses .email-list-container
        const container = document.querySelector('.priority-inbox-emails') || 
                         document.querySelector('.email-list-container') ||
                         document.querySelector('.email-list');
        
        if (!container) return;

        if (emails.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i data-feather="inbox" class="w-12 h-12 mx-auto mb-4 text-gray-400"></i>
                    <p class="text-lg font-medium">No emails found</p>
                    <p class="text-sm">Your inbox is empty</p>
                </div>
            `;
            feather.replace();
            return;
        }

        container.innerHTML = emails.map(email => this.renderEmailItem(email)).join('');
        feather.replace();
    }

    /**
     * Update email statistics display
     */
    updateEmailStats(stats) {
        // Update various stats displays
        this.updateStatCard('total-emails', stats.total || 0);
        this.updateStatCard('urgent-emails', stats.urgent || 0);
        this.updateStatCard('work-emails', stats.work || 0);
        this.updateStatCard('personal-emails', stats.personal || 0);
        this.updateStatCard('unread-emails', stats.unread || 0);
    }

    /**
     * Update individual stat card
     */
    updateStatCard(selector, value) {
        const element = document.querySelector(`[data-stat="${selector}"]`) || 
                       document.querySelector(`.${selector}`) ||
                       document.getElementById(selector);
        
        if (element) {
            // If it's a counter element, animate the number
            if (element.classList.contains('stat-number') || element.classList.contains('counter')) {
                this.animateNumber(element, parseInt(element.textContent) || 0, value);
            } else {
                element.textContent = value;
            }
        }
    }

    /**
     * Animate number changes
     */
    animateNumber(element, from, to, duration = 500) {
        const start = performance.now();
        const animate = (currentTime) => {
            const elapsed = currentTime - start;
            const progress = Math.min(elapsed / duration, 1);
            
            const current = Math.floor(from + (to - from) * progress);
            element.textContent = current;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        requestAnimationFrame(animate);
    }

    /**
     * Render individual email item
     */
    renderEmailItem(email) {
        const priorityClass = this.getPriorityClass(email.priority || email.urgency);
        const categoryClass = this.getCategoryClass(email.category);
        const timeAgo = this.getTimeAgo(email.date);

        return `
            <div class="${priorityClass} p-4 bg-white rounded-lg border border-gray-200 email-item cursor-pointer hover:shadow-md transition-shadow" 
                 data-email-id="${email.id}">
                <div class="flex items-start">
                    <div class="flex-shrink-0 mr-4">
                        <div class="w-10 h-10 rounded-full ${this.getPriorityIconBg(email.priority)} flex items-center justify-center">
                            <i class="fas ${this.getPriorityIcon(email.priority)} ${this.getPriorityIconColor(email.priority)}"></i>
                        </div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center">
                            <h3 class="text-sm font-medium text-gray-900 truncate">${email.subject || 'No Subject'}</h3>
                            ${email.urgent ? '<span class="ml-2 px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">Urgent</span>' : ''}
                        </div>
                        <p class="text-sm text-gray-600 truncate">From: ${email.sender?.email || email.from}</p>
                        <p class="text-sm text-gray-500 mt-1 line-clamp-2">${email.snippet || ''}</p>
                        <div class="flex items-center mt-2">
                            <span class="email-category ${categoryClass}">${email.category || 'Other'}</span>
                            <span class="ml-2 text-xs text-gray-500">${timeAgo}</span>
                            ${email.confidence ? `<span class="ml-2 text-xs text-blue-500">Confidence: ${Math.round(email.confidence * 100)}%</span>` : ''}
                        </div>
                    </div>
                    <div class="flex-shrink-0 ml-4">
                        <span class="text-xs font-medium text-gray-500">${this.formatTime(email.date)}</span>
                        <div class="mt-2">
                            <button class="text-xs text-blue-600 hover:text-blue-800" data-action="classify-email" data-email-id="${email.id}">
                                Re-classify
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Update AI processing indicators
     */
    updateAIProcessing(processing) {
        this.state.aiProcessing = { ...this.state.aiProcessing, ...processing };
        
        Object.entries(this.state.aiProcessing).forEach(([key, value]) => {
            const progressBar = document.querySelector(`[data-ai-process="${key}"] .progress-fill`);
            const percentText = document.querySelector(`[data-ai-process="${key}"] .progress-percent`);
            
            if (progressBar) {
                progressBar.style.width = `${value}%`;
                progressBar.className = `progress-fill ${value === 100 ? 'bg-green-500' : 'bg-blue-500'}`;
            }
            
            if (percentText) {
                percentText.textContent = `${value}%`;
            }
        });
    }

    /**
     * Update working hours display
     */
    updateWorkingHours(workingHours, currentStatus) {
        this.state.workingHours = workingHours;
        
        const statusElement = document.querySelector('.working-hours-status');
        const progressBar = document.querySelector('.working-hours-progress .progress-fill');
        const timeRemaining = document.querySelector('.time-remaining');
        
        if (statusElement) {
            statusElement.textContent = currentStatus.withinHours ? 'Within Working Hours' : 'Outside Working Hours';
            statusElement.className = `text-2xl font-bold mt-1 ${currentStatus.withinHours ? 'text-green-700' : 'text-gray-500'}`;
        }
        
        if (progressBar && currentStatus.progressPercent !== undefined) {
            progressBar.style.width = `${currentStatus.progressPercent}%`;
        }
        
        if (timeRemaining) {
            timeRemaining.textContent = currentStatus.timeRemaining || '';
        }
    }

    /**
     * Show notification toast
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${this.getNotificationClass(type)} transform translate-x-0 transition-transform duration-300`;
        notification.innerHTML = `
            <div class="flex items-center">
                <i class="fas ${this.getNotificationIcon(type)} mr-3"></i>
                <span class="flex-1">${message}</span>
                <button class="ml-4 text-current hover:opacity-75 transition-opacity" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.classList.add('animate-in'), 10);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.classList.add('transform', 'translate-x-full');
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }

    /**
     * Show loading state
     */
    showLoadingState(container, message = 'Loading...') {
        if (typeof container === 'string') {
            container = document.querySelector(container);
        }
        
        if (!container) return;
        
        container.innerHTML = `
            <div class="flex items-center justify-center py-12">
                <div class="flex flex-col items-center">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
                    <p class="text-gray-600">${message}</p>
                </div>
            </div>
        `;
    }

    // Utility methods for styling
    getPriorityClass(priority) {
        const priorities = {
            5: 'priority-high',
            4: 'priority-high', 
            3: 'priority-medium',
            2: 'priority-low',
            1: 'priority-low'
        };
        return priorities[priority] || 'priority-low';
    }

    getCategoryClass(category) {
        const categories = {
            'work': 'category-work',
            'personal': 'category-personal',
            'financial': 'category-financial',
            'opportunity': 'category-opportunities',
            'newsletter': 'category-newsletters',
            'spam': 'category-spam'
        };
        return categories[category?.toLowerCase()] || 'category-work';
    }

    getPriorityIconBg(priority) {
        if (priority >= 4) return 'bg-red-100';
        if (priority >= 3) return 'bg-yellow-100';
        return 'bg-green-100';
    }

    getPriorityIcon(priority) {
        if (priority >= 4) return 'fa-exclamation-circle';
        if (priority >= 3) return 'fa-clock';
        return 'fa-info-circle';
    }

    getPriorityIconColor(priority) {
        if (priority >= 4) return 'text-red-500';
        if (priority >= 3) return 'text-yellow-500';
        return 'text-green-500';
    }

    getNotificationClass(type) {
        const classes = {
            'success': 'bg-green-100 border border-green-200 text-green-800',
            'error': 'bg-red-100 border border-red-200 text-red-800',
            'warning': 'bg-yellow-100 border border-yellow-200 text-yellow-800',
            'info': 'bg-blue-100 border border-blue-200 text-blue-800'
        };
        return classes[type] || classes.info;
    }

    getNotificationIcon(type) {
        const icons = {
            'success': 'fa-check-circle',
            'error': 'fa-exclamation-circle',
            'warning': 'fa-exclamation-triangle',
            'info': 'fa-info-circle'
        };
        return icons[type] || icons.info;
    }

    getTimeAgo(date) {
        const now = new Date();
        const emailDate = new Date(date);
        const diffMs = now - emailDate;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        return 'Just now';
    }

    formatTime(date) {
        return new Date(date).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    /**
     * Update priority dashboard with clean summary cards
     */
    updatePriorityDashboard(data, showAll = false) {
        this.state.priorityItems = data.items || [];
        const container = document.querySelector('.priority-inbox-emails');
        
        if (!container) return;

        if (!data.items || data.items.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <div class="mb-6">
                        <i class="fas fa-inbox text-4xl text-gray-300"></i>
                    </div>
                    <h3 class="text-lg font-medium text-gray-900 mb-2">No Priority Items</h3>
                    <p class="text-gray-600">You're all caught up! No high-priority emails or calendar items need attention.</p>
                </div>
            `;
            return;
        }

        // Show top 5 items initially, or all if expanded
        const displayItems = showAll ? data.items : data.items.slice(0, 5);
        const remainingCount = showAll ? 0 : Math.max(0, data.items.length - 5);

        let html = `
            <div class="space-y-3 priority-items-main">
        `;

        // Create clean priority cards
        displayItems.forEach(item => {
            const priorityIcon = this.getPriorityIcon(item.priorityColor);
            const timeAgo = this.formatTimeAgo(new Date(item.date));
            
            html += `
                <div class="priority-item-card p-4 bg-white rounded-lg border-l-4 border-${item.priorityColor}-500 hover:shadow-md transition-shadow cursor-pointer" 
                     data-item-id="${item.id}" data-item-type="${item.type}">
                    <div class="flex items-start">
                        <div class="flex-shrink-0 mr-4">
                            <div class="w-3 h-3 rounded-full bg-${item.priorityColor}-500 priority-indicator" title="${item.priorityLabel} Priority"></div>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between mb-1">
                                <span class="text-xs font-medium text-${item.priorityColor}-600 uppercase tracking-wider">
                                    ${item.priorityLabel} • ${item.category}
                                </span>
                                <span class="text-xs text-gray-500">${timeAgo}</span>
                            </div>
                            <p class="text-sm font-medium text-gray-900 leading-relaxed">
                                ${item.summary}
                            </p>
                            ${item.actionRequired ? `
                                <div class="mt-2">
                                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        <i class="fas fa-exclamation-circle mr-1 text-xs"></i>
                                        Action Required
                                    </span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        });

        html += `</div>`;

        // Add expandable section if there are more items
        if (remainingCount > 0) {
            html += `
                <div class="mt-6 text-center">
                    <button class="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 border border-blue-300 hover:border-blue-400 rounded-lg transition-colors" 
                            data-action="expand-priority-inbox">
                        <i class="fas fa-chevron-down mr-2"></i>
                        Show ${remainingCount} More Priority Items
                    </button>
                </div>
            `;
        } else if (showAll && data.items.length > 5) {
            html += `
                <div class="mt-6 text-center">
                    <button class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-300 hover:border-gray-400 rounded-lg transition-colors" 
                            data-action="collapse-priority-inbox">
                        <i class="fas fa-chevron-up mr-2"></i>
                        Show Less
                    </button>
                </div>
            `;
        }

        container.innerHTML = html;

        // Add click handlers for priority items
        container.querySelectorAll('.priority-item-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const itemId = card.dataset.itemId;
                const itemType = card.dataset.itemType;
                this.showQuickLook(itemId, itemType);
            });
        });
    }

    /**
     * Get priority icon based on color
     */
    getPriorityIcon(color) {
        const icons = {
            red: 'fas fa-exclamation-triangle',
            orange: 'fas fa-exclamation-circle', 
            yellow: 'fas fa-clock',
            green: 'fas fa-info-circle'
        };
        return icons[color] || icons.green;
    }

    /**
     * Format time ago string
     */
    formatTimeAgo(date) {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);

        if (diffHours < 1) return 'Just now';
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }

    /**
     * Show quick look modal for priority item
     */
    showQuickLook(itemId, itemType) {
        const item = this.state.priorityItems.find(i => i.id === itemId);
        if (!item) return;

        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        
        modal.innerHTML = `
            <div class="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div class="p-6">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <div class="flex items-center mb-2">
                                <div class="w-3 h-3 rounded-full bg-${item.priorityColor}-500 mr-3"></div>
                                <span class="text-sm font-medium text-${item.priorityColor}-600 uppercase tracking-wider">
                                    ${item.priorityLabel} Priority • ${item.category}
                                </span>
                            </div>
                            <h3 class="text-xl font-semibold text-gray-900">${item.metadata.subject || item.title}</h3>
                        </div>
                        <button class="text-gray-400 hover:text-gray-600" data-action="close-modal">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div class="space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <span class="font-medium text-gray-600">From:</span>
                                <div class="text-gray-900">${item.source}</div>
                            </div>
                            <div>
                                <span class="font-medium text-gray-600">Date:</span>
                                <div class="text-gray-900">${new Date(item.date).toLocaleString()}</div>
                            </div>
                        </div>
                        
                        <div>
                            <span class="font-medium text-gray-600">AI Summary:</span>
                            <div class="text-gray-900 mt-1">${item.summary}</div>
                        </div>
                        
                        ${item.metadata.snippet ? `
                            <div>
                                <span class="font-medium text-gray-600">Preview:</span>
                                <div class="text-gray-700 text-sm mt-1 p-3 bg-gray-50 rounded">${item.metadata.snippet}</div>
                            </div>
                        ` : ''}
                        
                        ${item.actionRequired ? `
                            <div class="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <div class="flex items-center">
                                    <i class="fas fa-exclamation-circle text-blue-600 mr-2"></i>
                                    <span class="font-medium text-blue-900">Action Required</span>
                                </div>
                            </div>
                        ` : ''}
                        
                        <div class="flex space-x-3 pt-4">
                            <button class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                    data-action="open-email" data-email-id="${item.id}">
                                <i class="fas fa-envelope-open mr-2"></i>
                                Open in Gmail
                            </button>
                            <button class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                    data-action="mark-handled">
                                <i class="fas fa-check mr-2"></i>
                                Mark as Handled
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners
        modal.querySelector('[data-action="close-modal"]').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }
}

// Create global UI components instance
window.uiComponents = new UIComponents();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIComponents;
}