import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrainerHeader } from "@/components/TrainerHeader";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Download } from "lucide-react";

export default function TrainerBatch() {
  const { batch = "" } = useParams();
  const decoded = decodeURIComponent(batch);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("attempts").select("*").eq("batch_code", decoded).order("created_at", { ascending: false })
      .then(({ data }) => setRows((data as any) ?? []));
  }, [decoded]);

  const byEmail = new Map<string, any[]>();
  for (const r of rows) {
    if (!byEmail.has(r.email)) byEmail.set(r.email, []);
    byEmail.get(r.email)!.push(r);
  }

  const exportCsv = () => {
    const header = ["name", "email", "batch", "profile", "score", "badge", "created_at"];
    const lines = [header.join(",")].concat(
      rows.map((r) => [r.name, r.email, r.batch_code, r.profile_id, r.score_total, r.badge ?? "", r.created_at]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${decoded}-attempts.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen w-full bg-background">
      <TrainerHeader />
      <div className="flex-1">
        <div className="px-8 py-6 max-w-6xl mx-auto">
          <Link to="/trainer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
            <ArrowLeft className="h-3 w-3" /> Trainer dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Batch: {decoded}</h1>
              <p className="text-xs text-muted-foreground">{rows.length} total attempts · {byEmail.size} students</p>
            </div>
            <Button variant="outline" onClick={exportCsv} className="gap-2"><Download className="h-4 w-4" /> Export CSV</Button>
          </div>

          <Card className="mt-6 p-0 overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>{["Name", "Email", "Scenario", "Score", "Attempts"].map((h) =>
                  <th key={h} className="p-3 text-left text-xs font-medium text-muted-foreground">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {Array.from(byEmail.entries()).map(([email, attempts]) => {
                  const best = attempts.slice().sort((a, b) => b.score_total - a.score_total)[0];
                  return (
                    <tr key={email} className="border-b border-border">
                      <td className="p-3 text-sm font-medium">{best.name}</td>
                      <td className="p-3 text-sm text-muted-foreground">{email}</td>
                      <td className="p-3 text-sm">{best.profile_id}</td>
                      <td className="p-3 text-sm font-semibold">{best.score_total}</td>
                      <td className="p-3 text-sm">{attempts.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </div>
  );
}
