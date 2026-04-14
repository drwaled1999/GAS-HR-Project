const express = require("express");
const router = express.Router();
const User = require("../models/User");

// GET all users
router.get("/", async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET single user by Mongo _id or custom id/uuid
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    let user = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      user = await User.findById(id);
    }

    if (!user) {
      user = await User.findOne({
        $or: [{ id }, { uuid: id }],
      });
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT update user
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    let updatedUser = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      updatedUser = await User.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      });
    }

    if (!updatedUser) {
      updatedUser = await User.findOneAndUpdate(
        { $or: [{ id }, { uuid: id }] },
        updateData,
        { new: true, runValidators: true }
      );
    }

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE user
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    let deletedUser = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      deletedUser = await User.findByIdAndDelete(id);
    }

    if (!deletedUser) {
      deletedUser = await User.findOneAndDelete({
        $or: [{ id }, { uuid: id }],
      });
    }

    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
