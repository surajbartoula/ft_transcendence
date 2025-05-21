import { verifyGoogleToken } from "../google";
import { generateSecret, getQRCode, verifyToken } from "../twofa";

const users = {}; //!Need to replace with DB

export default async function (app, opts) {
	//Post /login - Google Sign-in
	app.post('/login', async(req, res) => {
		try {
			const { token } = req.body;
			const userData = await verifyGoogleToken(token);

			//!simulating DB lookput for the mean time but need to change later
			const user = users[userData.email] || {
				email: userData.email,
				name: userData.name,
				twoFA: false,
				secret: null,
			};
			users[user.email] = user;
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
		const { email, token } = req.body;
		if (!email || !users[email]) return res.code(400).send({error: 'Invalid user'});
		const secret = generateSecret(email);
		users[email].secret = secret.ascii;
		const qr = await getQRCode(secret);
		res.send({ qr });
	});

	app.post('/verify-2a', async(req, res) => {
		const { email, token } = req.body;
		const user = users[email];
		if (!user || !user.secret) return res.code(400).send({ error: '2FA not set up'});
		const isValid = verifyToken(user.secret, token);
		if (!isValid) return res.code(401).send({ error: 'Invalid 2FA token' });
		user.twoFA = true;
		const jwt = app.jwt.sign({ email: user.email });
		res.send({ jwt });
	});
}