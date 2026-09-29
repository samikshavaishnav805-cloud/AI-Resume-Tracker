const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");

const { calculateJobMatch } = require("../utils/jobMatcher");
const { calculateATS } = require("../utils/atsAnalyzer");
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

// ANALYZE RESUME
router.post("/:id/analyze", async (req, res) => {
    try {
        const { versionId, targetRole, jobDescription } = req.body;

        if (!versionId) {
            return res.status(400).json({
                message: "Version ID is required",
            });
        }

        if (jobDescription && jobDescription.length > 15000) {
            return res.status(400).json({
                message: "Job description is too long",
            });
        }

        const result = await pool.query(
            `SELECT rv.id, rv.extracted_text
             FROM resume_versions rv
             JOIN resumes r ON r.id = rv.resume_id
             WHERE r.id = $1
               AND rv.id = $2
               AND r.user_id = $3`,
            [req.params.id, versionId, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Resume version not found",
            });
        }

        const parsed = calculateATS(
            result.rows[0].extracted_text,
            targetRole || "",
            jobDescription || ""
        );

        const saved = await pool.query(
            `INSERT INTO resume_analyses
             (
                user_id,
                resume_id,
                version_id,
                target_role,
                job_description,
                ats_score,
                score_breakdown,
                summary,
                model,
                issues,
                strengths,
                keywords_present,
                keywords_missing,
                bullet_rewrites
             )
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
             RETURNING id, created_at`,
            [
                req.user.id,
                req.params.id,
                versionId,
                targetRole || null,
                jobDescription || null,
                parsed.atsScore,
                JSON.stringify(parsed.scoreBreakdown),
                parsed.summary,
                parsed.model,
                JSON.stringify(parsed.issues),
                JSON.stringify(parsed.strengths),
                JSON.stringify(parsed.keywordsPresent),
                JSON.stringify(parsed.keywordsMissing),
                JSON.stringify(parsed.bulletRewrites),
            ]
        );

        return res.status(201).json({
            message: "Resume analyzed successfully",
            analysis: {
                _id: String(saved.rows[0].id),
                versionId: String(versionId),
                ...parsed,
                createdAt: saved.rows[0].created_at,
                targetRole: targetRole || null,
                jobDescription: jobDescription || null,
            },
        });

    } catch (error) {
        console.error("ATS analysis error:", error.message);

        return res.status(500).json({
            message: error.message || "Could not analyze resume",
        });
    }
});


// GET ANALYSES FOR A RESUME
router.get("/:id/analyses", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT a.*
             FROM resume_analyses a
             JOIN resumes r ON r.id = a.resume_id
             WHERE a.resume_id = $1
               AND a.user_id = $2
               AND r.user_id = $2
             ORDER BY a.created_at DESC`,
            [req.params.id, req.user.id]
        );

        return res.json({
            analyses: result.rows.map((a) => ({
                _id: String(a.id),
                versionId: String(a.version_id),
                atsScore: a.ats_score,
                scoreBreakdown: a.score_breakdown,
                summary: a.summary,
                model: a.model,
                issues: a.issues,
                strengths: a.strengths,
                keywordsPresent: a.keywords_present,
                keywordsMissing: a.keywords_missing,
                bulletRewrites: a.bullet_rewrites,
                targetRole: a.target_role,
                jobDescription: a.job_description,
                createdAt: a.created_at,
            })),
        });

    } catch (error) {
        console.error("Analysis history error:", error.message);

        return res.status(500).json({
            message: "Could not fetch analysis history",
        });
    }
});


// GET LATEST ANALYSIS FOR A VERSION
router.get("/:id/versions/:versionId/analysis", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT a.*
             FROM resume_analyses a
             JOIN resumes r ON r.id = a.resume_id
             WHERE a.resume_id = $1
               AND a.version_id = $2
               AND a.user_id = $3
               AND r.user_id = $3
             ORDER BY a.created_at DESC
             LIMIT 1`,
            [req.params.id, req.params.versionId, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.json({ analysis: null });
        }

        const a = result.rows[0];

        return res.json({
            analysis: {
                _id: String(a.id),
                versionId: String(a.version_id),
                atsScore: a.ats_score,
                scoreBreakdown: a.score_breakdown,
                summary: a.summary,
                model: a.model,
                issues: a.issues,
                strengths: a.strengths,
                keywordsPresent: a.keywords_present,
                keywordsMissing: a.keywords_missing,
                bulletRewrites: a.bullet_rewrites,
                targetRole: a.target_role,
                jobDescription: a.job_description,
                createdAt: a.created_at,
            },
        });

    } catch (error) {
        console.error("Version analysis error:", error.message);

        return res.status(500).json({
            message: "Could not fetch analysis",
        });
    }
});

// Match resume against a job description
router.post("/:id/match", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const resumeId = req.params.id;
    const { versionId, jobDescription, targetRole } = req.body;

    if (!jobDescription || jobDescription.trim().length < 50) {
      return res.status(400).json({
        message: "Please provide a job description with at least 50 characters."
      });
    }

    const ownership = await pool.query(
      "SELECT id FROM resumes WHERE id = $1 AND user_id = $2",
      [resumeId, userId]
    );

    if (!ownership.rows.length) {
      return res.status(404).json({ message: "Resume not found" });
    }

    let versionQuery;

    if (versionId) {
      versionQuery = await pool.query(
        `SELECT id, extracted_text FROM resume_versions
         WHERE id = $1 AND resume_id = $2`,
        [versionId, resumeId]
      );
    } else {
      versionQuery = await pool.query(
        `SELECT id, extracted_text FROM resume_versions
         WHERE resume_id = $1
         ORDER BY version_number DESC LIMIT 1`,
        [resumeId]
      );
    }

    if (!versionQuery.rows.length) {
      return res.status(404).json({ message: "Resume version not found" });
    }

    const version = versionQuery.rows[0];

    const result = calculateJobMatch(
      version.extracted_text,
      jobDescription
    );

    const saved = await pool.query(
      `INSERT INTO resume_analyses
       (user_id, resume_id, version_id, target_role, job_description,
        ats_score, score_breakdown, summary, model, issues, strengths,
        keywords_present, keywords_missing, bullet_rewrites)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id, created_at`,
      [
        userId,
        resumeId,
        version.id,
        targetRole || null,
        jobDescription,
        result.matchPercentage,
        JSON.stringify({ jobMatch: result.matchPercentage }),
        `Your resume matches ${result.matchPercentage}% of the detected job requirements.`,
        result.model,
        JSON.stringify(result.suggestions),
        JSON.stringify(result.matchedSkills),
        JSON.stringify(result.matchedKeywords),
        JSON.stringify(result.missingSkills),
        JSON.stringify([])
      ]
    );

    res.json({
      success: true,
      analysisId: saved.rows[0].id,
      createdAt: saved.rows[0].created_at,
      ...result
    });
  } catch (error) {
    next(error);
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