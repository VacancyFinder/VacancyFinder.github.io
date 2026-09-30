import { useCallback } from "react";
import { useToast } from "../components/Toast";
import { useApp } from "./app-state";
import type { Job } from "./types";

type JobRef = Pick<Job, "id" | "title" | "company" | "url">;

/** Save / hide with a confirmation toast and Undo, shared by every list and the detail page. */
export function useJobActions() {
  const { saved, toggleSave, restoreSaved, hideJob, unhideJob } = useApp();
  const toast = useToast();

  const save = useCallback(
    (job: JobRef) => {
      const prev = saved[job.id];
      toggleSave(job);
      if (prev) toast({ message: "Removed from saved jobs", action: { label: "Undo", onClick: () => restoreSaved(prev) } });
      else toast({ message: "Saved — find it under Saved", action: { label: "Undo", onClick: () => toggleSave(job) } });
    },
    [saved, toggleSave, restoreSaved, toast],
  );

  const hide = useCallback(
    (job: JobRef) => {
      hideJob(job);
      toast({ message: "Job hidden from your feed", action: { label: "Undo", onClick: () => unhideJob(job.id) } });
    },
    [hideJob, unhideJob, toast],
  );

  return { save, hide };
}
