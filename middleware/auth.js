import jwt from "jsonwebtoken";

export const verifyToken = async (req, res, next) => {
//    try {
//     const authHeader = req.headers.authorization;
//     if (!authHeader) return res.status(401).json({ error: "No token provided" });

//     const token = authHeader.split(" ")[1]; // "Bearer <token>"
//     if (!token) return res.status(401).json({ error: "Token missing" });

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = decoded; // store user info for next middleware
//     next();
//   } catch (err) {
//     console.error("Token verification error:", err);
//     return res.status(403).json({ error: "Invalid or expired token" });
//   }
// };

try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user; // ✅ VERY IMPORTANT
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};