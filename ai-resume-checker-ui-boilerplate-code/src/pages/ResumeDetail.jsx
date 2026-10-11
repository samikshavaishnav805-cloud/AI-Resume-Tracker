
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Sparkles, ArrowLeft, Loader2, FileText, Download } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { AtsGauge } from "@/components/dashboard/AtsGauge";
import { ScoreBreakdown } from "@/components/analysis/ScoreBreakdown";
import { IssuesList } from "@/components/analysis/IssuesList";
import { StrengthsList } from "@/components/analysis/StrengthsList";
import { KeywordChips } from "@/components/analysis/KeywordChips";
import { BulletRewrites } from "@/components/analysis/BulletRewrites";
import { VersionSwitcher } from "@/components/resume/VersionSwitcher";
import { DiffView } from "@/components/resume/DiffView";
import { relativeTime } from "@/lib/utils";
import {
  useResume,
  useAnalysisForVersion,
  useAnalyzeResume,
  useApplyRewrites,
  useMatchJob,
  useAnalyses,
} from "@/hooks/useResumes";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export default function ResumeDetail() {
  const { id } = useParams();
  const nav = useNavigate();

  const { data, isLoading, error } = useResume(id);
  const resume = data?.resume;
  const versions = data?.versions || [];

  const [activeVersionId, setActiveVersionId] = useState(null);


  const [targetRole, setTargetRole] = useState("");
  const [tab, setTab] = useState("score");
  const [jobDescription, setJobDescription] = useState("");
  const [jobMatch, setJobMatch] = useState(null);
  const [compareFromId, setCompareFromId] = useState("");
  const [compareToId, setCompareToId] = useState("");

  useEffect(() => {
  if (versions.length < 2) return;

  const firstId = String(versions[0]._id);
  const secondId = String(versions[1]._id);

  setCompareFromId((current) =>
    current && versions.some((v) => String(v._id) === current)
      ? current
      : firstId
  );

  setCompareToId((current) =>
    current &&
    current !== firstId &&
    versions.some((v) => String(v._id) === current)
      ? current
      : secondId
  );
}, [versions]);

  const activeVersion = useMemo(
    () => versions.find(
      (v) => String(v._id) === String(activeVersionId)
    ),
    [versions, activeVersionId]
  );

  const analysisQuery = useAnalysisForVersion(id, activeVersionId);
  const analysis = analysisQuery.data;

  // ATS analyses for the two selected resume versions
const compareFromQuery = useAnalysisForVersion(id, compareFromId);
const compareToQuery = useAnalysisForVersion(id, compareToId);

const compareFromAnalysis = compareFromQuery.data;
const compareToAnalysis = compareToQuery.data;

const comparisonReady =
  compareFromId &&
  compareToId &&
  compareFromId !== compareToId &&
  compareFromAnalysis &&
  compareToAnalysis;

const comparisonScoreChange = comparisonReady
  ? Number(compareToAnalysis.atsScore || 0) -
    Number(compareFromAnalysis.atsScore || 0)
  : null;

const fromKeywords = new Set(
  (compareFromAnalysis?.keywordsPresent || []).map((k) =>
    String(k).toLowerCase()
  )
);

const toKeywords = new Set(
  (compareToAnalysis?.keywordsPresent || []).map((k) =>
    String(k).toLowerCase()
  )
);

const keywordsGained = (compareToAnalysis?.keywordsPresent || []).filter(
  (k) => !fromKeywords.has(String(k).toLowerCase())
);

const keywordsLost = (compareFromAnalysis?.keywordsPresent || []).filter(
  (k) => !toKeywords.has(String(k).toLowerCase())
);

  const historyQuery = useAnalyses(id);
  const analysisHistory = historyQuery.data || [];

  // History is returned newest-first by the backend.
  const chartData = [...analysisHistory].reverse().map((item, index) => ({
    name: item.createdAt
      ? new Date(item.createdAt).toLocaleDateString("en-IN")
      : `Analysis ${index + 1}`,
    score: Math.max(0, Math.min(100, Number(item.atsScore) || 0)),
    role: item.targetRole || "General Analysis",
  }));

  const scoreChange =
    analysisHistory.length >= 2
      ? Number(analysisHistory[0].atsScore) -
        Number(analysisHistory[1].atsScore)
      : null;

  const analyze = useAnalyzeResume(id);
  const matchJob = useMatchJob(id);
  const applyRewrites = useApplyRewrites(id);

  async function runAnalyze() {
    if (!activeVersionId) return;
    try {
      await analyze.mutateAsync({
        versionId: activeVersionId,
        targetRole: targetRole.trim() || undefined,
      });
    } catch {
      // The mutation hook displays the error.
    }
  }

    async function runJobMatch() {
    if (!jobDescription.trim() || !activeVersionId) return;
    try {
      const result = await matchJob.mutateAsync({
        versionId: activeVersionId,
        jobDescription: jobDescription.trim(),
        targetRole: targetRole.trim() || undefined,
      });
      setJobMatch(result);
    } catch {
      // The mutation hook displays the error.
    }
  }

  async function runApplyRewrites(rewriteIds) {
    if (!analysis?._id) return;
    try {
      const res = await applyRewrites.mutateAsync({
        analysisId: analysis._id,
        rewriteIds: rewriteIds.length ? rewriteIds : undefined,
      });

      if (res?.version?._id) {
        const newVersionId = res.version._id;
        setActiveVersionId(newVersionId);
        setTab("score");

        try {
          await analyze.mutateAsync({
            versionId: newVersionId,
            targetRole: targetRole.trim() || undefined,
          });
        } catch {
          // The mutation hook displays the error.
        }
      }
    } catch {
      // The rewrite component displays the error.
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-1/3 rounded-2xl" />
        <Skeleton className="h-[400px] rounded-3xl" />
      </div>
    );
  }

  if (error || !resume) {
    return (
      <EmptyState
        icon={FileText}
        title="Resume not found"
        description={error?.message || "This resume could not be loaded."}
        action={
          <Button variant="outline" onClick={() => nav("/resumes")}>
            Back to resumes
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={resume.title || "Resume"}
        description={`Updated ${relativeTime(resume.updatedAt)} · ${
          versions.length
        } version${versions.length === 1 ? "" : "s"}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => nav("/resumes")}>
              <ArrowLeft size={14} /> All resumes
            </Button>
            <Button
              variant="outline"
              onClick={() => nav(`/resumes/${id}/export`)}
            >
              <Download size={14} /> Export PDF
            </Button>
          </div>
        }
      />

      {/* Run ATS analysis */}
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <CardTitle className="text-base">Run analysis</CardTitle>
            <CardDescription>
              Analyze this version and review its score, issues, strengths,
              and suggested rewrites.
            </CardDescription>
            <VersionSwitcher
              versions={versions}
              activeId={activeVersionId}
              onChange={setActiveVersionId}
            />
          </div>

          <div className="flex min-w-[280px] max-w-[520px] flex-1 items-center gap-3">
            <Input
              placeholder="Target role (optional, e.g. Software Developer Intern)"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
            />
            <Button
              variant="accent"
              size="lg"
              onClick={runAnalyze}
              disabled={analyze.isPending || !activeVersionId}
              className="shrink-0"
            >
              {analyze.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <Sparkles size={14} /> Analyze
                </>
              )}
            </Button>
          </div>
        </div>

        {analyze.error && (
          <p className="mt-4 rounded-xl bg-[#F8E3E0] px-3 py-2 text-xs text-[var(--danger)]">
            {analyze.error.message}
          </p>
        )}
      </Card>

      {/* Job Description Matcher */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Job Description Matcher</CardTitle>
          <CardDescription>
            Compare your resume against a job description and identify
            missing skills.
          </CardDescription>
        </CardHeader>

        <div className="space-y-4">
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the complete job description here..."
            rows={7}
            className="w-full rounded-xl border border-[var(--border)] bg-transparent p-4 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
          />

          <Button
            variant="accent"
            onClick={runJobMatch}
            disabled={
              matchJob.isPending ||
              !activeVersionId ||
              jobDescription.trim().length < 50
            }
          >
            {matchJob.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Matching...
              </>
            ) : (
              "Match My Resume"
            )}
          </Button>

          {matchJob.error && (
            <p className="text-sm text-[var(--danger)]">
              {matchJob.error.message}
            </p>
          )}

          {jobMatch && (
            <div className="space-y-5 border-t border-[var(--border)] pt-5">
              <div className="text-center">
                <p className="text-sm text-[var(--ink-muted)]">
                  Resume–Job Match
                </p>
                <div className="text-5xl font-bold text-[var(--accent-strong)]">
                  {jobMatch.matchPercentage}%
                </div>
              </div>

              <div>
                <h4 className="mb-2 font-semibold">Matched Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {jobMatch.matchedSkills?.length ? (
                    jobMatch.matchedSkills.map((skill) => (
                      <Badge key={skill} tone="success">{skill}</Badge>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--ink-muted)]">
                      No detected skill matches yet.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="mb-2 font-semibold">Missing Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {jobMatch.missingSkills?.length ? (
                    jobMatch.missingSkills.map((skill) => (
                      <Badge key={skill} tone="warning">{skill}</Badge>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--ink-muted)]">
                      No missing skills detected.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="mb-2 font-semibold">Improvement Suggestions</h4>
                {jobMatch.suggestions?.length ? (
                  <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--ink-muted)]">
                    {jobMatch.suggestions.map((suggestion, index) => (
                      <li key={index}>{suggestion}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--ink-muted)]">
                    No additional suggestions returned.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ATS Analysis History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ATS Analysis History</CardTitle>
          <CardDescription>
            Track scores from previous analyses of this resume.
          </CardDescription>
        </CardHeader>

        {historyQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        ) : historyQuery.isError ? (
          <p className="text-sm text-[var(--danger)]">
            Could not load history: {historyQuery.error?.message}
          </p>
        ) : analysisHistory.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--ink-muted)]">
            No analysis history yet. Run an ATS analysis to start tracking.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--border)] p-3">
                <p className="text-xs text-[var(--ink-muted)]">Total analyses</p>
                <p className="mt-1 text-2xl font-semibold">
                  {analysisHistory.length}
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border)] p-3">
                <p className="text-xs text-[var(--ink-muted)]">Latest ATS score</p>
                <p className="mt-1 text-2xl font-semibold">
                  {Number(analysisHistory[0].atsScore) || 0}/100
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border)] p-3">
                <p className="text-xs text-[var(--ink-muted)]">
                  Change from previous
                </p>
                <p className={`mt-1 text-2xl font-semibold ${
                  scoreChange > 0
                    ? "text-emerald-600"
                    : scoreChange < 0
                      ? "text-red-500"
                      : "text-[var(--ink)]"
                }`}>
                  {scoreChange === null
                    ? "—"
                    : `${scoreChange > 0 ? "+" : ""}${scoreChange}`}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {analysisHistory.map((item, index) => {
                const version = versions.find(
                  (v) => String(v._id) === String(item.versionId)
                );
                const previousScore = analysisHistory[index + 1]
                  ? Number(analysisHistory[index + 1].atsScore)
                  : null;
                const currentScore = Math.max(
                  0,
                  Math.min(100, Number(item.atsScore) || 0)
                );
                const delta = previousScore === null
                  ? null
                  : currentScore - previousScore;

                return (
                  <div
                    key={item._id || `${item.versionId}-${item.createdAt}-${index}`}
                    className="flex flex-col gap-3 rounded-xl border border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{currentScore}/100</span>
                        {index === 0 && <Badge tone="accent">Latest</Badge>}
                        {delta !== null && (
                          <Badge tone={delta > 0 ? "success" : delta < 0 ? "warning" : "neutral"}>
                            {delta > 0 ? "+" : ""}{delta} points
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-[var(--ink-muted)]">
                        {item.targetRole || "No target role specified"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--ink-muted)]">
                        {version?.label || `Resume version ${item.versionId}`}
                        {" · "}
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleString("en-IN", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "Date unavailable"}
                      </p>
                    </div>

                    <div className="w-full shrink-0 sm:w-32">
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--border)]">
                        <div
                          className="h-full rounded-full bg-[var(--accent-strong)]"
                          style={{ width: `${currentScore}%` }}
                        />
                      </div>
                      <p className="mt-1 text-right text-xs text-[var(--ink-muted)]">
                        Score out of 100
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* ATS score-over-time chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ATS Score Progress</CardTitle>
          <CardDescription>
            See how your score changes across saved analyses.
          </CardDescription>
        </CardHeader>

        {historyQuery.isLoading ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : historyQuery.isError ? (
          <p className="text-sm text-[var(--danger)]">
            The score chart is unavailable because history could not be loaded.
          </p>
        ) : chartData.length < 2 ? (
          <div className="flex h-48 items-center justify-center text-center text-sm text-[var(--ink-muted)]">
            Run at least two ATS analyses to see your score trend.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} width={35} />
                <Tooltip
                  formatter={(value) => [`${value}/100`, "ATS Score"]}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  name="ATS Score"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

    {/* ATS Resume Version Comparison */}
<Card>
  <CardHeader>
    <CardTitle className="text-base">
      ATS Resume Version Comparison
    </CardTitle>
    <CardDescription>
      Compare saved ATS analyses to see how your resume has improved.
    </CardDescription>
  </CardHeader>

  {versions.length < 2 ? (
    <p className="py-6 text-center text-sm text-[var(--ink-muted)]">
      Upload another resume version to compare ATS scores.
    </p>
  ) : (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Older version
          </label>

          <select
            value={compareFromId}
            onChange={(e) => {
              const value = e.target.value;
              setCompareFromId(value);

              if (value === compareToId) {
                const alternative = versions.find(
                  (v) => String(v._id) !== value
                );
                setCompareToId(
                  alternative ? String(alternative._id) : ""
                );
              }
            }}
            className="w-full rounded-xl border border-[var(--border)] bg-transparent p-3 text-sm text-[var(--ink)]"
          >
            {versions.map((version) => (
              <option
                key={version._id}
                value={String(version._id)}
                disabled={String(version._id) === compareToId}
              >
                {version.label || `Version ${version._id}`}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Newer version
          </label>

          <select
            value={compareToId}
            onChange={(e) => {
              const value = e.target.value;
              setCompareToId(value);

              if (value === compareFromId) {
                const alternative = versions.find(
                  (v) => String(v._id) !== value
                );
                setCompareFromId(
                  alternative ? String(alternative._id) : ""
                );
              }
            }}
            className="w-full rounded-xl border border-[var(--border)] bg-transparent p-3 text-sm text-[var(--ink)]"
          >
            {versions.map((version) => (
              <option
                key={version._id}
                value={String(version._id)}
                disabled={String(version._id) === compareFromId}
              >
                {version.label || `Version ${version._id}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {compareFromQuery.isLoading || compareToQuery.isLoading ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : compareFromQuery.isError || compareToQuery.isError ? (
        <p className="rounded-xl bg-[#F8E3E0] p-3 text-sm text-[var(--danger)]">
          Could not load one of the saved analyses. Run an ATS
          analysis on both versions before comparing them.
        </p>
      ) : !comparisonReady ? (
        <p className="rounded-xl border border-[var(--border)] p-4 text-sm text-[var(--ink-muted)]">
          Both versions need a saved ATS analysis. Select another
          version or run an analysis first.
        </p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] p-4">
              <p className="text-xs text-[var(--ink-muted)]">
                Older score
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {Number(compareFromAnalysis.atsScore || 0)}/100
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border)] p-4">
              <p className="text-xs text-[var(--ink-muted)]">
                Newer score
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {Number(compareToAnalysis.atsScore || 0)}/100
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border)] p-4">
              <p className="text-xs text-[var(--ink-muted)]">
                Score change
              </p>
              <p
                className={`mt-1 text-2xl font-semibold ${
                  comparisonScoreChange > 0
                    ? "text-emerald-600"
                    : comparisonScoreChange < 0
                      ? "text-red-500"
                      : "text-[var(--ink)]"
                }`}
              >
                {comparisonScoreChange > 0 ? "+" : ""}
                {comparisonScoreChange}
              </p>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                points
              </p>
            </div>
          </div>

          <div>
            <h4 className="mb-3 font-semibold">
              Score Comparison
            </h4>

            <div className="space-y-4">
              {[
                {
                  label: "Older version",
                  score: Number(compareFromAnalysis.atsScore || 0),
                },
                {
                  label: "Newer version",
                  score: Number(compareToAnalysis.atsScore || 0),
                },
              ].map((item) => (
                <div key={item.label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{item.label}</span>
                    <span className="font-medium">
                      {item.score}/100
                    </span>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-[var(--border)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent-strong)]"
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(100, item.score)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <h4 className="mb-2 font-semibold">
                Keywords Gained
              </h4>

              <div className="flex flex-wrap gap-2">
                {keywordsGained.length ? (
                  keywordsGained.map((keyword) => (
                    <Badge key={keyword} tone="success">
                      + {keyword}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-[var(--ink-muted)]">
                    No new keywords detected.
                  </p>
                )}
              </div>
            </div>

            <div>
              <h4 className="mb-2 font-semibold">
                Keywords Lost
              </h4>

              <div className="flex flex-wrap gap-2">
                {keywordsLost.length ? (
                  keywordsLost.map((keyword) => (
                    <Badge key={keyword} tone="warning">
                      − {keyword}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-[var(--ink-muted)]">
                    No previously detected keywords were lost.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )}
</Card>

      {/* Current version analysis results */}
      {analysisQuery.isLoading && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Skeleton className="h-[280px] rounded-3xl" />
          <Skeleton className="h-[280px] rounded-3xl lg:col-span-2" />
        </div>
      )}

      {analysis && (
        <>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <AtsGauge score={analysis.atsScore} delta={0} />
            </div>
            <div className="lg:col-span-5">
              <ScoreBreakdown breakdown={analysis.scoreBreakdown} />
            </div>
            <div className="lg:col-span-3">
              <Card className="flex h-full flex-col">
                <CardHeader>
                  <div>
                    <CardTitle className="text-base">Verdict</CardTitle>
                    <CardDescription className="mt-1">
                      Overall summary
                    </CardDescription>
                  </div>
                  <Badge tone="accent">{analysis.model}</Badge>
                </CardHeader>
                <p className="text-sm leading-relaxed text-[var(--ink)]">
                  {analysis.summary}
                </p>
              </Card>
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="score">Issues</TabsTrigger>
              <TabsTrigger value="strengths">Strengths</TabsTrigger>
              <TabsTrigger value="keywords">Keywords</TabsTrigger>
              <TabsTrigger value="rewrites">Rewrites</TabsTrigger>
              {versions.length >= 2 && (
                <TabsTrigger value="diff">Diff</TabsTrigger>
              )}
            </TabsList>

            <div className="mt-5">
              <TabsContent value="score">
                <IssuesList issues={analysis.issues} />
              </TabsContent>
              <TabsContent value="strengths">
                <StrengthsList strengths={analysis.strengths} />
              </TabsContent>
              <TabsContent value="keywords">
                <KeywordChips
                  present={analysis.keywordsPresent}
                  missing={analysis.keywordsMissing}
                />
              </TabsContent>
              <TabsContent value="rewrites">
                <BulletRewrites
                  rewrites={analysis.bulletRewrites}
                  onApply={runApplyRewrites}
                  isApplying={applyRewrites.isPending}
                  error={applyRewrites.error?.message}
                />
              </TabsContent>
              <TabsContent value="diff">
                <DiffView resumeId={id} versions={versions} />
              </TabsContent>
            </div>
          </Tabs>
        </>
      )}

      {activeVersion && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="text-base">
                Parsed Sections ({activeVersion.label})
              </CardTitle>
              <CardDescription className="mt-1">
                Quick preview of the content extracted from your PDF.
              </CardDescription>
            </div>
          </CardHeader>
          <ParsedSectionsPreview version={activeVersion} />
        </Card>
      )}
    </div>
  );
}

function PreviewLabel({ children }) {
  return (
    <div className="mb-1.5 text-[10px] uppercase tracking-wide text-[var(--ink-muted)]">
      {children}
    </div>
  );
}

function ParsedSectionsPreview({ version }) {
  const s = version.parsedSections || {};
  const b = s.basics || {};

  return (
    <div className="space-y-4 text-sm">
      {(b.name || b.title || b.email) && (
        <div className="border-b border-[var(--border)] pb-4">
          {b.name && (
            <div className="font-display text-lg font-semibold tracking-tight text-[var(--ink)]">
              {b.name}
            </div>
          )}
          {b.title && (
            <div className="text-sm text-[var(--accent-strong)]">{b.title}</div>
          )}
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--ink-muted)]">
            {b.email && <span>{b.email}</span>}
            {b.phone && <span>{b.phone}</span>}
            {b.location && <span>{b.location}</span>}
            {(b.links || []).map((link, i) => (
              <span key={i}>{link.label}</span>
            ))}
          </div>
        </div>
      )}

      {s.summary && (
        <div>
          <PreviewLabel>Summary</PreviewLabel>
          <p className="leading-relaxed text-[var(--ink)]">{s.summary}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {s.experience?.length > 0 && (
          <div>
            <PreviewLabel>Experience ({s.experience.length})</PreviewLabel>
            <ul className="space-y-1.5">
              {s.experience.slice(0, 5).map((entry, i) => (
                <li key={i}>
                  <span className="font-medium text-[var(--ink)]">{entry.role}</span>
                  {entry.company && <span className="text-[var(--ink-muted)]"> · {entry.company}</span>}
                  {entry.period && <span className="ml-2 text-[11px] text-[var(--ink-muted)]">{entry.period}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {s.education?.length > 0 && (
          <div>
            <PreviewLabel>Education ({s.education.length})</PreviewLabel>
            <ul className="space-y-1.5">
              {s.education.map((entry, i) => (
                <li key={i}>
                  <span className="font-medium text-[var(--ink)]">{entry.degree}</span>
                  {entry.school && <span className="text-[var(--ink-muted)]"> · {entry.school}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {s.skills?.length > 0 && (
        <div>
          <PreviewLabel>Skills ({s.skills.length})</PreviewLabel>
          <div className="flex flex-wrap gap-1.5">
            {s.skills.slice(0, 24).map((skill, i) => (
              <Badge key={i} tone="accent">{skill}</Badge>
            ))}
          </div>
        </div>
      )}

      {s.projects?.length > 0 && (
        <div>
          <PreviewLabel>Projects ({s.projects.length})</PreviewLabel>
          <ul className="space-y-1.5">
            {s.projects.slice(0, 5).map((project, i) => (
              <li key={i}>
                <span className="font-medium text-[var(--ink)]">{project.name}</span>
                {project.tech?.length > 0 && (
                  <span className="ml-2 text-[11px] text-[var(--accent-strong)]">
                    {project.tech.join(" · ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {s.certifications?.length > 0 && (
          <div>
            <PreviewLabel>Certifications</PreviewLabel>
            <ul className="space-y-1 text-xs text-[var(--ink-muted)]">
              {s.certifications.map((cert, i) => (
                <li key={i}>
                  <span className="text-[var(--ink)]">{cert.name}</span>
                  {cert.year && <span> · {cert.year}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {s.languages?.length > 0 && (
          <div>
            <PreviewLabel>Languages</PreviewLabel>
            <div className="flex flex-wrap gap-1">
              {s.languages.map((language, i) => (
                <Badge key={i} tone="neutral">{language}</Badge>
              ))}
            </div>
          </div>
        )}

        {s.interests?.length > 0 && (
          <div>
            <PreviewLabel>Interests</PreviewLabel>
            <div className="flex flex-wrap gap-1">
              {s.interests.map((interest, i) => (
                <Badge key={i} tone="neutral">{interest}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
