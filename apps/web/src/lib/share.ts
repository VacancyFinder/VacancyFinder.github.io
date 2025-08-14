/**
 * Ready-to-send messages for WhatsApp (and anywhere else text is pasted). WhatsApp renders *bold*;
 * the link goes on its own last line so WhatsApp builds the preview card from it.
 */
import { JOB_TYPE_LABELS, SENIORITY_LABELS, WORK_MODE_LABELS } from "@rekiya/shared/constants";
import type { Job } from "./types";

/** Opens WhatsApp (app on phones, WhatsApp Web on desktop) with the message filled in. */
export const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

/** "Colombo · Kandy" → "Colombo, Kandy"; "Sri Lanka"/empty → "Sri Lanka". */
export const placeOf = (location: string) =>
  location
    .split(" · ")
    .filter((l) => l && !/^sri lanka$/i.test(l.trim()))
    .slice(0, 2)
    .join(", ") || "Sri Lanka";

export function jobShareMessage(job: Job, companyName: string, url: string): string {
  const details = [
    job.seniority !== "unspecified" && SENIORITY_LABELS[job.seniority],
    job.workMode !== "unspecified" && WORK_MODE_LABELS[job.workMode],
    job.type !== "unspecified" && JOB_TYPE_LABELS[job.type],
  ].filter(Boolean);
  return [
    `*${job.title}*`,
    `${companyName} · ${placeOf(job.location)}`,
    ...(details.length ? [details.join(" · ")] : []),
    "",
    "Found on Rekiya. Apply directly on the company's official careers page:",
    url,
  ].join("\n");
}

/** The introduction message for sharing Rekiya itself. Counts are left out when not loaded yet. */
export function siteShareMessage(url: string, stats?: { open: number; companies: number }): string {
  const count =
    stats && stats.open > 0
      ? `${stats.open.toLocaleString("en")} open jobs from ${stats.companies.toLocaleString("en")} employers`
      : "Open jobs from leading Sri Lankan employers";
  return [
    "*Rekiya: the latest job vacancies in Sri Lanka*",
    "",
    "Rekiya brings together openings from the official career pages of Sri Lankan companies, so you can search them all in one place.",
    "",
    `• ${count}`,
    "• Updated every 3 hours",
    "• Search by field, company, level or work mode",
    "• Free, with no sign-up. You apply directly with the employer",
    "",
    url,
  ].join("\n");
}
