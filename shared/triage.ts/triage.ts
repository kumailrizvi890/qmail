/**
 * Shared triage logic for Qmail's AI inbox.
 *
 * One module, used by both sides of the app:
 * - the client runs it in the browser when you press "Run triage";
 * - the server draft endpoint reuses it as its fallback when no
 *   OpenAI key is configured (the same fallback the existing
 *   email analysis already uses in demo mode).
 *
 * Everything here is derived from the message itself -- its sender,
 * subject, body and any analysis already stored on it. It never
 * invents facts, senders or deadlines: the summary is the message's
 * own first meaningful sentence, the next action names what the
 * message actually asks for, and a draft only answers what the
 * message asked. Messages that look like scams are never given a
 * reply draft; they land in the Low priority pile instead.
 */

export type TriagePile = "needs-reply" | "fyi" | "low";

export interface TriageInput {
  from: string;
  subject: string;
  body: string;
  category?: string | null;
  urgencyLevel?: string | null;
  isScam?: boolean | null;
  scamProbability?: number | null;
  unsubscribeRecommended?: boolean | null;
  isRead?: boolean | null;
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
  "needs-reply":
    "A real person is waiting on an answer from you. These get a draft written automatically.",
  fyi: "Worth knowing, nothing owed. Read the one-line summary and you have the whole story.",
  low: "Newsletters, receipts and messages that look like scams. Kept, searchable, and never allowed to shout over real mail.",
};

/** Sender labels that are services or bulk mail, not a person. */
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

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sentencesOf(body: string): string[] {
  return cleanText(body)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) =>
      sentence
        .replace(/^(hi|hey|hello|dear)[,.]?\s+/i, "")
        .replace(/^(hi|hey|hello|dear)[.!?]?$/, "")
        .trim(),
    )
    .filter(
      (sentence) =>
        sentence.length >= 12 &&
        !/^(best|thanks|regards|cheers|sincerely)/i.test(sentence),
    );
}

/**
 * The message's own first meaningful sentence, shortened to one line.
 * Falls back to the subject when the body has nothing usable.
 */
export function extractSummary(input: TriageInput): string {
  const first = sentencesOf(input.body)[0];
  const summary = first ?? cleanText(input.subject);
  if (summary.length <= 150) return summary;
  const cut = summary.slice(0, 147);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 80 ? lastSpace : 147).trim()}...`;
}

function asksForSomething(text: string): boolean {
  return (
    text.includes("?") ||
    /(could you|can you|would you|please (confirm|review|let me know|send|reply|take a look|check)|let me know|i need|we need|when (are|were) you|are you free|what time)/.test(
      text,
    )
  );
}

function mentionsDeadline(text: string): boolean {
  return (
    /(today|tomorrow|within 24 hours|before (the )?(demo|deadline|freeze)|due (today|tomorrow|by)|expires today|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday))/.test(
      text,
    ) || text.includes("urgent")
  );
}

/**
 * Content-based scam signals, used when no stored analysis exists.
 * Deliberately narrow: a message must combine an impersonation or
 * prize claim with a request for credentials, payment or an urgent click.
 */
export function looksLikeScam(input: TriageInput): boolean {
  const text = `${input.subject} ${input.body}`.toLowerCase();
  const impersonation =
    /account (has been )?(suspended|locked|compromised)|verify (your|now|identity)|unusual activity/.test(
      text,
    );
  const prize =
    /(you have (been )?selected|you('ve| have) won|claim your (prize|gift|free))/.test(
      text,
    );
  const credentialAsk =
    /(password|credit card|verify your identity|click here to verify|confirm your password)/.test(
      text,
    );
  const urgencyClick = /act now|expires today|within 24 hours|click here to claim/.test(
    text,
  );
  return (impersonation && (credentialAsk || urgencyClick)) || (prize && urgencyClick);
}

export function senderIsScam(input: TriageInput): boolean {
  if (input.isScam) return true;
  if (typeof input.scamProbability === "number" && input.scamProbability >= 0.8) {
    return true;
  }
  return looksLikeScam(input);
}

/** Two-letter avatar initials from a sender label or name. */
export function senderInitials(from: string): string {
  const words = cleanText(from).split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** A plausible first name to address, or null for services and bulk senders. */
export function senderFirstName(from: string): string | null {
  const label = cleanText(from).toLowerCase();
  if (BULK_SENDERS.has(label)) return null;
  const first = cleanText(from).split(/\s+/)[0] ?? "";
  if (!/^[A-Za-z][A-Za-z'-]*$/.test(first)) return null;
  return first[0].toUpperCase() + first.slice(1);
}

export function nextActionFor(input: TriageInput, pile: TriagePile): string {
  if (senderIsScam(input)) {
    return "Do not reply or click any link -- flag it as phishing instead.";
  }
  const text = `${input.subject} ${input.body}`.toLowerCase();
  if (pile === "needs-reply") {
    if (/pull request|\bpr #?\d+/.test(text)) {
      return "Review the changes and merge when ready.";
    }
    if (/(dinner|lunch|coffee|meet|free)/.test(text) && text.includes("?")) {
      return "Reply with a time that works for you.";
    }
    if (/confirm/.test(text)) {
      return "Reply to confirm, or propose another time.";
    }
    if (/review|feedback|take a look/.test(text)) {
      return "Review it and reply with your decision.";
    }
    if (mentionsDeadline(text)) {
      return "Reply before the deadline in the message.";
    }
    return "Reply to this message.";
  }
  if (pile === "fyi") {
    return "No reply needed -- read it and move on.";
  }
  if (input.unsubscribeRecommended) {
    return "Nothing to do -- read it, or unsubscribe.";
  }
  return "Nothing to do -- keep it or archive it.";
}

export function priorityScore(input: TriageInput): number {
  if (senderIsScam(input)) return 12;
  const text = `${input.subject} ${input.body}`.toLowerCase();
  const category = (input.category ?? "").toLowerCase();
  const urgency = (input.urgencyLevel ?? "low").toLowerCase();
  let score = 40;
  if (urgency === "high") score += 25;
  else if (urgency === "medium") score += 12;
  if (category === "personal") score += 14;
  else if (category === "work") score += 10;
  else if (category === "business") score += 6;
  else if (category === "finance") score += 4;
  else if (category === "newsletter" || category === "promotion") score -= 18;
  else if (category === "social") score -= 8;
  if (asksForSomething(text)) score += 12;
  if (mentionsDeadline(text)) score += 10;
  if (input.unsubscribeRecommended) score -= 12;
  if (!input.isRead) score += 4;
  return Math.max(0, Math.min(99, score));
}

/**
 * Sort one message into exactly one pile, with a priority score,
 * a one-line summary and the one next action it implies.
 */
export function triageEmail(input: TriageInput): TriageResult {
  const scam = senderIsScam(input);
  const score = priorityScore(input);
  const asksReply = !scam && asksForSomething(`${input.subject} ${input.body}`.toLowerCase());
  const pile: TriagePile = scam
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

/**
 * A short reply draft built from what the message actually asked.
 * Returns null for messages that look like scams -- those should
 * never be answered. The caller (the OpenAI endpoint, or the inbox
 * itself) is responsible for offering an editable draft, never for
 * sending anything on the user's behalf.
 */
export function draftReply(input: TriageInput): string | null {
  if (senderIsScam(input)) return null;
  const text = `${input.subject} ${input.body}`.toLowerCase();
  const name = senderFirstName(input.from);
  const greeting = name ? `Hi ${name},` : "Hi,";
  const repo = /(\b[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9._-]*)\b/.exec(
    input.body,
  )?.[1];
  const day = new RegExp(`\\b(${WEEKDAYS.join("|").toLowerCase()})\\b`).exec(
    text,
  )?.[1];
  let middle: string;
  if (/pull request|\bpr #?\d+/.test(text)) {
    middle = repo
      ? `Thanks for sending this over -- I'll review the pull request in ${repo} and merge it when ready.`
      : "Thanks for sending this over -- I'll review the pull request and merge it when ready.";
  } else if (/(dinner|lunch|coffee|meet up|catch up|free for)/.test(text)) {
    middle = day
      ? `${day[0].toUpperCase() + day.slice(1)} sounds lovely -- I'd love to. What time were you thinking?`
      : "That sounds lovely -- I'd love to. What time were you thinking?";
  } else if (/confirm/.test(text)) {
    middle =
      "That works for me -- please go ahead and confirm it. Let me know if anything changes.";
  } else if (/review|feedback|take a look/.test(text)) {
    middle =
      "Thanks for sharing this -- I'll take a look and send you my thoughts shortly.";
  } else if (text.includes("?")) {
    middle = "Thanks for reaching out -- I'll get back to you on this shortly.";
  } else {
    middle = "Thanks for sending this -- I'll follow up shortly.";
  }
  return `${greeting}\n\n${middle}\n\nBest regards`;
}
