/**
 * Authentication UI Component
 * Simple login/signup interface for Supabase authentication
 */

class AuthUI {
    constructor() {
        this.isVisible = false;
        this.currentMode = 'signin'; // 'signin' or 'signup'
    }

    /**
     * Show authentication modal
     */
    show(mode = 'signin') {
        this.currentMode = mode;
        this.isVisible = true;
        this.render();
    }

    /**
     * Hide authentication modal
     */
    hide() {
        this.isVisible = false;
        const modal = document.getElementById('auth-modal');
        if (modal) {
            modal.remove();
        }
    }

    /**
     * Toggle between signin and signup
     */
    toggleMode() {
        this.currentMode = this.currentMode === 'signin' ? 'signup' : 'signin';
        this.render();
    }

    /**
     * Render authentication modal
     */
    render() {
        // Remove existing modal
        const existing = document.getElementById('auth-modal');
        if (existing) {
            existing.remove();
        }

        if (!this.isVisible) return;

        const modal = document.createElement('div');
        modal.id = 'auth-modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        
        modal.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-800">
                        ${this.currentMode === 'signin' ? 'Sign In' : 'Create Account'}
                    </h2>
                    <button id="close-auth" class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>

                <form id="auth-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">
                            Email Address
                        </label>
                        <input 
                            type="email" 
                            id="email" 
                            required
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter your email"
                        />
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">
                            Password
                        </label>
                        <input 
                            type="password" 
                            id="password" 
                            required
                            minlength="6"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter your password"
                        />
                        ${this.currentMode === 'signup' ? '<p class="text-xs text-gray-500 mt-1">Minimum 6 characters</p>' : ''}
                    </div>

                    <div id="auth-error" class="hidden bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                    </div>

                    <button 
                        type="submit" 
                        id="auth-submit"
                        class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
                    >
                        ${this.currentMode === 'signin' ? 'Sign In' : 'Create Account'}
                    </button>
                </form>

                <div class="mt-6 text-center">
                    <p class="text-sm text-gray-600">
                        ${this.currentMode === 'signin' ? "Don't have an account?" : "Already have an account?"}
                        <button 
                            id="toggle-mode" 
                            class="text-blue-600 hover:text-blue-800 font-medium ml-1"
                        >
                            ${this.currentMode === 'signin' ? 'Create one' : 'Sign in'}
                        </button>
                    </p>
                </div>

                <div class="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p class="text-xs text-blue-700">
                        <i class="fas fa-info-circle mr-1"></i>
                        ${this.currentMode === 'signin' ? 
                            'Sign in to connect Gmail and access AI email classification.' :
                            'Create an account to get started with your AI email assistant.'
                        }
                    </p>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.setupEventListeners();

        // Focus email input
        setTimeout(() => {
            document.getElementById('email').focus();
        }, 100);
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Close modal
        document.getElementById('close-auth').addEventListener('click', () => {
            this.hide();
        });

        // Close on backdrop click
        document.getElementById('auth-modal').addEventListener('click', (e) => {
            if (e.target.id === 'auth-modal') {
                this.hide();
            }
        });

        // Toggle mode
        document.getElementById('toggle-mode').addEventListener('click', () => {
            this.toggleMode();
        });

        // Form submission
        document.getElementById('auth-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    /**
     * Handle form submission
     */
    async handleSubmit() {
        const submitBtn = document.getElementById('auth-submit');
        const errorDiv = document.getElementById('auth-error');
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        // Show loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Processing...';
        errorDiv.classList.add('hidden');

        try {
            let result;
            
            if (this.currentMode === 'signin') {
                result = await window.supabaseClient.signInWithEmail(email, password);
            } else {
                result = await window.supabaseClient.signUpWithEmail(email, password);
            }

            if (result.success) {
                this.hide();
                
                if (this.currentMode === 'signup' && !result.session) {
                    // Email confirmation required
                    window.uiComponents.showNotification(
                        'Please check your email to confirm your account!', 
                        'info'
                    );
                } else {
                    // Successful signin or confirmed signup
                    window.uiComponents.showNotification(
                        `Welcome! You're now signed in as ${result.user.email}`, 
                        'success'
                    );
                    
                    // Refresh the app to update auth state
                    if (window.neuroFlowApp) {
                        await window.neuroFlowApp.checkConnectionStatus();
                    }
                }
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('Auth error:', error);
            errorDiv.textContent = error.message || 'Authentication failed';
            errorDiv.classList.remove('hidden');
        } finally {
            // Reset button state
            submitBtn.disabled = false;
            submitBtn.innerHTML = this.currentMode === 'signin' ? 'Sign In' : 'Create Account';
        }
    }
}

// Create global auth UI instance
window.authUI = new AuthUI();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthUI;
}