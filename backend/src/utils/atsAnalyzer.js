const SKILLS = [
  "javascript", "typescript", "python", "java", "c++", "c",
  "react", "node.js", "express", "html", "css", "tailwind",
  "sql", "postgresql", "mysql", "mongodb", "supabase",
  "git", "github", "docker", "aws", "azure",
  "machine learning", "deep learning", "artificial intelligence",
  "data structures", "algorithms", "rest api", "api",
  "communication", "leadership", "problem solving",
  "agile", "linux", "excel", "power bi", "tableau"
];

const ACTION_VERBS = [
  "developed", "built", "implemented", "designed",
  "created", "optimized", "automated", "deployed",
  "improved", "engineered", "managed", "led",
  "integrated", "analyzed", "reduced", "increased"
];

const SECTION_PATTERNS = {
  education: /\beducation\b/i,
  skills: /\b(technical skills|skills|technologies)\b/i,
  projects: /\b(projects|academic projects|personal projects)\b/i,
  experience: /\b(experience|internship|work history|employment)\b/i,
  summary: /\b(summary|objective|profile|professional summary)\b/i,
  certifications: /\b(certifications|certificates)\b/i,
};

const STOPWORDS = new Set([
  "about", "above", "after", "again", "against", "also",
  "among", "and", "any", "are", "been", "being", "between",
  "both", "can", "could", "each", "from", "have", "having",
  "into", "its", "more", "most", "must", "other", "over",
  "such", "than", "that", "their", "them", "then", "there",
  "these", "they", "this", "those", "through", "under",
  "using", "very", "was", "were", "what", "when", "where",
  "which", "while", "will", "with", "would", "your",
  "work", "role", "team", "candidate", "required", "preferred",
  "responsibilities", "requirements", "skills", "experience",
  "knowledge", "ability", "strong", "good", "years"
]);

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function containsTerm(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
}

function detectSkills(text) {
  return SKILLS.filter((skill) => containsTerm(text, skill));
}

function extractKeywords(jobDescription) {
  const text = normalize(jobDescription);

  const technicalSkills = detectSkills(text);

  const words = text.match(/\b[a-z][a-z0-9+#.-]{3,}\b/g) || [];

  const usefulWords = [...new Set(
    words.filter((word) =>
      !STOPWORDS.has(word) &&
      !/^\d+$/.test(word)
    )
  )];

  return [...new Set([
    ...technicalSkills,
    ...usefulWords
  ])].slice(0, 40);
}

function calculateATS(resumeText, targetRole = "", jobDescription = "") {
  const text = normalize(resumeText);

  if (text.length < 50) {
    throw new Error("Resume text is too short to analyze.");
  }

  const sections = Object.entries(SECTION_PATTERNS)
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name);

  const skills = detectSkills(text);

  const keywords = jobDescription
    ? extractKeywords(jobDescription)
    : extractKeywords(targetRole);

  const keywordsPresent = keywords.filter((word) =>
    containsTerm(text, word)
  );

  const keywordsMissing = keywords.filter((word) =>
    !containsTerm(text, word)
  );

  const keywordScore = keywords.length
    ? Math.round((keywordsPresent.length / keywords.length) * 100)
    : Math.min(100, skills.length * 10);

  const formattingChecks = [
    /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i.test(text),
    /\b(?:\+?\d[\d\s()-]{8,}\d)\b/.test(text),
    text.length >= 500,
    text.length <= 12000,
    /\n/.test(resumeText),
    /(?:^|\n)\s*[-•▪●]/.test(resumeText),
  ];

  const formattingScore = Math.round(
    (formattingChecks.filter(Boolean).length / formattingChecks.length) * 100
  );

  const experienceIndicators = [
    /\b(projects|experience|internship)\b/i.test(text),
    ACTION_VERBS.some((verb) => containsTerm(text, verb)),
    /\b\d+\s*%/.test(text),
    /\b\d+\+?\s*(users|customers|projects|clients|hours|records)\b/i.test(text),
  ];

  const experienceScore = Math.round(
    (experienceIndicators.filter(Boolean).length / experienceIndicators.length) * 100
  );

  const sectionScore = Math.round((sections.length / 6) * 100);

  const skillsScore = Math.min(100, skills.length * 10);

  const scoreBreakdown = {
    formatting: Math.round(formattingScore * 0.20),
    skills: Math.round(skillsScore * 0.25),
    keywords: Math.round(keywordScore * 0.25),
    experience: Math.round(experienceScore * 0.20),
    sections: Math.round(sectionScore * 0.10),
  };

  const atsScore = Math.min(
    100,
    Math.max(0, Object.values(scoreBreakdown).reduce((a, b) => a + b, 0))
  );

  const issues = [];

  if (!formattingChecks[0]) {
    issues.push({
      title: "Email address not detected",
      description: "Ensure your contact email is present in selectable resume text.",
      severity: "high"
    });
  }

  if (!sections.includes("skills")) {
    issues.push({
      title: "Skills section missing",
      description: "Add a clearly labeled technical skills section.",
      severity: "medium"
    });
  }

  if (!sections.includes("projects")) {
    issues.push({
      title: "Projects section missing",
      description: "Include relevant academic or personal projects.",
      severity: "medium"
    });
  }

  if (!experienceIndicators[1]) {
    issues.push({
      title: "Use stronger action verbs",
      description: "Describe your contributions with verbs such as Developed, Built, Implemented, or Designed.",
      severity: "medium"
    });
  }

  if (!experienceIndicators[2] && !experienceIndicators[3]) {
    issues.push({
      title: "Add measurable achievements",
      description: "Where accurate, quantify project outcomes, performance improvements, or usage.",
      severity: "medium"
    });
  }

  if (keywordsMissing.length) {
    issues.push({
      title: "Some relevant keywords are missing",
      description: "Review the missing keywords and include only those that accurately reflect your skills.",
      severity: "medium"
    });
  }

  const strengths = [];

  if (sections.includes("education")) {
    strengths.push({
      title: "Education section detected",
      description: "Your educational background is present."
    });
  }

  if (sections.includes("projects")) {
    strengths.push({
      title: "Projects section detected",
      description: "Your resume includes project-related content."
    });
  }

  if (skills.length) {
    strengths.push({
      title: "Technical skills identified",
      description: `${skills.length} recognized skills were detected.`
    });
  }

  if (experienceIndicators[2] || experienceIndicators[3]) {
    strengths.push({
      title: "Measurable results detected",
      description: "Your resume contains numerical achievement indicators."
    });
  }

  return {
    atsScore,
    scoreBreakdown,
    summary: jobDescription
      ? `Your resume matches ${keywordsPresent.length} of ${keywords.length} extracted job-description keywords. This is a rule-based estimate, not a proprietary ATS result.`
      : `Your resume was evaluated using formatting, skills, experience indicators, and section completeness. Add a job description for a more targeted match.`,
    model: "Rule-based v1",
    issues,
    strengths,
    keywordsPresent,
    keywordsMissing,
    bulletRewrites: [],
    skills,
    sections,
    matchPercentage: jobDescription ? keywordScore : null,
    suggestions: issues.map((issue) => issue.description),
  };
}

module.exports = { calculateATS };