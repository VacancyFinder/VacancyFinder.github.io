/**
 * Spec quality bar: classifier accuracy ≥ 90% on a labelled set of 100 real titles.
 * Titles only (no descriptions) — stricter than production, where descriptions add signal.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { FieldSlug, Seniority } from "@rekiya/shared";
import { classifyFields } from "../src/classify/fields.js";
import { classifySeniority } from "../src/classify/seniority.js";
import { cleanTitle } from "../src/classify/text.js";

interface Labelled {
  title: string;
  fields: FieldSlug[];
  seniority: Seniority;
}
const { titles } = JSON.parse(readFileSync(resolve(__dirname, "fixtures/labelled-titles.json"), "utf8")) as { titles: Labelled[] };

describe("classifier accuracy on 100 labelled real titles", () => {
  it("has 100 labelled titles", () => expect(titles).toHaveLength(100));

  it("field accuracy ≥ 90%", () => {
    const misses = titles.filter((l) => !classifyFields(cleanTitle(l.title)).some((f) => l.fields.includes(f)));
    const accuracy = (titles.length - misses.length) / titles.length;
    if (accuracy < 0.9)
      console.log(
        "field misses:",
        misses.map((m) => `${m.title} → ${classifyFields(m.title).join(",")}`),
      );
    expect(accuracy).toBeGreaterThanOrEqual(0.9);
  });

  it("seniority accuracy ≥ 90%", () => {
    const misses = titles.filter((l) => classifySeniority(cleanTitle(l.title)) !== l.seniority);
    const accuracy = (titles.length - misses.length) / titles.length;
    if (accuracy < 0.9)
      console.log(
        "seniority misses:",
        misses.map((m) => `${m.title} → ${classifySeniority(m.title)}`),
      );
    expect(accuracy).toBeGreaterThanOrEqual(0.9);
  });
});
