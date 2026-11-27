export type LeadStageId =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "converted"
  | "lost";

export type LeadQuickFilter = "all" | "hot" | "overdue" | "unassigned" | "suspicious" | "unconverted";
export type LeadSortBy = "newest" | "score" | "value" | "followup";

export interface LeadRecordLike {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string;
  status: string;
  assigned_to: string | null;
  notes: string | null;
  converted_customer_id: string | null;
  created_at: string;
  score: number | null;
  next_follow_up: string | null;
  expected_value: number | null;
  pipeline_stage: string | null;
  lost_reason: string | null;
}

export interface ParsedLeadNotes {
  topic: string | null;
  city: string | null;
  summary: string | null;
  followUpNotes: string[];
}

export interface SuspiciousLeadCheck {
  suspicious: boolean;
  reasons: string[];
}

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "tempmail.com",
  "guerrillamail.com",
  "yopmail.com",
  "sharklasers.com",
  "10minutemail.com",
  "trashmail.com",
  "throwawaymail.com",
  "dispostable.com",
]);

const TEST_NAME_TOKENS = new Set([
  "test",
  "testing",
  "tester",
  "asdf",
  "qwer",
  "qwerty",
  "zxcv",
  "fake",
  "spam",
  "bot",
  "demo",
  "xyz",
  "abc",
  "na",
  "none",
  "null",
]);

const SOURCE_WEIGHTS: Record<string, number> = {
  referral: 45,
  website: 35,
  walkin: 35,
  whatsapp: 35,
  social: 25,
  ads: 25,
  cold_call: 20,
};

function stripHeaderPrefix(block: string): {
  topic: string | null;
  city: string | null;
  body: string | null;
} {
  let topic: string | null = null;
  let city: string | null = null;
  const remaining: string[] = [];

  for (const rawLine of block.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      if (remaining.length > 0) remaining.push("");
      continue;
    }
    const topicMatch = line.match(/^topic\s*:\s*(.+)$/i);
    if (topicMatch && !topic) {
      topic = topicMatch[1].trim() || null;
      continue;
    }
    const cityMatch = line.match(/^city\s*:\s*(.+)$/i);
    if (cityMatch && !city) {
      city = cityMatch[1].trim() || null;
      continue;
    }
    remaining.push(line);
  }

  const body = remaining.join("\n").replace(/\n{3,}/g, "\n\n").trim() || null;
  return { topic, city, body };
}

/** Parses structured `Topic:` / `City:` metadata and follow-up blocks stored inside `leads.notes`. */
export function parseLeadNotes(notes?: string | null): ParsedLeadNotes {
  const raw = String(notes ?? "").trim();
  if (!raw) return { topic: null, city: null, summary: null, followUpNotes: [] };

  const segments = raw.split(/\r?\n*--- Follow-up note ---\r?\n*/i);
  const first = stripHeaderPrefix(segments[0] ?? "");
  let topic = first.topic;
  let city = first.city;
  const followUpNotes: string[] = [];

  for (let i = 1; i < segments.length; i++) {
    const parsedFollow = stripHeaderPrefix(segments[i]);
    if (!topic && parsedFollow.topic) topic = parsedFollow.topic;
    if (!city && parsedFollow.city) city = parsedFollow.city;
    const text = parsedFollow.body || segments[i].trim();
    if (text) followUpNotes.push(text);
  }

  return {
    topic,
    city,
    summary: first.body,
    followUpNotes,
  };
}

/** Flags probable bot/test/spam submissions for one-click admin triage without hiding them by default. */
export function detectSuspiciousLead(lead: {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  source?: string | null;
}): SuspiciousLeadCheck {
  const reasons: string[] = [];
  const name = String(lead.name ?? "").trim();
  const phoneDigits = String(lead.phone ?? "").replace(/\D/g, "");
  const email = String(lead.email ?? "").trim().toLowerCase();
  const notes = String(lead.notes ?? "").trim();

  if (name.length < 2) {
    reasons.push("Short name");
  } else {
    if (/https?:\/\/|www\./i.test(name)) reasons.push("URL in name");
    const tokens = name.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.some((t) => TEST_NAME_TOKENS.has(t))) {
      reasons.push("Test/dummy name");
    } else if (/([a-z])\1{3,}/i.test(name)) {
      reasons.push("Repeated letters in name");
    }
  }

  if (phoneDigits.length > 0) {
    if (phoneDigits.length < 8) {
      reasons.push("Incomplete phone");
    } else if (/^(\d)\1{6,}$/.test(phoneDigits.slice(-10)) || ["1234567890", "0123456789", "9876543210"].includes(phoneDigits.slice(-10))) {
      reasons.push("Dummy phone sequence");
    }
  }

  if (email) {
    const domain = email.split("@")[1] || "";
    if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
      reasons.push("Disposable email");
    }
  }

  if (notes && (lead.source === "website" || lead.source === "social")) {
    if (/(https?:\/\/|t\.me\/|wa\.me\/|bit\.ly\/)/i.test(notes)) {
      reasons.push("Link inside message");
    }
  }

  return { suspicious: reasons.length > 0, reasons };
}

/** Dynamic 5-100 lead quality & engagement score blending channel, contact reachability, value, and activities. */
export function computeLeadScore(
  lead: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    source?: string | null;
    notes?: string | null;
    expected_value?: number | string | null;
  },
  activityCount = 0
): number {
  const base = SOURCE_WEIGHTS[String(lead.source ?? "").toLowerCase()] ?? 20;
  const phoneDigits = String(lead.phone ?? "").replace(/\D/g, "");
  const email = String(lead.email ?? "").trim();
  const parsed = parseLeadNotes(lead.notes);

  let score = base;
  if (phoneDigits.length >= 10) score += 15;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) score += 10;
  if (parsed.topic || parsed.summary) score += 10;
  if (Number(lead.expected_value ?? 0) > 0) score += 10;
  score += Math.min(15, Math.max(0, activityCount) * 5);
  if (detectSuspiciousLead(lead).suspicious) score -= 25;

  return Math.max(5, Math.min(100, Math.round(score)));
}

function toIstDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function getFollowUpStatus(
  lead: { next_follow_up?: string | null; pipeline_stage?: string | null },
  now = new Date()
): "overdue" | "due_today" | "upcoming" | "none" {
  const stage = String(lead.pipeline_stage || "new").toLowerCase();
  if (stage === "converted" || stage === "lost" || !lead.next_follow_up) return "none";
  const ts = Date.parse(lead.next_follow_up);
  if (!Number.isFinite(ts)) return "none";
  if (ts < now.getTime()) return "overdue";
  if (toIstDateKey(new Date(ts)) === toIstDateKey(now)) return "due_today";
  return "upcoming";
}

export function formatLeadAge(createdAt: string, now = new Date()): string {
  const ts = Date.parse(createdAt);
  if (!Number.isFinite(ts)) return "—";
  const diffMin = Math.max(0, Math.floor((now.getTime() - ts) / 60000));
  if (diffMin < 15) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays <= 14) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
  }).format(new Date(ts));
}

export function getLeadInitials(name?: string | null): string {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function buildWhatsAppLink(phone?: string | null, name?: string | null): string | null {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const intl = digits.length === 10 ? `91${digits}` : digits;
  const firstName = String(name ?? "").trim().split(/\s+/)[0] || "there";
  const text = encodeURIComponent(`Hi ${firstName}, regarding your enquiry with ALVStore.`);
  return `https://wa.me/${intl}?text=${text}`;
}

export function buildCallLink(phone?: string | null): string | null {
  const trimmed = String(phone ?? "").trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return `tel:${trimmed.startsWith("+") ? "+" : ""}${digits}`;
}

export function buildMailLink(email?: string | null, topic?: string | null): string | null {
  const clean = String(email ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return null;
  const subject = encodeURIComponent(topic ? `${topic}` : "ALVStore Enquiry");
  return `mailto:${clean}?subject=${subject}`;
}

export function filterAndSortLeads<T extends LeadRecordLike>(
  leads: T[],
  opts: {
    search?: string;
    stageFilter?: string;
    sourceFilter?: string;
    assigneeFilter?: string;
    quickFilter?: LeadQuickFilter;
    sortBy?: LeadSortBy;
  },
  activityCounts: Record<string, number> = {},
  now = new Date()
): T[] {
  const q = String(opts.search ?? "").trim().toLowerCase();
  const stage = opts.stageFilter || "all";
  const source = opts.sourceFilter || "all";
  const assignee = opts.assigneeFilter || "all";
  const quick = opts.quickFilter || "all";
  const sortBy = opts.sortBy || "newest";

  const filtered = leads.filter((l) => {
    const lStage = l.pipeline_stage || "new";
    if (stage !== "all" && lStage !== stage) return false;
    if (source !== "all" && (l.source || "") !== source) return false;
    if (assignee === "__unassigned__" && l.assigned_to) return false;
    if (assignee !== "all" && assignee !== "__unassigned__" && l.assigned_to !== assignee) return false;

    const dynScore = Math.max(Number(l.score ?? 0), computeLeadScore(l, activityCounts[l.id] || 0));
    if (quick === "hot" && dynScore < 70) return false;
    if (quick === "overdue" && getFollowUpStatus(l, now) !== "overdue") return false;
    if (quick === "unassigned" && Boolean(l.assigned_to)) return false;
    if (quick === "suspicious" && !detectSuspiciousLead(l).suspicious) return false;
    if (quick === "unconverted" && (lStage === "converted" || lStage === "lost")) return false;

    if (q) {
      const parsed = parseLeadNotes(l.notes);
      const haystack = [
        l.name,
        l.phone,
        l.email,
        l.source,
        parsed.topic,
        parsed.city,
        parsed.summary,
        ...parsed.followUpNotes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });

  return [...filtered].sort((a, b) => {
    if (sortBy === "score") {
      const sa = Math.max(Number(a.score ?? 0), computeLeadScore(a, activityCounts[a.id] || 0));
      const sb = Math.max(Number(b.score ?? 0), computeLeadScore(b, activityCounts[b.id] || 0));
      return sb - sa;
    }
    if (sortBy === "value") {
      return Number(b.expected_value ?? 0) - Number(a.expected_value ?? 0);
    }
    if (sortBy === "followup") {
      const fa = a.next_follow_up ? Date.parse(a.next_follow_up) : Number.POSITIVE_INFINITY;
      const fb = b.next_follow_up ? Date.parse(b.next_follow_up) : Number.POSITIVE_INFINITY;
      return fa - fb;
    }
    return Date.parse(b.created_at || "") - Date.parse(a.created_at || "");
  });
}
