import * as cheerio from "cheerio";
import { readFileSync, existsSync } from "node:fs";
const ids = process.argv.slice(2);
for (const id of ids) {
  const f = existsSync(`pages/${id}.rendered.html`) && process.env.R ? `pages/${id}.rendered.html` : `pages/${id}.html`;
  if (!existsSync(f)) { console.log(`\n## ${id}: no file`); continue; }
  const $ = cheerio.load(readFileSync(f, "utf8"));
  const seen = new Set(); const out = [];
  $("a[href]").each((_, a) => {
    const h = $(a).attr("href"); const t = $(a).text().replace(/\s+/g, " ").trim();
    if (!h || seen.has(h) || h.startsWith("#") || h.startsWith("mailto") || h.startsWith("tel")) return;
    if (/facebook|twitter|linkedin\.com\/company|instagram|youtube|privacy|cookie|contact|about|news|investor|sustainab|login/i.test(h)) return;
    seen.add(h); out.push(`${t.slice(0,60).padEnd(60)} ${h.slice(0,110)}`);
  });
  const hs = $("h1,h2,h3,h4").map((_, e) => $(e).text().replace(/\s+/g," ").trim()).get().filter(Boolean).slice(0,25);
  console.log(`\n## ${id} (${f})\nHEADINGS: ${hs.join(" | ").slice(0,700)}\n` + out.filter(l=>/career|job|vacanc|position|apply|opening|role|pdf|recruit/i.test(l)).slice(0,25).join("\n"));
}
