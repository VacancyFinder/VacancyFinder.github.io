import { useEffect } from "react";

export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = title ? `${title} · Rekiya` : "Rekiya — Sri Lanka jobs from company career pages";
  }, [title]);
}
