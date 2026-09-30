import { useMemo } from "react";
import { useApp } from "../lib/app-state";
import { useData } from "../lib/data";
import type { Job } from "../lib/types";
import { useJobActions } from "../lib/useJobActions";
import { JobCard } from "./JobCard";

/** Job cards wired to the user's saved / viewed / hidden state. */
export function JobList({ jobs, allowHide = true, className = "" }: { jobs: Job[]; allowHide?: boolean; className?: string }) {
  const { saved, isNew, recent } = useApp();
  const { employer } = useData();
  const { save, hide } = useJobActions();
  const viewed = useMemo(() => new Set(recent.map((r) => r.id)), [recent]);
  return (
    <ul className={`grid grid-cols-1 gap-3 ${className}`}>
      {jobs.map((j) => (
        <li key={j.id}>
          <JobCard
            job={j}
            employer={employer(j.company)}
            isNew={isNew(j)}
            saved={!!saved[j.id]}
            status={saved[j.id]?.status}
            viewed={viewed.has(j.id)}
            onToggleSave={save}
            onHide={allowHide ? hide : undefined}
          />
        </li>
      ))}
    </ul>
  );
}
