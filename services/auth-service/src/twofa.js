import speakeasy from 'speakeasy';
import qrcode from 'qrcode'

export function generateSecret(email) {
	return speakeasy.generateSecret({ name: `MyApp (${email})`});
}

export async function getQRCode(secret) {
	if (!secret.otpauth_url) {
		throw new Error('Invalid secret: missing otpauth_url');
	}
	return await qrcode.toDataURL(secret.otpauth_url);
}

export function verifyToken(secret, token) {
	return speakeasy.totp.verify({
		secret,
		encoding: 'base32',
		token,
	});
}