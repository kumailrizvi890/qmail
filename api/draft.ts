/**
 * POST /api/draft
 *
 * Drafts a reply to one message. The client sends the message it is
 * looking at; this endpoint answers with a short draft and says where
 * the draft came from.
 *
 * With an OpenAI key set, the draft comes from gpt-4o-mini. Without one,
 * the same endpoint falls back to the local draft in shared/triage, so
 * the public demo still drafts replies with no key and no extra wait.
 *
 * Messages that look like scams get a 409 and no draft at all. OpenAI
 * is told the same thing: it must answer REFUSE for a scam mail, and
 * that answer is dropped in favour of the local draft rules, which
 * refuse scams too.
 */
import OpenAI from "openai";
import { draftReply, triageEmail, type TriageInput } from "../shared/triage";

type DraftRequestBody = {
  from?: unknown;
  subject?: unknown;
  body?: unknown;
  category?: unknown;
  urgencyLevel?: unknown;
  isScam?: unknown;
  scamProbability?: unknown;
  unsubscribeRecommended?: unknown;
  isRead?: unknown;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function toTriageInput(body: DraftRequestBody): TriageInput | null {
  const from = asString(body.from);
  const subject = asString(body.subject);
  const messageBody = asString(body.body);
  if (!from || !subject || !messageBody) return null;

  const urgency = asString(body.urgencyLevel);
  return {
    from,
    subject,
    body: messageBody,
    category: asString(body.category) || undefined,
    urgencyLevel:
      urgency === "low" || urgency === "medium" || urgency === "high"
        ? urgency
        : undefined,
    isScam: asBoolean(body.isScam),
    scamProbability: asNumber(body.scamProbability),
    unsubscribeRecommended: asBoolean(body.unsubscribeRecommended),
    isRead: asBoolean(body.isRead),
  };
}

const apiKey = process.env.OPENAI_API_KEY;
const openai =
  apiKey && apiKey !== "sk-your-api-key" ? new OpenAI({ apiKey }) : null;

async function draftWithOpenAI(input: TriageInput): Promise<string | null> {
  if (!openai) return null;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      max_tokens: 220,
      messages: [
        {
          role: "system",
          content:
            "You draft short email replies. Reply in under 80 words, in a warm and direct tone. " +
            "Use only the facts in the email — never invent times, dates, places or commitments. " +
            "If the email looks like a scam, phishing or a prize claim, reply with the single word REFUSE and nothing else.",
        },
        {
          role: "user",
          content: `From: ${input.from}\nSubject: ${input.subject ?? ""}\n\n${input.body ?? ""}`,
        },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!text || text === "REFUSE") return null;
    return text;
  } catch {
    return null;
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const input = toTriageInput(req.body ?? {});
  if (!input) {
    return res.status(400).json({ error: "from, subject and body are required" });
  }

  const triage = triageEmail(input);
  const local = draftReply(input);
  if (!local) {
    return res.status(409).json({
      draft: null,
      source: "none",
      summary: triage.summary,
      reason: "This message looks like a scam, so no draft was written.",
    });
  }

  const fromOpenAI = await draftWithOpenAI(input);
  if (fromOpenAI) {
    return res
      .status(200)
      .json({ draft: fromOpenAI, source: "openai", summary: triage.summary });
  }

  return res.status(200).json({ draft: local, source: "local", summary: triage.summary });
}
