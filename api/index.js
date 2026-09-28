// api-src/index.ts
import express from "express";

// server/routes.ts
import { createServer } from "http";

// server/storage.ts
import session from "express-session";
import createMemoryStore from "memorystore";
var MemoryStore = createMemoryStore(session);
var MemStorage = class {
  users;
  emailProviders;
  emails;
  filterRules;
  userSettings;
  sessionStore;
  currentUserId;
  currentEmailProviderId;
  currentEmailId;
  currentFilterRuleId;
  currentUserSettingsId;
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.emailProviders = /* @__PURE__ */ new Map();
    this.emails = /* @__PURE__ */ new Map();
    this.filterRules = /* @__PURE__ */ new Map();
    this.userSettings = /* @__PURE__ */ new Map();
    this.currentUserId = 1;
    this.currentEmailProviderId = 1;
    this.currentEmailId = 1;
    this.currentFilterRuleId = 1;
    this.currentUserSettingsId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 864e5
      // 24h in ms
    });
  }
  // User methods
  async getUser(id) {
    return this.users.get(id);
  }
  async getUserByUsername(username) {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }
  async getUserByReplitId(replitId) {
    return Array.from(this.users.values()).find(
      (user) => user.replitId === replitId
    );
  }
  async createUser(insertUser) {
    const id = this.currentUserId++;
    const user = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  async updateUser(id, updates) {
    const user = this.users.get(id);
    if (!user) return void 0;
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  // Email provider methods
  async getEmailProviders(userId) {
    return Array.from(this.emailProviders.values()).filter(
      (provider) => provider.userId === userId
    );
  }
  async createEmailProvider(provider) {
    const id = this.currentEmailProviderId++;
    const now = /* @__PURE__ */ new Date();
    const newProvider = {
      ...provider,
      id,
      createdAt: now
    };
    this.emailProviders.set(id, newProvider);
    return newProvider;
  }
  async updateEmailProvider(id, updates) {
    const provider = this.emailProviders.get(id);
    if (!provider) return void 0;
    const updatedProvider = { ...provider, ...updates };
    this.emailProviders.set(id, updatedProvider);
    return updatedProvider;
  }
  async deleteEmailProvider(id) {
    return this.emailProviders.delete(id);
  }
  // Email methods
  async getEmails(userId, filters) {
    let emails2 = Array.from(this.emails.values()).filter(
      (email) => email.userId === userId
    );
    if (filters) {
      emails2 = emails2.filter((email) => {
        for (const [key, value] of Object.entries(filters)) {
          if (email[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }
    return emails2;
  }
  async getEmailById(id) {
    return this.emails.get(id);
  }
  async createEmail(email) {
    const id = this.currentEmailId++;
    const now = /* @__PURE__ */ new Date();
    const newEmail = {
      ...email,
      id,
      createdAt: now
    };
    this.emails.set(id, newEmail);
    return newEmail;
  }
  async updateEmail(id, updates) {
    const email = this.emails.get(id);
    if (!email) return void 0;
    const updatedEmail = { ...email, ...updates };
    this.emails.set(id, updatedEmail);
    return updatedEmail;
  }
  async deleteEmail(id) {
    return this.emails.delete(id);
  }
  // Filter rule methods
  async getFilterRules(userId) {
    return Array.from(this.filterRules.values()).filter(
      (rule) => rule.userId === userId
    );
  }
  async createFilterRule(rule) {
    const id = this.currentFilterRuleId++;
    const now = /* @__PURE__ */ new Date();
    const newRule = {
      ...rule,
      id,
      createdAt: now
    };
    this.filterRules.set(id, newRule);
    return newRule;
  }
  async updateFilterRule(id, updates) {
    const rule = this.filterRules.get(id);
    if (!rule) return void 0;
    const updatedRule = { ...rule, ...updates };
    this.filterRules.set(id, updatedRule);
    return updatedRule;
  }
  async deleteFilterRule(id) {
    return this.filterRules.delete(id);
  }
  // User settings methods
  async getUserSettings(userId) {
    return Array.from(this.userSettings.values()).find(
      (settings) => settings.userId === userId
    );
  }
  async createUserSettings(settings) {
    const id = this.currentUserSettingsId++;
    const now = /* @__PURE__ */ new Date();
    const newSettings = {
      ...settings,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.userSettings.set(id, newSettings);
    return newSettings;
  }
  async updateUserSettings(userId, updates) {
    const settings = Array.from(this.userSettings.values()).find(
      (s) => s.userId === userId
    );
    if (!settings) return void 0;
    const now = /* @__PURE__ */ new Date();
    const updatedSettings = {
      ...settings,
      ...updates,
      updatedAt: now
    };
    this.userSettings.set(settings.id, updatedSettings);
    return updatedSettings;
  }
};
var storage = new MemStorage();

// server/openai-service.ts
import OpenAI from "openai";
var HAS_LIVE_KEY = Boolean(
  process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "sk-your-api-key"
);
var openai = HAS_LIVE_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
var SCAM_SIGNALS = [
  { pattern: /verify.{0,20}account|confirm.{0,20}(identity|account)/i, reason: "Asks the recipient to verify account details, a common phishing pretext" },
  { pattern: /suspend|locked|restricted|unusual activity/i, reason: "Uses account-suspension urgency to pressure a quick click" },
  { pattern: /wire transfer|gift card|bitcoin|crypto(?!graphy)/i, reason: "Requests an untraceable payment method associated with scams" },
  { pattern: /click here|act now|expires? (today|in \d+)|limited time/i, reason: "Uses high-pressure urgency language typical of phishing" },
  { pattern: /won|prize|lottery|inheritance|claim your/i, reason: "Unsolicited prize or windfall claim, a classic scam pattern" },
  { pattern: /password|ssn|social security|credit card number/i, reason: "Requests sensitive credentials directly over email" }
];
function mockAnalyzeEmail(from, subject, body) {
  const text2 = `${subject} ${body}`;
  const matched = SCAM_SIGNALS.filter((s) => s.pattern.test(text2));
  const isScam = matched.length >= 2;
  const scamProbability = Math.min(0.95, matched.length * 0.28 + (isScam ? 0.15 : 0));
  const domain = from.split("@")[1]?.toLowerCase() || "";
  const isKnownBrand = /amazon|google|microsoft|apple|paypal|bankofamerica|chase/.test(domain);
  const looksSpoofed = isKnownBrand === false && /amazon|google|microsoft|apple|paypal|bank/i.test(text2);
  let category = "personal";
  if (/newsletter|unsubscribe|weekly digest/i.test(text2)) category = "newsletter";
  else if (/invoice|receipt|order|shipping/i.test(text2)) category = "business";
  else if (/sale|% off|discount|deal/i.test(text2)) category = "promotional";
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
    sensitiveContent: /password|ssn|social security|credit card|bank account/i.test(text2),
    unsubscribeRecommended: category === "newsletter" || category === "promotional",
    unsubscribeReason: category === "newsletter" || category === "promotional" ? "Recurring marketing/newsletter sender - safe to unsubscribe if unwanted" : void 0
  };
}
async function analyzeEmail2(from, subject, body) {
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
    const analysisResult = JSON.parse(response.choices[0].message.content);
    return analysisResult;
  } catch (error) {
    console.error("Error analyzing email with OpenAI:", error);
    return mockAnalyzeEmail(from, subject, body);
  }
}
function mockUnsubscribeEmail(to, fromName, serviceDescription) {
  return `Hello,

I'd like to unsubscribe ${to} from ${serviceDescription}. Please remove me from this mailing list at your earliest convenience.

Thank you,
${fromName}`;
}
async function generateUnsubscribeEmail(to, fromName, serviceDescription) {
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

// server/azure-quantum.ts
import axios from "axios";
import crypto from "crypto";
var quantumConfig = {
  endpoint: process.env.AZURE_QUANTUM_ENDPOINT || "https://quantum.azure.com",
  apiKey: process.env.AZURE_QUANTUM_API_KEY || "your-quantum-api-key",
  workspaceId: process.env.AZURE_QUANTUM_WORKSPACE_ID || "your-workspace-id"
};
var HAS_LIVE_QUANTUM_KEY = quantumConfig.apiKey !== "your-quantum-api-key";
async function generateQuantumRandomBytes(numBytes) {
  if (!HAS_LIVE_QUANTUM_KEY) {
    return generateQuantumInspiredRandomBytes(numBytes);
  }
  try {
    const response = await axios({
      method: "post",
      url: `${quantumConfig.endpoint}/quantum/${quantumConfig.workspaceId}/random-number-generators/qrng`,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${quantumConfig.apiKey}`
      },
      data: {
        count: numBytes,
        outputType: "base64"
      }
    });
    if (response.status === 200 && response.data && response.data.value) {
      return Buffer.from(response.data.value, "base64");
    }
    throw new Error("Invalid response from Azure Quantum service");
  } catch (error) {
    console.warn("Failed to get quantum random numbers, falling back to quantum-inspired alternative:", error);
    return generateQuantumInspiredRandomBytes(numBytes);
  }
}
function generateQuantumInspiredRandomBytes(numBytes) {
  const timestamp2 = Date.now().toString();
  const randomValues = crypto.randomBytes(numBytes * 2).toString("hex");
  const nodeRandomValue = Math.random().toString();
  const entropySource = timestamp2 + randomValues + nodeRandomValue;
  let mixedEntropy = "";
  for (let i = 0; i < entropySource.length; i++) {
    const charCode = entropySource.charCodeAt(i) ^ i % 256;
    mixedEntropy += String.fromCharCode(charCode % 256);
  }
  const hash = crypto.createHash("sha512").update(mixedEntropy).digest();
  return Buffer.from(hash.slice(0, numBytes));
}
async function generateQuantumKey(keySizeBytes = 32) {
  return generateQuantumRandomBytes(keySizeBytes);
}
async function generateSecureRandomString(length = 32) {
  const randomBytes = await generateQuantumRandomBytes(Math.ceil(length * 3 / 4));
  return randomBytes.toString("base64").slice(0, length);
}

// server/email-service.ts
import crypto2 from "crypto";
async function encryptEmail(to, from, subject, body, useQuantumRng = true) {
  try {
    const encryptionKey = useQuantumRng ? await generateQuantumKey(32) : crypto2.randomBytes(32);
    const iv = crypto2.randomBytes(16);
    const cipher = crypto2.createCipheriv("aes-256-gcm", encryptionKey, iv);
    const emailContent = JSON.stringify({ to, from, subject, body });
    let encrypted = cipher.update(emailContent, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag();
    return {
      encrypted,
      encryptionInfo: {
        algorithm: "aes-256-gcm",
        iv: iv.toString("hex"),
        authTag: authTag.toString("hex"),
        keySource: useQuantumRng ? "quantum" : "classical",
        encryptedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    };
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt email");
  }
}
async function processIncomingEmail(userId, providerId, emailData) {
  const settings = await storage.getUserSettings(userId);
  let aiAnalysis = null;
  if (settings?.aiScanEnabled) {
    aiAnalysis = await analyzeEmail2(
      emailData.from,
      emailData.subject,
      emailData.body
    );
  }
  const isFlagged = aiAnalysis?.isScam || aiAnalysis?.scamProbability > 0.7;
  let folder = "inbox";
  if (isFlagged) {
    folder = "suspicious";
  } else if (aiAnalysis?.category === "promotional") {
    folder = "promotions";
  } else if (aiAnalysis?.category === "newsletter") {
    folder = "newsletters";
  } else if (aiAnalysis?.category === "social") {
    folder = "social";
  }
  const emailToInsert = {
    userId,
    providerId,
    externalId: emailData.externalId,
    from: emailData.from,
    to: emailData.to,
    subject: emailData.subject,
    body: emailData.body,
    receivedAt: emailData.receivedAt,
    isRead: false,
    isFlagged,
    folder,
    aiAnalysis
  };
  return storage.createEmail(emailToInsert);
}

// server/demoAuth.ts
var SEED_EMAILS = [
  {
    externalId: "seed-1",
    from: "security@paypa1-verify.com",
    to: "demo@qmail.app",
    subject: "Your account has been suspended - verify now",
    body: "We detected unusual activity on your account. Click here to verify your identity within 24 hours or your account will be permanently locked. Confirm your password and credit card number to restore access.",
    receivedAt: new Date(Date.now() - 1e3 * 60 * 40)
  },
  {
    externalId: "seed-2",
    from: "notifications@github.com",
    to: "demo@qmail.app",
    subject: "[qmail] New pull request opened: Add scam detection dashboard",
    body: "A new pull request was opened in kumailrizvi890/qmail. Review the changes and merge when ready.",
    receivedAt: new Date(Date.now() - 1e3 * 60 * 60 * 3)
  },
  {
    externalId: "seed-3",
    from: "deals@northface-outlet-store.com",
    to: "demo@qmail.app",
    subject: "Congratulations! You've won a free jacket - claim your prize now",
    body: "You have been selected to win a free prize! Act now, this limited time offer expires today. Click here to claim your gift card.",
    receivedAt: new Date(Date.now() - 1e3 * 60 * 60 * 6)
  },
  {
    externalId: "seed-4",
    from: "billing@digitalocean.com",
    to: "demo@qmail.app",
    subject: "Your October invoice is ready",
    body: "Your invoice for October is now available. Total amount due: $24.00. This is an automated receipt for your records.",
    receivedAt: new Date(Date.now() - 1e3 * 60 * 60 * 20)
  },
  {
    externalId: "seed-5",
    from: "newsletter@morningbrew.com",
    to: "demo@qmail.app",
    subject: "5 things to know before the market opens",
    body: "Here's today's newsletter digest covering markets, tech, and business news. Unsubscribe anytime from the link below.",
    receivedAt: new Date(Date.now() - 1e3 * 60 * 60 * 30)
  },
  {
    externalId: "seed-6",
    from: "mom@gmail.com",
    to: "demo@qmail.app",
    subject: "Dinner on Sunday?",
    body: "Hey, are you free for dinner this Sunday? Let me know what time works for you.",
    receivedAt: new Date(Date.now() - 1e3 * 60 * 60 * 48)
  }
];
var demoUserId = null;
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
      replitId: "demo-user"
    });
    await storage.createUserSettings({
      userId: user.id,
      encryptionLevel: "standard",
      keyRotationDays: 30,
      useQuantumRng: true,
      aiScanEnabled: true,
      aiUnsubscribeEnabled: true,
      theme: "system"
    });
    const provider = await storage.createEmailProvider({
      userId: user.id,
      provider: "gmail",
      credentials: { demo: true },
      active: true
    });
    for (const email of SEED_EMAILS) {
      await processIncomingEmail(user.id, provider.id, email);
    }
  }
  demoUserId = user.id;
  return user;
}
async function setupAuth(app2) {
  const demoUser = await getOrCreateDemoUser();
  app2.use((req, _res, next) => {
    req.user = {
      userId: demoUser.id,
      username: demoUser.username,
      email: demoUser.email,
      first_name: demoUser.firstName,
      last_name: demoUser.lastName,
      profile_image_url: demoUser.profileImage
    };
    req.isAuthenticated = () => true;
    req.session = req.session || {};
    req.session.passport = { user: req.user };
    next();
  });
  app2.get("/api/login", (_req, res) => res.redirect("/"));
  app2.get("/api/logout", (_req, res) => res.redirect("/"));
  app2.get("/api/callback", (_req, res) => res.redirect("/"));
}
var isAuthenticated = (_req, _res, next) => next();

// server/routes.ts
import { z } from "zod";

// shared/schema.ts
import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email"),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImage: text("profile_image"),
  replitId: text("replit_id").unique()
  // For Replit auth
});
var insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
  firstName: true,
  lastName: true,
  profileImage: true,
  replitId: true
});
var emailProviders = pgTable("email_providers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  provider: text("provider").notNull(),
  // e.g., "gmail", "outlook"
  credentials: jsonb("credentials").notNull(),
  // Encrypted credentials
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow()
});
var insertEmailProviderSchema = createInsertSchema(emailProviders).pick({
  userId: true,
  provider: true,
  credentials: true,
  active: true
});
var emails = pgTable("emails", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  providerId: integer("provider_id").notNull().references(() => emailProviders.id),
  externalId: text("external_id").notNull(),
  // ID from email provider
  from: text("from").notNull(),
  to: text("to").notNull(),
  subject: text("subject"),
  body: text("body"),
  receivedAt: timestamp("received_at"),
  isRead: boolean("is_read").default(false),
  isFlagged: boolean("is_flagged").default(false),
  folder: text("folder").default("inbox"),
  aiAnalysis: jsonb("ai_analysis"),
  // AI-generated analysis and flags
  createdAt: timestamp("created_at").defaultNow()
});
var insertEmailSchema = createInsertSchema(emails).pick({
  userId: true,
  providerId: true,
  externalId: true,
  from: true,
  to: true,
  subject: true,
  body: true,
  receivedAt: true,
  isRead: true,
  isFlagged: true,
  folder: true,
  aiAnalysis: true
});
var filterRules = pgTable("filter_rules", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  conditions: jsonb("conditions").notNull(),
  // JSON with conditions like {field, operator, value}
  actions: jsonb("actions").notNull(),
  // Actions to perform when conditions match
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow()
});
var insertFilterRuleSchema = createInsertSchema(filterRules).pick({
  userId: true,
  name: true,
  conditions: true,
  actions: true,
  isActive: true
});
var userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id).unique(),
  encryptionLevel: text("encryption_level").default("standard"),
  // standard, enhanced, maximum
  keyRotationDays: integer("key_rotation_days").default(30),
  useQuantumRng: boolean("use_quantum_rng").default(true),
  aiScanEnabled: boolean("ai_scan_enabled").default(true),
  aiUnsubscribeEnabled: boolean("ai_unsubscribe_enabled").default(true),
  theme: text("theme").default("system"),
  // light, dark, system
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var insertUserSettingsSchema = createInsertSchema(userSettings).pick({
  userId: true,
  encryptionLevel: true,
  keyRotationDays: true,
  useQuantumRng: true,
  aiScanEnabled: true,
  aiUnsubscribeEnabled: true,
  theme: true
});

// server/routes.ts
async function registerRoutes(app2) {
  await setupAuth(app2);
  app2.get("/api/auth/user", (req, res) => {
    res.json(req.session?.passport?.user || null);
  });
  app2.get("/api/settings", isAuthenticated, async (req, res) => {
    const userId = req.user.userId;
    try {
      let settings = await storage.getUserSettings(userId);
      if (!settings) {
        settings = await storage.createUserSettings({
          userId,
          encryptionLevel: "standard",
          keyRotationDays: 30,
          useQuantumRng: true,
          aiScanEnabled: true,
          aiUnsubscribeEnabled: true,
          theme: "system"
        });
      }
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to retrieve settings" });
    }
  });
  app2.patch("/api/settings", isAuthenticated, async (req, res) => {
    const userId = req.user.userId;
    try {
      const settings = await storage.updateUserSettings(userId, req.body);
      if (!settings) {
        return res.status(404).json({ message: "Settings not found" });
      }
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to update settings" });
    }
  });
  app2.get("/api/email-providers", isAuthenticated, async (req, res) => {
    const userId = req.user.userId;
    try {
      const providers = await storage.getEmailProviders(userId);
      res.json(providers);
    } catch (error) {
      res.status(500).json({ message: "Failed to retrieve email providers" });
    }
  });
  app2.post("/api/email-providers", isAuthenticated, async (req, res) => {
    const userId = req.user.userId;
    try {
      const validatedData = insertEmailProviderSchema.parse({
        ...req.body,
        userId
      });
      const provider = await storage.createEmailProvider(validatedData);
      res.status(201).json(provider);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create email provider" });
    }
  });
  app2.delete("/api/email-providers/:id", isAuthenticated, async (req, res) => {
    const userId = req.user.userId;
    const providerId = parseInt(req.params.id);
    try {
      const provider = await storage.getEmailProviders(userId).then((providers) => providers.find((p) => p.id === providerId));
      if (!provider) {
        return res.status(404).json({ message: "Provider not found" });
      }
      if (provider.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      await storage.deleteEmailProvider(providerId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete email provider" });
    }
  });
  app2.get("/api/emails", isAuthenticated, async (req, res) => {
    const userId = req.user.userId;
    const folder = req.query.folder;
    try {
      const filters = folder ? { userId, folder } : { userId };
      const emails2 = await storage.getEmails(userId, filters);
      res.json(emails2);
    } catch (error) {
      res.status(500).json({ message: "Failed to retrieve emails" });
    }
  });
  app2.get("/api/emails/:id", isAuthenticated, async (req, res) => {
    const userId = req.user.userId;
    const emailId = parseInt(req.params.id);
    try {
      const email = await storage.getEmailById(emailId);
      if (!email) {
        return res.status(404).json({ message: "Email not found" });
      }
      if (email.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      res.json(email);
    } catch (error) {
      res.status(500).json({ message: "Failed to retrieve email" });
    }
  });
  app2.patch("/api/emails/:id", isAuthenticated, async (req, res) => {
    const userId = req.user.userId;
    const emailId = parseInt(req.params.id);
    try {
      const email = await storage.getEmailById(emailId);
      if (!email) {
        return res.status(404).json({ message: "Email not found" });
      }
      if (email.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      const updatedEmail = await storage.updateEmail(emailId, req.body);
      res.json(updatedEmail);
    } catch (error) {
      res.status(500).json({ message: "Failed to update email" });
    }
  });
  app2.get("/api/filter-rules", isAuthenticated, async (req, res) => {
    const userId = req.user.userId;
    try {
      const rules = await storage.getFilterRules(userId);
      res.json(rules);
    } catch (error) {
      res.status(500).json({ message: "Failed to retrieve filter rules" });
    }
  });
  app2.post("/api/filter-rules", isAuthenticated, async (req, res) => {
    const userId = req.user.userId;
    try {
      const validatedData = insertFilterRuleSchema.parse({
        ...req.body,
        userId
      });
      const rule = await storage.createFilterRule(validatedData);
      res.status(201).json(rule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create filter rule" });
    }
  });
  app2.patch("/api/filter-rules/:id", isAuthenticated, async (req, res) => {
    const userId = req.user.userId;
    const ruleId = parseInt(req.params.id);
    try {
      const rule = (await storage.getFilterRules(userId)).find((r) => r.id === ruleId);
      if (!rule) {
        return res.status(404).json({ message: "Rule not found" });
      }
      if (rule.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      const updatedRule = await storage.updateFilterRule(ruleId, req.body);
      res.json(updatedRule);
    } catch (error) {
      res.status(500).json({ message: "Failed to update filter rule" });
    }
  });
  app2.delete("/api/filter-rules/:id", isAuthenticated, async (req, res) => {
    const userId = req.user.userId;
    const ruleId = parseInt(req.params.id);
    try {
      const rule = (await storage.getFilterRules(userId)).find((r) => r.id === ruleId);
      if (!rule) {
        return res.status(404).json({ message: "Rule not found" });
      }
      if (rule.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      await storage.deleteFilterRule(ruleId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete filter rule" });
    }
  });
  app2.get("/api/security-stats", isAuthenticated, async (req, res) => {
    const userId = req.user.userId;
    try {
      const thirtyDaysAgo = /* @__PURE__ */ new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const emails2 = await storage.getEmails(userId);
      const scamBlocked = emails2.filter((email) => email.isFlagged).length;
      const encrypted = emails2.filter((email) => email.folder === "sent").length;
      let unsubscribeCount = 0;
      for (const email of emails2) {
        if (email.aiAnalysis && email.aiAnalysis.unsubscribeRecommended) {
          unsubscribeCount++;
        }
      }
      res.json({
        scamBlocked,
        encrypted,
        unsubscribeCount,
        emailsAnalyzed: emails2.length
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to retrieve security stats" });
    }
  });
  app2.post("/api/emails/analyze", isAuthenticated, async (req, res) => {
    try {
      const { from, subject, body } = req.body;
      const analysis = await analyzeEmail(from, subject, body);
      res.json(analysis);
    } catch (error) {
      res.status(500).json({ message: "Failed to analyze email" });
    }
  });
  app2.post("/api/emails/encrypt", isAuthenticated, async (req, res) => {
    try {
      const { to, from, subject, body, useQuantumRng } = req.body;
      const encrypted = await encryptEmail(to, from, subject, body, useQuantumRng);
      res.json(encrypted);
    } catch (error) {
      res.status(500).json({ message: "Failed to encrypt email" });
    }
  });
  app2.post("/api/generate-unsubscribe", isAuthenticated, async (req, res) => {
    try {
      const { to, fromName, serviceDescription } = req.body;
      const unsubscribeEmail = await generateUnsubscribeEmail(to, fromName, serviceDescription);
      res.json({ email: unsubscribeEmail });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate unsubscribe email" });
    }
  });
  app2.post("/api/quantum-random", isAuthenticated, async (req, res) => {
    try {
      const { length = 32 } = req.body;
      const randomString = await generateSecureRandomString(length);
      res.json({ random: randomString });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate quantum random number" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// api-src/index.ts
var app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
  });
  next();
});
var readyPromise = null;
function ready() {
  if (!readyPromise) {
    readyPromise = registerRoutes(app);
  }
  return readyPromise;
}
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});
async function handler(req, res) {
  await ready();
  app(req, res);
}
export {
  handler as default
};
