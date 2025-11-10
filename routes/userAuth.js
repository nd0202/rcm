
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { User } from "../models/User.js";
import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Post } from "../models/post.js";



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


// ===== UPLOAD AVATAR =====
authRouter.patch(
  "/profile/avatar",
  verifyToken, // ✅ required
  upload.single("avatar"),
  async (req, res) => {
    try {
      const userId = req.user.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
      }

      const key = `avatars/${userId}-${Date.now()}.jpg`;

      const cmd = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      });

      await s3.send(cmd);

      const avatar_url = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { avatar_url },
        { new: true } // ✅ return updated doc
      ).select("-password");

       // ✅ OPTIONAL: Also update avatar in all old posts
      await Post.updateMany({ userId }, { $set: { userAvatar: avatar_url } });


      res.json({
        success: true,
        message: "Avatar uploaded successfully",
        avatar_url,
        user: updatedUser,
      });
    } catch (error) {
      console.error("Avatar upload error:", error);
      res.status(500).json({ success: false, message: "Error uploading avatar" });
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


// ===== FOLLOW / UNFOLLOW / CHECK FOLLOW STATUS =====

// ✅ Follow a user
authRouter.post("/:userId/follow", verifyToken, async (req, res) => {
  try {
    const { userId } = req.params; // person to follow
    const { followerId } = req.body; // person performing follow

    if (!followerId || !userId) {
      return res.status(400).json({ success: false, message: "Missing user IDs" });
    }

    if (followerId === userId) {
      return res.status(400).json({ success: false, message: "Cannot follow yourself" });
    }

    const userToFollow = await User.findById(userId);
    const followerUser = await User.findById(followerId);

    if (!userToFollow || !followerUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // prevent duplicates
    if (!userToFollow.followers.includes(followerId)) {
      userToFollow.followers.push(followerId);
      await userToFollow.save();
    }

    if (!followerUser.following.includes(userId)) {
      followerUser.following.push(userId);
      await followerUser.save();
    }

    res.json({ success: true, message: "Followed successfully" });
  } catch (error) {
    console.error("Follow user error:", error);
    res.status(500).json({ success: false, message: "Error following user" });
  }
});

// ✅ Unfollow a user
authRouter.post("/:userId/unfollow", verifyToken, async (req, res) => {
  try {
    const { userId } = req.params; // person to unfollow
    const { followerId } = req.body; // person performing unfollow

    if (!followerId || !userId) {
      return res.status(400).json({ success: false, message: "Missing user IDs" });
    }

    const userToUnfollow = await User.findById(userId);
    const followerUser = await User.findById(followerId);

    if (!userToUnfollow || !followerUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    userToUnfollow.followers = userToUnfollow.followers.filter(
      (id) => id.toString() !== followerId
    );
    followerUser.following = followerUser.following.filter(
      (id) => id.toString() !== userId
    );

    await userToUnfollow.save();
    await followerUser.save();

    res.json({ success: true, message: "Unfollowed successfully" });
  } catch (error) {
    console.error("Unfollow user error:", error);
    res.status(500).json({ success: false, message: "Error unfollowing user" });
  }
});

// ✅ Check follow status
authRouter.get("/:otherId/is-following/:myId", verifyToken, async (req, res) => {
  try {
    const { otherId, myId } = req.params;

    const otherUser = await User.findById(otherId);
    if (!otherUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const isFollowing = otherUser.followers.includes(myId);
    res.json({ success: true, isFollowing });
  } catch (error) {
    console.error("Check follow status error:", error);
    res.status(500).json({ success: false, message: "Error checking follow status" });
  }
});

// ✅ Get follow data (followers/following counts + lists)
authRouter.get("/:userId/follow-data", verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId)
      .populate("followers", "name avatar_url")
      .populate("following", "name avatar_url");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      followersCount: user.followers.length,
      followingCount: user.following.length,
      followers: user.followers,
      following: user.following,
    });
  } catch (error) {
    console.error("Get follow data error:", error);
    res.status(500).json({ success: false, message: "Error fetching follow data" });
  }
});


// ✅ Fetch logged-in user's posts
authRouter.get("/myposts", verifyToken, async (req, res) => {
  try {
    const posts = await Post.find({ ownerId: req.user.id })
      .sort({ createdAt: -1 })
      .populate("ownerId", "name avatar_url");
    res.json({ success: true, posts });
  } catch (err) {
    console.error("Error fetching my posts:", err);
    res.status(500).json({ success: false, message: "Failed to fetch posts" });
  }
});

// ✅ Fetch posts by any other user
authRouter.get("/:userId", verifyToken, async (req, res) => {
  try {
    const posts = await Post.find({ ownerId: req.params.userId })
      .sort({ createdAt: -1 })
      .populate("ownerId", "name avatar_url");
    res.json({ success: true, posts });
  } catch (err) {
    console.error("Error fetching user's posts:", err);
    res.status(500).json({ success: false, message: "Failed to fetch user's posts" });
  }
});

// ✅ Delete a post (only if owner)
authRouter.delete("/:postId", verifyToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });
    if (post.ownerId.toString() !== req.user.id)
      return res.status(403).json({ success: false, message: "Not authorized" });

    await post.deleteOne();
    res.json({ success: true, message: "Post deleted successfully" });
  } catch (err) {
    console.error("Delete post error:", err);
    res.status(500).json({ success: false, message: "Delete failed" });
  }
});

export default authRouter;
