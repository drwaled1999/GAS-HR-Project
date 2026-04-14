import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { initDatabase } from "./data/database.js";
import authRoutes from "./routes/authRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import usersRoutes from "./routes/usersRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import projectsRoutes from "./routes/projectsRoutes.js";

dotenv.config();

const app = express();

// =======================================
// ✅ CORS FIX (هذا أهم جزء)
// =======================================
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://gas-hr-project-1.onrender.com"
];

app.use(
  cors({
    origin: function (origin, callback) {
      // السماح للطلبات بدون origin (مثل Postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true
  })
);

// =======================================
// ✅ مهم للـ cookies
// =======================================
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Credentials", "true");
  next();
});

// =======================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =======================================
// Routes
// =======================================
app.get("/", (req, res) => {
  res.json({ message: "HR Portal API is running." });
});

app.use("/auth", authRoutes);
app.use("/attendance", attendanceRoutes);
app.use("/users", usersRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/projects", projectsRoutes);

// =======================================
// Error handler (مهم عشان تعرف الخطأ)
// =======================================
app.use((err, req, res, next) => {
  console.error("ERROR:", err.message);

  res.status(500).json({
    message: err.message || "Internal Server Error"
  });
});

// =======================================
const PORT = process.env.PORT || 10000;

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database initialization failed:", error);
    process.exit(1);
  });