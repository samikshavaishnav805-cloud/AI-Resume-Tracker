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

export default function ResumeDetail() {
  const { id } = useParams();
  const nav = useNavigate();

  const { data, isLoading, error } = useResume(id);
  const resume = data?.resume;
  const versions = data?.versions || [];

  const [activeVersionId, setActiveVersionId] = useState(null);
  useEffect(() => {
    if (!activeVersionId && versions.length) {
      setActiveVersionId(resume?.currentVersionId || versions[versions.length - 1]._id);
    }
  }, [versions, resume, activeVersionId]);

  const activeVersion = useMemo(
    () => versions.find((v) => v._id === activeVersionId),
    [versions, activeVersionId]
  );

  const analysisQuery = useAnalysisForVersion(id, activeVersionId);
  const analysis = analysisQuery.data;

  const historyQuery = useAnalyses(id);
  const analysisHistory = historyQuery.data || [];

  const scoreChange =
    analysisHistory.length >= 2
      ? Number(analysisHistory[0].atsScore) -
        Number(analysisHistory[1].atsScore)
      : null;

  const analyze = useAnalyzeResume(id);
  const matchJob = useMatchJob(id);
  const applyRewrites = useApplyRewrites(id);
  const [targetRole, setTargetRole] = useState("");
  const [tab, setTab] = useState("score");

  const [jobDescription, setJobDescription] = useState("");
  const [jobMatch, setJobMatch] = useState(null);

  async function runAnalyze() {
    try {
      await analyze.mutateAsync({
        versionId: activeVersionId,
        targetRole: targetRole.trim() || undefined,
      });
    } catch {
      /* surfaced below */
    }
  }

  async function runJobMatch() {
  if (!jobDescription.trim()) return;

  try {
    const result = await matchJob.mutateAsync({
      versionId: activeVersionId,
      jobDescription: jobDescription.trim(),
      targetRole: targetRole.trim() || undefined,
    });

    setJobMatch(result);
  } catch {
    // Error is displayed below
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
        // Auto-analyze the new version with the same target role so the user
        // immediately sees whether their rewrites moved the score.
        try {
          await analyze.mutateAsync({
            versionId: newVersionId,
            targetRole: targetRole.trim() || undefined,
          });
        } catch {
          /* surfaced via analyze.error inside the Run analysis card */
        }
      }
    } catch {
      /* surfaced inside the card */
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

  if (error) {
    return (
      <EmptyState
        icon={FileText}
        title="Resume not found"
        description={error.message}
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
        title={resume?.title || "Resume"}
        description={
          resume
            ? `Updated ${relativeTime(resume.updatedAt)} · ${versions.length} version${
                versions.length > 1 ? "s" : ""
              }`
            : ""
        }
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

      <Card>
        <div className="flex flex-wrap items-end gap-4 justify-between">
          <div className="space-y-2">
            <CardTitle className="text-base">Run analysis</CardTitle>
            <CardDescription>
              Score this version with Gemini and get issues, strengths, and rewrites.
            </CardDescription>
            <VersionSwitcher
              versions={versions}
              activeId={activeVersionId}
              onChange={setActiveVersionId}
            />
          </div>
          <div className="flex items-center gap-3 flex-1 min-w-[280px] max-w-[520px]">
            <Input
              placeholder="Target role (optional, e.g. Senior Frontend Engineer)"
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
                  <Loader2 size={14} className="animate-spin" /> Analyzing…
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
          <div className="mt-4 text-xs text-[var(--danger)] bg-[#F8E3E0] rounded-xl px-3 py-2">
            {analyze.error.message}
          </div>
        )}
      </Card>

      <>
              <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Job Description Matcher
          </CardTitle>
          <CardDescription>
            Compare your resume against a specific job and identify missing skills.
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
                <h4 className="font-semibold mb-2">Matched Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {jobMatch.matchedSkills.length ? (
                    jobMatch.matchedSkills.map((skill) => (
                      <Badge key={skill} tone="success">
                        {skill}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--ink-muted)]">
                      No detected skill matches yet.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Missing Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {jobMatch.missingSkills.length ? (
                    jobMatch.missingSkills.map((skill) => (
                      <Badge key={skill} tone="warning">
                        {skill}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--ink-muted)]">
                      No missing skills detected.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">
                  Improvement Suggestions
                </h4>
                <ul className="list-disc pl-5 space-y-2 text-sm text-[var(--ink-muted)]">
                  {jobMatch.suggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </Card>
    </>

    
<Card>
  <CardHeader>
    <CardTitle className="text-base">
      ATS Analysis History
    </CardTitle>
    <CardDescription>
      Track your resume score across analyses and versions.
    </CardDescription>
  </CardHeader>

  {historyQuery.isLoading ? (
    <div className="space-y-3">
      <Skeleton className="h-16 rounded-xl" />
      <Skeleton className="h-16 rounded-xl" />
    </div>
  ) : historyQuery.error ? (
    <p className="text-sm text-[var(--danger)]">
      Could not load analysis history: {historyQuery.error.message}
    </p>
  ) : analysisHistory.length === 0 ? (
    <div className="py-6 text-center">
      <p className="text-sm font-medium text-[var(--ink)]">
        No analysis history yet
      </p>
      <p className="mt-1 text-sm text-[var(--ink-muted)]">
        Run your first ATS analysis to start tracking your score.
      </p>
    </div>
  ) : (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-[var(--border)] p-3">
          <p className="text-xs text-[var(--ink-muted)]">
            Total analyses
          </p>
          <p className="mt-1 text-2xl font-semibold text-[var(--ink)]">
            {analysisHistory.length}
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] p-3">
          <p className="text-xs text-[var(--ink-muted)]">
            Latest ATS score
          </p>
          <p className="mt-1 text-2xl font-semibold text-[var(--ink)]">
            {analysisHistory[0].atsScore}/100
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] p-3">
          <p className="text-xs text-[var(--ink-muted)]">
            Change from previous
          </p>
          <p
            className={`mt-1 text-2xl font-semibold ${
              scoreChange > 0
                ? "text-emerald-600"
                : scoreChange < 0
                  ? "text-red-500"
                  : "text-[var(--ink)]"
            }`}
          >
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

          const previousScore =
            index < analysisHistory.length - 1
              ? Number(analysisHistory[index + 1].atsScore)
              : null;

          const currentScore = Number(item.atsScore);

          const delta =
            previousScore === null
              ? null
              : currentScore - previousScore;

          return (
            <div
              key={item._id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-[var(--border)] p-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-[var(--ink)]">
                    {currentScore}/100
                  </span>

                  {index === 0 && (
                    <Badge tone="accent">Latest</Badge>
                  )}

                  {delta !== null && (
                    <Badge
                      tone={
                        delta > 0
                          ? "success"
                          : delta < 0
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {delta > 0 ? "+" : ""}
                      {delta} points
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

              <div className="w-full sm:w-32 shrink-0">
                <div className="h-2 rounded-full bg-[var(--border)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--accent-strong)]"
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(100, currentScore)
                      )}%`,
                    }}
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


      {analysisQuery.isLoading && (

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Skeleton className="h-[280px] rounded-3xl" />
          <Skeleton className="h-[280px] rounded-3xl lg:col-span-2" />
        </div>
      )}

      {analysis && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-4">
              <AtsGauge score={analysis.atsScore} delta={0} />
            </div>
            <div className="lg:col-span-5">
              <ScoreBreakdown breakdown={analysis.scoreBreakdown} />
            </div>
            <div className="lg:col-span-3">
              <Card className="h-full flex flex-col">
                <CardHeader>
                  <div>
                    <CardTitle className="text-base">Verdict</CardTitle>
                    <CardDescription className="mt-1">
                      AI overall summary
                    </CardDescription>
                  </div>
                  <Badge tone="accent">{analysis.model}</Badge>
                </CardHeader>
                <p className="text-sm text-[var(--ink)] leading-relaxed">
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
              <CardTitle className="text-base">Parsed Sections ({activeVersion.label})</CardTitle>
              <CardDescription className="mt-1">
                Quick preview of what we extracted from the PDF
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
    <div className="text-[10px] uppercase tracking-wide text-[var(--ink-muted)] mb-1.5">
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
        <div className="pb-4 border-b border-[var(--border)]">
          {b.name && (
            <div className="font-display text-lg font-semibold tracking-tight text-[var(--ink)]">
              {b.name}
            </div>
          )}
          {b.title && (
            <div className="text-[var(--accent-strong)] text-sm">{b.title}</div>
          )}
          <div className="text-xs text-[var(--ink-muted)] mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {b.email && <span>{b.email}</span>}
            {b.phone && <span>{b.phone}</span>}
            {b.location && <span>{b.location}</span>}
            {(b.links || []).map((l, i) => (
              <span key={i}>{l.label}</span>
            ))}
          </div>
        </div>
      )}

      {s.summary && (
        <div>
          <PreviewLabel>Summary</PreviewLabel>
          <p className="text-[var(--ink)] leading-relaxed">{s.summary}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {s.experience?.length > 0 && (
          <div>
            <PreviewLabel>Experience ({s.experience.length})</PreviewLabel>
            <ul className="space-y-1.5">
              {s.experience.slice(0, 5).map((e, i) => (
                <li key={i}>
                  <span className="text-[var(--ink)] font-medium">{e.role}</span>
                  {e.company && (
                    <span className="text-[var(--ink-muted)]"> · {e.company}</span>
                  )}
                  {e.period && (
                    <span className="ml-2 text-[11px] text-[var(--ink-muted)]">
                      {e.period}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {s.education?.length > 0 && (
          <div>
            <PreviewLabel>Education ({s.education.length})</PreviewLabel>
            <ul className="space-y-1.5">
              {s.education.map((e, i) => (
                <li key={i}>
                  <span className="text-[var(--ink)] font-medium">{e.degree}</span>
                  {e.school && (
                    <span className="text-[var(--ink-muted)]"> · {e.school}</span>
                  )}
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
            {s.skills.slice(0, 24).map((sk, i) => (
              <Badge key={i} tone="accent">{sk}</Badge>
            ))}
          </div>
        </div>
      )}

      {s.projects?.length > 0 && (
        <div>
          <PreviewLabel>Projects ({s.projects.length})</PreviewLabel>
          <ul className="space-y-1.5">
            {s.projects.slice(0, 5).map((p, i) => (
              <li key={i}>
                <span className="text-[var(--ink)] font-medium">{p.name}</span>
                {p.tech?.length > 0 && (
                  <span className="ml-2 text-[11px] text-[var(--accent-strong)]">
                    {p.tech.join(" · ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {s.certifications?.length > 0 && (
          <div>
            <PreviewLabel>Certifications</PreviewLabel>
            <ul className="space-y-1 text-xs text-[var(--ink-muted)]">
              {s.certifications.map((c, i) => (
                <li key={i}>
                  <span className="text-[var(--ink)]">{c.name}</span>
                  {c.year && <span> · {c.year}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {s.languages?.length > 0 && (
          <div>
            <PreviewLabel>Languages</PreviewLabel>
            <div className="flex flex-wrap gap-1">
              {s.languages.map((l, i) => (
                <Badge key={i} tone="neutral">{l}</Badge>
              ))}
            </div>
          </div>
        )}
        {s.interests?.length > 0 && (
          <div>
            <PreviewLabel>Interests</PreviewLabel>
            <div className="flex flex-wrap gap-1">
              {s.interests.map((l, i) => (
                <Badge key={i} tone="neutral">{l}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
