import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { root } from "../tools/check-ui.mjs";

async function importTs(file) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const {
  buildCallLink,
  buildMailLink,
  buildWhatsAppLink,
  computeLeadScore,
  detectSuspiciousLead,
  filterAndSortLeads,
  formatLeadAge,
  getFollowUpStatus,
  getLeadInitials,
  parseLeadNotes,
} = await importTs("src/lib/leads-utils.ts");

test("parseLeadNotes extracts Topic, City, clean summary, and appended follow-up sections", () => {
  const parsed = parseLeadNotes(
    "Topic: Home Theater\nCity: Udaipur\n\nLooking for 7.2.4 Dolby Atmos acoustic setup.\n\n--- Follow-up note ---\nTopic: Demo Booking\n\nConfirmed Saturday visit"
  );
  assert.equal(parsed.topic, "Home Theater");
  assert.equal(parsed.city, "Udaipur");
  assert.equal(parsed.summary, "Looking for 7.2.4 Dolby Atmos acoustic setup.");
  assert.equal(parsed.followUpNotes.length, 1);
  assert.match(parsed.followUpNotes[0], /Confirmed Saturday visit/);

  const plain = parseLeadNotes("Walk-in enquiry for acoustic curtains.");
  assert.equal(plain.topic, null);
  assert.equal(plain.city, null);
  assert.equal(plain.summary, "Walk-in enquiry for acoustic curtains.");
  assert.deepEqual(plain.followUpNotes, []);
});

test("detectSuspiciousLead catches fake bots while keeping legitimate ALVStore leads clean", () => {
  const legit = detectSuspiciousLead({
    name: "Rajat",
    phone: "9887601200",
    email: "rajat@alvstore.in",
    source: "website",
    notes: "Topic: Cinema Room\nCity: Jodhpur\n\nInterested in projector pricing.",
  });
  assert.equal(legit.suspicious, false);
  assert.deepEqual(legit.reasons, []);

  const bot = detectSuspiciousLead({
    name: "asdf test",
    phone: "9999999999",
    email: "bot@mailinator.com",
    source: "website",
    notes: "Cheap SEO traffic https://spam.example.com",
  });
  assert.equal(bot.suspicious, true);
  assert.ok(bot.reasons.length >= 3);
});

test("computeLeadScore blends source, contact completeness, value, activity engagement, and bot penalty", () => {
  const richScore = computeLeadScore(
    {
      name: "Aarav Mehta",
      phone: "+91 98876 01200",
      email: "aarav@example.com",
      source: "referral",
      notes: "Topic: Home Cinema\n\n20x14 dedicated room",
      expected_value: 850000,
    },
    3
  );
  assert.equal(richScore, 100);

  const botScore = computeLeadScore(
    {
      name: "test bot",
      phone: "1234567890",
      email: "x@tempmail.com",
      source: "website",
      notes: "",
      expected_value: 0,
    },
    0
  );
  assert.ok(botScore <= 35);
  assert.ok(botScore >= 5);
});

test("getFollowUpStatus, formatLeadAge, initials, and contact links handle real CRM formats", () => {
  const now = new Date("2026-11-27T12:00:00+05:30");
  assert.equal(getFollowUpStatus({ next_follow_up: "2026-11-27T09:00:00+05:30", pipeline_stage: "qualified" }, now), "overdue");
  assert.equal(getFollowUpStatus({ next_follow_up: "2026-11-27T18:00:00+05:30", pipeline_stage: "qualified" }, now), "due_today");
  assert.equal(getFollowUpStatus({ next_follow_up: "2026-11-29T11:00:00+05:30", pipeline_stage: "qualified" }, now), "upcoming");
  assert.equal(getFollowUpStatus({ next_follow_up: "2026-11-20T09:00:00+05:30", pipeline_stage: "converted" }, now), "none");

  assert.equal(formatLeadAge("2026-11-27T10:00:00+05:30", now), "2h ago");
  assert.equal(formatLeadAge("2026-11-24T12:00:00+05:30", now), "3d ago");
  assert.equal(getLeadInitials("Rajat Lekhari"), "RL");
  assert.equal(getLeadInitials("Rajat"), "R");

  assert.equal(buildWhatsAppLink("9887601200", "Rajat"), "https://wa.me/919887601200?text=Hi%20Rajat%2C%20regarding%20your%20enquiry%20with%20ALVStore.");
  assert.equal(buildWhatsAppLink("123", "Bad"), null);
  assert.equal(buildCallLink("+91 98876 01200"), "tel:+919887601200");
  assert.equal(buildMailLink("sales@alvstore.in", "Home Cinema"), "mailto:sales@alvstore.in?subject=Home%20Cinema");
});

test("filterAndSortLeads searches parsed topic/city and sorts deterministically", () => {
  const now = new Date("2026-11-27T12:00:00+05:30");
  const sample = [
    {
      id: "1",
      name: "Rajat",
      phone: "9887601200",
      email: "rajat@example.com",
      source: "website",
      status: "new",
      assigned_to: null,
      notes: "Topic: Private Cinema\nCity: Udaipur\n\nBudget 12L",
      converted_customer_id: null,
      created_at: "2026-11-27T08:00:00+05:30",
      score: 70,
      next_follow_up: null,
      expected_value: 1200000,
      pipeline_stage: "new",
      lost_reason: null,
    },
    {
      id: "2",
      name: "asdf",
      phone: "9999999999",
      email: "spam@mailinator.com",
      source: "website",
      status: "new",
      assigned_to: "staff-1",
      notes: "",
      converted_customer_id: null,
      created_at: "2026-11-27T10:00:00+05:30",
      score: 10,
      next_follow_up: "2026-11-26T10:00:00+05:30",
      expected_value: 0,
      pipeline_stage: "contacted",
      lost_reason: null,
    },
  ];

  const byCity = filterAndSortLeads(sample, { search: "udaipur" }, {}, now);
  assert.deepEqual(byCity.map((l) => l.id), ["1"]);

  const suspiciousOnly = filterAndSortLeads(sample, { quickFilter: "suspicious" }, {}, now);
  assert.deepEqual(suspiciousOnly.map((l) => l.id), ["2"]);

  const byValue = filterAndSortLeads(sample, { sortBy: "value" }, {}, now);
  assert.deepEqual(byValue.map((l) => l.id), ["1", "2"]);
});
