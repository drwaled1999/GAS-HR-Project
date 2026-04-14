import express from "express";
import * as userRepo from "../data/userEmployeeRepository.js";

const router = express.Router();

function pickFunction(...candidates) {
  for (const fn of candidates) {
    if (typeof fn === "function") return fn;
  }
  return null;
}

const getAllUsersFn = pickFunction(
  userRepo.getAllUsers,
  userRepo.getUsers,
  userRepo.listUsers,
  userRepo.listAllUsers
);

const getUserByIdFn = pickFunction(
  userRepo.getUserById,
  userRepo.findUserById,
  userRepo.getUser,
  userRepo.findById
);

const updateUserFn = pickFunction(
  userRepo.updateUser,
  userRepo.updateUserById,
  userRepo.saveUserUpdate
);

const deleteUserFn = pickFunction(
  userRepo.deleteUser,
  userRepo.deleteUserById,
  userRepo.removeUser
);

// GET all users
router.get("/", async (req, res) => {
  try {
    if (!getAllUsersFn) {
      return res.status(500).json({ message: "User repository function for listing users is missing" });
    }

    const result = await getAllUsersFn(req.query || {});
    const users = Array.isArray(result)
      ? result
      : result?.users || result?.employees || [];

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET single user
router.get("/:id", async (req, res) => {
  try {
    if (!getUserByIdFn) {
      return res.status(500).json({ message: "User repository function for getting one user is missing" });
    }

    const user = await getUserByIdFn(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// UPDATE user
router.put("/:id", async (req, res) => {
  try {
    if (!updateUserFn) {
      return res.status(500).json({ message: "User repository function for updating user is missing" });
    }

    const updatedUser = await updateUserFn(req.params.id, req.body);

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
    if (!deleteUserFn) {
      return res.status(500).json({ message: "User repository function for deleting user is missing" });
    }

    const deleted = await deleteUserFn(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;