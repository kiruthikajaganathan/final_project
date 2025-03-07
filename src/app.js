require("dotenv").config();
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
const fileType = require('file-type'); 

// Import MongoDB Models
const { LogInCollection, Students} = require("./mongo");

const app = express();
const port = process.env.PORT || 3000;

// Paths
const viewsPath = path.join(__dirname, "../temp");
const publicPath = path.join(__dirname, "../public");

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicPath));
app.use(express.static(viewsPath)); 
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// Session Middleware
app.use(session({
    secret: process.env.SESSION_SECRET || "your_secret_key",
    resave: false,
    saveUninitialized: true
}));



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
const isValidEmail = (email) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);

// Nodemailer Configuration
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
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
            `
        });
        console.log("✅ Signup Email Sent Successfully");
    } catch (error) {
        console.error("❌ Error Sending Email:", error);
    }
};

const storage = multer.diskStorage({
    destination: './uploads/', // Store uploaded files in the 'uploads' directory
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: async (req, file, cb) => {
        // Temporarily remove fileType.fromFile check
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and PDF are allowed.'));
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024
    }
});
// Serve Pages

// Serve Pages (Now Serving HTML)
app.get("/", (req, res) => res.sendFile(path.join(viewsPath, "home.html")));
app.get("/login", (req, res) => res.sendFile(path.join(viewsPath, "login.html")));
app.get("/signup", (req, res) => res.sendFile(path.join(viewsPath, "signup.html")));
app.get("/student", (req, res) => res.sendFile(path.join(viewsPath, "student.html")));
app.get("/admin", async (req, res) => {res.sendFile(path.join(viewsPath, "admin.html"));
});
app.get("/forgot-password", (req, res) => res.sendFile(path.join(viewsPath, "forgot-password.html")));
app.get("/verify-otp", (req, res) => res.sendFile(path.join(viewsPath, "verify-otp.html")));
app.get("/reset-password", (req, res) => {res.sendFile(path.join(viewsPath, "reset-password.html"));
});
app.set('view engine', 'ejs');
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
            photo: req.file ? req.file.filename : null
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
            if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
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

app.post("/students", upload.fields([
    { name: "aadharCard", maxCount: 1 },
    { name: "communityCertificate", maxCount: 1 },
    { name: "tenthMarkSheet", maxCount: 1 },
    { name: "eleventhMarkSheet", maxCount: 1 },
    { name: "twelfthMarkSheet", maxCount: 1 },
    { name: "transferCertificate", maxCount: 1 },
    { name: "birthCertificate", maxCount: 1 },
    { name: "firstCertificate", maxCount: 1 },
    { name: "photo", maxCount: 1 }
]), async (req, res) => {
    try {
        console.log("Received form data:", req.body);
        console.log("Received files:", req.files);

        let errors =[];

        // Extract Student Details
        const {
            name, registerNo, dob, gender, department, batch, bloodGroup, mobileNo, aadharNo,
            email, nationality, religion, community, motherTongue, cutoff, year, hostel, regular, first,
            doorNo, street, villageCity, state, district, pinCode,
            fatherName, fatherOccupation, fatherMobile, motherName, motherOccupation, motherMobile,
            school10, marks10, year10, school11, marks11, year11, school12, marks12, year12
        } = req.body;

        // Validate Required Fields
        if (!name) errors.push("Student name is required.");
        if (!registerNo) errors.push("Register number is required.");
        if (!dob) errors.push("Date of birth is required.");
        if (!gender) errors.push("Gender is required.");
        if (!department) errors.push("Department is required.");
        if (!batch) errors.push("Batch is required.");
        if (!mobileNo) errors.push("Mobile number is required.");
        if (!email) errors.push("Email is required.");
        if (!cutoff) errors.push("Cutoff is required.");
        if (!year) errors.push("Year is required.");
        if (!hostel) errors.push("Hostel/Day Scholar selection is required.");
        if (!regular) errors.push("Regular/Lateral selection is required.");
        if (!first) errors.push("Yes/No selection is required.");
        if (!doorNo) errors.push("Door Number is required.");
        if (!street) errors.push("Street is required.");
        if (!villageCity) errors.push("Village/City is required.");
        if (!state) errors.push("State is required.");
        if (!district) errors.push("District is required.");
        if (!pinCode) errors.push("PIN code is required.");
        if (!fatherMobile) errors.push("Father mobile is required.");
        if (!motherMobile) errors.push("Mother mobile is required.");

        // Validate School Details
        if (!school10) errors.push("School Name for Class X is required.");
        if (!marks10) errors.push("Valid Marks for Class X are required.");
        if (marks10.toLowerCase() !== "pass" && marks10.toLowerCase() !== "all pass" && isNaN(parseFloat(marks10))) {
            errors.push("Valid Marks for Class X are required.");
        }
        if (!year10 || isNaN(parseInt(year10, 10))) errors.push("Valid Passing Year for Class X is required.");

        if (!school11) errors.push("School Name for Class XI is required.");
        if (!marks11) errors.push("Valid Marks for Class XI are required.");
        if (marks11.toLowerCase() !== "pass" && marks11.toLowerCase() !== "all pass" && isNaN(parseFloat(marks11))) {
            errors.push("Valid Marks for Class XI are required.");
        }
        if (!year11 || isNaN(parseInt(year11, 10))) errors.push("Valid Passing Year for Class XI is required.");


        // ... similar validation for marks11 and marks12 ...

        if (!school12) errors.push("School Name for Class XII is required.");
        if (!marks12) errors.push("Valid Marks for Class XII are required.");
        if (marks12.toLowerCase() !== "pass" && marks12.toLowerCase() !== "all pass" && isNaN(parseFloat(marks12))) {
            errors.push("Valid Marks for Class XII are required.");
        }
        if (!year12 || isNaN(parseInt(year12, 10))) errors.push("Valid Passing Year for Class XII is required.");

        // If Errors Exist, Send Response
        if (errors.length > 0) {
            return res.status(400).json({ error: "Validation Failed", details: errors });
        }

        // Save Student Data to Database
        const newStudent = new Students({
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
            cutoff,
            year,
            hostel,
            regular,
            first,
            address: { doorNo, street, villageCity, state, district, pinCode },
            parents: {
                father: { name: fatherName, occupation: fatherOccupation, mobile: fatherMobile },
                mother: { name: motherName, occupation: motherOccupation, mobile: motherMobile },
            },
            schoolDetails: [
                { classLevel: "X", name: school10, marks: marks10, passingYear: parseInt(year10, 10) },
                { classLevel: "XI", name: school11, marks: marks11, passingYear: parseInt(year11, 10) },
                { classLevel: "XII", name: school12, marks: marks12, passingYear: parseInt(year12, 10) }
            ],
            documents: {
                aadharCard: req.files && req.files["aadharCard"] && req.files["aadharCard"][0] ? path.basename(req.files["aadharCard"][0].path) : null,
                communityCertificate: req.files && req.files["communityCertificate"] && req.files["communityCertificate"][0] ? path.basename(req.files["communityCertificate"][0].path) : null,
                tenthMarkSheet: req.files && req.files["tenthMarkSheet"] && req.files["tenthMarkSheet"][0] ? path.basename(req.files["tenthMarkSheet"][0].path) : null,
                eleventhMarkSheet: req.files && req.files["eleventhMarkSheet"] && req.files["eleventhMarkSheet"][0] ? path.basename(req.files["eleventhMarkSheet"][0].path) : null,
                twelfthMarkSheet: req.files && req.files["twelfthMarkSheet"] && req.files["twelfthMarkSheet"][0] ? path.basename(req.files["twelfthMarkSheet"][0].path) : null,
                transferCertificate: req.files && req.files["transferCertificate"] && req.files["transferCertificate"][0] ? path.basename(req.files["transferCertificate"][0].path) : null,
                birthCertificate: req.files && req.files["birthCertificate"] && req.files["birthCertificate"][0] ? path.basename(req.files["birthCertificate"][0].path) : null,
                firstCertificate: req.files && req.files["firstCertificate"] && req.files["firstCertificate"][0] ? path.basename(req.files["firstCertificate"][0].path) : null,
                photo: req.files && req.files["photo"] && req.files["photo"][0] ? path.basename(req.files["photo"][0].path) : null,
            }
        });
        await newStudent.save();

        // ... email sending code ...

        console.log("Student registered successfully!");
        res.status(201).json({ message: "Student registered successfully!" });

    } catch (error) {
        console.error("Error during student registration:", error);
        if (error.code === 11000) {
            return res.status(400).json({ error: "Register Number already exists." });
        }
        res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
});

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
            `
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
    res.render("forgot-password");  // Create forgot-password.hbs
});

app.post("/forgot-password", async (req, res) => {
    const { email } = req.body;

    try {
        const user = await LogInCollection.findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.redirect(`/forgot-password?error=${encodeURIComponent("❌ Email not found!")}`);
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
            `
        });

        return res.redirect(`/verify-otp?success=${encodeURIComponent("✅ OTP sent to your email!")}`);

    } catch (error) {
        console.error("❌ Forgot Password Error:", error);
        return res.redirect(`/forgot-password?error=${encodeURIComponent("❌ Something went wrong!")}`);
    }
});



// ✅ OTP Verification Page
app.get("/verify-otp", (req, res) => {
    res.render("verify-otp");  // Create verify-otp.hbs
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
        return res.redirect("/reset-password?success=✅ OTP verified! Set a new password.");

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
    res.render("reset-password");  // Create reset-password.hbs
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
            { $set: { password: hashedPassword }, $unset: { resetOTP: 1, otpExpiry: 1 } }
        );

        req.session.email = null;  // Clear session
        return res.redirect("/reset-password?success=✅ Password reset successfully!");

    } catch (error) {
        console.error("❌ Reset Password Error:", error);
        return res.redirect("/reset-password?error=❌ Something went wrong!");
    }
});
app.get("/students", async (req, res) => {
    try {
        const students = await Students.find();
        const studentsWithPhotos = students.map(student => ({
            ...student._doc,
            documents: {
                aadharCard: student.documents.aadharCard ? `/uploads/${student.documents.aadharCard}` : null,
                communityCertificate: student.documents.communityCertificate ? `/uploads/${student.documents.communityCertificate}` : null,
                tenthMarkSheet: student.documents.tenthMarkSheet ? `/uploads/${student.documents.tenthMarkSheet}` : null,
                eleventhMarkSheet: student.documents.eleventhMarkSheet ? `/uploads/${student.documents.eleventhMarkSheet}` : null,
                twelfthMarkSheet: student.documents.twelfthMarkSheet ? `/uploads/${student.documents.twelfthMarkSheet}` : null,
                transferCertificate: student.documents.transferCertificate ? `/uploads/${student.documents.transferCertificate}` : null,
                birthCertificate: student.documents.birthCertificate ? `/uploads/${student.documents.birthCertificate}` : null,
                photo: student.documents.photo ? `/uploads/${student.documents.photo}` : null,
            }
        }));
        res.json(studentsWithPhotos);
    } catch (error) {
        console.error("Error fetching students:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


// Get all students
// Get all students
app.get("/api/students", async (req, res) => {
    try {
        const students = await Students.find();
        res.json(students);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch students" });
    }
});

// Update student details
app.put("/api/students/:registerNo", async (req, res) => {
    const registerNo = req.params.registerNo;
    const updatedStudent = req.body;

    try {
        const student = await Students.findOneAndUpdate({ registerNo: registerNo }, updatedStudent, { new: true });
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

app.listen(port, () => console.log(`🚀 Server running on port ${port}`));