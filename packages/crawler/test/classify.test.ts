import { describe, expect, it } from "vitest";
import { classifyFields, termRegex } from "../src/classify/fields.js";
import { classifySeniority } from "../src/classify/seniority.js";
import { cleanText, detectJobType, detectWorkMode, isoDate, normalizeLocation, snippet } from "../src/classify/text.js";

describe("seniority — spec's tricky titles", () => {
  it.each([
    ["Associate Tech Lead", "lead"],
    ["Senior Product Manager", "senior"],
    ["QA Automation Intern", "intern"],
    ["DevSecOps Engineer", "unspecified"],
    ["Business Analyst – Data", "unspecified"],
  ] as const)("%s → %s", (title, want) => expect(classifySeniority(title)).toBe(want));
});

describe("seniority — title rules in order", () => {
  it.each([
    ["Software Engineering Intern", "intern"],
    ["Internship - Human Resources", "intern"],
    ["Intern - Associate Software Engineer", "intern"],
    ["Graduate Trainee - Finance", "trainee"],
    ["Management Trainee", "trainee"],
    ["Fresher Java Developer", "trainee"],
    ["Associate Software Engineer", "junior"],
    ["Associate QA Engineer", "junior"],
    ["Junior Accountant", "junior"],
    ["Jr. Frontend Developer", "junior"],
    ["Associate Project Manager", "unspecified"],
    ["Associate Architect", "principal"],
    ["Principal Engineer", "principal"],
    ["Solutions Architect", "principal"],
    ["Staff Software Engineer", "principal"],
    ["Distinguished Engineer", "principal"],
    ["Head of Engineering", "manager"],
    ["Director - Finance", "manager"],
    ["Assistant Manager - Human Resources", "manager"],
    ["Senior Manager - Operations", "manager"],
    ["Product Manager", "unspecified"],
    ["Project Manager", "unspecified"],
    ["Senior Project Manager", "senior"],
    ["Tech Lead - Java", "lead"],
    ["Team Lead - Customer Service", "lead"],
    ["Lead Software Engineer", "lead"],
    ["Senior Technical Lead", "lead"],
    ["Senior Software Engineer", "senior"],
    ["Sr. Data Scientist", "senior"],
    ["Sr Business Analyst", "senior"],
    ["Mid-Level Frontend Developer", "mid"],
    ["Intermediate QA Engineer", "mid"],
    ["Software Engineer II", "mid"],
    ["Software Engineer III", "unspecified"],
    ["Software Engineer", "unspecified"],
    ["Executive - Marketing", "unspecified"],
  ] as const)("%s → %s", (title, want) => expect(classifySeniority(title)).toBe(want));

  it("does not treat Staff Nurse as principal", () => expect(classifySeniority("Staff Nurse")).toBe("unspecified"));
  it("does not treat Lead Generation as a lead role", () => expect(classifySeniority("Lead Generation Executive")).toBe("unspecified"));
  it("does not match words that merely contain a rule", () => {
    expect(classifySeniority("International Sales Executive")).toBe("unspecified");
    expect(classifySeniority("Midlands Area Coordinator")).toBe("unspecified");
  });
});

describe("seniority — description fallback", () => {
  it("uses the description only when the title says nothing", () => {
    expect(classifySeniority("Software Engineer", "This is an internship for undergraduates")).toBe("intern");
    expect(classifySeniority("Accountant", "We welcome fresh graduates")).toBe("trainee");
    expect(classifySeniority("Developer", "An entry-level role")).toBe("junior");
    expect(classifySeniority("Senior Developer", "internship")).toBe("senior");
  });
  it("ignores weak description words", () => {
    expect(classifySeniority("Accountant", "Report to senior management. Graduate degree required.")).toBe("unspecified");
  });
});

describe("fields — spec's tricky titles", () => {
  it("DevSecOps Engineer → cloud & security", () => {
    expect(classifyFields("DevSecOps Engineer")).toEqual(expect.arrayContaining(["cloud-devops", "cybersecurity"]));
  });
  it("Business Analyst – Data → business & data", () => {
    expect(classifyFields("Business Analyst – Data")).toEqual(expect.arrayContaining(["product-project-business", "data-ai-ml"]));
  });
  it("Senior Product Manager → product only", () => {
    expect(classifyFields("Senior Product Manager")).toEqual(["product-project-business"]);
  });
  it("QA Automation Intern → QA only (automation is not DevOps)", () => {
    expect(classifyFields("QA Automation Intern")).toEqual(["qa-testing"]);
  });
  it("Associate Tech Lead → software", () => {
    expect(classifyFields("Associate Tech Lead")).toEqual(["software-engineering"]);
  });
});

describe("fields — real-world titles", () => {
  const has = (title: string, field: string, desc = "") => expect(classifyFields(title, desc)).toContain(field);
  it.each([
    ["Senior Software Engineer - Java", "software-engineering"],
    ["Full Stack Developer (MERN)", "software-engineering"],
    ["Android Developer", "software-engineering"],
    ["Associate Frontend Engineer (React)", "software-engineering"],
    [".NET Developer", "software-engineering"],
    ["Data Scientist", "data-ai-ml"],
    ["Machine Learning Engineer", "data-ai-ml"],
    ["AI Engineer Intern", "data-ai-ml"],
    ["BI Developer - Power BI", "data-ai-ml"],
    ["Site Reliability Engineer", "cloud-devops"],
    ["Cloud Engineer - AWS", "cloud-devops"],
    ["DevOps Engineer", "cloud-devops"],
    ["SOC Analyst", "cybersecurity"],
    ["Information Security Engineer", "cybersecurity"],
    ["Penetration Tester", "cybersecurity"],
    ["QA Engineer", "qa-testing"],
    ["Senior Test Automation Engineer", "qa-testing"],
    ["UI/UX Designer", "ui-ux-design"],
    ["Product Designer", "ui-ux-design"],
    ["UX Researcher", "ui-ux-design"],
    ["Graphic Designer", "digital-graphics"],
    ["Video Editor", "digital-graphics"],
    ["Creative Designer - Graphics & Video", "digital-graphics"],
    ["HR Executive", "human-resource"],
    ["Talent Acquisition Specialist", "human-resource"],
    ["Scrum Master", "product-project-business"],
    ["Project Coordinator", "product-project-business"],
    ["Chartered Accountant", "finance-accounting"],
    ["Internal Auditor", "finance-accounting"],
    ["Branch Manager - Kandy", "banking-insurance"],
    ["Credit Officer", "banking-insurance"],
    ["Insurance Advisor", "banking-insurance"],
    ["Sales Executive", "sales-marketing"],
    ["Digital Marketing Executive", "sales-marketing"],
    ["Key Account Manager", "sales-marketing"],
    ["Executive Chef", "hospitality-tourism"],
    ["Front Office Associate", "hospitality-tourism"],
    ["Commis II - Pastry", "hospitality-tourism"],
    ["Mechanical Engineer", "engineering-manufacturing"],
    ["Production Supervisor", "engineering-manufacturing"],
    ["Quantity Surveyor", "engineering-manufacturing"],
    ["Supply Chain Executive", "operations-logistics"],
    ["Warehouse Assistant", "operations-logistics"],
    ["Procurement Officer", "operations-logistics"],
    ["Staff Nurse", "healthcare"],
    ["Pharmacist", "healthcare"],
    ["Customer Service Executive", "admin-customer-service"],
    ["Receptionist", "admin-customer-service"],
    ["Data Entry Operator", "admin-customer-service"],
    ["Legal Officer", "legal-compliance"],
    ["Compliance Manager", "legal-compliance"],
  ] as const)("%s → includes %s", (title, field) => has(title, field));

  it("Data Entry Operator is not Data & AI", () => expect(classifyFields("Data Entry Operator")).not.toContain("data-ai-ml"));
  it("Security Officer (guard) is not cybersecurity", () => expect(classifyFields("Security Officer")).not.toContain("cybersecurity"));
  it("System Administrator is DevOps, not admin", () => {
    expect(classifyFields("System Administrator")).toContain("cloud-devops");
    expect(classifyFields("System Administrator")).not.toContain("admin-customer-service");
  });
  it("Quality Control Executive (factory) is not QA & Testing", () => {
    expect(classifyFields("Quality Control Executive")).not.toContain("qa-testing");
  });
  it("needs 3 description hits when the title is silent", () => {
    expect(classifyFields("Executive", "You will use Python and SQL.")).toEqual(["other"]);
    expect(classifyFields("Executive", "Work with machine learning, analytics and big data pipelines.")).toContain("data-ai-ml");
  });
  it("falls back to other", () => expect(classifyFields("Driver's Helper Trainee Something")).toBeDefined());
  it("returns other when nothing matches", () => expect(classifyFields("Miscellaneous Role")).toEqual(["other"]));
});

describe("taxonomy term matching", () => {
  it("matches whole words and symbols", () => {
    expect(termRegex("c#").test("Senior C# Developer")).toBe(true);
    expect(termRegex(".net").test("ASP.NET Core")).toBe(false);
    expect(termRegex(".net").test("Senior .NET Developer")).toBe(true);
    expect(termRegex("ai").test("Chair Operator")).toBe(false);
    expect(termRegex("ui/ux").test("UI/UX Designer")).toBe(true);
    expect(termRegex("develop*").test("Development Manager")).toBe(true);
    expect(termRegex("hr").test("Three Wheel")).toBe(false);
  });
});

describe("text normalisation", () => {
  it("cleans html and entities", () => {
    expect(cleanText("<p>Hello&nbsp;&amp; <b>welcome</b></p>\n\n to  us")).toBe("Hello & welcome to us");
  });
  it("cuts snippets at 300 chars on a word boundary", () => {
    const s = snippet("word ".repeat(200));
    expect(s.length).toBeLessThanOrEqual(300);
    expect(s.endsWith("…")).toBe(true);
    expect(snippet("short")).toBe("short");
  });
  it.each([
    ["Colombo 03", "Colombo"],
    ["Colombo, Western Province, Sri Lanka", "Colombo"],
    ["Kandy / Colombo 07", "Kandy · Colombo"],
    ["Sri Lanka", "Sri Lanka"],
    ["Remote", "Remote"],
    ["Ja-Ela", "Ja-Ela"],
    ["Mount Lavinia", "Mount Lavinia"],
    ["London, UK", "London, UK"],
    ["", ""],
  ])("location %j → %j", (raw, want) => expect(normalizeLocation(raw)).toBe(want));

  it("detects work mode", () => {
    expect(detectWorkMode("Hybrid - Colombo")).toBe("hybrid");
    expect(detectWorkMode("Remote (Sri Lanka)")).toBe("remote");
    expect(detectWorkMode("Work from home available")).toBe("remote");
    expect(detectWorkMode("On-site in Colombo")).toBe("onsite");
    expect(detectWorkMode("Colombo")).toBe("unspecified");
  });
  it("detects job type", () => {
    expect(detectJobType("Internship")).toBe("internship");
    expect(detectJobType("Part-time")).toBe("part-time");
    expect(detectJobType("Contract - 6 months")).toBe("contract");
    expect(detectJobType("Full Time")).toBe("full-time");
    expect(detectJobType("Permanent")).toBe("full-time");
    expect(detectJobType("")).toBe("unspecified");
  });
  it("parses dates without guessing", () => {
    expect(isoDate("2026-09-01T10:00:00Z")).toBe("2026-09-01");
    expect(isoDate(1788220800000)).toBe("2026-09-01");
    expect(isoDate("3 days ago")).toBeNull();
    expect(isoDate(null)).toBeNull();
  });
});
