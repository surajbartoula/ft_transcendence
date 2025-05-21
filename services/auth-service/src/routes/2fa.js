import { generateSecret, getQRCode, verifyToken } from '../twofa.js';

const users = {}; //!same shared dummy user store

export default async function (app, opts) {
	app.post('/setup', async(req, res) => {
		const { email } = req.body;
		const secret = generateSecret(email);
		users[email] = users[email] || {};
		users[email].tempSecret = secret.base32;
		const qr = await getQRCode(secret);
		res.send({qr, secret: secret.base32});
	});

	app.post('/verify', async (req, res) => {
		const { email, token } = req.body;
		const isVerified = verifyToken(token, users[email]?.tempSecret);
		if (isVerified) {
			users[email].is2FAEnabled = true;
			users[email].secret = users[email].tempSecret;
			delete users[email].tempSecret;
			res.send({ verified: true});
		} else {
			res.status(401).send({ verified: false });
		}
	});

	app.post('/validate', async (req, res) => {
		const { email, token } = req.body;
		const isValid = verifyToken(token, users[email]?.secret);

		if (isValid) {
			const jwt = app.jwt.sign({ email });
			res.send({ jwt });
		} else {
			res.status(401).send({ error: 'Invalid token' });
		}
	});
}