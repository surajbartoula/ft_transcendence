// pages/LoginPage.ts - Login page with all related functionality
import { Page } from '../router/Router';
import { login, register, User } from '../utils/auth';
import { showError, hideError } from '../utils/ui';
import { API_CONFIG } from '../config';

export class LoginPage implements Page {
    public title = 'Login';
    public requiresAuth = false;
    
    private isLoginMode = true;
    private form: HTMLFormElement | null = null;
    private switchButton: HTMLButtonElement | null = null;
    private googleButton: HTMLButtonElement | null = null;

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
                            <p class="text-gray-600 mt-2">Please sign in to your account</p>
                        </div>

                        <form id="authForm" class="space-y-6">
                            <div id="nameField" class="hidden">
                                <label for="name" class="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                                <input type="text" id="name" name="name" 
                                       class="w-full px-4 py-3 text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                                       placeholder="Enter your full name">
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
                                       placeholder="Enter your password">
                            </div>

                            <div id="errorMessage" class="hidden bg-red-50 border border-red-200 rounded-lg p-4">
                                <div class="flex">
                                    <svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
                                    </svg>
                                    <span class="ml-2 text-sm text-red-700" id="errorText"></span>
                                </div>
                            </div>

                            <button type="submit" id="submitBtn"
                                    class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 focus:ring-4 focus:ring-indigo-300">
                                <span id="submitText">Sign In</span>
                                <div id="submitLoading" class="hidden items-center justify-center">
                                    <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                    Signing In...
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
                                <span id="switchText">Don't have an account?</span>
                                <button id="switchMode" class="text-indigo-600 hover:text-indigo-700 font-semibold ml-1 transition-colors">
                                    Sign Up
                                </button>
                            </p>
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
    }

    public cleanup(): void {
        // Remove event listeners
        if (this.form) {
            this.form.removeEventListener('submit', this.handleSubmit);
        }
        if (this.switchButton) {
            this.switchButton.removeEventListener('click', this.toggleMode);
        }
        if (this.googleButton) {
            this.googleButton.removeEventListener('click', this.handleGoogleSignIn);
        }
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

    private async handleSubmit(e: Event): Promise<void> {
        e.preventDefault();
        
        const submitBtn = document.getElementById('submitBtn') as HTMLButtonElement;
        const submitText = document.getElementById('submitText') as HTMLElement;
        const submitLoading = document.getElementById('submitLoading') as HTMLElement;
        
        // Set loading state
        this.setLoadingState(true);
        
        try {
            const formData = new FormData(this.form!);
            const email = formData.get('email') as string;
            const password = formData.get('password') as string;
            const name = formData.get('name') as string;
            
            let response: { token: string; user: User };
            
            if (this.isLoginMode) {
                response = await login(email, password);
            } else {
                if (!name) throw new Error('Name is required');
                response = await register(name, email, password);
            }
            
            // Store authentication data
            localStorage.setItem('token', response.token);
            localStorage.setItem('userData', JSON.stringify(response.user));
            
            // Trigger authentication success event
            this.triggerAuthSuccess(response);
            
        } catch (err: any) {
            showError(err.message || 'Authentication failed');
        } finally {
            this.setLoadingState(false);
        }
    }

    private toggleMode(): void {
        this.isLoginMode = !this.isLoginMode;
        this.updateUI();
        hideError();
    }

    private updateUI(): void {
        const nameField = document.getElementById('nameField');
        const submitText = document.getElementById('submitText');
        const switchText = document.getElementById('switchText');
        const switchMode = document.getElementById('switchMode');
        
        nameField?.classList.toggle('hidden', this.isLoginMode);
        
        if (submitText) submitText.textContent = this.isLoginMode ? 'Sign In' : 'Sign Up';
        if (switchText) switchText.textContent = this.isLoginMode ? "Don't have an account?" : 'Already have an account?';
        if (switchMode) switchMode.textContent = this.isLoginMode ? 'Sign Up' : 'Sign In';
    }

    private handleGoogleSignIn(): void {
        this.setGoogleLoadingState(true);
        const AUTH_API_BASE = `${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.AUTH}`;
        window.location.href = `${AUTH_API_BASE}/google`;
    }

    private handleGoogleCallback(): void {
        const urlParams = new URLSearchParams(window.location.search);
        const googleToken = urlParams.get('token');
        
        if (googleToken) {
            localStorage.setItem('token', googleToken);
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Trigger authentication success with token
            this.triggerAuthSuccess({ token: googleToken, user: null });
        }
    }

    private setLoadingState(isLoading: boolean): void {
        const submitBtn = document.getElementById('submitBtn') as HTMLButtonElement;
        const submitText = document.getElementById('submitText') as HTMLElement;
        const submitLoading = document.getElementById('submitLoading') as HTMLElement;
        
        if (submitBtn) submitBtn.disabled = isLoading;
        if (submitText) submitText.classList.toggle('hidden', isLoading);
        if (submitLoading) submitLoading.classList.toggle('hidden', !isLoading);
    }

    private setGoogleLoadingState(isLoading: boolean): void {
        const googleBtn = document.getElementById('googleSignInBtn') as HTMLButtonElement;
        const googleBtnText = document.getElementById('googleBtnText') as HTMLElement;
        const googleBtnLoading = document.getElementById('googleBtnLoading') as HTMLElement;
        
        if (googleBtn) googleBtn.disabled = isLoading;
        if (googleBtnText) googleBtnText.classList.toggle('hidden', isLoading);
        if (googleBtnLoading) googleBtnLoading.classList.toggle('hidden', !isLoading);
    }

    private triggerAuthSuccess(response: { token: string; user: User | null }): void {
        // Dispatch custom event for the main app to handle
        const event = new CustomEvent('authSuccess', {
            detail: response
        });
        window.dispatchEvent(event);
    }
}