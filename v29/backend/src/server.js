import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import usersRoutes from "./routes/usersRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import projectsRoutes from "./routes/projectsRoutes.js";
// إذا عندك attendanceRoutes أضفه هنا
// import attendanceRoutes from "./routes/attendanceRoutes.js";

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
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.send("Backend is running");
});

// routes
app.use("/auth", authRoutes);
app.use("/users", usersRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/projects", projectsRoutes);

// إذا عندك attendance route فعّله
// app.use("/attendance", attendanceRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});