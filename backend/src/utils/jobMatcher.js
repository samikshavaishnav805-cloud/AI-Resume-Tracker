
const STOP_WORDS = new Set([
  "the", "and", "for", "with", "you", "your", "are", "our",
  "this", "that", "from", "will", "have", "has", "using",
  "use", "into", "their", "they", "about", "who", "what",
  "when", "where", "how", "all", "any", "can", "should",
  "must", "work", "working", "role", "job", "team", "years",
  "year", "experience", "ability", "strong", "good", "knowledge",
  "required", "preferred", "responsibilities", "skills"
]);

const SKILLS = [
  "javascript", "typescript", "python", "java", "c++", "c",
  "react", "node.js", "express", "mongodb", "postgresql",
  "sql", "html", "css", "tailwind", "next.js",
  "machine learning", "deep learning", "artificial intelligence",
  "data analysis", "data structures", "algorithms",
  "git", "github", "docker", "aws", "azure",
  "rest api", "api", "communication", "leadership",
  "problem solving", "teamwork", "excel", "power bi",
  "tensorflow", "pytorch", "flask", "django",
  "computer vision", "natural language processing"
];

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTerms(text) {
  const words = normalize(text)
    .split(" ")
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));

  return [...new Set(words)];
}

function calculateJobMatch(resumeText, jobDescription) {
  if (!resumeText || !jobDescription) {
    throw new Error("Resume text and job description are required");
  }

  const resume = normalize(resumeText);
  const jd = normalize(jobDescription);

  const jdSkills = SKILLS.filter(skill => jd.includes(skill));
  const matchedSkills = jdSkills.filter(skill => resume.includes(skill));
  const missingSkills = jdSkills.filter(skill => !resume.includes(skill));

  const jdTerms = extractTerms(jobDescription);
  const matchedTerms = jdTerms.filter(term => resume.includes(term));

  const skillScore = jdSkills.length
    ? (matchedSkills.length / jdSkills.length) * 70
    : 0;

  const keywordScore = jdTerms.length
    ? (matchedTerms.length / jdTerms.length) * 30
    : 0;

  const matchPercentage = Math.min(
    100,
    Math.round(skillScore + keywordScore)
  );

  const suggestions = missingSkills.slice(0, 8).map(skill =>
    `If you have experience with ${skill}, include it clearly in your resume.`
  );

  if (missingSkills.length === 0 && jdSkills.length > 0) {
    suggestions.push(
      "Your listed technical skills cover the detected job requirements. Make sure your project descriptions demonstrate them."
    );
  }

  return {
    matchPercentage,
    matchedSkills,
    missingSkills,
    matchedKeywords: matchedTerms.slice(0, 30),
    suggestions,
    totalRequiredSkills: jdSkills.length,
    model: "Rule-based Job Matcher v1"
  };
}

module.exports = { calculateJobMatch };
