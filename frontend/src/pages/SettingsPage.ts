import { Page } from '../router/Router';
import { showModal, hideModal, showNotification } from '../utils/ui';
import { API_CONFIG } from '../config';

export class SettingsPage implements Page {
    public title = 'Settings';
    public requiresAuth = true;
    private is2FAEnabled = false;
    private qrCodeData: string = '';
    private manualEntryKey: string = '';
    private isSetupInProgress = false;

    public render(): string {
        return `
            <div class="fixed inset-0 flex h-screen bg-slate-900">
                ${this.renderSidebar()}
                <div class="flex-1 p-8 overflow-y-auto">
                    <div class="fade-in">
                        <h1 class="text-3xl font-bold text-white mb-6">Settings</h1>
                        
                        <!-- Security Settings Section -->
                        <div class="bg-slate-800 p-6 rounded-lg mb-6">
                            <h2 class="text-xl font-semibold text-white mb-4">Security</h2>
                            
                            <!-- 2FA Toggle -->
                            <div class="flex items-center justify-between p-4 bg-slate-700 rounded-lg">
                                <div class="flex-1">
                                    <h3 class="text-lg font-medium text-white">Two-Factor Authentication</h3>
                                    <p class="text-sm text-gray-400 mt-1">
                                        Add an extra layer of security to your account with 2FA
                                    </p>
                                </div>
                                <div class="ml-4">
                                    <label class="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            id="2fa-toggle" 
                                            class="sr-only peer" 
                                            ${this.is2FAEnabled ? 'checked' : ''}
                                            ${this.isSetupInProgress ? 'disabled' : ''}
                                        >
                                        <div class="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 ${this.isSetupInProgress ? 'opacity-50 cursor-not-allowed' : ''}"></div>
                                    </label>
                                </div>
                            </div>
                            
                            ${this.is2FAEnabled ? this.render2FAStatus() : ''}
                        </div>
                        
                    </div>
                </div>
                ${this.renderModals()}
            </div>
        `;
    }

    private render2FAStatus(): string {
        return `
            <div class="mt-4 p-4 bg-green-900/20 border border-green-800 rounded-lg">
                <div class="flex items-center">
                    <svg class="w-5 h-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                    </svg>
                    <span class="text-green-400 font-medium">Two-Factor Authentication is enabled</span>
                </div>
                <p class="text-sm text-gray-400 mt-2">
                    Your account is protected with 2FA. You can disable it anytime using the toggle above.
                </p>
            </div>
        `;
    }

    private renderModals(): string {
        return `
            <!-- Enable 2FA Confirmation Modal -->
            <div id="enable2FAModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 hidden">
                <div class="bg-slate-800 rounded-lg shadow-xl w-96 max-w-md mx-4">
                    <div class="p-6">
                        <div class="flex items-center mb-4">
                            <div class="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                                <svg class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-1a2 2 0 00-2-2H6a2 2 0 00-2 2v1a2 2 0 002 2zM12 15V9m0 0l4-4m-4 4L8 5" />
                                </svg>
                            </div>
                            <h3 class="text-lg font-medium text-white">Enable Two-Factor Authentication</h3>
                        </div>
                        <p class="text-sm text-gray-300 mb-6">
                            This will require you to use an authenticator app to generate codes when logging in, significantly increasing your account security.
                        </p>
                        <div class="flex gap-3">
                            <button id="confirmEnable2FA" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded">
                                Enable 2FA
                            </button>
                            <button id="cancelEnable2FA" class="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 2FA Setup Modal with QR Code -->
            <div id="setup2FAModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 hidden">
                <div class="bg-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
                    <div class="p-6">
                        <div class="flex items-center mb-4">
                            <div class="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                                <svg class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                                </svg>
                            </div>
                            <h3 class="text-lg font-medium text-white">Set up Two-Factor Authentication</h3>
                        </div>

                        <!-- Setup Steps -->
                        <div class="space-y-4 mb-6">
                            <div class="text-sm text-gray-300">
                                <p class="font-medium mb-2">Follow these steps to set up 2FA:</p>
                                <ol class="list-decimal list-inside space-y-1 text-gray-400">
                                    <li>Install an authenticator app (Google Authenticator, Authy, etc.)</li>
                                    <li>Scan the QR code below with your authenticator app</li>
                                    <li>Enter the 6-digit code from your app to verify setup</li>
                                </ol>
                            </div>
                        </div>

                        <!-- QR Code Section -->
                        <div class="bg-white p-4 rounded-lg mb-6 text-center">
                            <div id="qrCodeContainer" class="flex justify-center items-center">
                                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            </div>
                        </div>

                        <!-- Manual Entry Section -->
                        <div class="mb-6">
                            <button id="showManualEntry" class="text-blue-400 hover:text-blue-300 text-sm underline">
                                Can't scan QR code? Enter manually
                            </button>
                            <div id="manualEntrySection" class="hidden mt-3 p-3 bg-slate-700 rounded">
                                <p class="text-sm text-gray-300 mb-2">Manual entry key:</p>
                                <code id="manualKey" class="text-xs text-green-400 bg-slate-900 p-2 rounded block break-all"></code>
                            </div>
                        </div>

                        <!-- Verification Code Input -->
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-300 mb-2">
                                Enter verification code from your authenticator app:
                            </label>
                            <input 
                                type="text" 
                                id="verificationCode" 
                                maxlength="6" 
                                placeholder="123456" 
                                class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg tracking-widest"
                            >
                        </div>

                        <!-- Action Buttons -->
                        <div class="flex gap-3">
                            <button id="verify2FASetup" class="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed">
                                Verify & Enable
                            </button>
                            <button id="cancelSetup2FA" class="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Disable 2FA Confirmation Modal -->
            <div id="disable2FAModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 hidden">
                <div class="bg-slate-800 rounded-lg shadow-xl w-96 max-w-md mx-4">
                    <div class="p-6">
                        <div class="flex items-center mb-4">
                            <div class="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                                <svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                            </div>
                            <h3 class="text-lg font-medium text-white">Disable Two-Factor Authentication</h3>
                        </div>
                        <p class="text-sm text-gray-300 mb-4">
                            Are you sure you want to disable Two-Factor Authentication? This will make your account less secure.
                        </p>
                        
                        <!-- Password Input -->
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-300 mb-2">
                                Enter your password:
                            </label>
                            <input 
                                type="password" 
                                id="disable2FAPassword" 
                                placeholder="Enter your password" 
                                class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            >
                        </div>
                        
                        <!-- 2FA Code Input -->
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-300 mb-2">
                                Enter your current 2FA code to confirm:
                            </label>
                            <input 
                                type="text" 
                                id="disable2FACode" 
                                maxlength="6" 
                                placeholder="123456" 
                                class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-center text-lg tracking-widest"
                            >
                        </div>
                        
                        <div class="flex gap-3">
                            <button id="confirmDisable2FA" class="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed">
                                Disable 2FA
                            </button>
                            <button id="cancelDisable2FA" class="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    public initialize(): void {
        console.log('Settings page initialized');
        this.setupEventListeners();
        this.loadUserSettings();
    }

    private async loadUserSettings(): Promise<void> {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const response = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.AUTH}/2fa/status`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (response.ok) {
                const data = await response.json();
                this.is2FAEnabled = data.two_factor_enabled;
                this.updatePageContent();
            }
        } catch (error) {
            console.error('Failed to load user settings:', error);
        }
    }

    private setupEventListeners(): void {
        const toggle = document.getElementById('2fa-toggle') as HTMLInputElement;
        if (toggle) {
            toggle.addEventListener('change', (e) => {
                const isEnabled = (e.target as HTMLInputElement).checked;
                this.handle2FAToggle(isEnabled);
            });
        }
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.handleLogout.bind(this));
        }
        /** Modal event listeners */
        this.setupModalEventListeners();
    }

    private handleLogout(): void {
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
        sessionStorage.clear();
        /** Redirect to login page */
        window.location.href = '/login';
    }

    private setupModalEventListeners(): void {
        /** Enable 2FA modal */
        const confirmEnable = document.getElementById('confirmEnable2FA');
        const cancelEnable = document.getElementById('cancelEnable2FA');
        if (confirmEnable) {
            confirmEnable.addEventListener('click', () => {
                hideModal('enable2FAModal');
                this.startSetup2FA();
            });
        }
        if (cancelEnable) {
            cancelEnable.addEventListener('click', () => {
                hideModal('enable2FAModal');
                this.resetToggle();
            });
        }
        /** Setup 2FA modal */
        const verify2FASetup = document.getElementById('verify2FASetup');
        const cancelSetup2FA = document.getElementById('cancelSetup2FA');
        const showManualEntry = document.getElementById('showManualEntry');
        
        if (verify2FASetup) {
            verify2FASetup.addEventListener('click', this.verify2FASetup.bind(this));
        }
        if (cancelSetup2FA) {
            cancelSetup2FA.addEventListener('click', () => {
                hideModal('setup2FAModal');
                this.resetToggle();
                this.isSetupInProgress = false;
            });
        }
        if (showManualEntry) {
            showManualEntry.addEventListener('click', () => {
                const section = document.getElementById('manualEntrySection');
                if (section) {
                    section.classList.toggle('hidden');
                }
            });
        }
        /** Disable 2FA modal */
        const confirmDisable = document.getElementById('confirmDisable2FA');
        const cancelDisable = document.getElementById('cancelDisable2FA');
        if (confirmDisable) {
            confirmDisable.addEventListener('click', this.disable2FA.bind(this));
        }
        if (cancelDisable) {
            cancelDisable.addEventListener('click', () => {
                hideModal('disable2FAModal');
                this.resetToggle();
            });
        }
        /** Input formatting for verification codes */
        const verificationInput = document.getElementById('verificationCode') as HTMLInputElement;
        if (verificationInput) {
            verificationInput.addEventListener('input', (e) => {
                const input = e.target as HTMLInputElement;
                input.value = input.value.replace(/\D/g, '');
            });
        }
        const disableInput = document.getElementById('disable2FACode') as HTMLInputElement;
        if (disableInput) {
            disableInput.addEventListener('input', (e) => {
                const input = e.target as HTMLInputElement;
                input.value = input.value.replace(/\D/g, '');
            });
        }
    }

    private async handle2FAToggle(isEnabled: boolean): Promise<void> {
        try {
            if (isEnabled) {
                showModal('enable2FAModal');
            } else {
                showModal('disable2FAModal');
            }
        } catch (error) {
            console.error('Error toggling 2FA:', error);
            this.resetToggle();
        }
    }

    private async startSetup2FA(): Promise<void> {
        try {
            this.isSetupInProgress = true;
            showModal('setup2FAModal');
            const token = localStorage.getItem('token');
            if (!token) throw new Error('No authentication token');
            const response = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.AUTH}/2fa/setup`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });
            if (!response.ok) {
                let errorMessage = 'Failed to setup 2FA';
                try {
                    const errorData = await response.json();
                    console.log('2FA setup error data:', errorData);
                    errorMessage = errorData.error || errorMessage;
                } catch (parseError) {
                    console.error('Failed to parse error response:', parseError);
                    errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }
            const data = await response.json();
            console.log('2FA setup success data:', data);
            this.qrCodeData = data.qrCode;
            this.manualEntryKey = data.manualEntryKey;
            /** Display QR code */
            const qrContainer = document.getElementById('qrCodeContainer');
            if (qrContainer && this.qrCodeData) {
                qrContainer.innerHTML = `<img src="${this.qrCodeData}" alt="2FA QR Code" class="w-48 h-48">`;
            }
            const manualKey = document.getElementById('manualKey');
            if (manualKey && this.manualEntryKey) {
                manualKey.textContent = this.manualEntryKey;
            }
        } catch (error) {
            console.error('Failed to start 2FA setup:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to initialize 2FA setup. Please try again.';
            showNotification(errorMessage, 'error');
            hideModal('setup2FAModal');
            this.resetToggle();
            this.isSetupInProgress = false;
        }
    }

    private async verify2FASetup(): Promise<void> {
        try {
            const verificationCode = (document.getElementById('verificationCode') as HTMLInputElement)?.value;
            if (!verificationCode || verificationCode.length !== 6) {
                showNotification('Please enter a valid 6-digit verification code.', 'error');
                return;
            }
            const token = localStorage.getItem('token');
            if (!token) throw new Error('No authentication token');
            const response = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.AUTH}/2fa/verify`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token: verificationCode })
            });
            if (!response.ok) {
                let errorMessage = 'Invalid verification code';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (parseError) {
                    console.error('Failed to parse error response:', parseError);
                    errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }
            const data = await response.json();
            this.is2FAEnabled = true;
            this.isSetupInProgress = false;
            hideModal('setup2FAModal');
            this.updatePageContent();
            showNotification(data.message || 'Two-Factor Authentication has been enabled successfully!', 'success');
        } catch (error) {
            console.error('Failed to verify 2FA setup:', error);
            const errorMessage = error instanceof Error ? error.message : 'Invalid verification code. Please try again.';
            showNotification(errorMessage, 'error');
        }
    }

    private async disable2FA(): Promise<void> {
        try {
            const disableCode = (document.getElementById('disable2FACode') as HTMLInputElement)?.value;
            const password = (document.getElementById('disable2FAPassword') as HTMLInputElement)?.value;
            if (!disableCode || disableCode.length !== 6) {
                showNotification('Please enter a valid 6-digit code.', 'error');
                return;
            }
            if (!password) {
                showNotification('Please enter your password.', 'error');
                return;
            }
            const token = localStorage.getItem('token');
            if (!token) throw new Error('No authentication token');
            const response = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.AUTH}/2fa/disable`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    token: disableCode,
                    password: password 
                })
            });
            if (!response.ok) {
                let errorMessage = 'Failed to disable 2FA';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (parseError) {
                    console.error('Failed to parse error response:', parseError);
                    errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }
            const data = await response.json();
            this.is2FAEnabled = false;
            hideModal('disable2FAModal');
            this.updatePageContent();
            showNotification(data.message || 'Two-Factor Authentication has been disabled.', 'info');
        } catch (error) {
            console.error('Failed to disable 2FA:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to disable 2FA. Please try again.';
            showNotification(errorMessage, 'error');
        }
    }

    private resetToggle(): void {
        const toggle = document.getElementById('2fa-toggle') as HTMLInputElement;
        if (toggle) toggle.checked = this.is2FAEnabled;
    }

    private updatePageContent(): void {
        const mainContent = document.querySelector('.ml-64');
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="p-8">
                    <h1 class="text-3xl font-bold text-white mb-6">Settings</h1>
                    
                    <!-- Security Settings Section -->
                    <div class="bg-slate-800 p-6 rounded-lg mb-6">
                        <h2 class="text-xl font-semibold text-white mb-4">Security</h2>
                        
                        <!-- 2FA Toggle -->
                        <div class="flex items-center justify-between p-4 bg-slate-700 rounded-lg">
                            <div class="flex-1">
                                <h3 class="text-lg font-medium text-white">Two-Factor Authentication</h3>
                                <p class="text-sm text-gray-400 mt-1">
                                    Add an extra layer of security to your account with 2FA
                                </p>
                            </div>
                            <div class="ml-4">
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        id="2fa-toggle" 
                                        class="sr-only peer" 
                                        ${this.is2FAEnabled ? 'checked' : ''}
                                        ${this.isSetupInProgress ? 'disabled' : ''}
                                    >
                                    <div class="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 ${this.isSetupInProgress ? 'opacity-50 cursor-not-allowed' : ''}"></div>
                                </label>
                            </div>
                        </div>
                        
                        ${this.is2FAEnabled ? this.render2FAStatus() : ''}
                    </div>
                </div>

                ${this.renderModals()}
            `;
            /** Re-setup event listeners */
            this.setupEventListeners();
        }
    }

    public cleanup(): void {
        console.log('Settings page cleaned up');
        /** Remove any event listeners if needed later */
    }

    private renderSidebar(): string {
        return this.getSidebar('/dashboard/settings');
    }

    private getSidebar(activeRoute: string): string {
        const navItems = [
            { route: '/dashboard', icon: '🎮', label: 'Dashboard' },
            { route: '/dashboard/profile', icon: '👤', label: 'Profile' },
            { route: '/dashboard/leaderboard', icon: '🏆', label: 'Leaderboard', active: true },
            { route: '/dashboard/settings', icon: '⚙️', label: 'Settings' },
            { route: '/chat', icon: '💬', label: 'Chat' }
        ];

        return `
            <div class="w-64 bg-slate-800 border-r border-slate-700 flex flex-col h-full">
                <div class="p-6 border-b border-slate-700">
                    <div class="flex items-center space-x-3">
                        <div class="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                            <span class="text-white font-bold text-lg">G</span>
                        </div>
                        <h1 class="text-xl font-bold text-blue-400">GameHub</h1>
                    </div>
                </div>
                
                <nav class="p-4 space-y-2 flex-1">
                    ${navItems.map(item => {
                        const isActive = item.route === activeRoute;
                        const activeClasses = isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700';
                        return `
                            <a href="#" data-route="${item.route}" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg ${activeClasses} transition-colors">
                                <span>${item.icon}</span>
                                <span>${item.label}</span>
                            </a>
                        `;
                    }).join('')}
                    
                    <a href="#" id="logoutBtn" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors">
                        <span>🚪</span>
                        <span>Logout</span>
                    </a>
                </nav>
            </div>
        `;
    }
}