export function showError(message: string): void {
    const errorText = document.getElementById('errorText') as HTMLElement;
    const errorMessage = document.getElementById('errorMessage') as HTMLElement;
    
    if (errorText && errorMessage) {
        errorText.textContent = message;
        errorMessage.classList.remove('hidden');
        errorMessage.classList.add('slide-up');
    } else {
        // Fallback: show notification if error elements don't exist
        showNotification(message, 'error');
    }
}

export function hideError(): void {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.classList.add('hidden');
        errorMessage.classList.remove('slide-up');
    }
}

export function showNotification(
    message: string, 
    type: 'success' | 'error' | 'info' = 'info', 
    duration: number = 5000
): void {
    const notificationsContainer = document.getElementById('notifications');
    if (!notificationsContainer) {
        console.warn('Notifications container not found');
        return;
    }

    const notification = document.createElement('div');
    notification.className = `notification max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 mb-4 ${getNotificationClasses(type)}`;
    
    notification.innerHTML = `
        <div class="flex-1 w-0 p-4">
            <div class="flex items-start">
                <div class="flex-shrink-0">
                    ${getNotificationIcon(type)}
                </div>
                <div class="ml-3 flex-1">
                    <p class="text-sm font-medium ${getNotificationTextColor(type)}">${escapeHtml(message)}</p>
                </div>
            </div>
        </div>
        <div class="flex border-l border-gray-200">
            <button class="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-gray-500 hover:text-gray-600 focus:outline-none">
                ×
            </button>
        </div>
    `;

    // Add close functionality
    const closeBtn = notification.querySelector('button');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            removeNotification(notification);
        });
    }

    notificationsContainer.appendChild(notification);

    // Auto-remove after duration
    if (duration > 0) {
        setTimeout(() => {
            removeNotification(notification);
        }, duration);
    }
}

function getNotificationClasses(type: 'success' | 'error' | 'info'): string {
    switch (type) {
        case 'success':
            return 'border-green-200 bg-green-50';
        case 'error':
            return 'border-red-200 bg-red-50';
        case 'info':
        default:
            return 'border-blue-200 bg-blue-50';
    }
}

function getNotificationTextColor(type: 'success' | 'error' | 'info'): string {
    switch (type) {
        case 'success':
            return 'text-green-900';
        case 'error':
            return 'text-red-900';
        case 'info':
        default:
            return 'text-blue-900';
    }
}

function getNotificationIcon(type: 'success' | 'error' | 'info'): string {
    switch (type) {
        case 'success':
            return `
                <svg class="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            `;
        case 'error':
            return `
                <svg class="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
            `;
        case 'info':
        default:
            return `
                <svg class="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            `;
    }
}

function removeNotification(notification: HTMLElement): void {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100%)';
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300);
}

export function showModal(modalId: string): void {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.style.overflow = 'hidden';
    }
}

export function hideModal(modalId: string): void {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = 'auto';
    }
}

export function setLoading(elementId: string, isLoading: boolean, loadingText: string = 'Loading...'): void {
    const element = document.getElementById(elementId) as HTMLButtonElement;
    if (!element) return;

    if (isLoading) {
        element.disabled = true;
        element.dataset.originalText = element.textContent || '';
        element.innerHTML = `
            <div class="flex items-center justify-center">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ${loadingText}
            </div>
        `;
    } else {
        element.disabled = false;
        element.textContent = element.dataset.originalText || 'Submit';
        delete element.dataset.originalText;
    }
}

export function debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
}

export function throttle<T extends (...args: any[]) => any>(
    func: T,
    delay: number
): (...args: Parameters<T>) => void {
    let lastCall = 0;
    
    return (...args: Parameters<T>) => {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            func.apply(null, args);
        }
    };
}

export function formatDate(date: string | Date): string {
    const d = new Date(date);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffInSeconds < 60) {
        return 'Just now';
    } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 604800) {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days} day${days > 1 ? 's' : ''} ago`;
    } else {
        return d.toLocaleDateString();
    }
}

export function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export function validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/\d/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

export function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function copyToClipboard(text: string): Promise<boolean> {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
    } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'absolute';
        textArea.style.left = '-999999px';
        
        document.body.prepend(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            return Promise.resolve(true);
        } catch (error) {
            return Promise.resolve(false);
        } finally {
            textArea.remove();
        }
    }
}

export function generateAvatarUrl(name: string, size: number = 40): string {
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const backgroundColor = generateColorFromString(name);
    
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${backgroundColor}&color=ffffff&size=${size}`;
}

function generateColorFromString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`.replace(/[^\w]/g, '').slice(3, 9);
}

// Export utility functions for external use
export const utils = {
    debounce,
    throttle,
    formatDate,
    validateEmail,
    validatePassword,
    copyToClipboard,
    generateAvatarUrl,
    escapeHtml
};
