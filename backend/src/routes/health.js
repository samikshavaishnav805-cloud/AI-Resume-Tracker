const express = require("express");

const app = express();

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        message: "AI Resume Tracker backend is running"
    });
});

app.listen(5000, () => {
    console.log("Server running on http://localhost:5000");
});