# QMail - AI Scam Detection for Email

QMail is a Progressive Web App (PWA) that flags scam and phishing emails with OpenAI, suggests actions, and helps clean up an inbox.

**Team project, WSU Hackathon 2025 (5th place).** Original repo: [garv-seth/qmail](https://github.com/garv-seth/qmail). This fork hosts the public demo: [qmail-demo-kumailr.vercel.app](https://qmail-demo-kumailr.vercel.app).

My role (Kumail Rizvi): branding, UX design, and project documentation.

## Features

- AI email analysis: message text is sent to the OpenAI API with a structured JSON response, which returns a scam label, confidence, reasoning and a recommended action
- Encrypted storage: messages are encrypted with AES-256-GCM using random keys from Node's `crypto` module
- Smart filtering: categorizes emails and suggests actions
- Unsubscribe assistant: helps unsubscribe from unwanted newsletters
- Installable PWA with a mobile-friendly interface

## Tech Stack

- Frontend: React with TypeScript, Tailwind CSS, shadcn/ui components
- Backend: Node.js with Express
- Database: PostgreSQL with Drizzle ORM
- Authentication: OpenID Connect (Replit Auth); the public demo uses a demo sign-in
- AI: OpenAI API for email analysis

## Notes

`server/azure-quantum.ts` contains an optional hook to source key randomness from an external random-number service. It is disabled in the public demo, which always uses Node's built-in `crypto.randomBytes`.
