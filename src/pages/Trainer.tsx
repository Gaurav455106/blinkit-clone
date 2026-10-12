import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrainerHeader } from "@/components/TrainerHeader";
import { SimPage, PageHeader, StatTile, Section } from "@/components/sim/primitives";
import { BatchTable } from "@/components/admin/BatchTable";
import { StudentsTable } from "@/components/admin/StudentsTable";
import { ScoringGuide } from "@/components/admin/ScoringGuide";
import { CohortAnalysis } from "@/components/admin/CohortAnalysis";
import { CohortTab } from "@/components/admin/CohortTab";
import { useAllAttempts } from "@/components/admin/useAllAttempts";
import { bestPerStudent, summariseBatches } from "@/lib/attemptAnalysis";

const ALL_BATCHES = "All";
const ATTEMPT_LIMIT = 2000;

export default function Trainer() {
  const nav = useNavigate();
  const { rows, loading, error, reload } = useAllAttempts(ATTEMPT_LIMIT, "trainer");
  const [search, setSearch] = useState("");
  const [activeBatch, setActiveBatch] = useState<string>(ALL_BATCHES);

  const bestByEmail = useMemo(() => bestPerStudent(rows), [rows]);
  const batches = useMemo(() => [ALL_BATCHES, ...Array.from(new Set(bestByEmail.map((r) => r.batch_code))).sort()], [bestByEmail]);
  const batchSummaries = useMemo(() => summariseBatches(bestByEmail), [bestByEmail]);

  const filtered = useMemo(() => {
    const byBatch = activeBatch === ALL_BATCHES ? bestByEmail : bestByEmail.filter((r) => r.batch_code === activeBatch);
    const q = search.trim().toLowerCase();
    const bySearch = q ? byBatch.filter((r) => r.email.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)) : byBatch;
    return [...bySearch].sort((a, b) => b.score_total - a.score_total);
  }, [bestByEmail, activeBatch, search]);

  const totalStudents = bestByEmail.length;
  const overallAvg = totalStudents ? Math.round(bestByEmail.reduce((s, x) => s + x.score_total, 0) / totalStudents) : 0;
  const openProfile = (email: string) => nav(`/trainer/student/${encodeURIComponent(email)}`);

  return (
    <div className="min-h-screen w-full bg-background">
      <TrainerHeader />
      <SimPage wide>
        <PageHeader
          eyebrow="Trainer"
          title="Trainer dashboard"
          description="How each batch is doing, where students lose points, and what to teach next."
        />

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile label="Students" value={totalStudents} />
          <StatTile label="Batches" value={batches.length - 1} />
          <StatTile label="Average best score" value={`${overallAvg} / 100`} />
        </div>

        <Tabs defaultValue="cohort" className="space-y-6">
          <TabsList>
            <TabsTrigger value="cohort">Cohort analysis</TabsTrigger>
            <TabsTrigger value="students">Students and batches</TabsTrigger>
            <TabsTrigger value="scoring">How students are judged</TabsTrigger>
          </TabsList>

          <TabsContent value="cohort">
            <CohortTab loading={loading} error={error} onRetry={reload}>
              <CohortAnalysis key={activeBatch} rows={rows} onOpenStudent={openProfile} initialBatch={activeBatch === ALL_BATCHES ? undefined : activeBatch} />
            </CohortTab>
          </TabsContent>

          <TabsContent value="students" className="space-y-6">
            <Section title="Batches" description="Select a batch to filter the students and the cohort analysis.">
              <BatchTable
                batches={batchSummaries}
                activeBatch={activeBatch}
                loading={loading}
                onSelect={(b) => setActiveBatch((prev) => (prev === b ? ALL_BATCHES : b))}
              />
            </Section>

            <Section
              title="Students"
              description="Best run per student. Open a row for details, or the profile for every run."
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by batch">
                    {batches.map((b) => (
                      <button
                        key={b}
                        type="button"
                        aria-pressed={activeBatch === b}
                        onClick={() => setActiveBatch(b)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium ${activeBatch === b ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                      >{b}</button>
                    ))}
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" aria-label="Search students by name or email" className="h-8 w-56 pl-8 text-sm" />
                  </div>
                </div>
              }
            >
              <StudentsTable rows={filtered} allRows={rows} loading={loading} error={error} onRetry={reload} onOpenProfile={openProfile} />
            </Section>
          </TabsContent>
          <TabsContent value="scoring">
            <ScoringGuide />
          </TabsContent>
        </Tabs>
      </SimPage>
    </div>
  );
}
