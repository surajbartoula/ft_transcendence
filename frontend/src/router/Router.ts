export interface Page {
	render(): string;
	initialize?(): void;
	cleanup?(): void;
	requiresAuth?: boolean;
	title?: string;
}

export interface RouteConfig {
	page: () => Promise<Page>;
	requiresAuth?: boolean;
}

export class Router {
	private routes = new Map<string, RouteConfig>();
	private currentPage: Page | null = null;
	private isAuthenticated = false;

	constructor() {
		/** Handle browser back/forward buttons */
		window.addEventListener('popstate', () => this.navigate(location.pathname, false));
		
		/** Handle link clicks with data-route attribute */
		document.addEventListener('click', (e) => {
			const link = (e.target as HTMLElement).closest('[data-route]') as HTMLElement;
			if (link) {
				e.preventDefault();
				const route = link.getAttribute('data-route');
				if (route) this.navigate(route);
			}
		});
	}

	addRoute(path: string, config: RouteConfig): void {
		this.routes.set(path, config);
	}

	async navigate(path: string, pushState = true): Promise<void> {
		// Strip query parameters for route matching but keep the full path for URL updates
		const pathWithoutQuery = path.split('?')[0];
		let route = this.routes.get(pathWithoutQuery);
		
		// If exact route not found, try to find parametric route
		if (!route) {
			route = this.findParametricRoute(pathWithoutQuery);
		}
		
		/** Handle 404 or auth redirects */
		if (!route) {
			const defaultPath = this.isAuthenticated ? '/dashboard' : '/login';
			if (defaultPath !== path) return this.navigate(defaultPath, pushState);
			return;
		}

		/** Auth checks */
		if (route.requiresAuth && !this.isAuthenticated) {
			if (path !== '/login') return this.navigate('/login', pushState);
			return;
		}

		if (!route.requiresAuth && this.isAuthenticated && path === '/login') {
			return this.navigate('/dashboard', pushState);
		}

		/** Update URL */
		if (pushState && path !== location.pathname) {
			history.pushState({ route: path }, '', path);
		}

		await this.renderPage(route);
	}

	private async renderPage(route: RouteConfig): Promise<void> {
		const mainContent = document.getElementById('main-content');
		if (!mainContent) return;

		try {
			/** Cleanup current page */
			this.currentPage?.cleanup?.();

			/** Load new page */
			const page = await route.page();
			this.currentPage = page;

			/** Update title */
			if (page.title) {
				document.title = `${page.title} - ft_transcendence`;
			}

			mainContent.style.opacity = '0';
			setTimeout(() => {
				mainContent.innerHTML = page.render();
				mainContent.style.opacity = '1';
				page.initialize?.();
			}, 150);

		} catch (error) {
			console.error('Failed to load page:', error);
			mainContent.innerHTML = this.getErrorPage();
		}
	}

	private getErrorPage(): string {
		return `
			<div class="min-h-screen flex items-center justify-center bg-slate-900">
				<div class="text-center">
					<h1 class="text-6xl font-bold text-red-500 mb-4">Error</h1>
					<p class="text-gray-400 mb-6">Something went wrong loading the page.</p>
					<button data-route="/dashboard" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors">
						Go to Dashboard
					</button>
				</div>
			</div>
		`;
	}

	private findParametricRoute(path: string): RouteConfig | undefined {
		for (const [routePath, config] of this.routes) {
			if (this.matchesParametricRoute(routePath, path)) {
				return config;
			}
		}
		return undefined;
	}

	private matchesParametricRoute(routePath: string, actualPath: string): boolean {
		// Handle routes like '/game/tournament/remote/lobby' matching '/game/tournament/remote/lobby/123'
		if (routePath.endsWith('/lobby') && actualPath.includes('/lobby/')) {
			const baseRoute = routePath;
			return actualPath.startsWith(baseRoute + '/');
		}
		
		if (routePath.endsWith('/bracket') && actualPath.includes('/bracket/')) {
			const baseRoute = routePath;
			return actualPath.startsWith(baseRoute + '/');
		}
		
		if (routePath.endsWith('/match') && actualPath.includes('/match/')) {
			const baseRoute = routePath;
			return actualPath.startsWith(baseRoute + '/');
		}
		
		return false;
	}

	setAuthenticated(authenticated: boolean): void {
		this.isAuthenticated = authenticated;
	}

	isUserAuthenticated(): boolean {
		return this.isAuthenticated;
	}

	getCurrentPath(): string {
		return location.pathname;
	}

	start(): void {
		this.navigate(location.pathname, false);
	}
}