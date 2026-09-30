/**
 * Link-preview images (Open Graph) for WhatsApp, Facebook, LinkedIn, X, Slack and Telegram: one branded
 * 1200×630 PNG per shared page, rendered at build time (satori → SVG, resvg → PNG; no browser needed).
 * Kept well under WhatsApp's ~300 KB preview limit.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const font = (w: number) => readFileSync(require.resolve(`@fontsource/inter/files/inter-latin-${w}-normal.woff`));
const FONTS = [400, 600, 700, 800].map((weight) => ({
  name: "Inter",
  data: font(weight),
  weight: weight as 400 | 600 | 700 | 800,
  style: "normal" as const,
}));
const LOGO = `data:image/svg+xml;base64,${readFileSync(resolve(HERE, "../public/favicon.svg")).toString("base64")}`;

const BRAND = "#123760";
const AMBER = "#fbbf24";
const INK_SOFT = "#d9e5f4";

// Minimal element builder for satori (no JSX in the build).
type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, ...children: (Node | string | null | false)[]): Node => ({
  type,
  props: { style: { display: "flex", ...style }, children: children.filter((c) => c !== null && c !== false) },
});
const img = (src: string, size: number, style: Record<string, unknown> = {}): Node => ({
  type: "img",
  props: { src, width: size, height: size, style },
});

export interface OgCard {
  /** Small amber line above the title. */
  eyebrow: string;
  title: string;
  /** Line under the title (company · location, or a count). */
  subtitle?: string;
  /** Up to 4 pill labels (level, work mode, type…). */
  chips?: string[];
  /** Company badge: initials on a colour derived from the company slug. */
  badge?: { text: string; hue: number };
  /** Big numbers along the bottom (home page). */
  stats?: [string, string][];
  /** Site host shown bottom-right. */
  host: string;
  /** Narrow the title box to control line breaks (px). */
  titleWidth?: number;
}

/** Title size steps down for long titles so they never overflow (max 3 lines). */
const titleSize = (t: string, narrow: boolean) =>
  t.length > 70 ? (narrow ? 48 : 54) : t.length > 45 ? (narrow ? 56 : 62) : t.length > 28 ? 72 : 84;
const clamp = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

function card(c: OgCard): Node {
  const chip = (label: string) =>
    h(
      "div",
      {
        padding: "10px 22px",
        borderRadius: 999,
        border: "2px solid rgba(255,255,255,0.28)",
        background: "rgba(255,255,255,0.08)",
        fontSize: 26,
        fontWeight: 600,
        color: "#ffffff",
      },
      label,
    );
  return h(
    "div",
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      flexDirection: "column",
      padding: "56px 72px",
      fontFamily: "Inter",
      color: "#ffffff",
      backgroundColor: BRAND,
      position: "relative",
      overflow: "hidden",
    },
    // Decorative solid shapes (flat colours keep the PNG small — WhatsApp drops previews over ~300 KB).
    h("div", { position: "absolute", top: -260, right: -200, width: 640, height: 640, borderRadius: 999, backgroundColor: "#1c4274" }),
    h("div", { position: "absolute", top: -120, right: -60, width: 300, height: 300, borderRadius: 999, backgroundColor: "#254f8c" }),
    h("div", { position: "absolute", bottom: -220, left: -160, width: 460, height: 460, borderRadius: 999, backgroundColor: "#16406f" }),
    h("div", { position: "absolute", left: 0, top: 0, bottom: 0, width: 12, backgroundColor: AMBER }),
    // Brand row
    h(
      "div",
      { alignItems: "center", justifyContent: "space-between", width: "100%" },
      h(
        "div",
        { alignItems: "center", gap: 16 },
        img(LOGO, 56, { borderRadius: 14 }),
        h("div", { fontSize: 36, fontWeight: 800, letterSpacing: -0.5 }, "Rekiya"),
      ),
      h("div", { fontSize: 24, fontWeight: 600, color: INK_SOFT }, "Jobs in Sri Lanka"),
    ),
    // Main block
    h(
      "div",
      { flexDirection: "column", marginTop: 48, flexGrow: 1 },
      h("div", { fontSize: 24, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: AMBER }, clamp(c.eyebrow, 60)),
      h(
        "div",
        { alignItems: "center", gap: 28, marginTop: 16 },
        c.badge
          ? h(
              "div",
              {
                width: 112,
                height: 112,
                flexShrink: 0,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 24,
                fontSize: 46,
                fontWeight: 800,
                backgroundColor: `hsl(${c.badge.hue}, 55%, 92%)`,
                color: `hsl(${c.badge.hue}, 60%, 25%)`,
              },
              c.badge.text,
            )
          : null,
        h(
          "div",
          {
            fontSize: titleSize(c.title, !!c.badge),
            fontWeight: 800,
            lineHeight: 1.06,
            letterSpacing: -2,
            maxWidth: c.titleWidth ?? (c.badge ? 900 : 1050),
          },
          clamp(c.title, 95),
        ),
      ),
      c.subtitle ? h("div", { marginTop: 22, fontSize: 32, fontWeight: 600, color: INK_SOFT }, clamp(c.subtitle, 70)) : null,
      c.chips?.length ? h("div", { marginTop: 26, gap: 14, flexWrap: "wrap" }, ...c.chips.slice(0, 4).map(chip)) : null,
      c.stats?.length
        ? h(
            "div",
            { marginTop: 34, gap: 20 },
            ...c.stats.map(([v, l]) =>
              h(
                "div",
                { flexDirection: "column", padding: "16px 26px", borderRadius: 18, background: "rgba(255,255,255,0.10)" },
                h("div", { fontSize: 44, fontWeight: 800 }, v),
                h("div", { fontSize: 22, fontWeight: 600, color: INK_SOFT }, l),
              ),
            ),
          )
        : null,
    ),
    // Footer
    h(
      "div",
      {
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        marginTop: 20,
        flexShrink: 0,
        fontSize: 24,
        fontWeight: 600,
        color: INK_SOFT,
      },
      h("div", {}, "Straight from employers' career pages · updated every 3 hours"),
      h("div", { color: "#ffffff" }, c.host),
    ),
  );
}

/** Render one preview card to PNG bytes. */
export async function renderOgPng(c: OgCard): Promise<Buffer> {
  const svg = await satori(card(c) as unknown as Parameters<typeof satori>[0], { width: OG_WIDTH, height: OG_HEIGHT, fonts: FONTS });
  return new Resvg(svg, { fitTo: { mode: "width", value: OG_WIDTH } }).render().asPng();
}
