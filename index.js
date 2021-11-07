const express = require("express");
const { MongoClient } = require("mongodb");
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

async function run() {
	try {
		await client.connect();

		const database = client.db("doctors_portal");
		const appointmentCollection = database.collection("appointments");

		// GET Appointments
		app.get("/appointments", async (req, res) => {
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
