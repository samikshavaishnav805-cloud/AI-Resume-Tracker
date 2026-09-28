const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const env = require("./src/config/env");
const { connectDB } = require("./src/config/db");
const authRoutes = require("./src/routes/auth");
const resumeRoutes = require("./src/routes/resumes");

const app = express();

app.use(cors({
    origin: true,
    credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/resumes", resumeRoutes);

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

async function startServer() {
    try {
        await connectDB();

        app.listen(env.port, () => {
            console.log(
                `Server running on http://localhost:${env.port}`
            );
        });
    } catch (error) {
        console.error("Supabase connection failed:");
        console.error(error.message);
        process.exit(1);
    }
}

startServer();