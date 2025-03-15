require("dotenv").config();
const { Storage } = require("megajs")
const mega = require("mega")

const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const hbs = require("hbs");
const nodemailer = require("nodemailer");
const session = require("express-session");
const mongoose = require("mongoose");
const multer = require("multer");
const fs = require("fs");
const cors = require("cors");
const bodyParser = require("body-parser");
const fileType = require("file-type");

// ✅ MongoDB Connection
const mongoURI =
  "mongodb+srv://divansan05:Divansan0076@loginformpractice.vlg9n.mongodb.net/mydatabase?retryWrites=true&w=majority&appName=LoginFormPractice";

mongoose
  .connect(mongoURI)
  .then(() => console.log("✅ MongoDB Atlas Connected Successfully"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// Import MongoDB Models
const { LogInCollection, Students } = require("./mongo");

const app = express();
const port = process.env.PORT || 3000;

// Paths
const viewsPath = path.join(__dirname, "../temp","home.html");
const publicPath = path.join(__dirname, "../public");

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicPath));
app.use(express.static(viewsPath));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/temp/home.html");
});


// Session Middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your_secret_key",
    resave: false,
    saveUninitialized: true,
  })
);

// Flash Message Middleware
app.use((req, res, next) => {
  res.locals.error = req.session.error || null;
  res.locals.success = req.session.success || null;
  req.session.error = null;
  req.session.success = null;
  next();
});

app.use(bodyParser.urlencoded({ extended: true }));

// Handle login form submission (POST request)

// Email Validation Function
const isValidEmail = (email) =>
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);

// Nodemailer Configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Send Signup Confirmation Email
const sendSignupEmail = async (email, fullname) => {
  try {
    await transporter.sendMail({
      from: `Your Website <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Welcome to Our Website!",
      html: `
                <p>Hello <b>${fullname}</b>,</p>
                <p>Thank you for signing up! We're excited to have you on board.</p>
                <p><b>Best Regards,<br>Your Website Team</b></p>
            `,
    });
    console.log("✅ Signup Email Sent Successfully");
  } catch (error) {
    console.error("❌ Error Sending Email:", error);
  }
};

let storage = null;

const connectToMega = async () => {
  console.log("🔄 Connecting to MEGA...");

  return new Promise((resolve, reject) => {
    const storage = new Storage({
      email: "thamaraisiva29@gmail.com",
      password: "Thamaraisiva",
    });

    storage.on("ready", () => {
      console.log("✅ MEGA Connected Successfully");
      resolve(storage);
    });

    storage.on("error", (error) => {
      console.error("❌ MEGA Connection Failed:", error.message);
      reject(error);
    });
  });
};
module.exports = { connectToMega, storage };

// ✅ Upload File to MEGA
async function uploadToMega(filePath, fileName) {
  try {
      console.log(`📤 Uploading ${fileName} to MEGA...`);

      const storage = await connectToMega();
      if (!storage) {
          console.error("❌ MEGA Connection Failed!");
          return;
      }

      const fileBuffer = fs.readFileSync(filePath); // Read file into buffer
      const fileSize = fileBuffer.length; // Get file size

      await storage.upload({
          name: fileName,
          size: fileSize, // ✅ Specify file size
          allowUploadBuffering: true, // ✅ Allow buffering
      }, fileBuffer).complete;

      console.log(`✅ ${fileName} Uploaded Successfully to MEGA!`);
  } catch (error) {
      console.error(`❌ Upload Failed: ${error.message}`);
  }
}
const ensureDirectoryExists = (dir) => {
  if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📂 Created directory: ${dir}`);
  }
};

const uploadFileToMega = async (filePath) => {
  try {
      if (!fs.existsSync(filePath)) {
          console.error(`❌ Error: File not found - ${filePath}`);
          return;
      }

      const storage = new mega.Storage({
          email: process.env.MEGA_EMAIL,
          password: process.env.MEGA_PASSWORD
      });

      await new Promise((resolve) => storage.once('ready', resolve));

      const fileName = path.basename(filePath);
      const newFileName = `${Date.now()}_${fileName}`; // Add timestamp

      const file = fs.createReadStream(filePath);
      const uploadStream = storage.upload(newFileName, file);

      uploadStream.on('complete', () => {
          console.log(`✅ File uploaded: ${newFileName}`);
      });

      uploadStream.on('error', (err) => {
          console.error(`❌ Upload failed: ${err.message}`);
      });

  } catch (error) {
      console.error("Error:", error);
  }
};

// ✅ Ensure "uploads" directory exists
const uploadDir = "D:/uploads";
const filePath = path.join(uploadDir);
ensureDirectoryExists(uploadDir);

// ✅ Ensure file exists before calling upload
if (fs.existsSync(filePath)) {
  uploadFileToMega(filePath);
} else {
  console.error(`❌ Error: File not found at ${filePath}`);
}

// ✅ Test the connection and upload
const testMegaUpload = async () => {
  await connectToMega();
  if (storage) {
    try {
      const file = await uploadToMega("./sample.txt", "sample_uploaded.txt");
      console.log("✅ File Uploaded Successfully:", file);
    } catch (error) {
      console.error("❌ Upload Failed:", error.message);
    }
  }
};

// Run the test function
testMegaUpload();


// 🛠️ Multer Storage Configuration
const storageConfig = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Files will be stored in 'uploads' folder
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Rename file
  },
});

const upload = multer({ storage: storageConfig });

// ✅ File Upload API
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send("❌ No file uploaded.");

    const filePath = req.file.path;
    const fileName = req.file.originalname;

    // Upload to MEGA Cloud
    const megaFileUrl = await uploadToMega(filePath, fileName);

    // Store MEGA URL in MongoDB
    await Students.updateOne(
      { _id: req.body.studentId },
      {
        $set: { "documents.photo": megaFileUrl },
      }
    );

    // Delete local file after upload
    fs.unlinkSync(filePath);

    res.json({ message: "✅ File uploaded to MEGA!", megaFileUrl });
  } catch (error) {
    console.error("❌ Upload Error:", error);
    res.status(500).json({ error: "Upload failed" });
  }
});

// ✅ Start MEGA Connection on Server Start
connectToMega();

// Serve Pages (Now Serving HTML)
app.get("/", (req, res) => res.sendFile(path.join(viewsPath, "home.html")));
app.get("/login", (req, res) =>
  res.sendFile(path.join(viewsPath, "login.html"))
);
app.get("/signup", (req, res) =>
  res.sendFile(path.join(viewsPath, "signup.html"))
);
app.get("/student", (req, res) =>
  res.sendFile(path.join(viewsPath, "student.html"))
);
app.get("/admin", async (req, res) => {
  res.sendFile(path.join(viewsPath, "admin.html"));
});
app.get("/forgot-password", (req, res) =>
  res.sendFile(path.join(viewsPath, "forgot-password.html"))
);
app.get("/verify-otp", (req, res) =>
  res.sendFile(path.join(viewsPath, "verify-otp.html"))
);
app.get("/reset-password", (req, res) => {
  res.sendFile(path.join(viewsPath, "reset-password.html"));
});
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));

app.post("/signup", upload.single("photo"), async (req, res) => {
  const { fullname, email, role, username, password } = req.body;

  try {
    if (!fullname || !email || !role || !username || !password) {
      return res.redirect("/signup?error=All fields are required.");
    }

    if (!isValidEmail(email)) {
      return res.redirect("/signup?error=Invalid email address.");
    }

    const existingUser = await LogInCollection.findOne({ email });

    if (existingUser) {
      return res.redirect("/signup?error=User already exists with this email.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new LogInCollection({
      fullname,
      email,
      role,
      username,
      password: hashedPassword,
      photo: req.file ? req.file.filename : null,
    });

    await newUser.save();
    await sendSignupEmail(email, fullname);

    return res.redirect("/login?success=Signup successful! Please log in.");
  } catch (error) {
    console.error("❌ Signup Error:", error);
    return res.redirect("/signup?error=Server error occurred.");
  }
});

app.post("/login", async (req, res) => {
  const { email, password, role } = req.body;

  try {
    if (!email || !password || !role) {
      return res.redirect("/login?error=All fields are required.");
    }

    if (role === "admin") {
      if (
        email === process.env.ADMIN_EMAIL &&
        password === process.env.ADMIN_PASSWORD
      ) {
        req.session.username = "Admin";
        req.session.role = "admin";
        return res.redirect("/admin");
      } else {
        return res.redirect("/login?error=Invalid Admin Credentials.");
      }
    }

    const user = await LogInCollection.findOne({ email, role });

    if (!user) {
      return res.redirect("/login?error=User not found.");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.redirect("/login?error=Incorrect password.");
    }

    req.session.username = user.username;

    if (role === "student") return res.redirect("/student");
    if (role === "admin") return res.redirect("/admin");

    return res.redirect("/login?error=Invalid role.");
  } catch (error) {
    console.error("❌ Login Error:", error);
    return res.redirect("/login?error=Server error occurred.");
  }
});

app.get("/student", (req, res) => {
  res.sendFile(path.join(__dirname, "student.html"));
});

const subjectMapping = {
  "Science with Mathematics (PCM)": [
    "Tamil",
    "English",
    "Physics",
    "Chemistry",
    "Mathematics",
    "Biology",
  ],
  "Science with Biology (PCB)": [
    "Tamil",
    "English",
    "Physics",
    "Chemistry",
    "Zoology",
    "Botany",
  ],
  "Computer Science": [
    "Tamil",
    "English",
    "Physics",
    "Chemistry",
    "Mathematics",
    "Computer Science",
  ],
};

app.post("/students",upload.fields([
    { name: "aadharCard", maxCount: 1 },
    { name: "communityCertificate", maxCount: 1 },
    { name: "tenthMarkSheet", maxCount: 1 },
    { name: "eleventhMarkSheet", maxCount: 1 },
    { name: "twelfthMarkSheet", maxCount: 1 },
    { name: "transferCertificate", maxCount: 2 },
    { name: "birthCertificate", maxCount: 1 },
    { name: "firstCertificate", maxCount: 1 },
    { name: "photo", maxCount: 1 },
    { name: "studentSignature", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      console.log("Received form data:", req.body);
      console.log("Received files:", req.files);

      let errors = [];
      let missingFields = [];

      const {
        applicationNo,
        name,
        registerNo,
        dob,
        gender,
        department,
        batch,
        bloodGroup,
        mobileNo,
        aadharNo,
        email,
        nationality,
        religion,
        community,
        motherTongue,
        modeOfAdmission,
        selectedGroup,
        year,
        hostel,
        regular,
        first,
        fatherName,
        fatherOccupation,
        fatherMobile,
        fatherAnnualIncome,
        motherName,
        motherOccupation,
        motherMobile,
        motherAnnualIncome,
        school6,
        marks6,
        year6,
        school7,
        marks7,
        year7,
        school8,
        marks8,
        year8,
        school9,
        marks9,
        year9,
        school10,
        marks10,
        year10,
        school11,
        marks11,
        year11,
        school12,
        marks12,
        year12,
        mediumOfInstruction,
        cutoff,
        address,
      } = req.body;

      const addressObj = JSON.parse(address);

      const { doorNo, street, villageCity, state, district, pinCode } =
        addressObj;

      if (!applicationNo) {
        errors.push("Application number is required.");
        missingFields.push("Application Number");
      }
      if (!name) {
        errors.push("Student name is required.");
        missingFields.push("Name");
      }
      if (!registerNo) {
        errors.push("Register number is required.");
        missingFields.push("Register Number");
      }
      if (!dob) {
        errors.push("Date of birth is required.");
        missingFields.push("Date of Birth");
      }
      if (!gender) {
        errors.push("Gender is required.");
        missingFields.push("Gender");
      }
      if (!department) {
        errors.push("Department is required.");
        missingFields.push("Department");
      }
      if (!batch) {
        errors.push("Batch is required.");
        missingFields.push("Batch");
      }
      if (!mobileNo) {
        errors.push("Mobile number is required.");
        missingFields.push("Mobile Number");
      }
      if (!email) {
        errors.push("Email is required.");
        missingFields.push("Email");
      }
      if (!cutoff) {
        errors.push("Cutoff is required.");
        missingFields.push("Cutoff");
      }
      if (!year) {
        errors.push("Year is required.");
        missingFields.push("Year");
      }
      if (!hostel) {
        errors.push("Hostel/Day Scholar selection is required.");
        missingFields.push("Hostel");
      }
      if (!regular) {
        errors.push("Regular/Lateral selection is required.");
        missingFields.push("Regular");
      }
      if (!first) {
        errors.push("Yes/No selection is required.");
        missingFields.push("First");
      }
      if (!doorNo) {
        errors.push("Door Number is required.");
        missingFields.push("Door Number");
      }
      if (!street) {
        errors.push("Street is required.");
        missingFields.push("Street");
      }
      if (!villageCity) {
        errors.push("Village/City is required.");
        missingFields.push("Village/City");
      }
      if (!state) {
        errors.push("State is required.");
        missingFields.push("State");
      }
      if (!district) {
        errors.push("District is required.");
        missingFields.push("District");
      }
      if (!pinCode) {
        errors.push("PIN code is required.");
        missingFields.push("PIN Code");
      }
      if (!fatherMobile) {
        errors.push("Father mobile is required.");
        missingFields.push("Father Mobile");
      }
      if (!motherMobile) {
        errors.push("Mother mobile is required.");
        missingFields.push("Mother Mobile");
      }
      if (!mediumOfInstruction) {
        errors.push("Medium of Instruction is required");
        missingFields.push("Medium of Instruction");
      }

      if (!school10) {
        errors.push("School Name for Class X is required.");
        missingFields.push("School 10");
      }
      if (!marks10) {
        errors.push("Valid Marks for Class X are required.");
        missingFields.push("Marks 10");
      }
      if (
        marks10.toLowerCase() !== "pass" &&
        marks10.toLowerCase() !== "all pass" &&
        isNaN(parseFloat(marks10))
      ) {
        errors.push("Valid Marks for Class X are required.");
        missingFields.push("Marks 10");
      }
      if (!year10 || isNaN(parseInt(year10, 10))) {
        errors.push("Valid Passing Year for Class X is required.");
        missingFields.push("Year 10");
      }

      if (!school11) {
        errors.push("School Name for Class XI is required.");
        missingFields.push("School 11");
      }
      if (!marks11) {
        errors.push("Valid Marks for Class XI are required.");
        missingFields.push("Marks 11");
      }
      if (
        marks11.toLowerCase() !== "pass" &&
        marks11.toLowerCase() !== "all pass" &&
        isNaN(parseFloat(marks11))
      ) {
        errors.push("Valid Marks for Class XI are required.");
        missingFields.push("Marks 11");
      }
      if (!year11 || isNaN(parseInt(year11, 10))) {
        errors.push("Valid Passing Year for Class XI is required.");
        missingFields.push("Year 11");
      }

      if (!school12) {
        errors.push("School Name for Class XII is required.");
        missingFields.push("School 12");
      }
      if (!marks12) {
        errors.push("Valid Marks for Class XII are required.");
        missingFields.push("Marks 12");
      }
      if (
        marks12.toLowerCase() !== "pass" &&
        marks12.toLowerCase() !== "all pass" &&
        isNaN(parseFloat(marks12))
      ) {
        errors.push("Valid Marks for Class XII are required.");
        missingFields.push("Marks 12");
      }
      if (!year12 || isNaN(parseInt(year12, 10))) {
        errors.push("Valid Passing Year for Class XII is required.");
        missingFields.push("Year 12");
      }

      const subjects = subjectMapping[selectedGroup];
      subjects.forEach((subject) => {
        const marksKey = subject.toLowerCase() + "Marks";
        const marksValue = req.body[marksKey];
        const marks =
          marksValue.toLowerCase() === "pass" ||
          marksValue.toLowerCase() === "all pass"
            ? marksValue
            : parseFloat(marksValue);
        if (!marksValue) {
          errors.push(`Valid ${subject} Marks are required.`);
          missingFields.push(`${subject} Marks`);
        } else if (
          isNaN(marks) &&
          marksValue.toLowerCase() !== "pass" &&
          marksValue.toLowerCase() !== "all pass"
        ) {
          errors.push(`${subject} Marks must be a number or "Pass".`);
          missingFields.push(`${subject} Marks`);
        }
      });

      if (!req.files || !req.files["aadharCard"]) {
        missingFields.push("Aadhar Card");
      }
      if (!req.files || !req.files["communityCertificate"]) {
        missingFields.push("Community Certificate");
      }
      if (!req.files || !req.files["tenthMarkSheet"]) {
        missingFields.push("10th Mark Sheet");
      }
      if (!req.files || !req.files["eleventhMarkSheet"]) {
        missingFields.push("11th Mark Sheet");
      }
      if (!req.files || !req.files["twelfthMarkSheet"]) {
        missingFields.push("12th Mark Sheet");
      }
      if (!req.files || !req.files["transferCertificate"]) {
        missingFields.push("Transfer Certificate");
      }
      if (!req.files || !req.files["birthCertificate"]) {
        missingFields.push("Birth Certificate");
      }
      if (
        req.body.first === "Yes" &&
        (!req.files || !req.files["firstCertificate"])
      ) {
        missingFields.push("First Graduate Certificate");
      }
      if (!req.files || !req.files["photo"]) {
        missingFields.push("Photo");
      }
      if (!req.files || !req.files["studentSignature"]) {
        missingFields.push("Student Signature");
      }

      if (errors.length > 0) {
        return res
          .status(400)
          .json({ error: "Validation Failed", details: errors });
      }

      const twelfthSubjectMarks = subjects.map((subject) => {
        const marksKey = subject.toLowerCase() + "Marks";
        const marksValue = req.body[marksKey];
        return {
          subjectName: subject,
          marksObtained:
            marksValue.toLowerCase() === "pass" ||
            marksValue.toLowerCase() === "all pass"
              ? marksValue
              : parseFloat(marksValue),
          yearOfPassing: parseInt(year12),
        };
      });

      const newStudent = new Students({
        applicationNo,
        name,
        registerNo,
        dob,
        gender,
        department,
        batch,
        bloodGroup,
        mobileNo,
        aadharNo,
        email,
        nationality,
        religion,
        community,
        motherTongue,
        modeOfAdmission,
        selectedGroup,
        cutoff: parseFloat(cutoff),
        year,
        hostel,
        regular,
        first,
        address: {
          doorNo,
          street,
          villageCity,
          state,
          district,
          pinCode,
        },
        parents: {
          father: {
            name: fatherName,
            occupation: fatherOccupation,
            mobile: fatherMobile,
            annualIncome: fatherAnnualIncome,
          },
          mother: {
            name: motherName,
            occupation: motherOccupation,
            mobile: motherMobile,
            annualIncome: motherAnnualIncome,
          },
        },
        schoolDetails: [
          {
            classLevel: "VI",
            name: school6,
            marks:
              marks6.toLowerCase() === "pass" ||
              marks6.toLowerCase() === "all pass"
                ? marks6
                : parseFloat(marks6),
            passingYear: parseInt(year6, 10),
          },
          {
            classLevel: "VII",
            name: school7,
            marks:
              marks7.toLowerCase() === "pass" ||
              marks7.toLowerCase() === "all pass"
                ? marks7
                : parseFloat(marks7),
            passingYear: parseInt(year7, 10),
          },
          {
            classLevel: "VIII",
            name: school8,
            marks:
              marks8.toLowerCase() === "pass" ||
              marks8.toLowerCase() === "all pass"
                ? marks8
                : parseFloat(marks8),
            passingYear: parseInt(year8, 10),
          },
          {
            classLevel: "IX",
            name: school9,
            marks:
              marks9.toLowerCase() === "pass" ||
              marks9.toLowerCase() === "all pass"
                ? marks9
                : parseFloat(marks9),
            passingYear: parseInt(year9, 10),
          },
          {
            classLevel: "X",
            name: school10,
            marks:
              marks10.toLowerCase() === "pass" ||
              marks10.toLowerCase() === "all pass"
                ? marks10
                : parseFloat(marks10),
            passingYear: parseInt(year10, 10),
          },
          {
            classLevel: "XI",
            name: school11,
            marks:
              marks11.toLowerCase() === "pass" ||
              marks11.toLowerCase() === "all pass"
                ? marks11
                : parseFloat(marks11),
            passingYear: parseInt(year11, 10),
          },
          {
            classLevel: "XII",
            name: school12,
            marks:
              marks12.toLowerCase() === "pass" ||
              marks12.toLowerCase() === "all pass"
                ? marks12
                : parseFloat(marks12),
            passingYear: parseInt(year12, 10),
          },
        ],
        twelfthSubjectMarks: twelfthSubjectMarks,
        mediumOfInstruction,
        documents: {
          aadharCard:
            req.files && req.files["aadharCard"] && req.files["aadharCard"][0]
              ? path.basename(req.files["aadharCard"][0].path)
              : null,
          communityCertificate:
            req.files &&
            req.files["communityCertificate"] &&
            req.files["communityCertificate"][0]
              ? path.basename(req.files["communityCertificate"][0].path)
              : null,
          tenthMarkSheet:
            req.files &&
            req.files["tenthMarkSheet"] &&
            req.files["tenthMarkSheet"][0]
              ? path.basename(req.files["tenthMarkSheet"][0].path)
              : null,
          eleventhMarkSheet:
            req.files &&
            req.files["eleventhMarkSheet"] &&
            req.files["eleventhMarkSheet"][0]
              ? path.basename(req.files["eleventhMarkSheet"][0].path)
              : null,
          twelfthMarkSheet:
            req.files &&
            req.files["twelfthMarkSheet"] &&
            req.files["twelfthMarkSheet"][0]
              ? path.basename(req.files["twelfthMarkSheet"][0].path)
              : null,
          transferCertificate:
            req.files &&
            req.files["transferCertificate"] &&
            req.files["transferCertificate"][0]
              ? path.basename(req.files["transferCertificate"][0].path)
              : null,
          birthCertificate:
            req.files &&
            req.files["birthCertificate"] &&
            req.files["birthCertificate"][0]
              ? path.basename(req.files["birthCertificate"][0].path)
              : null,
          firstCertificate:
            req.files &&
            req.files["firstCertificate"] &&
            req.files["firstCertificate"][0]
              ? path.basename(req.files["firstCertificate"][0].path)
              : null,
          photo:
            req.files && req.files["photo"] && req.files["photo"][0]
              ? path.basename(req.files["photo"][0].path)
              : null,
          studentSignature:
            req.files &&
            req.files["studentSignature"] &&
            req.files["studentSignature"][0]
              ? path.basename(req.files["studentSignature"][0].path)
              : null,
        },
        admissionStatus: {
          status: "Pending",
          remarks: "",
        },
        missingFields: missingFields,
      });
      await newStudent.save();

      senddetailsEmail(email, name, req.body);

      console.log("Student registered successfully!");
      res.status(201).json({ message: "Student registered successfully!" });
    } catch (error) {
      console.error("Error during student registration:", error);
      if (error.code === 11000) {
        return res
          .status(400)
          .json({ error: "Register Number or Application No already exists." });
      }
      res
        .status(500)
        .json({ error: "Internal Server Error", details: error.message });
    }
  }
);
const senddetailsEmail = async (email, fullname, details) => {
  try {
    await transporter.sendMail({
      from: `Your Website <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Student Registration Details",
      html: `
                <p>Hello <b>${fullname}</b>,</p>
                <p>Thank you for submitting your details. Here is the information you provided:</p>
                <ul>
                    <li><b>Name:</b> ${details.name}</li>
                    <li><b>Register No:</b> ${details.registerNo}</li>
                    <li><b>Date of Birth:</b> ${details.dob}</li>
                    <li><b>Gender:</b> ${details.gender}</li>
                    <li><b>Department:</b> ${details.department}</li>
                    <li><b>Batch:</b> ${details.batch}</li>
                    <li><b>Blood Group:</b> ${details.bloodGroup}</li>
                    <li><b>Mobile No::</b> ${details.mobileNo}</li>
                    <li><b>Aadhar No:</b> ${details.aadharNo}</li>
                    <li><b>Email:</b> ${details.email}</li>
                    <li><b>Nationality:</b> ${details.nationality}</li>
                    <li><b>Religion:</b> ${details.religion}</li>
                    <li><b>Community:</b> ${details.community}</li>
                    <li><b>Mother Tongue:</b> ${details.motherTongue}</li>
                    <li><b>Cutoff:</b> ${details.cutoff}</li>
                    <li><b>Year:</b> ${details.year}</li>
                    <li><b>Hostel:</b> ${details.hostel}</li>
                    <li><b>Regular/Lateral:</b> ${details.regular}</li>
                    <li><b>First Graduate:</b> ${details.first}</li>
                    <li><b>Address:</b> ${details.address}</li>
                    <li><b>Father's Name:</b> ${details.fatherName}</li>
                    <li><b>Father's Occupation:</b> ${details.fatherOccupation}</li>
                    <li><b>Father's Mobile:</b> ${details.fatherMobile}</li>
                    <li><b>Mother's Name:</b> ${details.motherName}</li>
                    <li><b>Mother's Occupation:</b> ${details.motherOccupation}</li>
                    <li><b>Mother's Mobile:</b> ${details.motherMobile}</li>
                    <li><b>School 10:</b> ${details.school10}, Marks: ${details.marks10}, Year: ${details.year10}</li>
                    <li><b>School 11:</b> ${details.school11}, Marks: ${details.marks11}, Year: ${details.year11}</li>
                    <li><b>School 12:</b> ${details.school12}, Marks: ${details.marks12}, Year: ${details.year12}</li>
                </ul>
                <p>If there are any mistakes, please contact us.</p>
                <p><b>Best Regards,<br>Your Website Team</b></p>
            `,
    });
    console.log("✅ Student Details Email Sent Successfully");
  } catch (error) {
    console.error("❌ Error Sending Email:", error);
  }
};
// ✅ OTP Expiry Time (10 minutes)
const OTP_EXPIRY_TIME = 10 * 60 * 1000;

// ✅ Forgot Password Page
app.get("/forgot-password", (req, res) => {
  res.render("forgot-password"); // Create forgot-password.hbs
});

app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await LogInCollection.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.redirect(
        `/forgot-password?error=${encodeURIComponent("❌ Email not found!")}`
      );
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000);
    const otpExpiry = Date.now() + OTP_EXPIRY_TIME;

    // Save OTP & Expiry to Database
    user.resetOTP = otp.toString();
    user.otpExpiry = otpExpiry;
    await user.save();

    // Send OTP via Email
    await transporter.sendMail({
      from: `Your Website <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Password Reset OTP",
      html: `
                <p>Hello <b>${user.fullname}</b>,</p>
                <p>Your OTP for password reset is: <b>${otp}</b></p>
                <p>This OTP is valid for 10 minutes.</p>
                <p>If you did not request this, please ignore this email.</p>
                <p><b>Best Regards,<br>Your Website Team</b></p>
            `,
    });

    return res.redirect(
      `/verify-otp?success=${encodeURIComponent("✅ OTP sent to your email!")}`
    );
  } catch (error) {
    console.error("❌ Forgot Password Error:", error);
    return res.redirect(
      `/forgot-password?error=${encodeURIComponent("❌ Something went wrong!")}`
    );
  }
});

// ✅ OTP Verification Page
app.get("/verify-otp", (req, res) => {
  res.render("verify-otp"); // Create verify-otp.hbs
});

// ✅ Handle OTP Verification
app.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.redirect("/verify-otp?error=❌ Email and OTP are required!");
    }

    const user = await LogInCollection.findOne({ email: email.toLowerCase() });

    // ✅ Validate OTP & Expiry
    if (!user || user.resetOTP !== otp || Date.now() > user.otpExpiry) {
      return res.redirect("/verify-otp?error=❌ Invalid or expired OTP!");
    }

    // ✅ Clear OTP from Database after verification
    await LogInCollection.updateOne(
      { email: email.toLowerCase() },
      { $unset: { resetOTP: 1, otpExpiry: 1 } }
    );

    req.session.email = email;
    return res.redirect(
      "/reset-password?success=✅ OTP verified! Set a new password."
    );
  } catch (error) {
    console.error("❌ OTP Verification Error:", error);
    return res.redirect("/verify-otp?error=❌ Something went wrong!");
  }
});

// ✅ Reset Password Page
app.get("/reset-password", (req, res) => {
  if (!req.session.email) {
    req.session.error = "❌ Unauthorized access!";
    return res.redirect("/forgot-password");
  }
  res.render("reset-password"); // Create reset-password.hbs
});

// ✅ Handle Password Reset
app.post("/reset-password", async (req, res) => {
  const { password, confirmPassword } = req.body;
  const email = req.session.email;

  try {
    if (!email) {
      return res.redirect("/reset-password?error=❌ Unauthorized access!");
    }

    if (!password || !confirmPassword) {
      return res.redirect("/reset-password?error=❌ Both fields are required!");
    }

    if (password !== confirmPassword) {
      return res.redirect("/reset-password?error=❌ Passwords do not match!");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Update Password & Clear OTP Fields
    await LogInCollection.updateOne(
      { email: email.toLowerCase() },
      {
        $set: { password: hashedPassword },
        $unset: { resetOTP: 1, otpExpiry: 1 },
      }
    );

    req.session.email = null; // Clear session
    return res.redirect(
      "/reset-password?success=✅ Password reset successfully!"
    );
  } catch (error) {
    console.error("❌ Reset Password Error:", error);
    return res.redirect("/reset-password?error=❌ Something went wrong!");
  }
});
app.get("/students", async (req, res) => {
  try {
      const students = await Students.find();
      const studentsWithPhotos = students.map((student) => ({
          ...student._doc,
          documents: student.documents,
      }));
      res.json(studentsWithPhotos);
  } catch (error) {
      console.error("Error fetching students:", error);
      res.status(500).json({ error: "Internal Server Error" });
  }
});
// Get all students
// Get a single student by registerNo
app.get('/api/students/:registerNo', async (req, res) => {
  const registerNo = req.params.registerNo;
  try {
      const student = await Students.findOne({ registerNo: registerNo });

      if (!student) {
          return res.status(404).json({ message: 'Student not found' });
      }

      res.json(student);
  } catch (error) {
      console.error('Error fetching student:', error);
      res.status(500).json({ message: 'Internal server error' });
  }
});
// Update student details
app.put("/api/students/:registerNo", async (req, res) => {
  const registerNo = req.params.registerNo;
  const updatedStudent = req.body;

  try {
    const student = await Students.findOneAndUpdate(
      { registerNo: registerNo },
      updatedStudent,
      { new: true }
    );
    if (student) {
      res.json({ message: "Student updated successfully", student });
    } else {
      res.status(404).json({ message: "Student not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error updating student", error });
  }
});

// Delete student from database
app.delete("/api/students/:registerNo", async (req, res) => {
  const registerNo = req.params.registerNo;

  try {
    const student = await Students.findOneAndDelete({ registerNo: registerNo });
    if (student) {
      res.json({ message: "Student deleted successfully" });
    } else {
      res.status(404).json({ message: "Student not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error deleting student", error });
  }
});
app.get("/api/seats", async (req, res) => {
  try {
    const seatLimits = {
      "COMPUTER SCIENCE AND ENGINEERING": {
        managementQuota: 30,
        governmentQuota: 60,
      },
      "ELECTRONICS AND COMMUNICATION ENGINEERING": {
        managementQuota: 15,
        governmentQuota: 45,
      },
      "MECHANICAL ENGINEERING": { managementQuota: 15, governmentQuota: 15 },
      "MECHANICAL AND MECHOTRONICS ENGINEERING": {
        managementQuota: 15,
        governmentQuota: 15,
      },
      "ARTIFICIAL INTELLIGENCE AND DATA SCIENCE": {
        managementQuota: 30,
        governmentQuota: 60,
      },
      "INFORMATION TECHNOLOGY": { managementQuota: 15, governmentQuota: 15 },
      "AGRICULTURAL ENGINEERING": { managementQuota: 15, governmentQuota: 15 },
    };

    const seatData = await Students.aggregate([
      {
        $group: {
          _id: { department: "$department", mode: "$modeOfAdmission" },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.department",
          quotas: {
            $push: {
              mode: "$_id.mode",
              count: "$count",
            },
          },
        },
      },
    ]);

    const formattedSeatData = seatData.map((deptData) => {
      const department = deptData._id.toUpperCase();
      const limits = seatLimits[department] || {
        managementQuota: 0,
        governmentQuota: 0,
      };
      let governmentQuotaFilled = 0;
      let managementQuotaFilled = 0;

      deptData.quotas.forEach((quota) => {
        if (quota.mode === "Government Quota") {
          governmentQuotaFilled = quota.count;
        } else if (quota.mode === "Management Quota") {
          managementQuotaFilled = quota.count;
        }
      });

      const governmentQuotaSeats = limits.governmentQuota;
      const managementQuotaSeats = limits.managementQuota;
      const totalSeats = governmentQuotaSeats + managementQuotaSeats;

      let abbreviatedDepartment = deptData._id; // Default to original

      switch (deptData._id) {
        case "COMPUTER SCIENCE AND ENGINEERING":
          abbreviatedDepartment = "CS";
          break;
        case "ELECTRONICS AND COMMUNICATION ENGINEERING":
          abbreviatedDepartment = "EC";
          break;
        case "MECHANICAL ENGINEERING":
          abbreviatedDepartment = "MECH";
          break;
        case "MECHANICAL AND MECHOTRONICS ENGINEERING":
          abbreviatedDepartment = "MTRS";
          break;
        case "ARTIFICIAL INTELLIGENCE AND DATA SCIENCE":
          abbreviatedDepartment = "AD";
          break;
        case "INFORMATION TECHNOLOGY":
          abbreviatedDepartment = "IT";
          break;
        case "AGRICULTURAL ENGINEERING":
          abbreviatedDepartment = "AG";
          break;
        // Add more cases as needed
      }

      const seatInfo = {
        department: deptData._id, // Keep the full name if needed elsewhere
        abbreviatedDepartment: abbreviatedDepartment,
        totalSeats: totalSeats,
        governmentQuotaSeats: governmentQuotaSeats,
        managementQuotaSeats: managementQuotaSeats,
        governmentQuota: {
          filled: governmentQuotaFilled,
          pending: Math.max(0, governmentQuotaSeats - governmentQuotaFilled),
        },
        managementQuota: {
          filled: managementQuotaFilled,
          pending: Math.max(0, managementQuotaSeats - managementQuotaFilled),
        },
      };

      return seatInfo;
    });

    res.json(formattedSeatData);
  } catch (error) {
    console.error("Error fetching seat allocation:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", message: error.message });
  }
});

app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
