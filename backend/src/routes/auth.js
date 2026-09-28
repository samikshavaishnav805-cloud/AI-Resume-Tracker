const express = require("express");
const bcrypt = require("bcrypt");

const { pool } = require("../config/db");
const { signToken, cookieOptions } = require("../utils/jwt");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// ================= REGISTER =================

router.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "All fields are required",
            });
        }

        if (typeof name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string") {
            return res.status(400).json({
                message: "Invalid input",
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                message: "Password must be at least 8 characters",
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [normalizedEmail]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                message: "Email already registered",
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const result = await pool.query(
            `INSERT INTO users (name, email, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id, name, email, created_at`,
            [name.trim(), normalizedEmail, passwordHash]
        );

        const user = result.rows[0];

        const token = signToken(user.id);

        res.cookie("token", token, cookieOptions());

        return res.status(201).json({
            message: "Registration successful",
            user,
        });

    } catch (error) {
        console.error("Register error:", error.message);

        return res.status(500).json({
            message: "Registration failed",
        });
    }
});


// ================= LOGIN =================

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required",
            });
        }

        const result = await pool.query(
            `SELECT id, name, email, password_hash
             FROM users
             WHERE email = $1`,
            [email.trim().toLowerCase()]
        );

        const user = result.rows[0];

        if (
            !user ||
            !(await bcrypt.compare(password, user.password_hash))
        ) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        const token = signToken(user.id);

        res.cookie("token", token, cookieOptions());

        return res.json({
            message: "Login successful",
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            },
        });

    } catch (error) {
        console.error("Login error:", error.message);

        return res.status(500).json({
            message: "Login failed",
        });
    }
});


// ================= CURRENT USER =================

router.get("/me", requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, email, created_at
             FROM users
             WHERE id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "User not found",
            });
        }

        return res.json({
            user: result.rows[0],
        });

    } catch (error) {
        console.error("Get user error:", error.message);

        return res.status(500).json({
            message: "Could not fetch user",
        });
    }
});


// ================= LOGOUT =================

router.post("/logout", (req, res) => {
    const isProd = process.env.NODE_ENV === "production";

    res.clearCookie("token", {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        path: "/",
    });

    return res.json({
        message: "Logged out successfully",
    });
});


module.exports = router;