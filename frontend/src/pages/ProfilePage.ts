import { Page } from '../router/Router';
import { User } from '../utils/auth';
import { showNotification, showError } from '../utils/ui';
import { API_CONFIG } from '../config';
import { generateAvatarUrl, debounce } from '../utils/ui';

interface ProfileData {
    username: string;
    bio?: string;
}

interface PhotoData {
    id: string;
    user_id: string;
    filename: string;
    path: string;
    created_at: string;
    updated_at: string;
}

export class ProfilePage implements Page {
    public title = 'Profile';
    public requiresAuth = true;
    
    private currentUser: User | null = null;
    private currentProfile: ProfileData | null = null;
    private profileForm: HTMLFormElement | null = null;
    private avatarUpload: HTMLInputElement | null = null;
    private saveButton: HTMLButtonElement | null = null;
    private isEditing: boolean = false;
    private debouncedCheckUsername: ((username: string) => void) | null = null;
    private originalUsername: string = '';

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
                    <div class="fade-in max-w-4xl mx-auto">
                        <h2 class="text-3xl font-bold mb-6 text-cyan-400">Profile Settings</h2>
                        
                        <!-- Profile Header -->
                        <div class="bg-slate-800/70 backdrop-blur-sm rounded-lg p-6 mb-6 tron-border tron-glow">
                            <div class="flex items-center space-x-6">
                                <div class="relative">
                                    <div class="w-24 h-24 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-2xl font-bold tron-glow" id="profileAvatar">
                                        <span class="text-white">📷</span>
                                    </div>
                                    <img id="profilePhoto" class="w-24 h-24 rounded-full object-cover hidden tron-glow" alt="Profile Photo">
                                    <button class="absolute bottom-0 right-0 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white p-2 rounded-full transition-all duration-300 tron-glow" id="avatarButton">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                        </svg>
                                    </button>
                                    <input type="file" id="avatarUpload" class="hidden" accept="image/*">
                                </div>
                                <div>
                                    <h3 class="text-xl font-semibold text-white" id="currentUserName">Loading...</h3>
                                    <p class="text-gray-400" id="currentUserEmail">Loading...</p>
                                    <p class="text-sm text-gray-500 mt-1">Member since <span id="memberSince">Loading...</span></p>
                                </div>
                            </div>
                        </div>

                        <!-- Profile Display -->
                        <div id="profileDisplay" class="bg-slate-800/70 backdrop-blur-sm rounded-lg p-6 mb-6 tron-border tron-glow" style="display: none;">
                            <div class="flex justify-between items-start mb-4">
                                <h3 class="text-lg font-semibold text-cyan-300">Profile Information</h3>
                                <button id="editProfileBtn" class="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white px-4 py-2 rounded-lg font-medium transition-all duration-300 tron-glow flex items-center">
                                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                    </svg>
                                    Edit Profile
                                </button>
                            </div>
                            <div class="space-y-4">
                                <div>
                                    <label class="block text-sm font-medium text-cyan-400 mb-1">Display name</label>
                                    <p id="displayUsername" class="text-white text-lg">-</p>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-cyan-400 mb-1">Bio</label>
                                    <p id="displayBio" class="text-gray-200">No bio provided</p>
                                </div>
                            </div>
                        </div>

                        <!-- Profile Form -->
                        <div id="profileFormContainer" class="bg-slate-800/70 backdrop-blur-sm rounded-lg p-6 mb-6 tron-border tron-glow">
                            <h3 class="text-lg font-semibold text-cyan-300 mb-4">Personal Information</h3>
                            <form id="profileForm" class="space-y-6">
                                <div>
                                    <label for="username" class="block text-sm font-medium text-cyan-400 mb-2">Username *</label>
                                    <div class="relative">
                                        <input type="text" id="username" name="username" required
                                               class="w-full p-3 pr-12 bg-slate-900/50 border border-cyan-500/30 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 focus:bg-slate-900/70 transition-all tron-glow"
                                               placeholder="Enter your username">
                                        <div id="usernameIndicator" class="absolute inset-y-0 right-0 pr-3 items-center hidden">
                                            <!-- Loading spinner -->
                                            <div id="usernameLoading" class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 hidden"></div>
                                            <!-- Available checkmark -->
                                            <svg id="usernameAvailable" class="h-5 w-5 text-green-500 hidden" fill="currentColor" viewBox="0 0 20 20">
                                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                                            </svg>
                                            <!-- Unavailable X -->
                                            <svg id="usernameUnavailable" class="h-5 w-5 text-red-500 hidden" fill="currentColor" viewBox="0 0 20 20">
                                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
                                            </svg>
                                        </div>
                                    </div>
                                    <div id="usernameMessage" class="text-xs mt-1 hidden"></div>
                                    <p class="text-xs text-gray-500 mt-1">Username must be 3-20 characters long</p>
                                </div>
                                
                                <div>
                                    <label for="bio" class="block text-sm font-medium text-cyan-400 mb-2">Bio</label>
                                    <textarea id="bio" name="bio" rows="4"
                                              class="w-full p-3 bg-slate-900/50 border border-cyan-500/30 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 focus:bg-slate-900/70 transition-all resize-none tron-glow"
                                              placeholder="Tell us about yourself..."></textarea>
                                    <p class="text-xs text-gray-500 mt-1">Maximum 500 characters</p>
                                </div>

                                <!-- Action Buttons -->
                                <div class="flex justify-center items-center space-x-4">
                                    <button type="button" id="cancelBtn" class="bg-slate-600/70 hover:bg-slate-500/70 text-white px-6 py-2 rounded-lg font-medium transition-all duration-300 tron-border" style="display: none;">
                                        Cancel
                                    </button>
                                    <button type="submit" id="saveButton" class="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white px-6 py-2 rounded-lg font-medium transition-all duration-300 tron-glow">
                                        Save Profile
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    public initialize(): void {
        this.bindElements();
        this.loadUserData();
        this.attachEventListeners();
        this.setupUsernameValidation();
        this.loadProfile();
        this.loadPhoto();
    }

    public cleanup(): void {
        if (this.profileForm) {
            this.profileForm.removeEventListener('submit', this.handleSubmit);
        }
        if (this.avatarUpload) {
            this.avatarUpload.removeEventListener('change', this.handleAvatarChange);
        }
        if (this.saveButton) {
            this.saveButton.removeEventListener('click', this.handleSave);
        }
        const avatarButton = document.getElementById('avatarButton');
        if (avatarButton) {
            avatarButton.removeEventListener('click', this.handleAvatarClick);
        }
        const editBtn = document.getElementById('editProfileBtn');
        if (editBtn) {
            editBtn.removeEventListener('click', this.handleEditClick);
        }
        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) {
            cancelBtn.removeEventListener('click', this.handleCancelClick);
        }
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.removeEventListener('click', this.handleLogout);
        }
        
        // Cleanup username validation
        const usernameInput = document.getElementById('username') as HTMLInputElement;
        if (usernameInput) {
            usernameInput.removeEventListener('input', this.handleUsernameInputEvent.bind(this));
        }
        this.debouncedCheckUsername = null;
    }

    private bindElements(): void {
        this.profileForm = document.getElementById('profileForm') as HTMLFormElement;
        this.avatarUpload = document.getElementById('avatarUpload') as HTMLInputElement;
        this.saveButton = document.getElementById('saveButton') as HTMLButtonElement;
    }

    private loadUserData(): void {
        const userDataStr = localStorage.getItem('userData');
        if (userDataStr) {
            this.currentUser = JSON.parse(userDataStr);
            this.populateUserInfo();
        }
    }

    private attachEventListeners(): void {
        if (this.profileForm) {
            this.profileForm.addEventListener('submit', this.handleSubmit.bind(this));
        }
        if (this.avatarUpload) {
            this.avatarUpload.addEventListener('change', this.handleAvatarChange.bind(this));
        }
        const avatarButton = document.getElementById('avatarButton');
        if (avatarButton) {
            avatarButton.addEventListener('click', this.handleAvatarClick.bind(this));
        }
        const editBtn = document.getElementById('editProfileBtn');
        if (editBtn) {
            editBtn.addEventListener('click', this.handleEditClick.bind(this));
        }
        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', this.handleCancelClick.bind(this));
        }
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.handleLogout.bind(this));
        }
    }

    private setupUsernameValidation(): void {
        this.debouncedCheckUsername = debounce(this.checkUsernameAvailability.bind(this), 500);
        
        const usernameInput = document.getElementById('username') as HTMLInputElement;
        if (usernameInput) {
            // Remove existing listener first to avoid duplicates
            usernameInput.removeEventListener('input', this.handleUsernameInputEvent.bind(this));
            usernameInput.addEventListener('input', this.handleUsernameInputEvent.bind(this));
        }
    }

    private handleUsernameInputEvent = (e: Event): void => {
        const username = (e.target as HTMLInputElement).value.trim();
        this.handleUsernameInput(username);
    }

    private handleUsernameInput(username: string): void {
        this.hideUsernameIndicators();
        this.hideUsernameMessage();
        
        if (username.length === 0) {
            return;
        }
        
        // Check if it's the same as original username (no need to check availability)
        if (username === this.originalUsername) {
            this.showUsernameIndicator('available');
            this.showUsernameMessage('Current username', 'info');
            return;
        }
        
        if (username.length < 3) {
            this.showUsernameMessage('Username must be at least 3 characters long', 'error');
            this.showUsernameIndicator('unavailable');
            return;
        }
        
        if (username.length > 20) {
            this.showUsernameMessage('Username must be no more than 20 characters long', 'error');
            this.showUsernameIndicator('unavailable');
            return;
        }
        
        this.showUsernameIndicator('loading');
        this.debouncedCheckUsername!(username);
    }

    private async checkUsernameAvailability(username: string): Promise<void> {
        try {
            const response = await fetch(`${API_CONFIG.ENDPOINTS.USER}/username/check/${encodeURIComponent(username)}`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to check username availability');
            }
            
            const currentUsername = (document.getElementById('username') as HTMLInputElement)?.value?.trim();
            if (currentUsername !== username) {
                return;
            }
            
            this.hideUsernameIndicators();
            
            if (data.available) {
                this.showUsernameIndicator('available');
                this.showUsernameMessage('Username is available', 'success');
            } else {
                this.showUsernameIndicator('unavailable');
                this.showUsernameMessage('Username is already taken', 'error');
            }
            
        } catch (error) {
            console.error('Username availability check failed:', error);
            this.hideUsernameIndicators();
            this.showUsernameMessage('Unable to check username availability', 'error');
        }
    }

    private showUsernameIndicator(type: 'loading' | 'available' | 'unavailable'): void {
        const container = document.getElementById('usernameIndicator');
        const loading = document.getElementById('usernameLoading');
        const available = document.getElementById('usernameAvailable');
        const unavailable = document.getElementById('usernameUnavailable');
        
        if (!container) return;
        
        container.classList.remove('hidden');
        
        loading?.classList.add('hidden');
        available?.classList.add('hidden');
        unavailable?.classList.add('hidden');
        
        switch (type) {
            case 'loading':
                loading?.classList.remove('hidden');
                break;
            case 'available':
                available?.classList.remove('hidden');
                break;
            case 'unavailable':
                unavailable?.classList.remove('hidden');
                break;
        }
    }

    private hideUsernameIndicators(): void {
        const container = document.getElementById('usernameIndicator');
        container?.classList.add('hidden');
    }

    private showUsernameMessage(message: string, type: 'success' | 'error' | 'info'): void {
        const messageElement = document.getElementById('usernameMessage');
        if (!messageElement) return;
        
        messageElement.textContent = message;
        let colorClass = '';
        switch (type) {
            case 'success':
                colorClass = 'text-green-400';
                break;
            case 'error':
                colorClass = 'text-red-400';
                break;
            case 'info':
                colorClass = 'text-blue-400';
                break;
        }
        messageElement.className = `text-xs mt-1 ${colorClass}`;
        messageElement.classList.remove('hidden');
    }

    private hideUsernameMessage(): void {
        const messageElement = document.getElementById('usernameMessage');
        messageElement?.classList.add('hidden');
    }

    private populateUserInfo(): void {
        if (!this.currentUser) return;

        const profileAvatar = document.getElementById('profileAvatar');
        const currentUserName = document.getElementById('currentUserName');
        const currentUserEmail = document.getElementById('currentUserEmail');
        const memberSince = document.getElementById('memberSince');

        if (profileAvatar) {
            profileAvatar.innerHTML = `<img src="${generateAvatarUrl()}" alt="UA" class="w-24 h-24 rounded-full object-cover">`;
        }
        if (currentUserName) {
            currentUserName.textContent = this.currentUser.name;
        }
        if (currentUserEmail) {
            currentUserEmail.textContent = this.currentUser.email;
        }
        if (memberSince) {
            const joinDate = new Date(this.currentUser.created_at).toLocaleDateString();
            memberSince.textContent = joinDate;
        }
    }

    private async loadProfile(): Promise<void> {
        try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error('No authentication token found');
            const response = await fetch(`${API_CONFIG.ENDPOINTS.USER}/profile`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (response.ok) {
                const profile = await response.json();
                this.currentProfile = profile;
                this.updateProfileDisplay(profile);
                this.showProfileDisplay();
            } else if (response.status === 404) {
                /** Profile doesn't exist, show form to create one */
                this.showProfileForm();
            } else {
                const error = await response.json();
                throw new Error(error.message || 'Failed to load profile');
            }
        } catch (error: any) {
            console.error('Error loading profile:', error);
            if (error.message.includes('not found')) {
                this.showProfileForm();
            } else {
                showError(error.message || 'Failed to load profile');
                this.showProfileForm();
            }
        }
    }

    private async loadPhoto(): Promise<void> {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch(`${API_CONFIG.ENDPOINTS.USER}/photo`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const photo: PhotoData = await response.json();
                this.updatePhotoDisplay(photo);
            }
        } catch (error) {
            console.log('No photo found, using placeholder');
        }
    }

    private updateProfileDisplay(profile: ProfileData): void {
        const displayUsername = document.getElementById('displayUsername');
        const displayBio = document.getElementById('displayBio');
        if (displayUsername) {
            displayUsername.textContent = profile.username;
        }
        if (displayBio) {
            displayBio.textContent = profile.bio || 'No bio provided';
        }
        const usernameInput = document.getElementById('username') as HTMLInputElement;
        const bioInput = document.getElementById('bio') as HTMLTextAreaElement;
        if (usernameInput) {
            usernameInput.value = profile.username;
            this.originalUsername = profile.username; // Store original username for comparison
        }
        if (bioInput) {
            bioInput.value = profile.bio || '';
        }
        
        // Reset validation indicators when profile is updated
        this.hideUsernameIndicators();
        this.hideUsernameMessage();
    }

    private updatePhotoDisplay(photo: PhotoData): void {
        const profilePhoto = document.getElementById('profilePhoto') as HTMLImageElement;
        const profileAvatar = document.getElementById('profileAvatar');

        if (profilePhoto && profileAvatar) {
            profilePhoto.src = photo.path;
            profilePhoto.classList.remove('hidden');
            profileAvatar.classList.add('hidden');
        }
    }

    private showProfileDisplay(): void {
        const profileDisplay = document.getElementById('profileDisplay');
        const profileFormContainer = document.getElementById('profileFormContainer');

        if (profileDisplay) {
            profileDisplay.style.display = 'block';
        }
        if (profileFormContainer) {
            profileFormContainer.style.display = 'none';
        }
        this.isEditing = false;
    }

    private showProfileForm(): void {
        const profileDisplay = document.getElementById('profileDisplay');
        const profileFormContainer = document.getElementById('profileFormContainer');
        const cancelBtn = document.getElementById('cancelBtn');
        if (profileDisplay) {
            profileDisplay.style.display = 'none';
        }
        if (profileFormContainer) {
            profileFormContainer.style.display = 'block';
        }
        if (cancelBtn) {
            cancelBtn.style.display = this.currentProfile ? 'inline-block' : 'none';
        }
        this.isEditing = true;
        /** Update save button text */
        if (this.saveButton) {
            this.saveButton.textContent = this.currentProfile ? 'Update Profile' : 'Create Profile';
        }
        
        // Re-setup username validation when form is shown
        this.setupUsernameValidation();
        
        // If we have current profile, show current username as valid
        if (this.currentProfile && this.currentProfile.username) {
            const usernameInput = document.getElementById('username') as HTMLInputElement;
            if (usernameInput && usernameInput.value === this.originalUsername) {
                this.showUsernameIndicator('available');
                this.showUsernameMessage('Current username', 'info');
            }
        }
    }

    private handleEditClick(): void {
        this.showProfileForm();
    }

    private handleCancelClick(): void {
        if (this.currentProfile) {
            this.updateProfileDisplay(this.currentProfile);
            this.showProfileDisplay();
        }
    }

    private handleSubmit(e: Event): void {
        e.preventDefault();
        this.handleSave();
    }

    private async handleSave(): Promise<void> {
        if (!this.profileForm || !this.saveButton) return;
        const formData = new FormData(this.profileForm);
        const profileData: ProfileData = {
            username: formData.get('username') as string,
            bio: formData.get('bio') as string
        };
        if (!profileData.username.trim()) {
            showError('Username is required');
            return;
        }
        
        // Validate username length
        const username = profileData.username.trim();
        if (username.length < 3) {
            showError('Username must be at least 3 characters long');
            return;
        }
        if (username.length > 20) {
            showError('Username must be no more than 20 characters long');
            return;
        }
        
        // Check if username is available (unless it's the same as current)
        if (username !== this.originalUsername) {
            const usernameUnavailable = document.getElementById('usernameUnavailable');
            if (usernameUnavailable && !usernameUnavailable.classList.contains('hidden')) {
                showError('Please choose an available username');
                return;
            }
        }
        this.setLoadingState(true);
        try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error('No authentication token found');

            const method = this.currentProfile ? 'PATCH' : 'POST';
            const response = await fetch(`${API_CONFIG.ENDPOINTS.USER}/profile`, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(profileData)
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to save profile');
            }
            const updatedProfile = await response.json();
            this.currentProfile = updatedProfile;
            this.originalUsername = updatedProfile.username; // Update original username
            this.updateProfileDisplay(updatedProfile);
            this.showProfileDisplay();
            
            const message = method === 'PATCH' ? 'Profile updated successfully!' : 'Profile created successfully!';
            showNotification(message, 'success');
        } catch (error: any) {
            showError(error.message || 'Failed to save profile');
        } finally {
            this.setLoadingState(false);
        }
    }

    private handleAvatarClick(): void {
        this.avatarUpload?.click();
    }

    private async handleAvatarChange(e: Event): Promise<void> {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;
        /** Validate file */
        if (!file.type.startsWith('image/')) {
            showError('Please select a valid image file');
            return;
        }
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            showError('Image must be smaller than 5MB');
            return;
        }
        try {
            const formData = new FormData();
            formData.append('file', file); // Changed from 'avatar' to 'file' to match your backend
            const token = localStorage.getItem('token');
            if (!token) throw new Error('No authentication token found');
            const response = await fetch(`${API_CONFIG.ENDPOINTS.USER}/photo`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formData
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to upload photo');
            }
            const result: PhotoData = await response.json();
            this.updatePhotoDisplay(result);
            showNotification('Photo updated successfully!', 'success');
        } catch (error: any) {
            showError(error.message || 'Failed to upload photo');
        }
    }

    private setLoadingState(isLoading: boolean): void {
        if (!this.saveButton) return;
        if (isLoading) {
            this.saveButton.disabled = true;
            this.saveButton.innerHTML = `
                <div class="flex items-center justify-center">
                    <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                </div>
            `;
        } else {
            this.saveButton.disabled = false;
            const buttonText = this.currentProfile ? 'Update Profile' : 'Create Profile';
            this.saveButton.textContent = buttonText;
        }
    }

    private handleLogout(): void {
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
        sessionStorage.clear();
        window.location.href = '/login';
    }

    private renderSidebar(): string {
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
                    <a href="#" data-route="/dashboard/profile" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 transition-all duration-300 tron-border tron-glow">
                        <span>👤</span>
                        <span>Profile</span>
                    </a>
                    <a href="#" data-route="/dashboard/leaderboard" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg text-slate-300 hover:text-cyan-400 hover:bg-slate-800/50 transition-all duration-300 hover:tron-border">
                        <span>🏆</span>
                        <span>Leaderboard</span>
                    </a>
                    <a href="#" data-route="/dashboard/settings" class="sidebar-item flex items-center space-x-3 p-3 rounded-lg text-slate-300 hover:text-cyan-400 hover:bg-slate-800/50 transition-all duration-300 hover:tron-border">
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