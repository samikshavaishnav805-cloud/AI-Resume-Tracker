const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const env = require("./src/config/env");
const { connectDB } = require("./src/config/db");

const authRoutes = require("./src/routes/auth");

const app = express();

app.use(
    cors({
        origin: true,
        credentials: true,
    })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/", (req, res) => {
    res.json({
        status: "ok",
        message: "AI Resume Tracker backend is running",
    });
});

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        message: "AI Resume Tracker backend is running",
        database: "Supabase PostgreSQL",
    });
});

app.use("/api/auth", authRoutes);
app.use("/api/resumes", resumeRoutes);

async function startServer() {
    try {
        await connectDB();

        app.listen(env.port, () => {
            console.log(
                `Server running on http://localhost:${env.port}`
            );
        });
    } catch (error) {
        console.error("Server startup failed:", error.message);
        process.exit(1);
    }
}

startServer();