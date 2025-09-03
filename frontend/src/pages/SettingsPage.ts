import { Page } from '../router/Router';
import { showModal, hideModal, showNotification } from '../utils/ui';
import { API_CONFIG } from '../config';
import { changePassword } from '../utils/auth';

// Global flags to prevent multiple requests across all instances
const GlobalOperationFlags = {
    isPasswordChangeInProgress: false,
    is2FASetupInProgress: false,
    is2FAVerifyInProgress: false,
    is2FADisableInProgress: false
};

export class SettingsPage implements Page {
    public title = 'Settings';
    public requiresAuth = true;
    private is2FAEnabled = false;
    private isGoogleUser = false;
    private qrCodeData: string = '';
    private manualEntryKey: string = '';
    private isSetupInProgress = false;
    private listenersSetup = false;

    public render(): string {
        return `
            <div class="fixed inset-0 flex h-screen bg-black relative overflow-hidden">
                <!-- Tron-inspired animated background -->
                <div class="absolute inset-0 opacity-30">
                    <!-- Animated grid -->
                    <div class="absolute inset-0" style="background-image: 
                        linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px);
                        background-size: 40px 40px; 
                        animation: grid-move 20s linear infinite;">
                    </div>
                    
                    <!-- Glowing circuit lines -->
                    <div class="absolute inset-0">
                        <div class="absolute top-1/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent shadow-cyan-500 shadow-sm animate-pulse" style="animation: line-glow 3s ease-in-out infinite;"></div>
                        <div class="absolute top-3/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-blue-500 shadow-sm animate-pulse" style="animation: line-glow 3s ease-in-out infinite; animation-delay: 1.5s;"></div>
                        <div class="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-purple-500 to-transparent shadow-purple-500 shadow-sm animate-pulse" style="animation: line-glow 3s ease-in-out infinite; animation-delay: 0.5s;"></div>
                        <div class="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-transparent via-pink-500 to-transparent shadow-pink-500 shadow-sm animate-pulse" style="animation: line-glow 3s ease-in-out infinite; animation-delay: 2s;"></div>
                    </div>
                    
                    <!-- Floating particles -->
                    <div class="absolute inset-0">
                        <div class="absolute w-1 h-1 bg-cyan-400 rounded-full animate-ping" style="top: 20%; left: 15%; animation-delay: 0s;"></div>
                        <div class="absolute w-1 h-1 bg-blue-400 rounded-full animate-ping" style="top: 60%; left: 80%; animation-delay: 1s;"></div>
                        <div class="absolute w-1 h-1 bg-purple-400 rounded-full animate-ping" style="top: 40%; left: 60%; animation-delay: 2s;"></div>
                        <div class="absolute w-1 h-1 bg-pink-400 rounded-full animate-ping" style="top: 80%; left: 30%; animation-delay: 1.5s;"></div>
                    </div>
                    
                    <!-- Hexagonal pattern overlay -->
                    <div class="absolute inset-0 opacity-10" style="background-image: radial-gradient(circle at 25px 25px, rgba(0, 255, 255, 0.2) 2px, transparent 2px); background-size: 50px 50px;"></div>
                </div>
                
                <style>
                    @keyframes grid-move {
                        0% { transform: translate(0, 0); }
                        100% { transform: translate(40px, 40px); }
                    }
                    
                    @keyframes line-glow {
                        0%, 100% { opacity: 0.3; box-shadow: 0 0 5px currentColor; }
                        50% { opacity: 1; box-shadow: 0 0 20px currentColor, 0 0 30px currentColor; }
                    }
                    
                    .tron-glow {
                        box-shadow: 0 0 10px rgba(0, 255, 255, 0.3), 0 0 20px rgba(0, 255, 255, 0.1);
                    }
                    
                    .tron-border {
                        border: 1px solid rgba(0, 255, 255, 0.3);
                        position: relative;
                    }
                    
                    .tron-border::before {
                        content: '';
                        position: absolute;
                        top: -1px;
                        left: -1px;
                        right: -1px;
                        bottom: -1px;
                        background: linear-gradient(45deg, transparent, rgba(0, 255, 255, 0.1), transparent);
                        z-index: -1;
                        border-radius: inherit;
                    }
                </style>
                ${this.renderSidebar()}
                <div class="flex-1 p-8 overflow-y-auto relative z-10 bg-slate-900/50 backdrop-blur-sm">
                    <div class="fade-in">
                        <h1 class="text-3xl font-bold text-cyan-400 mb-6">Settings</h1>
                        
                        <!-- Security Settings Section -->
                        <div class="bg-slate-800/70 backdrop-blur-sm p-6 rounded-lg mb-6 tron-border tron-glow">
                            <h2 class="text-xl font-semibold text-cyan-300 mb-4">Security</h2>
                            
                            <!-- Password Change Section -->
                            <div id="password-section-container" class="mb-6">
                                ${this.renderPasswordSection()}
                            </div>
                            
                            <!-- 2FA Section -->
                            <div id="2fa-section-container">
                                ${this.render2FASection()}
                            </div>
                        </div>
                        
                    </div>
                </div>
                ${this.renderModals()}
            </div>
        `;
    }

    private renderPasswordSection(): string {
        if (this.isGoogleUser) {
            return this.renderGooglePasswordSection();
        } else {
            return this.renderRegularPasswordSection();
        }
    }

    private renderGooglePasswordSection(): string {
        return `
            <div class="p-4 bg-slate-700/70 backdrop-blur-sm rounded-lg tron-border">
                <div class="flex items-start space-x-4">
                    <div class="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-full flex items-center justify-center tron-glow">
                        <svg class="h-6 w-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                    </div>
                    <div class="flex-1">
                        <h3 class="text-lg font-medium text-cyan-300 mb-2">Google Account Password</h3>
                        <div class="text-sm text-gray-300 space-y-2">
                            <p>🔒 Your password is managed through your Google account.</p>
                            <p>🔄 To change your password, visit your <a href="https://myaccount.google.com/password" target="_blank" class="text-cyan-400 hover:text-cyan-300 underline">Google Account Password</a> settings.</p>
                            <p>⚡ Changes to your Google password will automatically apply to this account.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    private renderRegularPasswordSection(): string {
        return `
            <div class="flex items-center justify-between p-4 bg-slate-700/70 backdrop-blur-sm rounded-lg tron-border">
                <div class="flex-1">
                    <h3 class="text-lg font-medium text-cyan-300">Password</h3>
                    <p class="text-sm text-gray-400 mt-1">
                        Change your account password to keep it secure
                    </p>
                </div>
                <div class="ml-4">
                    <button 
                        id="changePasswordBtn" 
                        class="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-medium py-2 px-4 rounded transition-all duration-300 tron-glow"
                    >
                        Change Password
                    </button>
                </div>
            </div>
        `;
    }

    private render2FASection(): string {
        if (this.isGoogleUser) {
            return this.renderGoogle2FASection();
        } else {
            return this.renderRegular2FASection();
        }
    }

    private renderGoogle2FASection(): string {
        return `
            <!-- Google OAuth User 2FA Section -->
            <div class="p-4 bg-slate-700/70 backdrop-blur-sm rounded-lg tron-border">
                <div class="flex items-start space-x-4">
                    <div class="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-full flex items-center justify-center tron-glow">
                        <svg class="h-6 w-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                    </div>
                    <div class="flex-1">
                        <h3 class="text-lg font-medium text-cyan-300 mb-2">Google Account Security</h3>
                        <div class="text-sm text-gray-300 space-y-2">
                            <p>🔒 Your account is protected by Google's advanced security features.</p>
                            <p>🛡️ Two-Factor Authentication is managed through your Google account settings.</p>
                            <p>⚙️ To enable/disable 2FA, visit your <a href="https://myaccount.google.com/security" target="_blank" class="text-cyan-400 hover:text-cyan-300 underline">Google Account Security</a> settings.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    private renderRegular2FASection(): string {
        return `
            <!-- Regular User 2FA Toggle -->
            <div class="flex items-center justify-between p-4 bg-slate-700/70 backdrop-blur-sm rounded-lg tron-border">
                <div class="flex-1">
                    <h3 class="text-lg font-medium text-cyan-300">Two-Factor Authentication</h3>
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
                        <div class="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-cyan-500 peer-checked:to-cyan-600 ${this.isSetupInProgress ? 'opacity-50 cursor-not-allowed' : ''}"></div>
                    </label>
                </div>
            </div>
            
            <!-- 2FA Status Container - This will be updated dynamically -->
            <div id="2fa-status-container">
                ${this.is2FAEnabled ? this.render2FAStatus() : ''}
            </div>
        `;
    }

    private render2FAStatus(): string {
        return `
            <div class="mt-4 p-4 bg-green-900/20 border border-green-800/50 rounded-lg tron-border">
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
        /** Only render modals for regular users */
        if (this.isGoogleUser) {
            return '';
        }
        return `
            <!-- Change Password Modal -->
            <div id="changePasswordModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 hidden">
                <div class="bg-slate-800/90 backdrop-blur-md rounded-lg shadow-xl w-96 max-w-md mx-4 tron-border tron-glow">
                    <div class="p-6">
                        <div class="flex items-center mb-4">
                            <div class="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-full flex items-center justify-center mr-3 tron-glow">
                                <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m0 0a2 2 0 012 2 2 2 0 00-2 2m-2-2h.01M9 9h.01M9 12h.01M9 15h.01M12 9h.01M12 12h.01M12 15h.01" />
                                </svg>
                            </div>
                            <h3 class="text-lg font-medium text-cyan-300">Change Password</h3>
                        </div>
                        
                        <form id="changePasswordForm" class="space-y-4">
                            <!-- Current Password -->
                            <div>
                                <label class="block text-sm font-medium text-cyan-400 mb-2">
                                    Current Password
                                </label>
                                <input 
                                    type="password" 
                                    id="currentPassword" 
                                    placeholder="Enter your current password" 
                                    class="w-full px-3 py-2 bg-slate-900/50 border border-cyan-500/30 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 tron-glow transition-all"
                                    required
                                >
                            </div>
                            
                            <!-- New Password -->
                            <div>
                                <label class="block text-sm font-medium text-cyan-400 mb-2">
                                    New Password
                                </label>
                                <input 
                                    type="password" 
                                    id="newPassword" 
                                    placeholder="Enter your new password" 
                                    class="w-full px-3 py-2 bg-slate-900/50 border border-cyan-500/30 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 tron-glow transition-all"
                                    required
                                    minlength="6"
                                >
                                <p class="text-xs text-gray-400 mt-1">Password must be at least 6 characters long</p>
                            </div>
                            
                            <!-- Confirm New Password -->
                            <div>
                                <label class="block text-sm font-medium text-cyan-400 mb-2">
                                    Confirm New Password
                                </label>
                                <input 
                                    type="password" 
                                    id="confirmNewPassword" 
                                    placeholder="Confirm your new password" 
                                    class="w-full px-3 py-2 bg-slate-900/50 border border-cyan-500/30 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 tron-glow transition-all"
                                    required
                                >
                            </div>
                        </form>
                        
                        <div class="flex gap-3 mt-6">
                            <button id="confirmPasswordChange" class="flex-1 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-medium py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 tron-glow">
                                Change Password
                            </button>
                            <button id="cancelPasswordChange" class="flex-1 bg-slate-600/70 hover:bg-slate-500/70 text-white font-medium py-2 px-4 rounded transition-all duration-300 tron-border">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Enable 2FA Confirmation Modal -->
            <div id="enable2FAModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 hidden">
                <div class="bg-slate-800/90 backdrop-blur-md rounded-lg shadow-xl w-96 max-w-md mx-4 tron-border tron-glow">
                    <div class="p-6">
                        <div class="flex items-center mb-4">
                            <div class="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-full flex items-center justify-center mr-3 tron-glow">
                                <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-1a2 2 0 00-2-2H6a2 2 0 00-2 2v1a2 2 0 002 2zM12 15V9m0 0l4-4m-4 4L8 5" />
                                </svg>
                            </div>
                            <h3 class="text-lg font-medium text-cyan-300">Enable Two-Factor Authentication</h3>
                        </div>
                        <p class="text-sm text-gray-300 mb-6">
                            This will require you to use an authenticator app to generate codes when logging in, significantly increasing your account security.
                        </p>
                        <div class="flex gap-3">
                            <button id="confirmEnable2FA" class="flex-1 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-medium py-2 px-4 rounded transition-all duration-300 tron-glow">
                                Enable 2FA
                            </button>
                            <button id="cancelEnable2FA" class="flex-1 bg-slate-600/70 hover:bg-slate-500/70 text-white font-medium py-2 px-4 rounded transition-all duration-300 tron-border">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 2FA Setup Modal with QR Code -->
            <div id="setup2FAModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 hidden">
                <div class="bg-slate-800/90 backdrop-blur-md rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto tron-border tron-glow">
                    <div class="p-6">
                        <div class="flex items-center mb-4">
                            <div class="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-full flex items-center justify-center mr-3 tron-glow">
                                <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                                </svg>
                            </div>
                            <h3 class="text-lg font-medium text-cyan-300">Set up Two-Factor Authentication</h3>
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
                            <button id="showManualEntry" class="text-cyan-400 hover:text-cyan-300 text-sm underline transition-colors">
                                Can't scan QR code? Enter manually
                            </button>
                            <div id="manualEntrySection" class="hidden mt-3 p-3 bg-slate-700/70 backdrop-blur-sm rounded tron-border">
                                <p class="text-sm text-cyan-300 mb-2">Manual entry key:</p>
                                <code id="manualKey" class="text-xs text-green-400 bg-slate-900/70 p-2 rounded block break-all tron-border"></code>
                            </div>
                        </div>

                        <!-- Verification Code Input -->
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-cyan-400 mb-2">
                                Enter verification code from your authenticator app:
                            </label>
                            <input 
                                type="text" 
                                id="verificationCode" 
                                maxlength="6" 
                                placeholder="123456" 
                                class="w-full px-3 py-2 bg-slate-900/50 border border-cyan-500/30 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-center text-lg tracking-widest tron-glow transition-all"
                            >
                        </div>

                        <!-- Action Buttons -->
                        <div class="flex gap-3">
                            <button id="verify2FASetup" class="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white font-medium py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 tron-glow">
                                Verify & Enable
                            </button>
                            <button id="cancelSetup2FA" class="flex-1 bg-slate-600/70 hover:bg-slate-500/70 text-white font-medium py-2 px-4 rounded transition-all duration-300 tron-border">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Disable 2FA Confirmation Modal -->
            <div id="disable2FAModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 hidden">
                <div class="bg-slate-800/90 backdrop-blur-md rounded-lg shadow-xl w-96 max-w-md mx-4 tron-border tron-glow">
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
                            <label class="block text-sm font-medium text-cyan-400 mb-2">
                                Enter your password:
                            </label>
                            <input 
                                type="password" 
                                id="disable2FAPassword" 
                                placeholder="Enter your password" 
                                class="w-full px-3 py-2 bg-slate-900/50 border border-cyan-500/30 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-400 tron-glow transition-all"
                            >
                        </div>
                        
                        <!-- 2FA Code Input -->
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-cyan-400 mb-2">
                                Enter your current 2FA code to confirm:
                            </label>
                            <input 
                                type="text" 
                                id="disable2FACode" 
                                maxlength="6" 
                                placeholder="123456" 
                                class="w-full px-3 py-2 bg-slate-900/50 border border-cyan-500/30 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-400 text-center text-lg tracking-widest tron-glow transition-all"
                            >
                        </div>
                        
                        <div class="flex gap-3">
                            <button id="confirmDisable2FA" class="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white font-medium py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 tron-glow">
                                Disable 2FA
                            </button>
                            <button id="cancelDisable2FA" class="flex-1 bg-slate-600/70 hover:bg-slate-500/70 text-white font-medium py-2 px-4 rounded transition-all duration-300 tron-border">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    public initialize(): void {
        if (this.listenersSetup) {
            // If listeners are already setup, just update the page content
            this.updatePageContent();
        } else {
            // First time initialization - setup listeners and load data
            this.setupEventListeners();
            this.loadUserSettings();
        }
    }

    private async loadUserSettings(): Promise<void> {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            /** First, get user info to check if they're a Google user */
            const userResponse = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.AUTH}/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (userResponse.ok) {
                const userData = await userResponse.json();
                this.isGoogleUser = !!userData.user?.google_id;
            }
            /** Only check 2FA status for regular users */
            if (!this.isGoogleUser) {
                const response = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.AUTH}/2fa/status`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    this.is2FAEnabled = data.two_factor_enabled;
                }
            }
            this.updatePageContent();
        } catch (error) {
            console.error('Failed to load user settings:', error);
        }
    }

    private setupEventListeners(): void {
        if (this.listenersSetup) return;
        /** Add single delegated listeners */
        document.addEventListener('change', this.handleDocumentChange);
        document.addEventListener('click', this.handleDocumentClick);
        document.addEventListener('input', this.handleDocumentInput);
        document.addEventListener('submit', this.handleDocumentSubmit);
        this.listenersSetup = true;
    }

    /** Event delegation handlers */
    private handleDocumentChange = (e: Event) => {
        const target = e.target as HTMLElement;
        if (target.id === '2fa-toggle' && !this.isGoogleUser) {
            const isEnabled = (target as HTMLInputElement).checked;
            this.handle2FAToggle(isEnabled);
        }
    };

    private handleDocumentClick = (e: Event) => {
        const target = e.target as HTMLElement;
        if (target.id === 'logoutBtn' || target.closest('#logoutBtn')) {
            e.preventDefault();
            e.stopPropagation();
            // Dispatch logout event to be handled by main.ts
            window.dispatchEvent(new CustomEvent('logout'));
            return;
        }
        switch (target.id) {
            case 'changePasswordBtn':
                e.preventDefault();
                e.stopPropagation();
                showModal('changePasswordModal');
                break;
            case 'confirmPasswordChange':
                e.preventDefault();
                e.stopPropagation();
                this.handlePasswordChange();
                break;
            case 'cancelPasswordChange':
                e.preventDefault();
                e.stopPropagation();
                hideModal('changePasswordModal');
                this.clearPasswordForm();
                break;
            case 'confirmEnable2FA':
                e.preventDefault();
                e.stopPropagation();
                hideModal('enable2FAModal');
                this.startSetup2FA();
                break;
            case 'cancelEnable2FA':
                e.preventDefault();
                e.stopPropagation();
                hideModal('enable2FAModal');
                this.resetToggle();
                break;
            case 'verify2FASetup':
                e.preventDefault();
                e.stopPropagation();
                this.verify2FASetup();
                break;
            case 'cancelSetup2FA':
                e.preventDefault();
                e.stopPropagation();
                hideModal('setup2FAModal');
                this.resetToggle();
                this.isSetupInProgress = false;
                break;
            case 'showManualEntry':
                e.preventDefault();
                e.stopPropagation();
                const section = document.getElementById('manualEntrySection');
                if (section) {
                    section.classList.toggle('hidden');
                }
                break;
            case 'confirmDisable2FA':
                e.preventDefault();
                e.stopPropagation();
                this.disable2FA();
                break;
            case 'cancelDisable2FA':
                e.preventDefault();
                e.stopPropagation();
                hideModal('disable2FAModal');
                this.resetToggle();
                break;
        }
        /** Handle sidebar navigation */
        if ((target.classList.contains('sidebar-item') || target.closest('.sidebar-item')) && target.id !== 'logoutBtn'){
            const sidebarItem = target.classList.contains('sidebar-item') ? target : target.closest('.sidebar-item');
            const route = sidebarItem?.getAttribute('data-route');
            if (route) {
                e.preventDefault();
                window.location.hash = route;
            }
        }
    };

    private handleDocumentInput = (e: Event) => {
        const target = e.target as HTMLInputElement;
        /** Format verification code inputs to numbers only */
        if (target.id === 'verificationCode' || target.id === 'disable2FACode') {
            target.value = target.value.replace(/\D/g, '');
        }
    };

    private handleDocumentSubmit = (e: Event) => {
        const target = e.target as HTMLFormElement;
        /** Prevent default form submission for our forms */
        if (target.id === 'changePasswordForm') {
            e.preventDefault();
            e.stopPropagation();
            // Form submission is handled by button click handlers
        }
    };


    private async handlePasswordChange(): Promise<void> {
        if (GlobalOperationFlags.isPasswordChangeInProgress) return;
        try {
            GlobalOperationFlags.isPasswordChangeInProgress = true;
            const currentPasswordInput = document.getElementById('currentPassword') as HTMLInputElement;
            const newPasswordInput = document.getElementById('newPassword') as HTMLInputElement;
            const confirmPasswordInput = document.getElementById('confirmNewPassword') as HTMLInputElement;

            if (!currentPasswordInput || !newPasswordInput || !confirmPasswordInput) {
                showNotification('Form fields not found', 'error');
                GlobalOperationFlags.isPasswordChangeInProgress = false;
                return;
            }

            const currentPassword = currentPasswordInput.value;
            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            // Validation
            if (!currentPassword || !newPassword || !confirmPassword) {
                showNotification('All fields are required', 'error');
                GlobalOperationFlags.isPasswordChangeInProgress = false;
                return;
            }

            if (newPassword.length < 6) {
                showNotification('New password must be at least 6 characters long', 'error');
                GlobalOperationFlags.isPasswordChangeInProgress = false;
                return;
            }

            if (newPassword !== confirmPassword) {
                showNotification('New passwords do not match', 'error');
                GlobalOperationFlags.isPasswordChangeInProgress = false;
                return;
            }

            if (currentPassword === newPassword) {
                showNotification('New password must be different from current password', 'error');
                GlobalOperationFlags.isPasswordChangeInProgress = false;
                return;
            }

            // Disable the button to prevent double submission
            const confirmBtn = document.getElementById('confirmPasswordChange') as HTMLButtonElement;
            if (confirmBtn) {
                confirmBtn.disabled = true;
                confirmBtn.textContent = 'Changing...';
            }

            try {
                const result = await changePassword(currentPassword, newPassword);
                hideModal('changePasswordModal');
                this.clearPasswordForm();
                showNotification(result.message || 'Password changed successfully', 'success');
            } catch (error) {
                console.error('Password change error:', error);
                const errorMessage = error instanceof Error ? error.message : 'Failed to change password. Please try again.';
                showNotification(errorMessage, 'error');
            } finally {
                // Re-enable the button
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = 'Change Password';
                }
            }
        } catch (error) {
            console.error('Password change handler error:', error);
            showNotification('An unexpected error occurred', 'error');
        } finally {
            GlobalOperationFlags.isPasswordChangeInProgress = false;
        }
    }

    private clearPasswordForm(): void {
        const currentPasswordInput = document.getElementById('currentPassword') as HTMLInputElement;
        const newPasswordInput = document.getElementById('newPassword') as HTMLInputElement;
        const confirmPasswordInput = document.getElementById('confirmNewPassword') as HTMLInputElement;

        if (currentPasswordInput) currentPasswordInput.value = '';
        if (newPasswordInput) newPasswordInput.value = '';
        if (confirmPasswordInput) confirmPasswordInput.value = '';
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
        if (GlobalOperationFlags.is2FASetupInProgress) return;
        try {
            GlobalOperationFlags.is2FASetupInProgress = true;
            this.isSetupInProgress = true;
            this.updateToggleState();
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
                    errorMessage = errorData.error || errorMessage;
                } catch (parseError) {
                    console.error('Failed to parse error response:', parseError);
                    errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }
            const data = await response.json();
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
        } finally {
            GlobalOperationFlags.is2FASetupInProgress = false;
        }
    }

    private async verify2FASetup(): Promise<void> {
        if (GlobalOperationFlags.is2FAVerifyInProgress) return;
        try {
            GlobalOperationFlags.is2FAVerifyInProgress = true;
            const verificationCode = (document.getElementById('verificationCode') as HTMLInputElement)?.value;
            if (!verificationCode || verificationCode.length !== 6) {
                showNotification('Please enter a valid 6-digit verification code.', 'error');
                GlobalOperationFlags.is2FAVerifyInProgress = false;
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
            showNotification(data.message, 'success');
        } catch (error) {
            console.error('Failed to verify 2FA setup:', error);
            const errorMessage = error instanceof Error ? error.message : 'Invalid verification code. Please try again.';
            showNotification(errorMessage, 'error');
        } finally {
            GlobalOperationFlags.is2FAVerifyInProgress = false;
        }
    }

    private async disable2FA(): Promise<void> {
        if (GlobalOperationFlags.is2FADisableInProgress) return;
        try {
            GlobalOperationFlags.is2FADisableInProgress = true;
            const disableCode = (document.getElementById('disable2FACode') as HTMLInputElement)?.value;
            const password = (document.getElementById('disable2FAPassword') as HTMLInputElement)?.value;
            if (!disableCode || disableCode.length !== 6) {
                showNotification('Please enter a valid 6-digit code.', 'error');
                GlobalOperationFlags.is2FADisableInProgress = false;
                return;
            }
            if (!password) {
                showNotification('Please enter your password.', 'error');
                GlobalOperationFlags.is2FADisableInProgress = false;
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
        } finally {
            GlobalOperationFlags.is2FADisableInProgress = false;
        }
    }

    private resetToggle(): void {
        if (!this.isGoogleUser) {
            const toggle = document.getElementById('2fa-toggle') as HTMLInputElement;
            if (toggle) toggle.checked = this.is2FAEnabled;
        }
    }

    private updateToggleState(): void {
        if (!this.isGoogleUser) {
            const toggle = document.getElementById('2fa-toggle') as HTMLInputElement;
            const toggleContainer = toggle?.parentElement?.querySelector('div');
            if (toggle) {
                toggle.checked = this.is2FAEnabled;
                toggle.disabled = this.isSetupInProgress;
            }
            if (toggleContainer) {
                if (this.isSetupInProgress) {
                    toggleContainer.classList.add('opacity-50', 'cursor-not-allowed');
                } else {
                    toggleContainer.classList.remove('opacity-50', 'cursor-not-allowed');
                }
            }
        }
    }

    private updatePageContent(): void {
        /** Re-render the password section */
        const passwordContainer = document.getElementById('password-section-container');
        if (passwordContainer) {
            passwordContainer.innerHTML = this.renderPasswordSection();
        }

        /** Re-render the entire 2FA section now that we know if user is Google user */
        const twoFAContainer = document.getElementById('2fa-section-container');
        if (twoFAContainer) {
            twoFAContainer.innerHTML = this.render2FASection();
        } else {
            /** Find and replace the 2FA content in the security section */
            const securitySection = document.querySelector('.bg-slate-800.p-6.rounded-lg.mb-6');
            if (securitySection) {
                const h2Element = securitySection.querySelector('h2');
                if (h2Element && h2Element.textContent === 'Security') {
                    /** Find and replace the 2FA section content */
                    const render2FAContainer = securitySection.querySelector('.p-4.bg-slate-700.rounded-lg');
                    if (render2FAContainer) {
                        render2FAContainer.outerHTML = this.render2FASection();
                    }
                }
            }
        }
        
        const statusContainer = document.getElementById('2fa-status-container');
        if (statusContainer) {
            statusContainer.innerHTML = this.is2FAEnabled ? this.render2FAStatus() : '';
        }
        this.updateToggleState();
    }

    public cleanup(): void {
        document.removeEventListener('change', this.handleDocumentChange);
        document.removeEventListener('click', this.handleDocumentClick);
        document.removeEventListener('input', this.handleDocumentInput);
        document.removeEventListener('submit', this.handleDocumentSubmit);
        this.listenersSetup = false;
    }

    private renderSidebar(): string {
        return this.getSidebar();
    }

    private getSidebar(): string {
        return `
            <div class="w-64 bg-slate-900/90 backdrop-blur-sm border-r border-cyan-500/30 flex flex-col h-full relative z-10 tron-glow">
                <div class="p-6 border-b border-cyan-500/30">
                    <div class="flex items-center space-x-3">
                        <div class="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center tron-glow">
                            <span class="text-white font-bold text-lg">G</span>
                        </div>
                        <h1 class="text-xl font-bold text-cyan-400">GameHub</h1>
                    </div>
                </div>
                
                <nav class="p-4 space-y-2 flex-1">
                    <a href="#" data-route="/dashboard" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg text-slate-300 hover:text-cyan-400 hover:bg-slate-800/50 transition-all duration-300 hover:tron-border">
                        <span>🎮</span>
                        <span>Dashboard</span>
                    </a>
                    <a href="#" data-route="/dashboard/profile" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg text-slate-300 hover:text-cyan-400 hover:bg-slate-800/50 transition-all duration-300 hover:tron-border">
                        <span>👤</span>
                        <span>Profile</span>
                    </a>
                    <a href="#" data-route="/dashboard/leaderboard" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg text-slate-300 hover:text-cyan-400 hover:bg-slate-800/50 transition-all duration-300 hover:tron-border">
                        <span>🏆</span>
                        <span>Leaderboard</span>
                    </a>
                    <a href="#" data-route="/dashboard/settings" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 transition-all duration-300 tron-border tron-glow">
                        <span>⚙️</span>
                        <span>Settings</span>
                    </a>
                    <a href="#" data-route="/chat" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg text-slate-300 hover:text-cyan-400 hover:bg-slate-800/50 transition-all duration-300 hover:tron-border">
                        <span>💬</span>
                        <span>Chat</span>
                    </a>
                    <a href="#" id="logoutBtn" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-all duration-300">
                        <span>🚪</span>
                        <span>Logout</span>
                    </a>
                </nav>
            </div>
        `;
    }
}