import type { Seniority } from "@rekiya/shared";

type Rule = [Seniority, RegExp];

/**
 * Title rules, in spec order; the first match wins.
 * Deviations from the spec, each covered by tests:
 *  - "staff" counts as principal only in engineering/science titles ("Staff Nurse" is not principal).
 *  - "lead generation" is not a lead role.
 */
const TITLE_RULES: Rule[] = [
  ["intern", /\bintern(?:ship)?s?\b/i],
  ["trainee", /\b(?:trainees?|graduates?|freshers?)\b/i],
  // "associate" only when no lead/manager/architect follows it in the title.
  ["junior", /\bassociate\b(?!.*\b(?:lead|manager|architect)\b)|\bjunior\b|\bjr\b\.?/i],
  [
    "principal",
    /\bprincipal\b|\bdistinguished\b|\barchitect\b|\bstaff\s+(?:(?:software|data|ml|machine learning|site reliability|security|backend|back-end|frontend|front-end|full[- ]?stack|platform|devops|qa|test|mobile|cloud)\s+)?(?:engineer|scientist|developer)\b/i,
  ],
  ["manager", /\bhead\s+of\b|\bdirector\b|\b(?<!product\s)(?<!project\s)manager\b/i],
  ["lead", /\b(?:team|tech|technical)\s+lead\b|\blead\b(?!\s+generation)/i],
  ["senior", /\bsenior\b|\bsr\b\.?/i],
  ["mid", /\bmid(?:[- ]level|[- ]senior)?\b|\bintermediate\b|\bengineer\s+ii\b(?!i)/i],
];

/** Descriptions are noisy ("graduate degree", "senior management"), so only strong phrases count. */
const DESCRIPTION_RULES: Rule[] = [
  ["intern", /\b(?:internship|intern\s+(?:position|role|programme|program))\b/i],
  ["trainee", /\b(?:trainee\s+(?:position|role|programme|program)|fresh\s+graduates?|graduate\s+(?:trainee|programme|program))\b/i],
  ["junior", /\bjunior[- ]level\b|\bentry[- ]level\b/i],
];

function firstMatch(rules: Rule[], text: string): Seniority | null {
  for (const [level, re] of rules) if (re.test(text)) return level;
  return null;
}

export function classifySeniority(title: string, description = ""): Seniority {
  return firstMatch(TITLE_RULES, title) ?? firstMatch(DESCRIPTION_RULES, description) ?? "unspecified";
}
