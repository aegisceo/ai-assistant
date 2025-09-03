/**
 * Real-time Progress Tracker
 * Provides real-time updates for batch email classification progress
 */

class ProgressTracker {
    constructor() {
        this.sessions = new Map();
        this.supabaseClient = null;
        this.channels = new Map();
    }

    /**
     * Initialize with Supabase client for real-time subscriptions
     */
    initialize(supabaseClient) {
        this.supabaseClient = supabaseClient;
    }

    /**
     * Start tracking progress for a session
     */
    async startTracking(sessionId, onUpdate, onComplete, onError) {
        if (this.sessions.has(sessionId)) {
            console.warn('Already tracking session:', sessionId);
            return;
        }

        const session = {
            sessionId,
            onUpdate,
            onComplete,
            onError,
            status: 'pending',
            startTime: Date.now(),
            lastUpdate: null,
        };

        this.sessions.set(sessionId, session);

        // Subscribe to real-time updates via Supabase
        if (this.supabaseClient) {
            const channel = this.supabaseClient
                .channel(`progress_${sessionId}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'classification_progress',
                    filter: `session_id=eq.${sessionId}`
                }, (payload) => {
                    this.handleRealtimeUpdate(sessionId, payload);
                })
                .subscribe();

            this.channels.set(sessionId, channel);
        }

        // Start polling as backup (in case realtime fails)
        this.startPolling(sessionId);

        // Get initial progress
        await this.fetchProgress(sessionId);
    }

    /**
     * Stop tracking a session
     */
    stopTracking(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        // Unsubscribe from real-time updates
        const channel = this.channels.get(sessionId);
        if (channel) {
            this.supabaseClient?.removeChannel(channel);
            this.channels.delete(sessionId);
        }

        // Clear polling
        if (session.pollInterval) {
            clearInterval(session.pollInterval);
        }

        this.sessions.delete(sessionId);
    }

    /**
     * Handle real-time updates from Supabase
     */
    handleRealtimeUpdate(sessionId, payload) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        const progressData = payload.new || payload.record;
        if (!progressData) return;

        this.processProgressUpdate(sessionId, progressData);
    }

    /**
     * Start polling for progress (backup mechanism)
     */
    startPolling(sessionId, intervalMs = 1000) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        session.pollInterval = setInterval(async () => {
            try {
                await this.fetchProgress(sessionId);
            } catch (error) {
                console.error('Polling error for session', sessionId, ':', error);
            }
        }, intervalMs);
    }

    /**
     * Fetch progress from API
     */
    async fetchProgress(sessionId) {
        try {
            const response = await window.apiClient.request(`/api/classify/progress?sessionId=${sessionId}`);
            
            if (response.success && response.data) {
                this.processProgressUpdate(sessionId, response.data);
            } else if (response.code === 'NETWORK_ERROR') {
                // Backend unavailable - handle gracefully
                console.warn('Backend unavailable for progress tracking');
            } else {
                throw new Error(response.error || 'Failed to fetch progress');
            }
        } catch (error) {
            const session = this.sessions.get(sessionId);
            if (session?.onError) {
                session.onError(error);
            }
        }
    }

    /**
     * Process progress update and call appropriate callbacks
     */
    processProgressUpdate(sessionId, progressData) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        const progress = {
            sessionId: progressData.sessionId || progressData.session_id,
            status: progressData.status,
            totalEmails: progressData.totalEmails || progressData.total_emails,
            processedEmails: progressData.processedEmails || progressData.processed_emails,
            successfulEmails: progressData.successfulEmails || progressData.successful_emails,
            failedEmails: progressData.failedEmails || progressData.failed_emails,
            currentEmailIndex: progressData.currentEmailIndex || progressData.current_email_index,
            currentEmailSubject: progressData.currentEmailSubject || progressData.current_email_subject,
            percentage: Math.round(((progressData.processedEmails || progressData.processed_emails) / (progressData.totalEmails || progressData.total_emails)) * 100),
            estimatedTimeRemainingMs: progressData.estimatedTimeRemainingMs || progressData.estimated_time_remaining_ms,
            averageProcessingTimeMs: progressData.averageProcessingTimeMs || progressData.average_processing_time_ms,
            startedAt: progressData.startedAt || progressData.started_at,
            updatedAt: progressData.updatedAt || progressData.updated_at,
            completedAt: progressData.completedAt || progressData.completed_at,
            errorMessage: progressData.errorMessage || progressData.error_message,
        };

        session.lastUpdate = Date.now();
        session.status = progress.status;

        // Call update callback
        if (session.onUpdate) {
            session.onUpdate(progress);
        }

        // Handle completion
        if (progress.status === 'completed' || progress.status === 'failed') {
            if (session.onComplete) {
                session.onComplete(progress);
            }
            this.stopTracking(sessionId);
        }
    }

    /**
     * Get current status of a session
     */
    getSessionStatus(sessionId) {
        const session = this.sessions.get(sessionId);
        return session ? {
            status: session.status,
            startTime: session.startTime,
            lastUpdate: session.lastUpdate,
            isActive: this.sessions.has(sessionId),
        } : null;
    }

    /**
     * Get all active sessions
     */
    getActiveSessions() {
        return Array.from(this.sessions.keys());
    }

    /**
     * Format time remaining for display
     */
    formatTimeRemaining(ms) {
        if (!ms || ms <= 0) return 'Unknown';
        
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        
        if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Create a progress bar HTML element
     */
    createProgressBar(containerId, sessionId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Progress container not found:', containerId);
            return;
        }

        container.innerHTML = `
            <div class="progress-tracker" data-session="${sessionId}">
                <div class="progress-header">
                    <span class="progress-title">Processing emails...</span>
                    <span class="progress-percentage">0%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 0%"></div>
                </div>
                <div class="progress-details">
                    <span class="progress-status">Initializing...</span>
                    <span class="progress-eta"></span>
                </div>
                <div class="progress-current-email"></div>
            </div>
        `;

        // Add CSS if not already present
        if (!document.querySelector('#progress-tracker-styles')) {
            const styles = document.createElement('style');
            styles.id = 'progress-tracker-styles';
            styles.textContent = `
                .progress-tracker {
                    margin: 20px 0;
                    padding: 20px;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    background: #f9f9f9;
                }
                .progress-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 10px;
                    font-weight: bold;
                }
                .progress-bar {
                    width: 100%;
                    height: 20px;
                    background: #e0e0e0;
                    border-radius: 10px;
                    overflow: hidden;
                    margin-bottom: 10px;
                }
                .progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #4CAF50, #45a049);
                    transition: width 0.3s ease;
                }
                .progress-details {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.9em;
                    color: #666;
                }
                .progress-current-email {
                    margin-top: 5px;
                    font-size: 0.8em;
                    color: #888;
                    font-style: italic;
                }
            `;
            document.head.appendChild(styles);
        }

        return container.querySelector('.progress-tracker');
    }

    /**
     * Update progress bar display
     */
    updateProgressBar(containerId, progress) {
        const container = document.getElementById(containerId);
        const tracker = container?.querySelector('.progress-tracker');
        if (!tracker) return;

        const fillElement = tracker.querySelector('.progress-fill');
        const percentageElement = tracker.querySelector('.progress-percentage');
        const statusElement = tracker.querySelector('.progress-status');
        const etaElement = tracker.querySelector('.progress-eta');
        const currentEmailElement = tracker.querySelector('.progress-current-email');

        // Update progress bar
        if (fillElement && percentageElement) {
            fillElement.style.width = `${progress.percentage}%`;
            percentageElement.textContent = `${progress.percentage}%`;
        }

        // Update status
        if (statusElement) {
            const statusText = {
                pending: 'Waiting to start...',
                running: `Processing (${progress.processedEmails}/${progress.totalEmails})`,
                completed: `Completed! ${progress.successfulEmails} successful, ${progress.failedEmails} failed`,
                failed: 'Processing failed',
                cancelled: 'Processing cancelled'
            };
            statusElement.textContent = statusText[progress.status] || progress.status;
        }

        // Update ETA
        if (etaElement && progress.estimatedTimeRemainingMs) {
            etaElement.textContent = `ETA: ${this.formatTimeRemaining(progress.estimatedTimeRemainingMs)}`;
        }

        // Update current email
        if (currentEmailElement && progress.currentEmailSubject && progress.status === 'running') {
            currentEmailElement.textContent = `Currently processing: ${progress.currentEmailSubject}`;
        } else if (currentEmailElement) {
            currentEmailElement.textContent = '';
        }
    }
}

// Create global instance
window.progressTracker = new ProgressTracker();

// Initialize when Supabase client is available
document.addEventListener('supabase-ready', () => {
    if (window.supabaseClient) {
        window.progressTracker.initialize(window.supabaseClient);
    }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProgressTracker;
}