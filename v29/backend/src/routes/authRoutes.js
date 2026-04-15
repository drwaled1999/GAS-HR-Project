import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  getUserByUsernameRepo,
  recordFailedLoginRepo,
  recordSuccessfulLoginRepo,
} from "../data/userEmployeeRepository.js";
import {
  addLoginAttemptRepo,
  addSecurityEventRepo,
} from "../data/securityRepository.js";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    const user = await getUserByUsernameRepo(String(username).trim());

    if (!user) {
      await addLoginAttemptRepo({
        username,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] || "-",
        status: "failed",
      });

      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.passwordHash) {
      console.error("Missing passwordHash for user:", user.username);

      return res.status(500).json({ message: "User password is not configured" });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      await addLoginAttemptRepo({
        username,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] || "-",
        status: "failed",
      });

      await recordFailedLoginRepo?.(user, req.ip);

      return res.status(401).json({ message: "Invalid credentials" });
    }

    await addLoginAttemptRepo({
      username,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || "-",
      status: "success",
    });

    await recordSuccessfulLoginRepo?.(user, req.ip);

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.roleName || user.roleCode || "Employee",
        roleName: user.roleName || "Employee",
        roleCode: user.roleCode || "employee",
        permissions: user.permissions || [],
        projectId: user.projectId || null,
        packageId: user.packageId || null,
        division: user.division || null,
        accessScope: user.accessScope || null,
        jobTitle: user.jobTitle || null,
      },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: "12h" }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.roleName || "Employee",
        roleName: user.roleName || "Employee",
        roleCode: user.roleCode || "employee",
        permissions: user.permissions || [],
        projectId: user.projectId || null,
        packageId: user.packageId || null,
        division: user.division || null,
        accessScope: user.accessScope || null,
        jobTitle: user.jobTitle || null,
      },
    });
  } catch (error) {
    console.error("Login route error:", error);
    return res.status(500).json({ message: "Login failed" });
  }
});

export default router;