const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const nodemailer = require("nodemailer");
const xlsx = require("xlsx");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const validator = require("validator");
const cors = require("cors");

// Initialize Express App
const app = express();
dotenv.config();

// Load and Validate Environment Variables
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
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
  })
);

// Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests
  message: "Too many requests, please try again later.",
});
app.use(limiter);

// MongoDB Connection
const connectToDatabase = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
};

connectToDatabase();

mongoose.connection.on("connected", () => {
  console.log("Mongoose connected to the database");
});

mongoose.connection.on("error", (err) => {
  console.error("Mongoose connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("Mongoose disconnected");
});

// User Schema
const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true,
  },
  mobile: {
    type: String,
    unique: true,
    required: [true, "Mobile number is required"],
    match: [/^\d{10}$/, "Invalid mobile number"], // Example: 10-digit validation
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: [6, "Password must be at least 6 characters"],
  },
});

const User = mongoose.model("User", UserSchema);

// Utility: Save User to Excel
const saveUserToExcel = (name, mobile, password) => {
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
      worksheet = xlsx.utils.aoa_to_sheet([["Name", "Mobile", "Password"]]);
      xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
    }

    const newRow = [name, mobile, password];
    xlsx.utils.sheet_add_aoa(worksheet, [newRow], { origin: -1 });

    xlsx.writeFile(workbook, filePath);
  } catch (err) {
    console.error("Error saving user to Excel:", err);
  }
};

// Routes
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.post("/signup", async (req, res) => {
  const { name, mobile, password } = req.body;

  if (!name || !mobile || !password) {
    return res.status(400).json({ message: "All fields are required!" });
  }

  try {
    const userExists = await User.findOne({ mobile });
    if (userExists) {
      return res.status(400).json({ message: "Mobile number already exists!" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, mobile, password: hashedPassword });

    await newUser.save();
    saveUserToExcel(name, mobile, hashedPassword);

    return res.status(201).json({ message: "User registered successfully!" });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "Mobile number already exists!" });
    }
    console.error("Signup error:", err);
    return res.status(500).json({ message: "Error during signup: " + err.message });
  }
});

app.post("/login", async (req, res) => {
  const { mobile, password } = req.body;

  if (!mobile || !password) {
    return res.status(400).json({ message: "All fields are required!" });
  }

  try {
    const user = await User.findOne({ mobile });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid credentials!" });
    }

    return res.json({ success: true, message: "Login successful!" });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Error during login: " + err.message });
  }
});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

app.post("/query", async (req, res) => {
  const { name, email, query } = req.body;

  if (!name || !email || !query) {
    return res.status(400).send("All fields are required!");
  }

  if (!validator.isEmail(email)) {
    return res.status(400).send("Invalid email format!");
  }

  const mailOptions = {
    from: EMAIL_USER,
    to: EMAIL_USER,
    subject: "New Query",
    html: `
      <h1>New Query</h1>
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
    subject: "New Feedback",
    html: `
      <h1>New Feedback</h1>
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
        Mobile: user.mobile,
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
