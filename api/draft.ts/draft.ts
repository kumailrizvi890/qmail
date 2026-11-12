/**
 * POST /api/draft -- generate a reply draft for one email.
 *
 * A standalone Vercel function (so the existing bundled /api handler
 * does not need to be rebuilt to ship it). The client sends the
 * message it is replying to -- the same shape the existing
 * POST /api/emails/analyze endpoint already accepts -- and gets back
 * a draft plus where it came from:
 *
 * - "openai" when an OpenAI key is configured: the draft is written
 *   by gpt-4o-mini from the message itself, with instructions not to
 *   invent facts, times or commitments that are not in the email;
 * - "local" otherwise: the content-aware draft from shared/triage,
 *   which is the same fallback pattern the public demo's email
 *   analysis already uses when no key is set.
 *
 * Messages that look like scams never get a draft (409). Nothing is
 * sent anywhere by this endpoint: the draft is returned for the user
 * to read, edit and send themselves from the inbox.
 */
import { OpenAI } from "openai";
import { draftReply, triageEmail, type TriageInput } from "../shared/triage";

type DraftSource = "openai" | "local";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method not allowed" });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const input: TriageInput = {
    from: asString(body.from),
    subject: asString(body.subject),
    body: asString(body.body),
    category: asString(body.category) || null,
    urgencyLevel: asString(body.urgencyLevel) || null,
    isScam: asBoolean(body.isScam),
    scamProbability: asNumber(body.scamProbability),
    unsubscribeRecommended: asBoolean(body.unsubscribeRecommended),
    isRead: asBoolean(body.isRead),
  };

  if (!input.subject.trim() && !input.body.trim()) {
    return res
      .status(400)
      .json({ message: "An email subject or body is required to draft a reply." });
  }

  const triage = triageEmail(input);
  const localDraft = draftReply(input);
  if (localDraft === null) {
    return res.status(409).json({
      draft: null,
      source: "local" as DraftSource,
      summary: triage.summary,
      message:
        "This message looks like a scam, so Qmail will not draft a reply to it.",
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      draft: localDraft,
      source: "local" as DraftSource,
      summary: triage.summary,
    });
  }

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      max_tokens: 220,
      messages: [
        {
          role: "system",
          content:
            "You write short, polite email replies. Reply in the voice of the recipient, in under 80 words. Answer only what the email asked; do not invent facts, times, dates or commitments that are not in the email. Do not add a sign-off name. If the email is a scam or asks for credentials or payment, reply with the single word REFUSE.",
        },
        {
          role: "user",
          content: `From: ${input.from}\nSubject: ${input.subject}\n\n${input.body}`,
        },
      ],
    });
    const draft = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!draft || draft === "REFUSE") {
      return res.status(200).json({
        draft: localDraft,
        source: "local" as DraftSource,
        summary: triage.summary,
      });
    }
    return res.status(200).json({
      draft,
      source: "openai" as DraftSource,
      summary: triage.summary,
    });
  } catch (error) {
    console.error(
      "OpenAI draft failed, using the local draft instead:",
      error instanceof Error ? error.message : error,
    );
    return res.status(200).json({
      draft: localDraft,
      source: "local" as DraftSource,
      summary: triage.summary,
    });
  }
}
