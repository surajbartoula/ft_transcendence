import { Page } from '../router/Router';
import { login, register, User, LoginResponse } from '../utils/auth';
import { showError, hideError } from '../utils/ui';
import { showModal, hideModal, showNotification } from '../utils/ui';
import { API_CONFIG } from '../config';

export class LoginPage implements Page {
    public title = 'Login';
    public requiresAuth = false;
    
    private isLoginMode = true;
    private form: HTMLFormElement | null = null;
    private switchButton: HTMLButtonElement | null = null;
    private googleButton: HTMLButtonElement | null = null;
    private pendingLoginData: { email: string; password: string; } | null = null;

    public render(): string {
        return `
            <div class="min-h-screen flex items-center justify-center px-4" style="background-image: url('./welcome.JPG'); background-size: cover; background-position: center;">
                <div class="w-full max-w-md relative z-10">
                    <div class="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-8 fade-in">
                        <div class="text-center mb-8">
                            <div class="mx-auto h-16 w-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                                <svg class="h-8 w-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                                </svg>
                            </div>
                            <h2 class="text-3xl font-bold text-gray-900">Welcome to Ping Pong</h2>
                            <p class="text-gray-600 mt-2">${this.isLoginMode ? 'Please sign in to your account' : 'Create your new account'}</p>
                        </div>

                        <form id="authForm" class="space-y-6">
                            <div id="nameField" class="${this.isLoginMode ? 'hidden' : ''}">
                                <label for="name" class="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                                <input type="text" id="name" name="name" 
                                       class="w-full px-4 py-3 text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                                       placeholder="Enter your full name"
                                       ${!this.isLoginMode ? 'required' : ''}>
                            </div>
                            
                            <div>
                                <label for="email" class="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                                <input type="email" id="email" name="email" required
                                       class="w-full px-4 py-3 text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                                       placeholder="Enter your email">
                            </div>
                            
                            <div>
                                <label for="password" class="block text-sm font-medium text-gray-700 mb-2">Password</label>
                                <input type="password" id="password" name="password" required
                                       class="w-full px-4 py-3 text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                                       placeholder="${this.isLoginMode ? 'Enter your password' : 'Minimum 6 characters'}"
                                       ${!this.isLoginMode ? 'minlength="6"' : ''}>
                                ${!this.isLoginMode ? '<p class="text-xs text-gray-500 mt-1">Password must be at least 6 characters long</p>' : ''}
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

                            <button type="submit" id="submitBtn"
                                    class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 focus:ring-4 focus:ring-indigo-300">
                                <span id="submitText">${this.isLoginMode ? 'Sign In' : 'Sign Up'}</span>
                                <div id="submitLoading" class="hidden items-center justify-center">
                                    <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                    <span id="loadingText">${this.isLoginMode ? 'Signing In...' : 'Creating Account...'}</span>
                                </div>
                            </button>

                            <div class="flex items-center gap-4 my-6">
                                <hr class="flex-grow border-t border-gray-300" />
                                <span class="text-gray-500 text-sm">or</span>
                                <hr class="flex-grow border-t border-gray-300" />
                            </div>

                            <button type="button" id="googleSignInBtn" class="relative w-full flex items-center justify-center px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg focus:ring-4 focus:ring-indigo-300 transform hover:scale-105 transition-all duration-200">
                                <span id="googleBtnText" class="flex items-center justify-center gap-2">
                                    <svg class="w-5 h-5" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                    </svg>
                                    <span>Continue with Google</span>
                                </span>
                                <span id="googleBtnLoading" class="hidden absolute inset-0 items-center justify-center gap-2 bg-indigo-600 rounded-lg">
                                    <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    Connecting...
                                </span>
                            </button>
                        </form>

                        <div class="mt-6 text-center">
                            <p class="text-gray-600">
                                <span id="switchText">${this.isLoginMode ? "Don't have an account?" : 'Already have an account?'}</span>
                                <button id="switchMode" class="text-indigo-600 hover:text-indigo-700 font-semibold ml-1 transition-colors">
                                    ${this.isLoginMode ? 'Sign Up' : 'Sign In'}
                                </button>
                            </p>
                        </div>
                    </div>
                </div>

                ${this.render2FAModal()}
            </div>
        `;
    }

    private render2FAModal(): string {
        return `
            <!-- 2FA Verification Modal -->
            <div id="twoFactorModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 hidden">
                <div class="bg-white rounded-lg shadow-xl w-96 max-w-md mx-4">
                    <div class="p-6">
                        <div class="flex items-center mb-4">
                            <div class="flex-shrink-0 w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
                                <svg class="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <h3 class="text-lg font-medium text-gray-900">Two-Factor Authentication</h3>
                        </div>
                        
                        <p class="text-sm text-gray-600 mb-6">
                            Please enter the 6-digit code from your authenticator app to complete the login process.
                        </p>

                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                Verification Code
                            </label>
                            <input 
                                type="text" 
                                id="twoFactorCode" 
                                maxlength="6" 
                                placeholder="123456" 
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-center text-lg tracking-widest"
                                autocomplete="one-time-code"
                            >
                        </div>

                        <div class="flex gap-3">
                            <button id="verify2FABtn" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
                                <span id="verify2FAText">Verify</span>
                                <span id="verify2FALoading" class="hidden">
                                    <span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                                    Verifying...
                                </span>
                            </button>
                            <button id="cancel2FABtn" class="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    public initialize(): void {
        this.bindElements();
        this.attachEventListeners();
        this.handleGoogleCallback();
        this.setup2FAModalListeners();
    }

    public cleanup(): void {
        if (this.form) {
            this.form.removeEventListener('submit', this.handleSubmit);
        }
        if (this.switchButton) {
            this.switchButton.removeEventListener('click', this.toggleMode);
        }
        if (this.googleButton) {
            this.googleButton.removeEventListener('click', this.handleGoogleSignIn);
        }
        /** Clean up 2FA listeners */
        this.cleanup2FAListeners();
    }

    private bindElements(): void {
        this.form = document.getElementById('authForm') as HTMLFormElement;
        this.switchButton = document.getElementById('switchMode') as HTMLButtonElement;
        this.googleButton = document.getElementById('googleSignInBtn') as HTMLButtonElement;
    }

    private attachEventListeners(): void {
        if (this.form) {
            this.form.addEventListener('submit', this.handleSubmit.bind(this));
        }
        if (this.switchButton) {
            this.switchButton.addEventListener('click', this.toggleMode.bind(this));
        }
        if (this.googleButton) {
            this.googleButton.addEventListener('click', this.handleGoogleSignIn.bind(this));
        }
    }

    private setup2FAModalListeners(): void {
        const verify2FABtn = document.getElementById('verify2FABtn');
        const cancel2FABtn = document.getElementById('cancel2FABtn');
        const twoFactorCodeInput = document.getElementById('twoFactorCode') as HTMLInputElement;

        if (verify2FABtn) {
            verify2FABtn.addEventListener('click', this.handle2FAVerification.bind(this));
        }

        if (cancel2FABtn) {
            cancel2FABtn.addEventListener('click', this.cancel2FA.bind(this));
        }
        if (twoFactorCodeInput) {
            twoFactorCodeInput.addEventListener('input', (e) => {
                const input = e.target as HTMLInputElement;
                input.value = input.value.replace(/\D/g, '');
            });
            /** Auto-submit when 6 digits are entered */
            twoFactorCodeInput.addEventListener('input', (e) => {
                const input = e.target as HTMLInputElement;
                if (input.value.length === 6) {
                    this.handle2FAVerification();
                }
            });
        }
    }

    private cleanup2FAListeners(): void {
        const verify2FABtn = document.getElementById('verify2FABtn');
        const cancel2FABtn = document.getElementById('cancel2FABtn');
		/** need to come back and remove event listener */
    }

    private async handleSubmit(e: Event): Promise<void> {
        e.preventDefault();
        /** Hide any previous messages */
        this.hideMessages();
        if (!this.validateForm()) {
            return;
        }
        this.setLoadingState(true);
        try {
            const formData = new FormData(this.form!);
            const email = (formData.get('email') as string).trim();
            const password = formData.get('password') as string;
            const name = (formData.get('name') as string)?.trim();
            
            let response: LoginResponse;
            
            if (this.isLoginMode) {
                response = await login(email, password);
            } else {
                if (!name) throw new Error('Name is required');
                response = await register(name, email, password);
            }
            /** Handle different response types based on backend behavior */
            this.handleAuthResponse(response, email, password);
            
        } catch (err: any) {
            this.showError(err.message || 'Authentication failed');
        } finally {
            this.setLoadingState(false);
        }
    }

	private handleAuthResponse(response: LoginResponse, email?: string, password?: string): void {
		if (response.requires2FA) {
			/** Store login data for 2FA verification */
			this.pendingLoginData = { email: email!, password: password! };
			this.show2FAModal();
		} else if (response.requiresVerification) {
			this.showSuccess(response.message);
			this.redirectToVerification(response.email!);
		} else if (response.token && response.user) {
			this.handleSuccessfulAuth(response);
		} else if (response.message) {
			this.showSuccess(response.message);
			if (response.email) {
				this.redirectToVerification(response.email);
			}
		}
	}

    private show2FAModal(): void {
        showModal('twoFactorModal');
        const twoFactorInput = document.getElementById('twoFactorCode') as HTMLInputElement;
        if (twoFactorInput) {
            setTimeout(() => twoFactorInput.focus(), 100);
        }
    }

	private async handle2FAVerification(): Promise<void> {
		const twoFactorCode = (document.getElementById('twoFactorCode') as HTMLInputElement)?.value;
		if (!twoFactorCode || twoFactorCode.length !== 6) {
			showNotification('Please enter a valid 6-digit verification code.', 'error');
			return;
		}
		if (!this.pendingLoginData) {
			showNotification('Session expired. Please try logging in again.', 'error');
			this.cancel2FA();
			return;
		}
		this.set2FALoadingState(true);
		try {
			const response = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.AUTH}/2fa/verify-login`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ 
					email: this.pendingLoginData.email,
					password: this.pendingLoginData.password,
					token: twoFactorCode
				})
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
			/** 2FA verification successful */
			hideModal('twoFactorModal');
			this.pendingLoginData = null;
			this.handleSuccessfulAuth({
				token: data.token,
				user: data.user,
				message: data.message || 'Login successful!'
			});

		} catch (error) {
			console.error('2FA verification failed:', error);
			const errorMessage = error instanceof Error ? error.message : 'Verification failed. Please try again.';
			showNotification(errorMessage, 'error');
		} finally {
			this.set2FALoadingState(false);
		}
	}

    private cancel2FA(): void {
        hideModal('twoFactorModal');
        this.pendingLoginData = null;
        this.clear2FAInputs();
        showNotification('Login cancelled.', 'info');
    }

    private clear2FAInputs(): void {
        const twoFactorInput = document.getElementById('twoFactorCode') as HTMLInputElement;
        if (twoFactorInput) twoFactorInput.value = '';
    }

    private set2FALoadingState(isLoading: boolean): void {
        const verifyBtn = document.getElementById('verify2FABtn') as HTMLButtonElement;
        const verifyText = document.getElementById('verify2FAText') as HTMLElement;
        const verifyLoading = document.getElementById('verify2FALoading') as HTMLElement;
        const cancelBtn = document.getElementById('cancel2FABtn') as HTMLButtonElement;
        
        if (verifyBtn) verifyBtn.disabled = isLoading;
        if (cancelBtn) cancelBtn.disabled = isLoading;
        if (verifyText) verifyText.classList.toggle('hidden', isLoading);
        if (verifyLoading) verifyLoading.classList.toggle('hidden', !isLoading);
    }

    private validateForm(): boolean {
        const email = (document.getElementById('email') as HTMLInputElement).value.trim();
        const password = (document.getElementById('password') as HTMLInputElement).value;
        const name = (document.getElementById('name') as HTMLInputElement)?.value?.trim();

        if (!email) {
            this.showError('Email is required');
            return false;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showError('Please enter a valid email address');
            return false;
        }
        if (!password) {
            this.showError('Password is required');
            return false;
        }
        /** Registration-specific validation */
        if (!this.isLoginMode) {
            if (!name) {
                this.showError('Name is required');
                return false;
            }
            if (password.length < 6) {
                this.showError('Password must be at least 6 characters long');
                return false;
            }
        }
        return true;
    }

    private redirectToVerification(email: string): void {
        /** Store email for verification page */
        sessionStorage.setItem('verificationEmail', email);
        /** Small delay to show success message before redirect */
        setTimeout(() => {
            /** Dispatch custom event to navigate to verification page */
            const event = new CustomEvent('navigateToVerification', {
                detail: { email }
            });
            window.dispatchEvent(event);
        }, 1500);
    }

    private handleSuccessfulAuth(response: LoginResponse): void {
        /** Store authentication data */
        localStorage.setItem('token', response.token!);
        localStorage.setItem('userData', JSON.stringify(response.user));
        
        this.showSuccess(response.message || 'Login successful!');
        
        /** Small delay before redirect */
        setTimeout(() => {
            /** Trigger authentication success event */
            const event = new CustomEvent('authSuccess', {
                detail: response
            });
            window.dispatchEvent(event);
        }, 1000);
    }

    private toggleMode(): void {
        this.isLoginMode = !this.isLoginMode;
        this.updateUI();
        this.hideMessages();
        this.clearForm();
    }

    private updateUI(): void {
        const nameField = document.getElementById('nameField');
        const nameInput = document.getElementById('name') as HTMLInputElement;
        const passwordInput = document.getElementById('password') as HTMLInputElement;
        const submitText = document.getElementById('submitText');
        const loadingText = document.getElementById('loadingText');
        const switchText = document.getElementById('switchText');
        const switchMode = document.getElementById('switchMode');
        const subtitle = document.querySelector('p.text-gray-600') as HTMLElement;
        
        /** Toggle name field visibility and required attribute */
        nameField?.classList.toggle('hidden', this.isLoginMode);
        if (nameInput) {
            nameInput.required = !this.isLoginMode;
        }
        /** Update password field attributes */
        if (passwordInput) {
            passwordInput.placeholder = this.isLoginMode ? 'Enter your password' : 'Minimum 6 characters';
            if (this.isLoginMode) {
                passwordInput.removeAttribute('minlength');
            } else {
                passwordInput.setAttribute('minlength', '6');
            }
        }
        /** Update text content */
        if (submitText) submitText.textContent = this.isLoginMode ? 'Sign In' : 'Sign Up';
        if (loadingText) loadingText.textContent = this.isLoginMode ? 'Signing In...' : 'Creating Account...';
        if (switchText) switchText.textContent = this.isLoginMode ? "Don't have an account?" : 'Already have an account?';
        if (switchMode) switchMode.textContent = this.isLoginMode ? 'Sign Up' : 'Sign In';
        if (subtitle) subtitle.textContent = this.isLoginMode ? 'Please sign in to your account' : 'Create your new account';
    }

    private clearForm(): void {
        if (this.form) {
            this.form.reset();
        }
    }

    private handleGoogleSignIn(): void {
        this.setGoogleLoadingState(true);
        const AUTH_API_BASE = `${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.AUTH}`;
        window.location.href = `${AUTH_API_BASE}/google`;
    }

    private handleGoogleCallback(): void {
        const urlParams = new URLSearchParams(window.location.search);
        const googleToken = urlParams.get('token');
        const error = urlParams.get('error');
        
        if (error) {
            this.showError(decodeURIComponent(error));
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        }
        if (googleToken) {
            localStorage.setItem('token', googleToken);
            window.history.replaceState({}, document.title, window.location.pathname);
            /** Trigger authentication success with token */
            this.handleSuccessfulAuth({ 
                token: googleToken, 
                user: null as any,
                message: 'Google sign-in successful'
            });
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
        const submitBtn = document.getElementById('submitBtn') as HTMLButtonElement;
        const submitText = document.getElementById('submitText') as HTMLElement;
        const submitLoading = document.getElementById('submitLoading') as HTMLElement;
        const googleBtn = document.getElementById('googleSignInBtn') as HTMLButtonElement;
        
        if (submitBtn) submitBtn.disabled = isLoading;
        if (googleBtn) googleBtn.disabled = isLoading;
        if (submitText) submitText.classList.toggle('hidden', isLoading);
        if (submitLoading) {
            submitLoading.classList.toggle('hidden', !isLoading);
            submitLoading.classList.toggle('flex', isLoading);
        }
    }

    private setGoogleLoadingState(isLoading: boolean): void {
        const googleBtn = document.getElementById('googleSignInBtn') as HTMLButtonElement;
        const googleBtnText = document.getElementById('googleBtnText') as HTMLElement;
        const googleBtnLoading = document.getElementById('googleBtnLoading') as HTMLElement;
        const submitBtn = document.getElementById('submitBtn') as HTMLButtonElement;
        
        if (googleBtn) googleBtn.disabled = isLoading;
        if (submitBtn) submitBtn.disabled = isLoading;
        if (googleBtnText) googleBtnText.classList.toggle('hidden', isLoading);
        if (googleBtnLoading) {
            googleBtnLoading.classList.toggle('hidden', !isLoading);
            googleBtnLoading.classList.toggle('flex', isLoading);
        }
    }
}