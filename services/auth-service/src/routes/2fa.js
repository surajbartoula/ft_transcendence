import { generateSecret, getQRCode, verifyToken } from '../twofa.js';
import {
	getUserByEmail,
	createUser,
	updateUserSecret,
	enable2FA,
} from '../db.js';

export default async function (app, opts) {
	app.post('/setup', async(req, res) => {
		const { email, name } = req.body;
		let user = getUserByEmail(email);
		if (!user) {
			createUser({ email, name: name || 'Unamed' });
		}
		const secret = generateSecret(email);
		updateUserSecret(email, secret.base32);
		const qr = await getQRCode(secret);
		res.send({qr, secret: secret.base32});
	});

	app.post('/verify', async (req, res) => {
		const { email, token } = req.body;
		const user = getUserByEmail(email);
		if (!user || !user.secret) {
			return res.status(400).send({ error: 'User or secret not found' });
		}
		const isVerified = verifyToken(token, user.secret);
		if (isVerified) {
			enable2FA(email);
			res.send({ verified: true});
		} else {
			res.status(401).send({ verified: false });
		}
	});

	app.post('/validate', async (req, res) => {
		const { email, token } = req.body;
		const user = getUserByEmail(email);
		if (!user || !user.secret || !user.twoFA) {
			return res.status(400).send({ error: '2FA not set up' });
		}
		const isValid = verifyToken(token, user.secret);

		if (isValid) {
			const jwt = app.jwt.sign({ email });
			res.send({ jwt });
		} else {
			res.status(401).send({ error: 'Invalid token' });
		}
	});
}