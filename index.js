const express = require("express");
const { MongoClient } = require("mongodb");
const admin = require("firebase-admin");
require("dotenv").config();
const cors = require("cors");

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.quv1r.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
});



const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
	credential: admin.credential.cert(serviceAccount)
});

async function verifyToken(req, res, next) {
	if (req.headers?.authorization.startsWith('Bearer ')) {
		const token = req.headers?.authorization.split(' ')[1]
		try {
			const decodedUser = await admin.auth().verifyIdToken(token)
			req.decodedEmail = decodedUser.email;
		}
		catch {

		}
	};
	next();
}

async function run() {
	try {
		await client.connect();

		const database = client.db("doctors_portal");
		const appointmentCollection = database.collection("appointments");
		const userCollection = database.collection("users");

		// GET Appointments
		app.get("/appointments", verifyToken, async (req, res) => {
			const email = req.query.email;
			const date = new Date(req.query.date).toLocaleDateString();
			const query = { email: email, date: date };

			const cursor = appointmentCollection.find(query);
			const result = await cursor.toArray();
			res.json(result);
		});

		// POST Appointment
		app.post("/appointments", async (req, res) => {
			const appointment = req.body;
			const result = await appointmentCollection.insertOne(appointment);
			res.json(result);
		});

		// GET admin from users collection
		app.get("/users/:email", async (req, res) => {
			const email = req.params.email;
			const query = { email };
			const result = await userCollection.findOne(query);
			let isAdmin = false;
			if (result?.role === "admin") {
				isAdmin = true;
			}
			res.json({ admin: isAdmin });
		});

		// POST User
		app.post("/users", async (req, res) => {
			const user = req.body;
			const result = await userCollection.insertOne(user);
			res.json(result);
		});

		// PUT User for Third Party Login System
		app.put("/users", async (req, res) => {
			const user = req.body;
			const filter = { email: user.email };
			const options = { upsert: true };
			const updateDoc = { $set: user };
			const result = await userCollection.updateOne(filter, updateDoc, options);
			res.json(result);
		});

		// Update admin role in userCollection
		app.put("/users/admin", verifyToken, async (req, res) => {
			const user = req.body;
			const requester = req.decodedEmail;
			if (requester) {
				const requesterAccount = await userCollection.findOne({ email: requester });
				if (requesterAccount.role === 'admin') {
					const filter = { email: user.email };
					const updateDoc = { $set: { role: "admin" } };
					const result = await userCollection.updateOne(filter, updateDoc);
					res.json(result);
				}

			}
			else {
				res.status(403).json({ message: 'You do not have permission to make an Admin.' })
			}

		});
	} finally {
		// await client.close();
	}
}
run().catch(console.dir);

app.get("/", (req, res) => {
	res.send("Hello from Doctors Portal!");
});

app.listen(port, () => {
	console.log(`Servier listening at port:${port}`);
});
