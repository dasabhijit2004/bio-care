const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const nodemailer = require("nodemailer");
const xlsx = require("xlsx"); // For handling Excel files
const fs = require("fs");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const validator = require("validator"); // For email validation

// Initialize Express App
const app = express();
const cors = require('cors');

// Load environment variables
dotenv.config();

// Environment Variables Validation
const MONGO_URI = process.env.MONGO_URI;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const PORT = process.env.PORT || 5000;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS;

if (!MONGO_URI || !EMAIL_USER || !EMAIL_PASS || !ALLOWED_ORIGINS) {
  console.error("Missing environment variables!");
  process.exit(1);
}

// Middleware
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// CORS Setup
const allowedOrigins = ALLOWED_ORIGINS.split(",");
app.use(cors({
  origin: allowedOrigins, // Allows multiple domains dynamically
  methods: ['GET', 'POST'],
  credentials: true, // Allow cookies, authorization headers, etc.
}));

// Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests
  message: "Too many requests, please try again later.",
});
app.use(limiter);

// Connect to MongoDB
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000,
}).then(() => {
  console.log("Connected to MongoDB");
}).catch((err) => {
  console.error("MongoDB connection error:", err);
});

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
  username: { 
    type: String, 
    unique: true, // Create a unique index for username
  },
  password: String,
});

const User = mongoose.model("User", UserSchema);

// Utility Function: Save User to Excel
const saveUserToExcel = (name, username, password) => {
  const filePath = "./user_data.xlsx";
  let workbook;

  try {
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
  } catch (err) {
    console.error("Error saving user to Excel:", err);
  }
};

// Root Route
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// Signup Route
app.post("/signup", async (req, res) => {
  const { name, username, password } = req.body;

  // Check if all fields are provided
  if (!name || !username || !password) {
    return res.status(400).json({ message: "All fields are required!" });
  }

  try {
    // Check if user already exists
    console.log("Checking if user exists...");
    const userExists = await User.find({ username });
    console.log("User exists check result:", userExists);

    // If user exists, return an error
    if (userExists.length > 0) {
      return res.status(400).json({ message: "Username already exists!" });
    }

    // Hash the password
    console.log("Hashing password...");
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    console.log("Creating new user...");
    const newUser = new User({ name, username, password: hashedPassword });
    await newUser.save();

    // Optionally, save the user to an Excel file (for reporting, etc.)
    console.log("Saving user to Excel...");
    saveUserToExcel(name, username, hashedPassword);

    // Respond with success
    return res.status(201).json({ message: "User registered successfully!" });

  } catch (err) {
    // Log detailed error and respond with an internal error
    console.error("Signup error:", err);  // Log the error for debugging
    return res.status(500).json({ message: "Error during signup: " + err.message });
  }
});


// Login Route
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "All fields are required!" });
  }

  try {
    const user = await User.find({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid credentials!" });
    }

    return res.json({ success: true, message: "Login successful!" });
  } catch (err) {
    console.error("Login error:", err); // Detailed logging for errors
    return res.status(500).json({ message: "Error during login: " + err.message });
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

  // Validate email format
  if (!validator.isEmail(email)) {
    return res.status(400).send("Invalid email format!");
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

  // Validate email format
  if (!validator.isEmail(email)) {
    return res.status(400).send("Invalid email format!");
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

// Export Users Route
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
