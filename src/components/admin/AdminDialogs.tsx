// Confirmation dialogs for the admin panel's destructive and cleanup actions.

import { useState } from "react";
import { Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AttemptRow } from "@/lib/attemptAnalysis";

interface DeleteStudentDialogProps {
  target: AttemptRow | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteStudentDialog({ target, busy, onCancel, onConfirm }: DeleteStudentDialogProps) {
  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sim-ui max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive"><Trash2 className="h-4 w-4" /> Delete this student's runs?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This deletes every run saved for <span className="font-semibold text-foreground">{target?.name}</span> ({target?.email}). It can't be undone.
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>{busy ? "Deleting…" : "Delete for good"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteBatchDialogProps {
  batch: string | null;
  students: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Typed confirmation: a whole batch is a far bigger loss than one student. */
export function DeleteBatchDialog({ batch, students, busy, onCancel, onConfirm }: DeleteBatchDialogProps) {
  const [typed, setTyped] = useState("");
  const close = () => { setTyped(""); onCancel(); };
  const confirm = () => { setTyped(""); onConfirm(); };
  return (
    <Dialog open={!!batch} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="sim-ui max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive"><Trash2 className="h-4 w-4" /> Delete the whole batch?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This deletes the runs of <span className="font-semibold text-foreground">{students}</span> students
          in batch <span className="font-semibold text-foreground">{batch}</span>. It can't be undone. Export a CSV first if you need the data.
        </p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="batch-confirm" className="text-xs font-semibold text-foreground">
            Type <span className="font-mono">{batch}</span> to confirm
          </label>
          <Input id="batch-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={batch ?? ""} autoComplete="off" />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={close}>Cancel</Button>
          <Button variant="destructive" onClick={confirm} disabled={busy || typed !== batch}>
            {busy ? "Deleting…" : "Delete batch for good"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ClearStaleDialogProps {
  open: boolean;
  count: number | null;
  days: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ClearStaleDialog({ open, count, days, busy, onCancel, onConfirm }: ClearStaleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sim-ui max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Clock className="h-4 w-4 text-sim-warn" /> Clear stale live sessions?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {count === 0
            ? `No live session has been inactive for more than ${days} days, so there is nothing to clear.`
            : <>This removes <span className="font-semibold text-foreground">{count}</span> "in progress"
                marker{count === 1 ? "" : "s"} inactive for over {days} days.
                It only clears in-progress trackers. Saved scores and runs are <span className="font-semibold">not</span> touched.</>}
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm} disabled={busy || !count}>{busy ? "Clearing…" : "Clear stale sessions"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
