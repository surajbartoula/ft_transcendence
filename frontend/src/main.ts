import { login, register, getCurrentUser, User } from "./auth";
import { fetchUserGameData } from "./dashboard";
import { showLoginForm, showError, hideError, toggleMode } from "./ui";
import { startFaviconAnimation } from './favicon';

let isLoginMode = true;
let token: string | null = localStorage.getItem('token') || null;
let currentSection = 'play'; // Track current section

document.addEventListener('DOMContentLoaded', async () => {
    startFaviconAnimation();
    bindEvents();
    const urlParams = new URLSearchParams(window.location.search);
    const googleToken = urlParams.get('token');
    
    if (googleToken) {
        token = googleToken;
        localStorage.setItem('token', token);
        window.history.replaceState({}, document.title, window.location.pathname);
        
        try {
            const user = await getCurrentUser(token);
            localStorage.setItem('userData', JSON.stringify(user));
            await loadUserDashboard(user);
            return;
        } catch (error) {
            console.error('Failed to get user after Google OAuth:', error);
            localStorage.removeItem('token');
            token = null;
        }
    }
    
    if (token) {
        try {
            const user = await getCurrentUser(token);
            localStorage.setItem('userData', JSON.stringify(user));
            await loadUserDashboard(user);
        } catch (error) {
            console.error('Failed to get current user: ', error);
            localStorage.removeItem('userData');
            localStorage.removeItem('token');
            token = null;
            showLoginForm();
        }
    } else {
        showLoginForm();
    }
});

async function loadUserDashboard(user: User): Promise<void> {
    try {
        const gameData = await fetchUserGameData(token!);
        populateDashboardData(user, gameData);
        bindDashboardEvents();
        /** Initialize modal events after dashboard is loaded */
        initializeModalEvents();
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        showError('Failed to load dashboard. Please try refreshing the page.');
    }
}

function populateDashboardData(user: User, gameData: any): void {
    /** Hide login form and show dashboard */
    const loginContainer = document.getElementById('loginContainer') as HTMLElement;
    const dashboardContainer = document.getElementById('dashboardContainer') as HTMLElement;
    const loadingElement = document.getElementById('loading') as HTMLElement;
    const loginBg = document.getElementById('loginBg') as HTMLElement;
    /** Hide loading screen and login background */
    if (loadingElement) loadingElement.style.display = 'none';
    if (loginBg) loginBg.classList.add('hidden');
    /** Hide login and show dashboard */
    if (loginContainer) loginContainer.style.display = 'none';
    if (dashboardContainer) dashboardContainer.style.display = 'flex';
    /** Populate user data */
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    const userHandle = document.getElementById('userHandle');
    const userRating = document.getElementById('userRating');
    
    if (userAvatar) {
        const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
        userAvatar.innerHTML = `<span class="text-white font-bold text-xl">${initials}</span>`;
    }
    if (userName) userName.textContent = user.name;
    if (userHandle) {
        const handle = user.email ? `@${user.email.split('@')[0]}` : `@${user.name.toLowerCase().replace(/\s+/g, '')}`;
        userHandle.textContent = handle;
    }
    if (userRating) userRating.textContent = gameData.stats?.rating?.toString() || '1000';
    
    /** Populate game statistics */
    const gamesPlayed = document.getElementById('gamesPlayed');
    const wins = document.getElementById('wins');
    const losses = document.getElementById('losses');
    
    if (gamesPlayed) gamesPlayed.textContent = gameData.stats?.gamesPlayed?.toString() || '0';
    if (wins) wins.textContent = gameData.stats?.wins?.toString() || '0';
    if (losses) losses.textContent = gameData.stats?.losses?.toString() || '0';
    /** Populate recent games */
    populateRecentGames(gameData.recentGames || []);
    /** Populate achievements */
    populateAchievements(gameData.achievements || []);
    
    /** Populate featured games. This will come handy if we are going to add more games. */
    // populateFeaturedGames(gameData.featuredGames || []);
}

function populateRecentGames(recentGames: any[]): void {
    const container = document.getElementById('recentGamesContainer');
    if (!container) return;
    
    if (recentGames.length === 0) {
        container.innerHTML = `
            <div class="p-8 text-center empty-state">
                <div class="text-4xl mb-4">🎮</div>
                <p class="text-gray-400">No games played yet</p>
                <p class="text-sm text-gray-500 mt-2">Start playing to see your game history here</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = recentGames.map(game => `
        <div class="grid grid-cols-4 gap-4 p-4 border-b border-slate-700 hover:bg-slate-700 transition-colors">
            <div class="font-medium">${game.game}</div>
            <div class="text-gray-400">${game.opponent}</div>
            <div class="${game.result === 'win' ? 'text-green-400' : 'text-red-400'}">${game.result === 'win' ? 'Win' : 'Loss'} (${game.score})</div>
            <div class="text-gray-400 text-sm">${game.date}</div>
        </div>
    `).join('');
}

function populateAchievements(achievements: any[]): void {
    const container = document.getElementById('achievementsContainer');
    if (!container) return;
    
    if (achievements.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 empty-state">
                <div class="text-4xl mb-4">🏆</div>
                <p class="text-gray-400">No achievements yet</p>
                <p class="text-sm text-gray-500 mt-2">Play games to unlock achievements</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = achievements.slice(0, 4).map(achievement => `
        <div class="bg-slate-700 p-4 rounded-lg flex items-center space-x-4 card-hover">
            <div class="text-2xl">${achievement.icon}</div>
            <div>
                <h4 class="font-semibold">${achievement.name}</h4>
                <p class="text-gray-400 text-sm">${achievement.description}</p>
                <p class="text-gray-500 text-xs">${achievement.unlockedAt}</p>
            </div>
        </div>
    `).join('');
}

function initializeModalEvents(): void {
    const playButton = document.getElementById('playButton') as HTMLElement;
    const modalOverlay = document.getElementById('modalOverlay') as HTMLElement;
    const closeButton = document.getElementById('closeButton') as HTMLElement;

    if (playButton && modalOverlay && closeButton) {
        /** Show modal when play button is clicked */
        playButton.addEventListener('click', (e: Event) => {
            e.preventDefault();
            showModal();
        });
        /** Hide modal when close button is clicked */
        closeButton.addEventListener('click', (e: Event) => {
            e.preventDefault();
            hideModal();
        });
        /** Hide modal when clicking outside the modal content */
        modalOverlay.addEventListener('click', (e: Event) => {
            if (e.target === modalOverlay) {
                hideModal();
            }
        });
        /** Hide modal when pressing Escape key */
        document.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !modalOverlay.classList.contains('hidden')) {
                hideModal();
            }
        });
        /** Add click handlers to game option buttons */
        initializeGameOptionButtons();
    }
}

function showModal(): void {
    const modalOverlay = document.getElementById('modalOverlay') as HTMLElement;
    if (modalOverlay) {
        modalOverlay.classList.remove('hidden');
        modalOverlay.classList.add('flex');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
}

function hideModal(): void {
    const modalOverlay = document.getElementById('modalOverlay') as HTMLElement;
    if (modalOverlay) {
        modalOverlay.classList.add('hidden');
        modalOverlay.classList.remove('flex');
        document.body.style.overflow = 'auto'; // Restore scrolling
    }
}

function initializeGameOptionButtons(): void {
    const gameOptionButtons = document.querySelectorAll('#modalOverlay button:not(#closeButton)');
    const options = ['Solo vs Computer (AI)', 'Multiplayer Local', 'Game Settings'];
    
    gameOptionButtons.forEach((button, index) => {
        button.addEventListener('click', (e: Event) => {
            e.preventDefault();
            handleGameOptionSelection(options[index], index);
        });
    });
}

function handleGameOptionSelection(option: string, index: number): void {
    console.log(`Selected: ${option}`);
    hideModal(); // Close modal after selection
    /** Handle different game options */
    switch (index) {
        case 0: // Solo vs Computer (AI)
            loadGame('solo-ai');
            break;
        case 1: // Multiplayer Local
            loadGame('multiplayer-local');
            break;
        case 2: // Game Settings
            console.log('Opening game settings...');
            /** Need to switch to settings section instead */
            // switchDashboardSection('settings');
            break;
        default:
            console.log('Unknown option selected');
    }
}

function bindEvents(): void {
    const form = document.getElementById('authForm') as HTMLFormElement;
    if (form) form.addEventListener('submit', handleSubmit);
    
    const switchBtn = document.getElementById('switchMode') as HTMLButtonElement;
    if (switchBtn) {
        switchBtn.addEventListener('click', () => {
            isLoginMode = !isLoginMode;
            toggleMode(isLoginMode);
        });
    }
    const googleBtn = document.getElementById('googleSignInBtn') as HTMLButtonElement;
    if (googleBtn) {
        googleBtn.addEventListener('click', handleGoogleSignIn);
    }
}

function handleLogout(e: Event): void {
    e.preventDefault();
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    token = null;
    const dashboardContainer = document.getElementById('dashboardContainer') as HTMLElement;
    const loginContainer = document.getElementById('loginContainer');
    const loadingElement = document.getElementById('loading');
    const loginBg = document.getElementById('loginBg') as HTMLElement;
    if (dashboardContainer) dashboardContainer.style.display = 'none';
    if (loadingElement) loadingElement.style.display = 'none';
    if (loginContainer) loginContainer.style.display = 'block';
    if (loginBg) loginBg.classList.remove('hidden');
    showLoginForm();
}

function bindDashboardEvents(): void {
    /** Create content containers for different sections if they don't exist */
    createSectionContainers();
    const playBtn = document.querySelector('a[data-game="game1"]:not(#playButton)') as HTMLElement;
    const profileBtn = document.querySelector('nav a:nth-child(2)') as HTMLElement;
    const leaderboardBtn = document.querySelector('nav a:nth-child(3)') as HTMLElement;
    const friendsBtn = document.querySelector('nav a:nth-child(4)') as HTMLElement;
    const settingsBtn = document.querySelector('nav a:nth-child(5)') as HTMLElement;
    const logoutBtn = document.querySelector('nav a:last-child') as HTMLElement;
    /** Bind navigation events with preventDefault */
    if (profileBtn) {
        profileBtn.addEventListener('click', (e) => {
            e.preventDefault();
            switchDashboardSection('profile');
        });
    }
    if (leaderboardBtn) {
        leaderboardBtn.addEventListener('click', (e) => {
            e.preventDefault();
            switchDashboardSection('leaderboard');
        });
    }
    if (friendsBtn) {
        friendsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            switchDashboardSection('friends');
        });
    }
    if (settingsBtn) {
        settingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            switchDashboardSection('settings');
        });
    }
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    /** Other play game buttons (if any exist in the content) */
    const otherPlayButtons = document.querySelectorAll('.play-btn:not(#playButton)');
    otherPlayButtons.forEach(btn => {
        btn.addEventListener('click', handlePlayGame);
    });
}

function createSectionContainers(): void {
    const mainContent = document.querySelector('.flex-1.p-8') as HTMLElement;
    if (!mainContent) return;
    /** Store the original dashboard content */
    const originalContent = mainContent.innerHTML;
    const sections = {
        play: originalContent,
        profile: createProfileSection(),
        leaderboard: createLeaderboardSection(),
        friends: createFriendsSection(),
        settings: createSettingsSection()
    };
    /** Store sections in a data attribute for easy access */
    (mainContent as any)._sections = sections;
}

function switchDashboardSection(section: string): void {
    const mainContent = document.querySelector('.flex-1.p-8') as HTMLElement;
    if (!mainContent) return;
    
    const sections = (mainContent as any)._sections;
    if (!sections || !sections[section]) return;
    currentSection = section;
    /** Update navigation active state without causing layout shifts */
    updateNavigationState(section);
    /** Switch content with fade effect */
    mainContent.style.opacity = '0.5';
    setTimeout(() => {
        mainContent.innerHTML = sections[section];
        mainContent.style.opacity = '1';
        /**if play section, reinitialize modal events */
        if (section === 'play') {
            bindPlaySectionEvents();
            /** Reinitialize modal events when returning to play section */
            setTimeout(() => initializeModalEvents(), 100);
        }
    }, 150);
}

function updateNavigationState(activeSection: string): void {
    const navItems = document.querySelectorAll('nav a');
    
    navItems.forEach((item, index) => {
        item.classList.remove('bg-slate-700', 'text-white');
        item.classList.add('text-gray-300');
        const sectionMap: { [key: string]: number } = {
            play: 0,
            profile: 1,
            leaderboard: 2,
            friends: 3,
            settings: 4
        };
        
        if (index === sectionMap[activeSection]) {
            item.classList.remove('text-gray-300');
            item.classList.add('bg-slate-700', 'text-white');
        }
    });
}

function createProfileSection(): string {
    return `
        <div class="fade-in">
            <h2 class="text-3xl font-bold mb-6">Profile Settings</h2>
            <div class="bg-slate-800 rounded-lg p-6">
                <p class="text-gray-300 mb-4">Manage your profile and account settings</p>
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Display Name</label>
                        <input type="text" class="w-full p-3 bg-slate-700 rounded-lg text-white" placeholder="Your display name">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Bio</label>
                        <textarea class="w-full p-3 bg-slate-700 rounded-lg text-white" rows="3" placeholder="Tell us about yourself"></textarea>
                    </div>
                    <button class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    `;
}

function createLeaderboardSection(): string {
    return `
        <div class="fade-in">
            <h2 class="text-3xl font-bold mb-6">Leaderboard</h2>
            <div class="bg-slate-800 rounded-lg p-6">
                <p class="text-gray-300 mb-4">Top players and rankings</p>
                <div class="space-y-3">
                    ${Array.from({length: 10}, (_, i) => `
                        <div class="flex items-center justify-between p-3 bg-slate-700 rounded">
                            <div class="flex items-center space-x-3">
                                <span class="text-lg font-bold text-yellow-500">#${i + 1}</span>
                                <span class="text-white">Player ${i + 1}</span>
                            </div>
                            <span class="text-blue-400 font-semibold">${1500 - i * 50} pts</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

function createFriendsSection(): string {
    return `
        <div class="fade-in">
            <h2 class="text-3xl font-bold mb-6">Friends</h2>
            <div class="bg-slate-800 rounded-lg p-6">
                <p class="text-gray-300 mb-4">Manage your friends and social connections</p>
                <div class="text-center py-8 empty-state">
                    <div class="text-4xl mb-4">👥</div>
                    <p class="text-gray-400">No friends added yet</p>
                    <p class="text-sm text-gray-500 mt-2">Connect with other players to see them here</p>
                </div>
            </div>
        </div>
    `;
}

function createSettingsSection(): string {
    return `
        <div class="fade-in">
            <h2 class="text-3xl font-bold mb-6">Settings</h2>
            <div class="bg-slate-800 rounded-lg p-6">
                <p class="text-gray-300 mb-4">Game settings and preferences</p>
                <div class="space-y-6">
                    <div>
                        <h3 class="text-lg font-semibold mb-3">Game Settings</h3>
                        <div class="space-y-3">
                            <label class="flex items-center space-x-3">
                                <input type="checkbox" class="rounded bg-slate-700" checked>
                                <span class="text-gray-300">Enable sound effects</span>
                            </label>
                            <label class="flex items-center space-x-3">
                                <input type="checkbox" class="rounded bg-slate-700">
                                <span class="text-gray-300">Enable background music</span>
                            </label>
                        </div>
                    </div>
                    <div>
                        <h3 class="text-lg font-semibold mb-3">Display Settings</h3>
                        <div class="space-y-3">
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-2">Theme</label>
                                <select class="w-full p-3 bg-slate-700 rounded-lg text-white">
                                    <option>Dark</option>
                                    <option>Light</option>
                                    <option>Auto</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function bindPlaySectionEvents(): void {
    const playButtons = document.querySelectorAll('.play-btn:not(#playButton)');
    playButtons.forEach(btn => {
        btn.addEventListener('click', handlePlayGame);
    });
}

function handlePlayGame(e: Event): void {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    const gameType = target.dataset.game;
    if (gameType) {
        loadGame(gameType);
    }
}

function loadGame(gameType: string): void {
    console.log(`Loading game: ${gameType}`);
    /** Hide dashboard and show game canvas */
    const dashboardContainer = document.getElementById('dashboardContainer') as HTMLElement;
    const gameCanvas = document.getElementById('gameCanvas') as HTMLElement;
    
    if (dashboardContainer) dashboardContainer.style.display = 'none';
    if (gameCanvas) {
        gameCanvas.classList.remove('hidden');
        /** we need to initialize Babylon.js game here based on gameType */
        initializeGame(gameType);
    }
}

/** Placeholder for game initialization */
function initializeGame(gameType: string): void {
    console.log(`Initializing ${gameType} game...`);
    /** Initialize Babylon.js game here based on the selected game type */
    /** This is where we need to differentiate between 'solo-ai', 'multiplayer-local', etc. */
}

async function handleSubmit(e: Event): Promise<void> {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn') as HTMLButtonElement;
    const submitText = document.getElementById('submitText') as HTMLElement;
    const submitLoading = document.getElementById('submitLoading') as HTMLElement;
    
    if (submitBtn) submitBtn.disabled = true;
    if (submitText) submitText.classList.add('hidden');
    if (submitLoading) submitLoading.classList.remove('hidden');
    
    try {
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;
        const name = formData.get('name') as string;
        
        let user: User;
        if (isLoginMode) {
            const res = await login(email, password);
            token = res.token;
            user = res.user;
        } else {
            if (!name) throw new Error('Name is required');
            const res = await register(name, email, password);
            token = res.token;
            user = res.user;
        }
        
        localStorage.setItem('token', token);
        localStorage.setItem('userData', JSON.stringify(user));
        await loadUserDashboard(user);
    } catch (err: any) {
        showError(err.message);
    } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (submitText) submitText.classList.remove('hidden');
        if (submitLoading) submitLoading.classList.add('hidden');
    }
}

function handleGoogleSignIn(): void {
    const googleBtn = document.getElementById('googleSignInBtn') as HTMLButtonElement;
    const googleBtnText = document.getElementById('googleBtnText') as HTMLElement;
    const googleBtnLoading = document.getElementById('googleBtnLoading') as HTMLElement;
    
    if (googleBtn) googleBtn.disabled = true;
    if (googleBtnText) googleBtnText.classList.add('hidden');
    if (googleBtnLoading) googleBtnLoading.classList.remove('hidden');
    
    window.location.href = 'http://localhost:3001/api/auth/google';
}

async function fetchUserProfile(token: string): Promise<any> {
    const response = await fetch('http://localhost:3002/api/user/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch profile');
    return response.json();
}

async function fetchLeaderboard(token: string): Promise<any> {
    const response = await fetch('http://localhost:3002/api/user/leaderboard', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch Leaderboard');
    return response.json();
}

async function fetchFriends(token: string): Promise<any> {
    const response = await fetch('http://localhost:3002/api/user/friends', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch friends');
    return response.json();
}