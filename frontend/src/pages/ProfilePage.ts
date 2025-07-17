// pages/ProfilePage.ts - Profile page with all related functionality
import { Page } from '../router/Router';
import { User } from '../utils/auth';
import { showNotification, showError } from '../utils/ui';
import { API_CONFIG } from '../config';

export class ProfilePage implements Page {
    public title = 'Profile';
    public requiresAuth = true;
    
    private currentUser: User | null = null;
    private profileForm: HTMLFormElement | null = null;
    private avatarUpload: HTMLInputElement | null = null;
    private saveButton: HTMLButtonElement | null = null;

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
                                        <span class="text-white">Loading...</span>
                                    </div>
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

                        <!-- Profile Form -->
                        <div class="bg-slate-800 rounded-lg p-6 mb-6">
                            <h3 class="text-lg font-semibold text-white mb-4">Personal Information</h3>
                            <form id="profileForm" class="space-y-6">
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label for="displayName" class="block text-sm font-medium text-gray-300 mb-2">Display Name</label>
                                        <input type="text" id="displayName" name="displayName" 
                                               class="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                               placeholder="Enter your display name">
                                    </div>
                                    <div>
                                        <label for="username" class="block text-sm font-medium text-gray-300 mb-2">Username</label>
                                        <input type="text" id="username" name="username" 
                                               class="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                               placeholder="Choose a username">
                                    </div>
                                </div>
                                
                                <div>
                                    <label for="email" class="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                                    <input type="email" id="email" name="email" 
                                           class="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                           placeholder="Enter your email">
                                </div>
                                
                                <div>
                                    <label for="bio" class="block text-sm font-medium text-gray-300 mb-2">Bio</label>
                                    <textarea id="bio" name="bio" rows="4"
                                              class="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                              placeholder="Tell us about yourself..."></textarea>
                                    <p class="text-xs text-gray-500 mt-1">Maximum 500 characters</p>
                                </div>
                                
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label for="location" class="block text-sm font-medium text-gray-300 mb-2">Location</label>
                                        <input type="text" id="location" name="location" 
                                               class="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                               placeholder="Your location">
                                    </div>
                                    <div>
                                        <label for="website" class="block text-sm font-medium text-gray-300 mb-2">Website</label>
                                        <input type="url" id="website" name="website" 
                                               class="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                               placeholder="https://yourwebsite.com">
                                    </div>
                                </div>
                            </form>
                        </div>

                        <!-- Privacy Settings -->
                        <div class="bg-slate-800 rounded-lg p-6 mb-6">
                            <h3 class="text-lg font-semibold text-white mb-4">Privacy Settings</h3>
                            <div class="space-y-4">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <h4 class="text-white font-medium">Profile Visibility</h4>
                                        <p class="text-sm text-gray-400">Who can see your profile</p>
                                    </div>
                                    <select id="profileVisibility" class="bg-slate-700 border border-slate-600 rounded-lg text-white p-2 focus:ring-2 focus:ring-blue-500">
                                        <option value="public">Public</option>
                                        <option value="friends">Friends Only</option>
                                        <option value="private">Private</option>
                                    </select>
                                </div>
                                
                                <div class="flex items-center justify-between">
                                    <div>
                                        <h4 class="text-white font-medium">Online Status</h4>
                                        <p class="text-sm text-gray-400">Show when you're online</p>
                                    </div>
                                    <label class="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" id="showOnlineStatus" class="sr-only peer" checked>
                                        <div class="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                                
                                <div class="flex items-center justify-between">
                                    <div>
                                        <h4 class="text-white font-medium">Game Invites</h4>
                                        <p class="text-sm text-gray-400">Allow others to invite you to games</p>
                                    </div>
                                    <label class="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" id="allowGameInvites" class="sr-only peer" checked>
                                        <div class="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <!-- Action Buttons -->
                        <div class="flex justify-between items-center">
                            <button type="button" id="deleteAccountBtn" class="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                                Delete Account
                            </button>
                            <div class="space-x-4">
                                <button type="button" data-route="/dashboard" class="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" form="profileForm" id="saveButton" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                                    Save Changes
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
        this.loadUserData();
        this.attachEventListeners();
        this.populateForm();
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

        const deleteButton = document.getElementById('deleteAccountBtn');
        if (deleteButton) {
            deleteButton.removeEventListener('click', this.handleDeleteAccount);
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

        const deleteButton = document.getElementById('deleteAccountBtn');
        if (deleteButton) {
            deleteButton.addEventListener('click', this.handleDeleteAccount.bind(this));
        }

        // Auto-save on input change
        const inputs = this.profileForm?.querySelectorAll('input, textarea, select');
        inputs?.forEach(input => {
            input.addEventListener('input', this.handleInputChange.bind(this));
        });
    }

    private populateForm(): void {
        if (!this.currentUser) return;

        // Update profile header
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

        // Populate form fields
        const displayNameInput = document.getElementById('displayName') as HTMLInputElement;
        const emailInput = document.getElementById('email') as HTMLInputElement;

        if (displayNameInput) {
            displayNameInput.value = this.currentUser.name;
        }

        if (emailInput) {
            emailInput.value = this.currentUser.email;
        }
    }

    private handleSubmit(e: Event): void {
        e.preventDefault();
        this.handleSave();
    }

    private async handleSave(): Promise<void> {
        if (!this.profileForm || !this.saveButton) return;

        this.setLoadingState(true);

        try {
            const formData = new FormData(this.profileForm);
            const profileData = Object.fromEntries(formData.entries());

            const token = localStorage.getItem('token');
            if (!token) throw new Error('No authentication token found');

            const response = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.USER}/profile`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(profileData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to update profile');
            }

            const updatedUser = await response.json();
            
            // Update localStorage
            localStorage.setItem('userData', JSON.stringify(updatedUser));
            this.currentUser = updatedUser;
            
            showNotification('Profile updated successfully!', 'success');

        } catch (error: any) {
            showError(error.message || 'Failed to update profile');
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

        // Validate file
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
            formData.append('avatar', file);

            const token = localStorage.getItem('token');
            if (!token) throw new Error('No authentication token found');

            const response = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.USER}/avatar`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to upload avatar');
            }

            const result = await response.json();
            showNotification('Avatar updated successfully!', 'success');

            // Update avatar display
            const profileAvatar = document.getElementById('profileAvatar');
            if (profileAvatar && result.avatarUrl) {
                profileAvatar.innerHTML = `<img src="${result.avatarUrl}" alt="Avatar" class="w-full h-full rounded-full object-cover">`;
            }

        } catch (error: any) {
            showError(error.message || 'Failed to upload avatar');
        }
    }

    private handleInputChange(): void {
        // Show unsaved changes indicator
        if (this.saveButton) {
            this.saveButton.textContent = 'Save Changes*';
            this.saveButton.classList.add('bg-yellow-600', 'hover:bg-yellow-700');
            this.saveButton.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        }
    }

    private async handleDeleteAccount(): Promise<void> {
        const confirmed = confirm('Are you sure you want to delete your account? This action cannot be undone.');
        
        if (!confirmed) return;

        const doubleConfirm = confirm('This will permanently delete all your data. Type "DELETE" in the next prompt to confirm.');
        
        if (!doubleConfirm) return;

        const deleteConfirmation = prompt('Type "DELETE" to confirm account deletion:');
        
        if (deleteConfirmation !== 'DELETE') {
            showError('Account deletion cancelled');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error('No authentication token found');

            const response = await fetch(`${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.USER}/account`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to delete account');
            }

            // Clear local storage and redirect
            localStorage.clear();
            showNotification('Account deleted successfully', 'success');
            
            // Dispatch logout event
            const event = new CustomEvent('logout');
            window.dispatchEvent(event);

        } catch (error: any) {
            showError(error.message || 'Failed to delete account');
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
            this.saveButton.textContent = 'Save Changes';
            this.saveButton.classList.remove('bg-yellow-600', 'hover:bg-yellow-700');
            this.saveButton.classList.add('bg-blue-600', 'hover:bg-blue-700');
        }
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