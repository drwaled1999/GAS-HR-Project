import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import usersRoutes from "./routes/usersRoutes.js";
import authRoutes from "./routes/authRoutes.js";
// أضف باقي الروتات إذا عندك

dotenv.config();

const app = express();

// ✅ أهم جزء (حل CORS)
app.use(cors({
  origin: [
    "https://gas-hr-project-1.onrender.com", // الفرونت حقك
    "http://localhost:5173"
  ],
  credentials: true,
}));

// 🔥 مهم جدًا (حل preflight)
app.options("*", cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("Backend is running");
});

// routes
app.use("/auth", authRoutes);
app.use("/users", usersRoutes);

// لو عندك:
/// app.use("/attendance", attendanceRoutes);
// app.use("/dashboard", dashboardRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});