import { verifyGoogleToken } from "../google.js";
import { generateSecret, getQRCode, verifyToken } from "../twofa.js";
import {
	getUserByEmail,
	createUser,
	updateUserSecret,
	enable2FA,
} from "../db.js";

export default async function (app, opts) {
	//Post /login - Google Sign-in
	app.post('/login', async(req, res) => {
		try {
			const { token } = req.body;
			const userData = await verifyGoogleToken(token);

			let user = getUserByEmail(userData.email);
			if (!user) {
				createUser({email: userData.email, name: userData.name});
				user = getUserByEmail(userData.email);
			}
			if (user.twoFA) {
				return res.send({ twoFA: true });
			}
			const jwt = app.jwt.sign({ email: user.email });
			res.send({ jwt });
		} catch (err) {
			console.error(err);
			res.code(401).send({ error: "Authentication failed"})
		}
	});

	app.post('/enable-2fa', async(req, res) => {
		const { email } = req.body;
		const user = getUserByEmail(email);
		if (!user) return res.code(400).send({ error: 'Invalid user '});
		const secret = generateSecret(email);
		updateUserSecret(email, secret.base32);
		const qr = await getQRCode(secret);
		res.send({ qr });
	});

	app.post('/verify-2fa', async(req, res) => {
		const { email, token } = req.body;
		const user = getUserByEmail(email);
		if (!user || !user.secret) return res.code(400).send({ error: '2FA not set up'});
		const isValid = verifyToken(user.secret, token);
		if (!isValid) return res.code(401).send({ error: 'Invalid 2FA token' });
		enable2FA(email);
		const jwt = app.jwt.sign({ email: user.email });
		res.send({ jwt });
	});
}