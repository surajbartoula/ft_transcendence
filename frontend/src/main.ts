import { onGoogleLogin, setup2FAHandlers, checkAuthOnLoad } from "./auth";

(window as any).onGoogleLogin = onGoogleLogin;
setup2FAHandlers();
checkAuthOnLoad();