import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import { initDatabase } from "./data/database.js";
import authRoutes from "./routes/authRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";


const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json({ message: "HR Portal API is running." });
});

app.use("/auth", authRoutes);
app.use("/attendance", attendanceRoutes);

const PORT = process.env.PORT || 10000;

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database initialization failed:", error);
    process.exit(1);
  });
