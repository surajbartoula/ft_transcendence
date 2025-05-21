import speakeasy from 'speakeasy';
import qrcode from 'qrcode'

export function generateSecret(email) {
	return speakeasy.generateSecret({ name: `MyApp (${email})`});
}

export async function getQRCode(secret) {
	return await qrcode.toDataURL(secret.otpath_url);
}

export function verifyToken(secret, token) {
	return speakeasy.totp.verify({
		secret,
		encoding: 'ascii',
		token,
	});
}