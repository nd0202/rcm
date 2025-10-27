
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { User } from "../models/User.js";
import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";



dotenv.config();
const authRouter = express.Router();

// ===== SIGN UP =====
authRouter.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check existing user
    const exist = await User.findOne({ email });
    if (exist) return res.status(400).json({ error: "Email already exists" });

    // Hash password and create user
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed });

    res.status(201).json({ message: "Signup success", user });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Signup failed" });
  }
});

// ===== LOGIN =====
authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    // Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({ token, user });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ===== VERIFY TOKEN MIDDLEWARE =====
const verifyToken = (req, res, next) => {
   try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token provided" });

    const token = authHeader.split(" ")[1]; // "Bearer <token>"
    if (!token) return res.status(401).json({ error: "Token missing" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // store user info for next middleware
    next();
  } catch (err) {
    console.error("Token verification error:", err);
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};

// upload profile avtar


const upload = multer(); // memory storage (req.file.buffer)

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
authRouter.post(
  "/profile/avatar",
  verifyToken, // <-- this is the missing piece!
  upload.single("avatar"),
  async (req, res) => {
    try {
      if (!req.user || !req.user.id) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "No file uploaded" });
      }

      const userId = req.user.id;
      const key = `avatars/${userId}-${Date.now()}.jpg`;

      // Upload to S3
      const cmd = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      });

      await s3.send(cmd);

      // Generate public S3 URL
      const avatar_url = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

      // Update user record
      await User.findByIdAndUpdate(userId, { avatar: avatar_url });

      res.json({
        success: true,
        avatarUrl: avatar_url,
        message: "Avatar uploaded successfully",
      });
    } catch (error) {
      console.error("Avatar upload error:", error);
      res
        .status(500)
        .json({ success: false, message: "Error uploading avatar" });
    }
  }
);




// ===== PROFILE (Protected Route) =====
authRouter.get("/profile", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ error: "Profile fetch failed" });
  }
});

export default authRouter;
