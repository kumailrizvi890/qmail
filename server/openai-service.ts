import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user

// The public demo deployment runs without a live OpenAI key (no billing
// exposure for a portfolio site), so email analysis falls back to a
// deterministic, content-aware mock instead of calling the real API.
const HAS_LIVE_KEY = Boolean(
  process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "sk-your-api-key"
);

const openai = HAS_LIVE_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

interface EmailAnalysisResult {
  isScam: boolean;
  scamProbability: number;
  reasons: string[];
  summary: string;
  category: string;
  urgencyLevel: 'low' | 'medium' | 'high';
  sensitiveContent: boolean;
  unsubscribeRecommended: boolean;
  unsubscribeReason?: string;
}

const SCAM_SIGNALS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /verify.{0,20}account|confirm.{0,20}(identity|account)/i, reason: "Asks the recipient to verify account details, a common phishing pretext" },
  { pattern: /suspend|locked|restricted|unusual activity/i, reason: "Uses account-suspension urgency to pressure a quick click" },
  { pattern: /wire transfer|gift card|bitcoin|crypto(?!graphy)/i, reason: "Requests an untraceable payment method associated with scams" },
  { pattern: /click here|act now|expires? (today|in \d+)|limited time/i, reason: "Uses high-pressure urgency language typical of phishing" },
  { pattern: /won|prize|lottery|inheritance|claim your/i, reason: "Unsolicited prize or windfall claim, a classic scam pattern" },
  { pattern: /password|ssn|social security|credit card number/i, reason: "Requests sensitive credentials directly over email" },
];

function mockAnalyzeEmail(from: string, subject: string, body: string): EmailAnalysisResult {
  const text = `${subject} ${body}`;
  const matched = SCAM_SIGNALS.filter((s) => s.pattern.test(text));
  const isScam = matched.length >= 2;
  const scamProbability = Math.min(0.95, matched.length * 0.28 + (isScam ? 0.15 : 0));

  const domain = from.split("@")[1]?.toLowerCase() || "";
  const isKnownBrand = /amazon|google|microsoft|apple|paypal|bankofamerica|chase/.test(domain);
  const looksSpoofed = isKnownBrand === false && /amazon|google|microsoft|apple|paypal|bank/i.test(text);

  let category = "personal";
  if (/newsletter|unsubscribe|weekly digest/i.test(text)) category = "newsletter";
  else if (/invoice|receipt|order|shipping/i.test(text)) category = "business";
  else if (/sale|% off|discount|deal/i.test(text)) category = "promotional";
  else if (isScam) category = "suspicious";

  const reasons = matched.map((m) => m.reason);
  if (looksSpoofed) reasons.push(`Sender domain (${domain || "unknown"}) doesn't match the brand referenced in the message`);

  return {
    isScam: isScam || looksSpoofed,
    scamProbability: looksSpoofed ? Math.max(scamProbability, 0.62) : scamProbability,
    reasons: reasons.length ? reasons : ["No known phishing or scam patterns detected"],
    summary: `${subject} - ${body.slice(0, 120)}${body.length > 120 ? "..." : ""}`,
    category,
    urgencyLevel: matched.length >= 3 ? "high" : matched.length >= 1 ? "medium" : "low",
    sensitiveContent: /password|ssn|social security|credit card|bank account/i.test(text),
    unsubscribeRecommended: category === "newsletter" || category === "promotional",
    unsubscribeReason: category === "newsletter" || category === "promotional"
      ? "Recurring marketing/newsletter sender - safe to unsubscribe if unwanted"
      : undefined,
  };
}

export async function analyzeEmail(
  from: string,
  subject: string,
  body: string
): Promise<EmailAnalysisResult> {
  if (!openai) {
    return mockAnalyzeEmail(from, subject, body);
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an email security expert specializing in detecting phishing, scams, and analyzing email content.
          Analyze the provided email and return a detailed assessment in JSON format.`
        },
        {
          role: "user",
          content: `Analyze this email for security threats, content type, and provide recommendations:

          From: ${from}
          Subject: ${subject}
          Body: ${body}

          Provide a detailed analysis including:
          - Is this likely a scam or phishing attempt?
          - What's the probability it's malicious (0-1 scale)?
          - Specific reasons for your determination
          - Brief summary of the email content
          - Email category (e.g., promotional, newsletter, personal, business, etc.)
          - Urgency level (low, medium, high)
          - Does it contain sensitive content requests?
          - Should the user unsubscribe from this sender? If yes, provide a reason.`
        }
      ],
      response_format: { type: "json_object" }
    });

    const analysisResult = JSON.parse(response.choices[0].message.content) as EmailAnalysisResult;
    return analysisResult;
  } catch (error) {
    console.error("Error analyzing email with OpenAI:", error);
    return mockAnalyzeEmail(from, subject, body);
  }
}

function mockUnsubscribeEmail(to: string, fromName: string, serviceDescription: string): string {
  return `Hello,\n\nI'd like to unsubscribe ${to} from ${serviceDescription}. Please remove me from this mailing list at your earliest convenience.\n\nThank you,\n${fromName}`;
}

export async function generateUnsubscribeEmail(
  to: string,
  fromName: string,
  serviceDescription: string
): Promise<string> {
  if (!openai) {
    return mockUnsubscribeEmail(to, fromName, serviceDescription);
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an assistant that helps users unsubscribe from email lists. Create formal, concise unsubscribe request emails."
        },
        {
          role: "user",
          content: `Generate a polite, brief email requesting to unsubscribe from a mailing list.

          To: ${to}
          My name: ${fromName}
          Service description: ${serviceDescription}`
        }
      ]
    });

    return response.choices[0].message.content || mockUnsubscribeEmail(to, fromName, serviceDescription);
  } catch (error) {
    console.error("Error generating unsubscribe email:", error);
    return mockUnsubscribeEmail(to, fromName, serviceDescription);
  }
}
