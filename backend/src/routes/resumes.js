const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");

const { pool } = require("../config/db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        if (
            file.mimetype !== "application/pdf" ||
            !file.originalname.toLowerCase().endsWith(".pdf")
        ) {
            return cb(new Error("Only PDF files are allowed"));
        }

        cb(null, true);
    },
});

router.use(requireAuth);

// GET ALL RESUMES
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                r.id,
                r.title,
                r.created_at,
                r.updated_at,
                (
                    SELECT rv.id
                    FROM resume_versions rv
                    WHERE rv.resume_id = r.id
                    ORDER BY rv.version_number DESC
                    LIMIT 1
                ) AS current_version_id
             FROM resumes r
             WHERE r.user_id = $1
             ORDER BY r.created_at DESC`,
            [req.user.id]
        );

        return res.json({
            resumes: result.rows.map((r) => ({
                _id: String(r.id),
                title: r.title,
                createdAt: r.created_at,
                updatedAt: r.updated_at,
                currentVersionId: String(r.current_version_id),
            })),
        });
    } catch (error) {
        console.error("List resumes error:", error.message);
        return res.status(500).json({
            message: "Could not fetch resumes",
        });
    }
});

// UPLOAD AND PARSE PDF
router.post("/", upload.single("file"), async (req, res) => {
    const client = await pool.connect();

    try {
        if (!req.file) {
            return res.status(400).json({
                message: "Please select a PDF file",
            });
        }

        const parsed = await pdfParse(req.file.buffer);
        const extractedText = parsed.text.trim();

        if (!extractedText) {
            return res.status(422).json({
                message: "No readable text found. Please upload a text-based PDF.",
            });
        }

        const title =
            (req.body.title || req.file.originalname.replace(/\.pdf$/i, ""))
                .trim()
                .slice(0, 150) || "My Resume";

        await client.query("BEGIN");

        const resumeResult = await client.query(
            `INSERT INTO resumes (user_id, title)
             VALUES ($1, $2)
             RETURNING id, title, created_at, updated_at`,
            [req.user.id, title]
        );

        const resume = resumeResult.rows[0];

        const versionResult = await client.query(
            `INSERT INTO resume_versions
             (resume_id, version_number, original_filename, file_data, extracted_text, file_size)
             VALUES ($1, 1, $2, $3, $4, $5)
             RETURNING id, version_number, created_at`,
            [
                resume.id,
                req.file.originalname,
                req.file.buffer,
                extractedText,
                req.file.size,
            ]
        );

        await client.query("COMMIT");

        const version = versionResult.rows[0];

        return res.status(201).json({
            message: "Resume uploaded and parsed successfully",
            resume: {
                _id: String(resume.id),
                title: resume.title,
                createdAt: resume.created_at,
                updatedAt: resume.updated_at,
                currentVersionId: String(version.id),
            },
        });
    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Resume upload error:", error.message);

        return res.status(500).json({
            message: "Resume upload failed",
        });
    } finally {
        client.release();
    }
});

// GET RESUME DETAILS
router.get("/:id", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT r.id, r.title, r.created_at, r.updated_at,
                    rv.id AS version_id, rv.version_number, rv.created_at AS version_created_at
             FROM resumes r
             LEFT JOIN resume_versions rv ON rv.resume_id = r.id
             WHERE r.id = $1 AND r.user_id = $2
             ORDER BY rv.version_number DESC`,
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Resume not found",
            });
        }

        const r = result.rows[0];

        return res.json({
            resume: {
                _id: String(r.id),
                title: r.title,
                createdAt: r.created_at,
                updatedAt: r.updated_at,
                currentVersionId: String(r.version_id),
            },
            versions: result.rows.map((v) => ({
                _id: String(v.version_id),
                label: `V${v.version_number}`,
                createdAt: v.version_created_at,
            })),
        });
    } catch (error) {
        console.error("Resume details error:", error.message);
        return res.status(500).json({
            message: "Could not fetch resume",
        });
    }
});

// GET VERSION TEXT
router.get("/:id/versions/:versionId", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT rv.id, rv.version_number, rv.original_filename,
                    rv.extracted_text, rv.created_at
             FROM resume_versions rv
             JOIN resumes r ON r.id = rv.resume_id
             WHERE r.id = $1 AND rv.id = $2 AND r.user_id = $3`,
            [req.params.id, req.params.versionId, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Version not found",
            });
        }

        const v = result.rows[0];

        return res.json({
            version: {
                _id: String(v.id),
                label: `V${v.version_number}`,
                createdAt: v.created_at,
                originalFilename: v.original_filename,
                parsedText: v.extracted_text,
            },
        });
    } catch (error) {
        console.error("Version error:", error.message);
        return res.status(500).json({
            message: "Could not fetch version",
        });
    }
});

// DELETE RESUME
router.delete("/:id", async (req, res) => {
    try {
        const result = await pool.query(
            "DELETE FROM resumes WHERE id = $1 AND user_id = $2 RETURNING id",
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Resume not found",
            });
        }

        return res.json({
            message: "Resume deleted successfully",
        });
    } catch (error) {
        console.error("Delete resume error:", error.message);
        return res.status(500).json({
            message: "Could not delete resume",
        });
    }
});

module.exports = router;