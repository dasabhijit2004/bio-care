const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const nodemailer = require("nodemailer");
const xlsx = require("xlsx"); // For handling Excel files
const fs = require("fs");
const cors = require("cors");
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

// Load environment variables
dotenv.config();

// Environment Variables Validation
const MONGO_URI = process.env.MONGO_URI;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const PORT = process.env.PORT || 5000;

if (!MONGO_URI || !EMAIL_USER || !EMAIL_PASS) {
  console.error("Missing environment variables!");
  process.exit(1);
}

// Initialize Express App
const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests
});
app.use(limiter);

// Connect to MongoDB
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Error connecting to MongoDB:", err));

mongoose.connection.on("connected", () => {
  console.log("Mongoose connected to the database");
});
mongoose.connection.on("error", (err) => {
  console.error("Mongoose connection error:", err);
});
mongoose.connection.on("disconnected", () => {
  console.log("Mongoose disconnected");
});

// Define Schemas
const UserSchema = new mongoose.Schema({
  name: String,
  username: String,
  password: String,
});
const User = mongoose.model("User", UserSchema);

// Utility Function: Save User to Excel
const saveUserToExcel = (name, username, password) => {
  const filePath = "./user_data.xlsx";
  let workbook;

  if (fs.existsSync(filePath)) {
    workbook = xlsx.readFile(filePath);
  } else {
    workbook = xlsx.utils.book_new();
  }

  const sheetName = "Users";
  let worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    worksheet = xlsx.utils.aoa_to_sheet([["Name", "Username", "Password"]]);
    xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
  }

  const newRow = [name, username, password];
  xlsx.utils.sheet_add_aoa(worksheet, [newRow], { origin: -1 });

  xlsx.writeFile(workbook, filePath);
};

// Root Route
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// Signup Route
app.post("/signup", async (req, res) => {
  const { name, username, password } = req.body;

  if (!name || !username || !password) {
    return res.status(400).json({ message: "All fields are required!" });
  }

  try {
    const userExists = await User.findOne({ username });
    if (userExists) {
      return res.status(400).json({ message: "Username already exists!" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, username, password: hashedPassword });
    await newUser.save();

    saveUserToExcel(name, username, hashedPassword);

    res.status(201).json({ message: "User registered successfully!" });
  } catch (err) {
    console.error("Signup Error:", err);  // Log error for debugging
    res.status(500).json({ message: "Error during signup: " + err.message });
  }
});

// Login Route
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "All fields are required!" });
  }

  try {
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid credentials!" });
    }

    res.json({ success: true, message: "Login successful!" });
  } catch (err) {
    console.error("Login Error:", err);  // Log error for debugging
    res.status(500).json({ message: "Error during login: " + err.message });
  }
});

// Nodemailer Setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

// Query Route
app.post("/query", async (req, res) => {
  const { name, email, query } = req.body;

  if (!name || !email || !query) {
    return res.status(400).send("All fields are required!");
  }

  const mailOptions = {
    from: EMAIL_USER,
    to: EMAIL_USER,
    subject: "New Query from Bio Care",
    html: `
      <h1>New Query from Bio Care</h1>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Query:</strong> ${query}</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.send("Query sent successfully!");
  } catch (err) {
    res.status(500).send("Error sending query: " + err.message);
  }
});

// Feedback Route
app.post("/feedback", async (req, res) => {
  const { name, email, feedback } = req.body;

  if (!name || !email || !feedback) {
    return res.status(400).send("All fields are required!");
  }

  const mailOptions = {
    from: EMAIL_USER,
    to: EMAIL_USER,
    subject: "New Feedback from Bio Care",
    html: `
      <h1>New Feedback from Bio Care</h1>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Feedback:</strong> ${feedback}</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.send("Feedback sent successfully!");
  } catch (err) {
    res.status(500).send("Error sending feedback: " + err.message);
  }
});

// Export all users to Excel
app.get("/export-users", async (req, res) => {
  try {
    const users = await User.find();

    const worksheet = xlsx.utils.json_to_sheet(
      users.map((user) => ({
        Name: user.name,
        Username: user.username,
      }))
    );

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Users");

    const excelFile = xlsx.write(workbook, { bookType: "xlsx", type: "buffer" });
    res.setHeader("Content-Disposition", "attachment; filename=users.xlsx");
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(excelFile);
  } catch (err) {
    res.status(500).send("Error exporting users to Excel: " + err.message);
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
