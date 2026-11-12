import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./demoAuth";
import { z } from "zod";
import { insertEmailProviderSchema, insertFilterRuleSchema } from "@shared/schema";
import { encryptEmail, processIncomingEmail, applyFilterRules } from "./email-service";
import { analyzeEmail, generateUnsubscribeEmail } from "./openai-service";
import { generateQuantumKey, generateSecureRandomString } from "./azure-quantum";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

  // Get current authenticated user
  app.get('/api/auth/user', (req: any, res) => {
    res.json(req.session?.passport?.user || null);
  });

  // User settings routes
  app.get('/api/settings', isAuthenticated, async (req: any, res) => {
    const userId = req.user.userId;
    try {
      let settings = await storage.getUserSettings(userId);

      // Create default settings if none exist
      if (!settings) {
        settings = await storage.createUserSettings({
          userId,
          encryptionLevel: "standard",
          keyRotationDays: 30,
          useQuantumRng: true,
          aiScanEnabled: true,
          aiUnsubscribeEnabled: true,
          theme: "system",
        });
      }

      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: 'Failed to retrieve settings' });
    }
  });

  app.patch('/api/settings', isAuthenticated, async (req: any, res) => {
    const userId = req.user.userId;
    try {
      const updatedSettings = await storage.updateUserSettings(userId, req.body);
      res.json(updatedSettings);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update settings' });
    }
  });

  // Email provider routes
  app.get('/api/email-providers', isAuthenticated, async (req: any, res) => {
    const userId = req.user.userId;
    try {
      const providers = await storage.getEmailProviders(userId);
      res.json(providers);
    } catch (error) {
      res.status(500).json({ message: 'Failed to retrieve email providers' });
    }
  });

  app.post('/api/email-providers', isAuthenticated, async (req: any, res) => {
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
        return res.status(400).json({ message: 'Invalid data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create email provider' });
    }
  });

  app.patch('/api/email-providers/:id', isAuthenticated, async (req: any, res) => {
    const userId = req.user.userId;
    const providerId = parseInt(req.params.id);
    try {
      const providers = await storage.getEmailProviders(userId);
      const provider = providers.find(p => p.id === providerId);
      if (!provider) {
        return res.status(404).json({ message: 'Provider not found' });
      }

      if (provider.userId !== userId) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      const updatedProvider = await storage.updateEmailProvider(providerId, req.body);
      res.json(updatedProvider);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update email provider' });
    }
  });

  app.delete('/api/email-providers/:id', isAuthenticated, async (req: any, res) => {
    const userId = req.user.userId;
    const providerId = parseInt(req.params.id);
    try {
      const providers = await storage.getEmailProviders(userId);
      const provider = providers.find(p => p.id === providerId);
      if (!provider) {
        return res.status(404).json({ message: 'Provider not found' });
      }

      if (provider.userId !== userId) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      await storage.deleteEmailProvider(providerId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete email provider' });
    }
  });

  // Email routes
  app.get('/api/emails', isAuthenticated, async (req: any, res) => {
    const userId = req.user.userId;
    const { folder } = req.query;
    try {
      const filters = folder ? { userId, folder } : { userId };
      const emails = await storage.getEmails(userId, filters);
      res.json(emails);
    } catch (error) {
      res.status(500).json({ message: 'Failed to retrieve emails' });
    }
  });

  // Send an email. It stays in this mailbox, in Sent, so the demo can
  // show it without sending real mail.
  app.post('/api/emails', isAuthenticated, async (req: any, res) => {
    const userId = req.user.userId;
    const { to, subject, body } = req.body ?? {};
    if (typeof to !== 'string' || !to.trim() || typeof subject !== 'string' || !subject.trim()) {
      return res.status(400).json({ message: 'A recipient and a subject are required' });
    }
    try {
      const providers = await storage.getEmailProviders(userId);
      const email = await storage.createEmail({
        userId,
        providerId: providers[0]?.id ?? 0,
        externalId: `sent-${Date.now()}`,
        from: req.user.email,
        to: to.trim(),
        subject: subject.trim(),
        body: typeof body === 'string' ? body : '',
        receivedAt: new Date(),
        isRead: true,
        isFlagged: false,
        folder: 'sent',
        aiAnalysis: null,
      });
      res.status(201).json(email);
    } catch (error) {
      res.status(500).json({ message: 'Failed to send email' });
    }
  });

  app.get('/api/emails/:id', isAuthenticated, async (req: any, res) => {
    const userId = req.user.userId;
    const emailId = parseInt(req.params.id);
    try {
      const email = await storage.getEmailById(emailId);
      if (!email) {
        return res.status(404).json({ message: 'Email not found' });
      }

      if (email.userId !== userId) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      res.json(email);
    } catch (error) {
      res.status(500).json({ message: 'Failed to retrieve email' });
    }
  });

  app.patch('/api/emails/:id', isAuthenticated, async (req: any, res) => {
    const userId = req.user.userId;
    const emailId = parseInt(req.params.id);
    try {
      const email = await storage.getEmailById(emailId);
      if (!email) {
        return res.status(404).json({ message: 'Email not found' });
      }

      if (email.userId !== userId) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      const updatedEmail = await storage.updateEmail(emailId, req.body);
      res.json(updatedEmail);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update email' });
    }
  });

  // Filter rules routes
  app.get('/api/filter-rules', isAuthenticated, async (req: any, res) => {
    const userId = req.user.userId;
    try {
      const rules = await storage.getFilterRules(userId);
      res.json(rules);
    } catch (error) {
      res.status(500).json({ message: 'Failed to retrieve filter rules' });
    }
  });

  app.post('/api/filter-rules', isAuthenticated, async (req: any, res) => {
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
        return res.status(400).json({ message: 'Invalid data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create filter rule' });
    }
  });

  app.patch('/api/filter-rules/:id', isAuthenticated, async (req: any, res) => {
    const userId = req.user.userId;
    const ruleId = parseInt(req.params.id);
    try {
      const rule = (await storage.getFilterRules(userId))
        .find(r => r.id === ruleId);
      if (!rule) {
        return res.status(404).json({ message: 'Rule not found' });
      }

      if (rule.userId !== userId) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      const updatedRule = await storage.updateFilterRule(ruleId, req.body);
      res.json(updatedRule);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update filter rule' });
    }
  });

  app.delete('/api/filter-rules/:id', isAuthenticated, async (req: any, res) => {
    const userId = req.user.userId;
    const ruleId = parseInt(req.params.id);
    try {
      const rule = (await storage.getFilterRules(userId))
        .find(r => r.id === ruleId);
      if (!rule) {
        return res.status(404).json({ message: 'Rule not found' });
      }

      if (rule.userId !== userId) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      await storage.deleteFilterRule(ruleId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete filter rule' });
    }
  });

  // Security and AI endpoints
  app.get('/api/security-stats', isAuthenticated, async (req: any, res) => {
    const userId = req.user.userId;
    try {
      const emails = await storage.getEmails(userId);
      const scamBlocked = emails.filter(email => email.isFlagged).length;
      const unsubscribeCount = emails.filter(email => email.aiAnalysis?.unsubscribeRecommended).length;
      const encrypted = emails.filter(email => email.folder === 'sent').length;

      res.json({
        scamBlocked,
        encrypted,
        unsubscribeCount,
        emailsAnalyzed: emails.length
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch security stats' });
    }
  });

  // Email analysis routes
  app.post('/api/emails/analyze', isAuthenticated, async (req: any, res) => {
    const { from, subject, body } = req.body;
    try {
      const analysis = await analyzeEmail(from, subject, body);
      res.json(analysis);
    } catch (error) {
      console.error("Email analysis error:", error);
      res.status(500).json({ message: 'Failed to analyze email' });
    }
  });

  app.post('/api/emails/encrypt', isAuthenticated, async (req: any, res) => {
    const { emailId } = req.body;
    try {
      const result = await encryptEmail(emailId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: 'Failed to encrypt email' });
    }
  });

  // Unsubscribe email generation
  app.post('/api/generate-unsubscribe', isAuthenticated, async (req: any, res) => {
    const { to, fromName, serviceDescription } = req.body;
    try {
      const email = await generateUnsubscribeEmail(to, fromName, serviceDescription);
      res.json({ email });
    } catch (error) {
      res.status(500).json({ message: 'Failed to generate unsubscribe email' });
    }
  });

  app.post('/api/quantum-random', isAuthenticated, async (req: any, res) => {
    try {
      const randomBytes = await generateQuantumKey(32);
      res.json({ randomBytes });
    } catch (error) {
      res.status(500).json({ message: 'Failed to generate quantum random bytes' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
