/**
 * Triage engine shared by the client (instant, local) and the server
 * (draft endpoint). Pure functions only, no imports, no I/O.
 *
 * Every message in the inbox gets three things:
 *   - a pile: needs-reply, fyi, or low priority
 *   - a priority score from 0 to 99
 *   - a one-line summary in the message's own words, plus the next action
 *
 * Nothing here calls out to a model. The scoring is a small set of rules
 * over the mail the app already knows about: urgency, category, whether
 * the sender seems to be asking for a reply, and whether the message
 * looks like a bulk or scam mail. That keeps triage instant on the
 * public demo, where no key is set, and the same result shows up
 * everywhere no matter who runs it.
 */

export type TriagePile = "needs-reply" | "fyi" | "low";

export interface TriageInput {
  from: string;
  subject: string | null;
  body: string | null;
  category?: string;
  urgencyLevel?: "low" | "medium" | "high";
  isScam?: boolean;
  scamProbability?: number;
  unsubscribeRecommended?: boolean;
  isRead?: boolean;
}

export interface TriageResult {
  pile: TriagePile;
  priorityScore: number;
  summary: string;
  nextAction: string;
  asksReply: boolean;
}

export const TRIAGE_PILE_LABELS: Record<TriagePile, string> = {
  "needs-reply": "Needs reply",
  fyi: "FYI",
  low: "Low priority",
};

export const TRIAGE_PILE_DESCRIPTIONS: Record<TriagePile, string> = {
  "needs-reply": "Waiting on you to answer",
  fyi: "Worth a read, no reply needed",
  low: "Skim it or archive it",
};

const MAX_SUMMARY_LENGTH = 150;

const GREETING_RE =
  /^(hi|hello|hey|dear|good (morning|afternoon|evening))\b[^.!?]*[.!?]?\s*/i;

function stripGreeting(text: string): string {
  const cleaned = text.replace(/^(re|fwd?)\s*:\s*/i, "");
  return cleaned.replace(GREETING_RE, "").trim();
}

export function extractSummary(input: {
  subject: string | null;
  body: string | null;
}): string {
  const subject = (input.subject ?? "").trim();
  const body = (input.body ?? "").trim();

  const cleaned = body
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();

  const firstSentence = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => stripGreeting(line))
    .find((line) => line.length > 0);

  if (firstSentence) {
    return firstSentence.length > MAX_SUMMARY_LENGTH
      ? `${firstSentence.slice(0, MAX_SUMMARY_LENGTH - 3)}...`
      : firstSentence;
  }

  if (subject) {
    return subject.length > MAX_SUMMARY_LENGTH
      ? `${subject.slice(0, MAX_SUMMARY_LENGTH - 3)}...`
      : subject;
  }

  return "No content to summarize.";
}

function nextActionFor(input: TriageInput, triage: TriagePile): string {
  const subject = input.subject ?? "";
  const body = input.body ?? "";

  if (input.isScam || (input.scamProbability ?? 0) >= 0.8) {
    return "Do not reply or click any link — flag it as phishing instead.";
  }

  if (triage === "low") {
    if (input.unsubscribeRecommended) {
      return "Unsubscribe, or archive it and move on.";
    }
    return "Skim it or archive it — nothing to do here.";
  }

  if (triage === "fyi") {
    return "No reply needed — read it and move on.";
  }

  if (/pull request|merge request/i.test(subject) || /pull request/i.test(body)) {
    return "Review the changes and leave a comment or approve it.";
  }

  if (
    /dinner|lunch|coffee|meet|call/i.test(subject) ||
    /dinner|lunch|coffee|meet|call/i.test(body)
  ) {
    return "Reply with a time that works for you.";
  }

  if (/confirm|confirmation/i.test(subject)) {
    return "Reply to confirm, or say what needs to change.";
  }

  if (
    /deadline|due|by (monday|tuesday|wednesday|thursday|friday)/i.test(subject) ||
    /deadline|due/i.test(body)
  ) {
    return "Reply before the deadline hits.";
  }

  return "Reply today — keep it short.";
}

const BULK_SENDERS = new Set([
  "security",
  "notifications",
  "deals",
  "billing",
  "newsletter",
  "support",
  "noreply",
  "no-reply",
  "admin",
  "team",
  "info",
  "hello",
  "updates",
  "digest",
]);

/**
 * Display name for a sender. "Mom <mom@gmail.com>" gives "Mom" and a bare
 * address like "mom@gmail.com" gives "mom", which the helpers below
 * capitalise. Bulk mail keeps its mailbox name.
 */
export function senderDisplayName(from: string): string {
  const beforeBracket = from.split("<")[0].trim();
  if (beforeBracket && !beforeBracket.includes("@")) return beforeBracket;
  const addr = (from.match(/<([^>]+)>/)?.[1] ?? from).trim();
  return addr.split("@")[0].replace(/[._-]+/g, " ").trim();
}

export function senderFirstName(from: string): string {
  const first = senderDisplayName(from).split(" ")[0] ?? "";
  if (!first) return "";
  if (BULK_SENDERS.has(first.toLowerCase())) return "";
  return first.charAt(0).toUpperCase() + first.slice(1);
}

export function senderInitials(from: string): string {
  const parts = senderDisplayName(from).split(" ").filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
}

const ASKS_REPLY_RE =
  /\b(please|can you|could you|would you|let me know|do you|are you|will you|confirm|reply|respond|review|feedback|what do you think|when are you|are you free)\b/i;

const DEADLINE_RE =
  /\b(deadline|due (by|on|before)|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday)|by (tomorrow|today)|eod|end of (day|week))\b/i;

export function priorityScore(input: TriageInput): number {
  if (input.isScam || (input.scamProbability ?? 0) >= 0.8) return 12;

  let score = 40;

  if (input.urgencyLevel === "high") score += 25;
  else if (input.urgencyLevel === "medium") score += 12;

  const category = (input.category ?? "").toLowerCase();
  if (category === "personal") score += 14;
  else if (category === "work") score += 10;
  else if (category === "business") score += 6;
  else if (category === "finance") score += 4;
  else if (category === "newsletter" || category === "promotional") score -= 18;
  else if (category === "social") score -= 8;

  const text = `${input.subject ?? ""} ${input.body ?? ""}`;
  if (ASKS_REPLY_RE.test(text)) score += 12;
  if (DEADLINE_RE.test(text)) score += 10;
  if (input.unsubscribeRecommended) score -= 12;
  if (!input.isRead) score += 4;

  return Math.max(0, Math.min(99, score));
}

export function triageEmail(input: TriageInput): TriageResult {
  const score = priorityScore(input);
  const text = `${input.subject ?? ""} ${input.body ?? ""}`;
  const asksReply = !input.isScam && ASKS_REPLY_RE.test(text);

  const pile: TriagePile =
    input.isScam || (input.scamProbability ?? 0) >= 0.8
      ? "low"
      : score >= 62
        ? "needs-reply"
        : score >= 30
          ? "fyi"
          : "low";

  return {
    pile,
    priorityScore: score,
    summary: extractSummary(input),
    nextAction: nextActionFor(input, pile),
    asksReply,
  };
}

export function draftReply(input: TriageInput): string | null {
  if (input.isScam || (input.scamProbability ?? 0) >= 0.8) return null;

  const firstName = senderFirstName(input.from);
  const greet = firstName ? `${firstName},` : "";
  const subject = input.subject ?? "";
  const body = input.body ?? "";

  // Pull request: confirm review, name the repo if the body gives it.
  if (
    /pull request|pr #|merge request/i.test(subject) &&
    /opened|merge|review/i.test(body)
  ) {
    const repo = body.match(/([\w.-]+\/[\w.-]+)/)?.[1];
    const where = repo ? ` in ${repo}` : "";
    return `Hi ${greet}

Thanks for flagging the pull request${where} — I'll take a look and leave a review shortly.

Best regards`;
  }

  // Dinner, lunch or coffee: accept the invite, ask for the time.
  const invite = /(dinner|lunch|coffee)/i.exec(`${subject} ${body}`);
  if (invite) {
    const meal = invite[1].toLowerCase();
    const day = /on (sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i.exec(
      body,
    )?.[1];
    const when = day ? ` on ${day.charAt(0).toUpperCase() + day.slice(1)}` : "";
    return `Hi ${greet}

${meal.charAt(0).toUpperCase() + meal.slice(1)}${when} sounds great — let me know what time works for you and I'll be there.

Best regards`;
  }

  // Straight confirmations.
  if (/confirm|confirmation/i.test(subject)) {
    return `Hi ${greet}

Confirmed — thanks for sending this over.

Best regards`;
  }

  return `Hi ${greet}

Thanks for the note — I'll get back to you shortly.

Best regards`;
}

// A stored message carries its analysis on aiAnalysis. Pull the fields
// triage needs out of it so callers do not repeat the mapping.
export interface TriageMessage {
  from: string;
  subject: string | null;
  body: string | null;
  isRead: boolean;
  aiAnalysis?: {
    category?: string;
    urgencyLevel?: "low" | "medium" | "high";
    isScam?: boolean;
    scamProbability?: number;
    unsubscribeRecommended?: boolean;
  } | null;
}

export function toTriageInput(email: TriageMessage): TriageInput {
  return {
    from: email.from,
    subject: email.subject,
    body: email.body,
    category: email.aiAnalysis?.category,
    urgencyLevel: email.aiAnalysis?.urgencyLevel,
    isScam: email.aiAnalysis?.isScam,
    scamProbability: email.aiAnalysis?.scamProbability,
    unsubscribeRecommended: email.aiAnalysis?.unsubscribeRecommended,
    isRead: email.isRead,
  };
}

export function triageMessage(email: TriageMessage): TriageResult {
  return triageEmail(toTriageInput(email));
}
