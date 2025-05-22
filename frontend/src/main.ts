import { setupBabylon } from "scene";
import { onGoogleLogin, setup2FAHandlers, checkAuthOnLoad } from "auth";

setupBabylon();
(window as any).onGoogleLogin = onGoogleLogin;
setup2FAHandlers();
checkAuthOnLoad();