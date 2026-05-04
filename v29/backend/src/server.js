import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { initDatabase } from "./data/database.js";
import usersRoutes from "./routes/usersRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import projectsRoutes from "./routes/projectsRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import leaveRoutes from "./routes/leaveRoutes.js";
import notificationsRoutes from "./routes/notificationsRoutes.js";
import payrollRoutes from "./routes/payrollRoutes.js";
import reportsRoutes from "./routes/reportsRoutes.js";
import securityRoutes from "./routes/securityRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import filesRoutes from "./routes/filesRoutes.js";
import adminEmployeesRoutes from "./routes/adminEmployeesRoutes.js";
import employeeDataUpdateRoutes from "./routes/employeeDataUpdateRoutes.js";

dotenv.config();

const app = express();

const allowedOrigins = [
  "https://gas-hr-project-1.onrender.com",
  "https://gas-hr-project.onrender.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Disposition", "Content-Length", "Content-Type"],
  })
);

app.options("*", cors());

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use((req, _res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

app.get("/", (_req, res) => {
  res.send("Backend is running");
});

// 🔥 health check مهم لـ Render
app.get("/ping", (_req, res) => {
  res.send("OK");
});

app.use("/auth", authRoutes);
app.use("/users", usersRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/projects", projectsRoutes);
app.use("/attendance", attendanceRoutes);
app.use("/requests-center", leaveRoutes);
app.use("/notifications", notificationsRoutes);
app.use("/payroll", payrollRoutes);
app.use("/reports", reportsRoutes);
app.use("/security", securityRoutes);
app.use("/settings", settingsRoutes);
app.use("/files", filesRoutes);
app.use("/admin/employees", adminEmployeesRoutes);
app.use("/employee/data-update-requests", employeeDataUpdateRoutes);

app.use((err, _req, res, _next) => {
  console.error("Server error:", err);
  return res.status(500).json({
    message: err?.message || "Internal server error",
  });
});

// ✅ أول شيء شغل السيرفر
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// 🔥 بعدها شغل الداتابيس (بدون ما يوقف السيرفر)
initDatabase()
  .then(() => {
    console.log("✅ Database initialized");
  })
  .catch((err) => {
    console.error("❌ Database init failed:", err.message);
  });
