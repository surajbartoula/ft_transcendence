// pages/ProfilePage.ts - Profile page with all related functionality
import { Page } from '../router/Router';
import { User } from '../utils/auth';
import { showNotification, showError } from '../utils/ui';
import { API_CONFIG } from '../config';

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

    public render(): string {
        return `
            <div class="fixed inset-0 flex h-screen bg-slate-900">
                ${this.renderSidebar()}
                <div class="flex-1 p-8 overflow-y-auto">
                    <div class="fade-in max-w-4xl mx-auto">
                        <h2 class="text-3xl font-bold mb-6 text-white">Profile Settings</h2>
                        
                        <!-- Profile Header -->
                        <div class="bg-slate-800 rounded-lg p-6 mb-6">
                            <div class="flex items-center space-x-6">
                                <div class="relative">
                                    <div class="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-2xl font-bold" id="profileAvatar">
                                        <span class="text-white">📷</span>
                                    </div>
                                    <img id="profilePhoto" class="w-24 h-24 rounded-full object-cover hidden" alt="Profile Photo">
                                    <button class="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full transition-colors" id="avatarButton">
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
                        <div id="profileDisplay" class="bg-slate-800 rounded-lg p-6 mb-6" style="display: none;">
                            <div class="flex justify-between items-start mb-4">
                                <h3 class="text-lg font-semibold text-white">Profile Information</h3>
                                <button id="editProfileBtn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center">
                                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                    </svg>
                                    Edit Profile
                                </button>
                            </div>
                            <div class="space-y-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-300 mb-1">Display name</label>
                                    <p id="displayUsername" class="text-white">-</p>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-300 mb-1">Bio</label>
                                    <p id="displayBio" class="text-white">No bio provided</p>
                                </div>
                            </div>
                        </div>

                        <!-- Profile Form -->
                        <div id="profileFormContainer" class="bg-slate-800 rounded-lg p-6 mb-6">
                            <h3 class="text-lg font-semibold text-white mb-4">Personal Information</h3>
                            <form id="profileForm" class="space-y-6">
                                <div>
                                    <label for="username" class="block text-sm font-medium text-gray-300 mb-2">Username *</label>
                                    <input type="text" id="username" name="username" required
                                           class="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                           placeholder="Enter your username">
                                </div>
                                
                                <div>
                                    <label for="bio" class="block text-sm font-medium text-gray-300 mb-2">Bio</label>
                                    <textarea id="bio" name="bio" rows="4"
                                              class="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                              placeholder="Tell us about yourself..."></textarea>
                                    <p class="text-xs text-gray-500 mt-1">Maximum 500 characters</p>
                                </div>

                                <!-- Action Buttons -->
                                <div class="flex justify-center items-center space-x-4">
                                    <button type="button" id="cancelBtn" class="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium transition-colors" style="display: none;">
                                        Cancel
                                    </button>
                                    <button type="submit" id="saveButton" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
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

        // Add logout button event listener
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.handleLogout.bind(this));
        }
    }

    private populateUserInfo(): void {
        if (!this.currentUser) return;

        const profileAvatar = document.getElementById('profileAvatar');
        const currentUserName = document.getElementById('currentUserName');
        const currentUserEmail = document.getElementById('currentUserEmail');
        const memberSince = document.getElementById('memberSince');

        if (profileAvatar) {
            const initials = this.currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase();
            profileAvatar.innerHTML = `<span class="text-white text-2xl font-bold">${initials}</span>`;
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

            const response = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.USER}/profile`, {
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
                // Profile doesn't exist, show form to create one
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

            const response = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.USER}/photo`, {
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
            // Photo not found is okay, keep placeholder
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

        // Also update form fields
        const usernameInput = document.getElementById('username') as HTMLInputElement;
        const bioInput = document.getElementById('bio') as HTMLTextAreaElement;

        if (usernameInput) {
            usernameInput.value = profile.username;
        }
        if (bioInput) {
            bioInput.value = profile.bio || '';
        }
    }

    private updatePhotoDisplay(photo: PhotoData): void {
        const profilePhoto = document.getElementById('profilePhoto') as HTMLImageElement;
        const profileAvatar = document.getElementById('profileAvatar');

        if (profilePhoto && profileAvatar) {
            profilePhoto.src = `${API_CONFIG.GATEWAY_URL}${photo.path}`;
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

        // Update save button text
        if (this.saveButton) {
            this.saveButton.textContent = this.currentProfile ? 'Update Profile' : 'Create Profile';
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

        this.setLoadingState(true);

        try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error('No authentication token found');

            const method = this.currentProfile ? 'PATCH' : 'POST';
            const response = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.USER}/profile`, {
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
            this.updateProfileDisplay(updatedProfile);
            this.showProfileDisplay();
            
            const message = this.currentProfile ? 'Profile updated successfully!' : 'Profile created successfully!';
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
            const response = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.USER}/photo`, {
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
        // Clear authentication data
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
        sessionStorage.clear();
        
        // Redirect to login page
        window.location.href = '/login';
    }

    private renderSidebar(): string {
        const navItems = [
            { route: '/dashboard', icon: '🎮', label: 'Dashboard' },
            { route: '/dashboard/profile', icon: '👤', label: 'Profile', active: true },
            { route: '/dashboard/leaderboard', icon: '🏆', label: 'Leaderboard' },
            { route: '/dashboard/friends', icon: '👥', label: 'Friends' },
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
                        const activeClasses = item.active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700';
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