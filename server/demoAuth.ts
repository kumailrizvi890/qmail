import type { Express, RequestHandler } from "express";
import { storage } from "./storage";
import { processIncomingEmail } from "./email-service";

const SEED_EMAILS = [
  {
    externalId: "seed-1",
    from: "security@paypa1-verify.com",
    to: "demo@qmail.app",
    subject: "Your account has been suspended - verify now",
    body: "We detected unusual activity on your account. Click here to verify your identity within 24 hours or your account will be permanently locked. Confirm your password and credit card number to restore access.",
    receivedAt: new Date(Date.now() - 1000 * 60 * 40),
  },
  {
    externalId: "seed-2",
    from: "notifications@github.com",
    to: "demo@qmail.app",
    subject: "[qmail] New pull request opened: Add scam detection dashboard",
    body: "A new pull request was opened in kumailrizvi890/qmail. Review the changes and merge when ready.",
    receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
  },
  {
    externalId: "seed-3",
    from: "deals@northface-outlet-store.com",
    to: "demo@qmail.app",
    subject: "Congratulations! You've won a free jacket - claim your prize now",
    body: "You have been selected to win a free prize! Act now, this limited time offer expires today. Click here to claim your gift card.",
    receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
  },
  {
    externalId: "seed-4",
    from: "billing@digitalocean.com",
    to: "demo@qmail.app",
    subject: "Your October invoice is ready",
    body: "Your invoice for October is now available. Total amount due: $24.00. This is an automated receipt for your records.",
    receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 20),
  },
  {
    externalId: "seed-5",
    from: "newsletter@morningbrew.com",
    to: "demo@qmail.app",
    subject: "5 things to know before the market opens",
    body: "Here's today's newsletter digest covering markets, tech, and business news. Unsubscribe anytime from the link below.",
    receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 30),
  },
  {
    externalId: "seed-6",
    from: "mom@gmail.com",
    to: "demo@qmail.app",
    subject: "Dinner on Sunday?",
    body: "Hey, are you free for dinner this Sunday? Let me know what time works for you.",
    receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
  },
];

// Public-demo replacement for replitAuth.ts.
//
// The original auth used Replit's OIDC provider (REPLIT_DOMAINS / REPL_ID env
// vars that only exist inside a Replit workspace), so the app couldn't boot
// anywhere else. This is a portfolio demo with one visitor at a time and
// nothing sensitive behind the login, so instead of standing up a real
// identity provider we auto-sign every visitor in as a seeded demo user -
// same req.user shape the rest of the app already expects, no external
// service required.

let demoUserId: number | null = null;

async function getOrCreateDemoUser() {
  if (demoUserId !== null) {
    const existing = await storage.getUser(demoUserId);
    if (existing) return existing;
  }

  let user = await storage.getUserByUsername("demo");
  if (!user) {
    user = await storage.createUser({
      username: "demo",
      email: "demo@qmail.app",
      password: "",
      firstName: "Demo",
      lastName: "User",
      profileImage: null,
      replitId: "demo-user",
    });

    await storage.createUserSettings({
      userId: user.id,
      encryptionLevel: "standard",
      keyRotationDays: 30,
      useQuantumRng: true,
      aiScanEnabled: true,
      aiUnsubscribeEnabled: true,
      theme: "system",
    });

    const provider = await storage.createEmailProvider({
      userId: user.id,
      provider: "gmail",
      credentials: { demo: true },
      active: true,
    });

    // Seed a realistic-looking inbox, run through the same scam-detection
    // pipeline a real connected inbox would use, so the demo shows the
    // actual feature working instead of an empty state.
    for (const email of SEED_EMAILS) {
      await processIncomingEmail(user.id, provider.id, email);
    }
  }

  demoUserId = user.id;
  return user;
}

export async function setupAuth(app: Express) {
  const demoUser = await getOrCreateDemoUser();

  // Attach the demo identity to every request - no session store, no
  // passport, no external IdP. `req.user.userId` matches what the routes
  // already expect from the old passport-based flow.
  app.use((req: any, _res, next) => {
    req.user = {
      userId: demoUser.id,
      username: demoUser.username,
      email: demoUser.email,
      first_name: demoUser.firstName,
      last_name: demoUser.lastName,
      profile_image_url: demoUser.profileImage,
    };
    req.isAuthenticated = () => true;
    req.session = req.session || {};
    req.session.passport = { user: req.user };
    next();
  });

  // Keep the old routes around so any existing links/redirects don't 404 -
  // there's nothing to actually log in or out of in the demo.
  app.get("/api/login", (_req, res) => res.redirect("/"));
  app.get("/api/logout", (_req, res) => res.redirect("/"));
  app.get("/api/callback", (_req, res) => res.redirect("/"));
}

export const isAuthenticated: RequestHandler = (_req, _res, next) => next();
