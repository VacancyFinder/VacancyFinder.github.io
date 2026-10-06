#!/usr/bin/env node
/* global process, console, Buffer, fetch, URLSearchParams -- runs in Node 20 on GitHub Actions */
// Tell Google about job pages this sync added (URL_UPDATED) or removed (URL_DELETED) via the Indexing API.
//
// Google allows the Indexing API only for pages with JobPosting (or livestream) structured data — exactly our
// /job/... pages. Setup (one time, by the site owner):
//   1. Google Cloud: create a project, enable the "Web Search Indexing API", create a service account + JSON key.
//   2. Search Console: add the service account's e-mail as an Owner of https://vacancyfinder.github.io/.
//   3. GitHub: Settings → Secrets and variables → Actions → New secret GOOGLE_INDEXING_KEY = the JSON key.
// Without the secret this script does nothing. Default quota is 200 notifications a day for the project, so each
// run sends at most GOOGLE_INDEXING_PER_RUN (default 24 × 8 syncs a day = 192). Removals go first.
//
//   node scripts/google-indexing.mjs apps/web/.seo/google-indexing.json
import { createSign } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";

const file = process.argv[2] ?? "apps/web/.seo/google-indexing.json";
const keyJson = process.env.GOOGLE_INDEXING_KEY;
const perRun = Number(process.env.GOOGLE_INDEXING_PER_RUN || 24);

if (!keyJson) {
  console.log("GOOGLE_INDEXING_KEY is not set: skipping the Google Indexing API (see scripts/google-indexing.mjs).");
  process.exit(0);
}
if (!existsSync(file)) {
  console.log(`${file} not found: nothing to notify.`);
  process.exit(0);
}

const { updated = [], deleted = [] } = JSON.parse(readFileSync(file, "utf8"));
const queue = [...deleted.map((url) => ({ url, type: "URL_DELETED" })), ...updated.map((url) => ({ url, type: "URL_UPDATED" }))];
if (!queue.length) {
  console.log("No job pages added or removed in this sync.");
  process.exit(0);
}

const b64url = (v) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");

async function accessToken(key) {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url({ alg: "RS256", typ: "JWT" })}.${b64url({
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/indexing",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(key.private_key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
  });
  if (!res.ok) throw new Error(`token request failed: HTTP ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

const token = await accessToken(JSON.parse(keyJson));
let ok = 0;
for (const { url, type } of queue.slice(0, perRun)) {
  const res = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ url, type }),
  });
  if (res.ok) ok++;
  else {
    const body = await res.text();
    console.log(`::warning::${type} ${url}: HTTP ${res.status} ${body.slice(0, 200)}`);
    if (res.status === 429) break; // daily quota used up; the next sync continues
  }
}
const skipped = Math.max(0, queue.length - perRun);
console.log(
  `Google Indexing API: ${ok}/${Math.min(queue.length, perRun)} notified (${deleted.length} removed, ${updated.length} new)${skipped ? `, ${skipped} left for Google's normal crawl` : ""}.`,
);
