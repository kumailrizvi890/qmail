# QMail - Your inbox, already triaged

QMail is a mail client that sorts itself. Run triage and the inbox splits into piles — needs a reply, worth a read, low priority — with a one-line summary and a next step on every message. Open a message that needs an answer and a draft reply is already writing itself. Scam and phishing mail still gets flagged before you ever reply.

**Team project, WSU Hackathon 2025 (5th place).** Original repo: [garv-seth/qmail](https://github.com/garv-seth/qmail). This fork hosts the public demo: [qmail-demo.vercel.app](https://qmail-demo.vercel.app).

My role (Kumail Rizvi): branding, UX design, and project documentation.

## How it works

- **Triage** — `shared/triage.ts` scores every message from 0 to 99 (urgency, category, whether it asks for a reply, deadlines, unread) and sorts it into a pile: needs a reply (62 and up), FYI (30 and up), low priority (under 30). Scam messages always land in low priority with a warning instead of a draft. Each message gets a one-line summary taken from its own text and a next step.
- **Draft replies** — opening a message that needs a reply generates a draft. `POST /api/draft` uses OpenAI when a key is set and falls back to a content-aware draft written on the device when there is none. It refuses to draft a reply to anything that looks like a scam.
- **Scam detection** — message text is analyzed with the OpenAI API (structured JSON response) or a local rules check when no key is set. Spoofed senders and phishing get flagged with their reasons.
- **Send mail** — replies and new messages go to the Sent folder (`POST /api/emails`). The demo mailbox never sends real mail.
- **Unsubscribe assistant** — generates an unsubscribe email for newsletters you no longer want.

## The demo

The public demo signs everyone in as a demo user with a small seeded mailbox (six messages) and in-memory storage, so it resets when the server restarts. Nothing in it is real mail, and nothing is sent for real.

## Tech stack

- Frontend: React with TypeScript, Tailwind CSS, shadcn/ui components
- Backend: Node.js with Express, deployed on Vercel as serverless functions
- AI: OpenAI API for email analysis and draft replies, with a local fallback when no key is set
- Authentication: OpenID Connect (Replit Auth); the public demo uses a demo sign-in

## Run it locally

```bash
npm install
npm run dev
```

`npm run check` runs the TypeScript typecheck. Set `OPENAI_API_KEY` to use OpenAI for analysis and drafts; without it the app uses the local fallback, and everything still works.

## API

- `GET /api/emails?folder=inbox` — list mail in a folder
- `GET /api/emails/:id` and `PATCH /api/emails/:id` — read and update one message
- `POST /api/emails` — send a message (`to`, `subject`, `body`); it lands in Sent
- `POST /api/draft` — draft a reply (`from`, `subject`, `body`, plus the message's analysis); returns `{ draft, source, summary }`, where `source` is `openai` or `local`, and a 409 when the message looks like a scam
- `POST /api/emails/analyze` — analyze one message
- `GET /api/security-stats` — scam, unsubscribe and sent counts

## Notes

`server/azure-quantum.ts` contains an optional hook to source key randomness from an external random-number service. It is disabled in the public demo, which always uses Node's built-in `crypto.randomBytes`.
