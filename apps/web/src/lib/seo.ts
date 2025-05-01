import { useEffect } from "react";
import { absUrl, DEFAULT_SITE_URL, SITE_NAME } from "./paths";
import { ldJson } from "./structured-data";

declare const __SITE_URL__: string | undefined;

/** Canonical origin (set at build time; a custom domain needs only SITE_URL). */
export const SITE_URL: string = typeof __SITE_URL__ === "string" && __SITE_URL__ ? __SITE_URL__ : DEFAULT_SITE_URL;

export interface Seo {
  title: string;
  description?: string;
  /** Canonical path, e.g. "/jobs/software-engineering/". Omit for pages that shouldn't be indexed. */
  path?: string;
  /** Keep out of search results (personal pages, filtered views, 404s). */
  noindex?: boolean;
  jsonLd?: unknown[];
}

function meta(attr: "name" | "property", key: string, content: string | null) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (content === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function link(rel: string, href: string | null) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (href === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

/** Apply a page's <head>: title, description, canonical, robots, Open Graph/Twitter and JSON-LD. */
export function applySeo(s: Seo): void {
  const url = s.path ? absUrl(SITE_URL, s.path) : null;
  document.title = s.title;
  if (s.description) {
    meta("name", "description", s.description);
    meta("property", "og:description", s.description);
    meta("name", "twitter:description", s.description);
  }
  meta("property", "og:title", s.title);
  meta("name", "twitter:title", s.title);
  meta("name", "robots", s.noindex ? "noindex, follow" : "index, follow, max-image-preview:large, max-snippet:-1");
  link("canonical", s.noindex ? null : url);
  if (url) meta("property", "og:url", url);

  // Page-level JSON-LD (site-wide WebSite/Organization blocks stay in index.html).
  document.head.querySelectorAll("script[data-ld=page]").forEach((n) => n.remove());
  for (const block of s.jsonLd ?? []) {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.dataset.ld = "page";
    el.textContent = ldJson(block);
    document.head.appendChild(el);
  }
}

export function useSeo(s: Seo): void {
  const key = JSON.stringify(s);
  useEffect(() => {
    applySeo(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures `s`
  }, [key]);
}

/** Personal or utility pages: a title, never indexed. */
export const usePrivatePage = (title: string) => useSeo({ title: `${title} · ${SITE_NAME}`, noindex: true });
