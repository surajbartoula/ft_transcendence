import { Page } from '../router/Router';
import { verifyEmail, resendVerificationCode, LoginResponse } from '../utils/auth';
import { showError, hideError } from '../utils/ui';

export class EmailVerificationPage implements Page {
    public title = 'Email Verification';
    public requiresAuth = false;
    

    private resendButton: HTMLButtonElement | null = null;
    private backButton: HTMLButtonElement | null = null;
    private email: string = '';
    private resendCooldown: number = 0;
    private cooldownInterval: NodeJS.Timeout | null = null;

    constructor() {
        // Get email from session storage (set by login page)
        this.email = sessionStorage.getItem('verificationEmail') || '';
    }

    public render(): string {
        if (!this.email) {
            // If no email, redirect back to login
            setTimeout(() => {
                const event = new CustomEvent('navigateToLogin');
                window.dispatchEvent(event);
            }, 100);
            return '<div>Redirecting...</div>';
        }

        return `
            <div class="min-h-screen flex items-center justify-center px-4" style="background-image: url('./welcome.JPG'); background-size: cover; background-position: center;">
                <div class="w-full max-w-md relative z-10">
                    <div class="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-8 fade-in">
                        <div class="text-center mb-8">
                            <div class="mx-auto h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                <svg class="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                                </svg>
                            </div>
                            <h2 class="text-3xl font-bold text-gray-900">Verify Your Email</h2>
                            <p class="text-gray-600 mt-2">We've sent a verification code to</p>
                            <p class="text-indigo-600 font-semibold">${this.email}</p>
                        </div>

                        <div class="space-y-6">
                            <div>
                                <label for="verificationCode" class="block text-sm font-medium text-gray-700 mb-2">
                                    Verification Code
                                </label>
                                <input type="text" 
                                       id="verificationCode" 
                                       name="verificationCode" 
                                       required
                                       maxlength="6"
                                       class="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                                       placeholder="000000"
                                       autocomplete="one-time-code">
                                <p class="text-xs text-gray-500 mt-1">Enter the 6-digit code from your email</p>
                            </div>

                            <div id="errorMessage" class="hidden bg-red-50 border border-red-200 rounded-lg p-4">
                                <div class="flex">
                                    <svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
                                    </svg>
                                    <span class="ml-2 text-sm text-red-700" id="errorText"></span>
                                </div>
                            </div>

                            <div id="successMessage" class="hidden bg-green-50 border border-green-200 rounded-lg p-4">
                                <div class="flex">
                                    <svg class="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                                    </svg>
                                    <span class="ml-2 text-sm text-green-700" id="successText"></span>
                                </div>
                            </div>

                            <div id="verifyStatus" class="hidden text-center py-3">
                                <div class="flex items-center justify-center">
                                    <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600 mr-2"></div>
                                    <span class="text-indigo-600 font-medium">Verifying...</span>
                                </div>
                            </div>
                        </div>

                        <div class="mt-6 text-center space-y-4">
                            <div>
                                <p class="text-gray-600 text-sm">Didn't receive the code?</p>
                                <button id="resendBtn" 
                                        class="text-indigo-600 hover:text-indigo-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                    <span id="resendText">Resend Code</span>
                                    <span id="resendCooldown" class="hidden">Resend in <span id="cooldownTime">60</span>s</span>
                                </button>
                            </div>
                            
                            <div class="pt-4 border-t border-gray-200">
                                <button id="backToLogin" 
                                        class="text-gray-600 hover:text-gray-800 font-medium transition-colors">
                                    ← Back to Login
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    public initialize(): void {
        this.bindElements();
        this.attachEventListeners();
        this.setupCodeInput();
        this.startInitialCooldown();
    }

    public cleanup(): void {
        if (this.resendButton) {
            this.resendButton.removeEventListener('click', this.handleResend);
        }
        if (this.backButton) {
            this.backButton.removeEventListener('click', this.handleBackToLogin);
        }
        if (this.cooldownInterval) {
            clearInterval(this.cooldownInterval);
        }
    }

    private bindElements(): void {
        this.resendButton = document.getElementById('resendBtn') as HTMLButtonElement;
        this.backButton = document.getElementById('backToLogin') as HTMLButtonElement;
    }

    private attachEventListeners(): void {
        if (this.resendButton) {
            this.resendButton.addEventListener('click', this.handleResend.bind(this));
        }
        if (this.backButton) {
            this.backButton.addEventListener('click', this.handleBackToLogin.bind(this));
        }
    }

    private setupCodeInput(): void {
        const codeInput = document.getElementById('verificationCode') as HTMLInputElement;
        if (codeInput) {
            // Only allow numbers and letters
            codeInput.addEventListener('input', (e) => {
                const target = e.target as HTMLInputElement;
                target.value = target.value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
                
                // Auto-submit when 6 digits are entered
                if (target.value.length === 6) {
                    this.handleVerify();
                }
            });

            // Focus the input on page load
            codeInput.focus();
        }
    }

    private async handleVerify(): Promise<void> {
        this.hideMessages();
        
        const codeInput = document.getElementById('verificationCode') as HTMLInputElement;
        const code = codeInput.value.trim();
        
        if (!code) {
            this.showError('Please enter the verification code');
            return;
        }
        
        if (code.length !== 6) {
            this.showError('Verification code must be 6 digits');
            return;
        }
        
        this.setLoadingState(true);
        
        try {
            const response: LoginResponse = await verifyEmail(this.email, code);
            
            this.showSuccess(response.message || 'Email verified successfully!');
            
            // Store authentication data if provided
            if (response.token && response.user) {
                localStorage.setItem('token', response.token);
                localStorage.setItem('userData', JSON.stringify(response.user));
                
                // Clear verification email from session
                sessionStorage.removeItem('verificationEmail');
                
                // Redirect to dashboard after short delay
                setTimeout(() => {
                    const event = new CustomEvent('authSuccess', {
                        detail: response
                    });
                    window.dispatchEvent(event);
                }, 1500);
            }
            
        } catch (err: any) {
            this.showError(err.message || 'Verification failed');
            // Clear the input on error
            codeInput.value = '';
            codeInput.focus();
        } finally {
            this.setLoadingState(false);
        }
    }

    private async handleResend(): Promise<void> {
        if (this.resendCooldown > 0) return;
        
        this.hideMessages();
        this.setResendLoadingState(true);
        
        try {
            await resendVerificationCode(this.email);
            this.showSuccess('Verification code sent successfully!');
            this.startCooldown(60); // 60 second cooldown
            
        } catch (err: any) {
            this.showError(err.message || 'Failed to resend verification code');
        } finally {
            this.setResendLoadingState(false);
        }
    }

    private handleBackToLogin(): void {
        // Clear verification email from session
        sessionStorage.removeItem('verificationEmail');
        
        const event = new CustomEvent('navigateToLogin');
        window.dispatchEvent(event);
    }

    private startInitialCooldown(): void {
        // Start with 30 second cooldown since code was just sent
        this.startCooldown(30);
    }

    private startCooldown(seconds: number): void {
        this.resendCooldown = seconds;
        this.updateCooldownUI();
        
        this.cooldownInterval = setInterval(() => {
            this.resendCooldown--;
            this.updateCooldownUI();
            
            if (this.resendCooldown <= 0) {
                if (this.cooldownInterval) {
                    clearInterval(this.cooldownInterval);
                }
            }
        }, 1000);
    }

    private updateCooldownUI(): void {
        const resendText = document.getElementById('resendText');
        const resendCooldown = document.getElementById('resendCooldown');
        const cooldownTime = document.getElementById('cooldownTime');
        
        if (this.resendCooldown > 0) {
            if (resendText) resendText.classList.add('hidden');
            if (resendCooldown) resendCooldown.classList.remove('hidden');
            if (cooldownTime) cooldownTime.textContent = this.resendCooldown.toString();
            if (this.resendButton) this.resendButton.disabled = true;
        } else {
            if (resendText) resendText.classList.remove('hidden');
            if (resendCooldown) resendCooldown.classList.add('hidden');
            if (this.resendButton) this.resendButton.disabled = false;
        }
    }

    private showError(message: string): void {
        const errorDiv = document.getElementById('errorMessage');
        const errorText = document.getElementById('errorText');
        const successDiv = document.getElementById('successMessage');
        
        if (successDiv) successDiv.classList.add('hidden');
        if (errorText) errorText.textContent = message;
        if (errorDiv) errorDiv.classList.remove('hidden');
    }

    private showSuccess(message: string): void {
        const successDiv = document.getElementById('successMessage');
        const successText = document.getElementById('successText');
        const errorDiv = document.getElementById('errorMessage');
        
        if (errorDiv) errorDiv.classList.add('hidden');
        if (successText) successText.textContent = message;
        if (successDiv) successDiv.classList.remove('hidden');
    }

    private hideMessages(): void {
        const errorDiv = document.getElementById('errorMessage');
        const successDiv = document.getElementById('successMessage');
        
        if (errorDiv) errorDiv.classList.add('hidden');
        if (successDiv) successDiv.classList.add('hidden');
    }

    private setLoadingState(isLoading: boolean): void {
        const codeInput = document.getElementById('verificationCode') as HTMLInputElement;
        const verifyStatus = document.getElementById('verifyStatus') as HTMLElement;
        
        if (this.resendButton) this.resendButton.disabled = isLoading || this.resendCooldown > 0;
        if (this.backButton) this.backButton.disabled = isLoading;
        if (codeInput) codeInput.disabled = isLoading;
        
        if (verifyStatus) {
            verifyStatus.classList.toggle('hidden', !isLoading);
        }
    }

    private setResendLoadingState(isLoading: boolean): void {
        const resendText = document.getElementById('resendText');
        
        if (resendText && !isLoading && this.resendCooldown <= 0) {
            resendText.textContent = 'Resend Code';
        } else if (resendText && isLoading) {
            resendText.textContent = 'Sending...';
        }
        
        if (this.resendButton) {
            this.resendButton.disabled = isLoading || this.resendCooldown > 0;
        }
    }
}