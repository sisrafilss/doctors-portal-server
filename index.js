const express = require("express");
const { MongoClient } = require("mongodb");
const ObjectId = require("mongodb").ObjectId;
const admin = require("firebase-admin");
require("dotenv").config();
const cors = require("cors");
const stripe = require("stripe")(`${process.env.STRIPE_SECRET}`);
const fileUpload = require("express-fileupload");

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());
app.use(fileUpload());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.quv1r.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
});

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
});

async function verifyToken(req, res, next) {
	if (req.headers?.authorization.startsWith("Bearer ")) {
		const token = req.headers?.authorization.split(" ")[1];
		try {
			const decodedUser = await admin.auth().verifyIdToken(token);
			req.decodedEmail = decodedUser.email;
		} catch {}
	}
	next();
}

async function run() {
	try {
		await client.connect();

		const database = client.db("doctors_portal");
		const appointmentCollection = database.collection("appointments");
		const userCollection = database.collection("users");
		const doctorCollection = database.collection("doctors");

		// GET Appointments
		app.get("/appointments", verifyToken, async (req, res) => {
			const email = req.query.email;
			const date = new Date(req.query.date).toLocaleDateString();
			const query = { email: email, date: date };

			const cursor = appointmentCollection.find(query);
			const result = await cursor.toArray();
			res.json(result);
		});

		// Get specific appointment based on ObjctId
		app.get("/appointments/:id", async (req, res) => {
			const id = req.params.id;
			const query = { _id: ObjectId(id) };
			const result = await appointmentCollection.findOne(query);
			res.json(result);
		});

		// POST Appointment
		app.post("/appointments", async (req, res) => {
			const appointment = req.body;
			const result = await appointmentCollection.insertOne(appointment);
			res.json(result);
		});

		// Update payment status for a specific appointment after successfull payment
		app.put("/appointments/:id", async (req, res) => {
			const id = req.params.id;
			const payment = req.body;
			const filter = { _id: ObjectId(id) };
			const updateDoc = {
				$set: {
					payment: payment,
				},
			};
			const result = await appointmentCollection.updateOne(filter, updateDoc);
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

		// GET - All doctors
		app.get("/doctors", async (req, res) => {
			const cursor = doctorCollection.find({});
			const result = await cursor.toArray();
			res.json(result);
		});

		// POST - Store newly added doctos data
		app.post("/doctors", async (req, res) => {
			const name = req.body.name;
			const email = req.body.email;
			const pic = req.files.image;
			const picData = pic.data;
			const encodedPic = picData.toString("base64");
			const imageBuffer = Buffer.from(encodedPic, "base64");

			const doctor = {
				name,
				email,
				image: imageBuffer,
			};
			const result = await doctorCollection.insertOne(doctor);
			res.json(result);
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
				const requesterAccount = await userCollection.findOne({
					email: requester,
				});
				if (requesterAccount.role === "admin") {
					const filter = { email: user.email };
					const updateDoc = { $set: { role: "admin" } };
					const result = await userCollection.updateOne(filter, updateDoc);
					res.json(result);
				}
			} else {
				res
					.status(403)
					.json({ message: "You do not have permission to make an Admin." });
			}
		});

		// Stripe
		app.post("/create-payment-intent", async (req, res) => {
			const paymentInfo = req.body;
			const amount = paymentInfo.price * 100;

			const paymentIntent = await stripe.paymentIntents.create({
				currency: "usd",
				amount: amount,
				payment_method_types: ["card"],
			});
			res.send({
				clientSecret: paymentIntent.client_secret,
			});
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
