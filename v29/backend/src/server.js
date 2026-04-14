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

dotenv.config();

const app = express();

const allowedOrigins = [
  "https://gas-hr-project-1.onrender.com",
  "http://localhost:5173",
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, _res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

app.get("/", (_req, res) => {
  res.send("Backend is running");
});

app.use("/auth", authRoutes);
app.use("/users", usersRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/projects", projectsRoutes);
app.use("/api/attendance", attendanceRoutes);

// الروتات الناقصة
app.use("/requests-center", leaveRoutes);
app.use("/notifications", notificationsRoutes);
app.use("/payroll", payrollRoutes);
app.use("/reports", reportsRoutes);
app.use("/security", securityRoutes);
app.use("/settings", settingsRoutes);

await initDatabase();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});