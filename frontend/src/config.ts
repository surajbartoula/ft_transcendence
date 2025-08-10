export const API_CONFIG = {
    GATEWAY_URL: 'https://localhost:3005',
    ENDPOINTS: {
        AUTH: '/api/auth',
        USER: '/api/user',
        CHAT: '/api/chat',
        GAME: '/api/game'
    }
};

export const ROUTES = {
    LOGIN: '/login',
    DASHBOARD: '/dashboard',
    PROFILE: '/dashboard/profile',
    LEADERBOARD: '/dashboard/leaderboard',
    SETTINGS: '/dashboard/settings',
    CHAT: '/chat',
    GAME: '/game'
} as const;

export const APP_CONFIG = {
    APP_NAME: 'ft_transcendence',
    VERSION: '1.0.0',
    DEFAULT_ROUTE: '/login',
    PROTECTED_ROUTES: [
        '/dashboard',
        '/dashboard/profile',
        '/dashboard/leaderboard', 
        '/dashboard/settings',
        '/chat',
        '/game'
    ],
    ANIMATION_DURATION: 300,
    NOTIFICATION_DURATION: 5000,
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
};

/** Game configuration */
export const GAME_CONFIG = {
    CANVAS_ID: 'gameCanvas',
    DEFAULT_SETTINGS: {
        sound: true,
        music: false,
        difficulty: 'medium',
        theme: 'dark'
    },
    GAME_MODES: {
        SOLO_AI: 'solo-ai',
        MULTIPLAYER_LOCAL: 'multiplayer-local',
        MULTIPLAYER_ONLINE: 'multiplayer-online'
    }
};

/** Chat configuration */
export const CHAT_CONFIG = {
    MAX_MESSAGE_LENGTH: 500,
    TYPING_TIMEOUT: 3000,
    RECONNECT_ATTEMPTS: 5,
    RECONNECT_DELAY: 1000
};

/** UI Configuration */
export const UI_CONFIG = {
    SIDEBAR_WIDTH: 256, // 16rem in pixels
    HEADER_HEIGHT: 64,  // 4rem in pixels
    MOBILE_BREAKPOINT: 768,
    ANIMATIONS: {
        PAGE_TRANSITION: 300,
        MODAL_FADE: 200,
        NOTIFICATION_SLIDE: 250
    },
    DEBOUNCE_DELAYS: {
        SEARCH: 300,
        RESIZE: 150,
        SCROLL: 100
    }
};

/** Export types for better TypeScript support */
export type RouteKey = keyof typeof ROUTES;
export type GameMode = keyof typeof GAME_CONFIG.GAME_MODES;