const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const nodemailer = require("nodemailer");
const xlsx = require("xlsx"); // For handling Excel files
const fs = require("fs");

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

// Middleware
app.use(express.json()); // For JSON requests
app.use(express.urlencoded({ extended: true })); // For form data
app.use(express.static("public")); // Serve static files

// Connect to MongoDB
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Error connecting to MongoDB:", err));

// Define Schemas
const UserSchema = new mongoose.Schema({
  name: String,
  username: String,
  password: String,
});
const User = mongoose.model("User", UserSchema);

// Root Route
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// Signup Route
app.post("/signup", async (req, res) => {
  const { name, username, password } = req.body;

  // Validate input fields
  if (!name || !username || !password) {
    return res.status(400).send("All fields are required!");
  }

  try {
    // Check if the username already exists
    const userExists = await User.findOne({ username });
    if (userExists) {
      return res.status(400).send("Username already exists!");
    }

    // Create a new user
    const newUser = new User({ name, username, password });
    await newUser.save();

    // Create or read the Excel file to store user data
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

    // Write to Excel file
    xlsx.writeFile(workbook, filePath);

    res.status(201).send("User registered successfully!");
  } catch (err) {
    res.status(500).send("Error during signup: " + err.message);
  }
});

// Login Route
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).send("All fields are required!");
  }

  try {
    const user = await User.findOne({ username });
    if (!user || user.password !== password) {
      return res.status(401).send("Invalid credentials!");
    }

    // Successful login, send a response
    res.json({ success: true, message: "Login successful!" });
  } catch (err) {
    res.status(500).send("Error during login: " + err.message);
  }
});

// Logout Route (Optional)
app.post("/logout", (req, res) => {
  // Since we're using localStorage on the frontend, logout is handled by removing the "loggedIn" key
  res.send("Logged out successfully!");
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
  console.log("Request Body for /query:", req.body);
  const { name, email, query } = req.body;
  
  if (!name || !email || !query) {
    return res.status(400).send("All fields are required!");
  }
  
  const mailOptions = {
    from: EMAIL_USER,
    to: EMAIL_USER,
    subject: "New Query from Bio Care",
    text: `Name: ${name}\nEmail: ${email}\nQuery: ${query}`, // Include user's email
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
  console.log("Request Body for /feedback:", req.body);
  const { name, email, feedback } = req.body; // Ensure email is part of the request
  
  if (!name || !email || !feedback) {
    return res.status(400).send("All fields are required!");
  }
  
  const mailOptions = {
    from: EMAIL_USER,
    to: EMAIL_USER,
    subject: "New Feedback from Bio Care",
    text: `Name: ${name}\nEmail: ${email}\nFeedback: ${feedback}`, // Include user's email
  };
  
  try {
    await transporter.sendMail(mailOptions);
    res.send("Feedback sent successfully!");
  } catch (err) {
    res.status(500).send("Error sending feedback: " + err.message);
  }
});


// Export all users to Excel
app.get('/export-users', async (req, res) => {
  try {
    // Fetch all users from the database
    const users = await User.find();

    // Create a worksheet from the user data
    const worksheet = XLSX.utils.json_to_sheet(users.map(user => ({
      Name: user.name,
      Username: user.username,
      // Avoid returning the password in real-world production environments
    })));

    // Create a workbook and add the worksheet to it
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');

    // Generate Excel file and send it as response
    const excelFile = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    res.setHeader('Content-Disposition', 'attachment; filename=users.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(excelFile); // Send the file as the response
  } catch (err) {
    res.status(500).send("Error exporting users to Excel: " + err.message);
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
