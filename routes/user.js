import express from "express";
import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import dotenv from "dotenv";
import { User } from "../models/user.js";



dotenv.config();

const userRouter = express.Router();

// Multer setup (store file in memory)
const upload = multer({ storage: multer.memoryStorage() });

// S3 client setup
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// ✅ Create user with optional avatar
userRouter.post("/", upload.single("avatar"), async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name and email required" });
    }

    let avatar_url = null;

    if (req.file) {
      const ext = req.file.originalname.split(".").pop();
      const key = `avatars/${randomUUID()}.${ext}`;

      const cmd = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      });

      await s3.send(cmd);

      avatar_url = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    }

    const user = await User.create({ name, email, avatar_url });
    res.status(201).json(user);
  } catch (err) {
    console.error("❌ Error creating user:", err);
    res.status(500).json({ error: "User creation failed" });
  }
});

// ✅ Get user by ID
userRouter.get("/:id", async (req, res) => {
  try {
    const u = await User.findById(req.params.id).lean();
    if (!u) return res.status(404).json({ error: "User not found" });
    res.json(u);
  } catch (err) {
    console.error("❌ Error fetching user:", err);
    res.status(500).json({ error: "Get user failed" });
  }
});

export default userRouter;
