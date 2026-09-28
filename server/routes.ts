import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./demoAuth";
import { z } from "zod";
import { insertEmailProviderSchema, insertFilterRuleSchema } from "@shared/schema";
import { encryptEmail, processIncomingEmail, applyFilterRules } from "./email-service";
import { generateUnsubscribeEmail } from "./openai-service";
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
      const settings = await storage.updateUserSettings(userId, req.body);
      if (!settings) {
        return res.status(404).json({ message: 'Settings not found' });
      }
      res.json(settings);
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

  app.delete('/api/email-providers/:id', isAuthenticated, async (req: any, res) => {
    const userId = req.user.userId;
    const providerId = parseInt(req.params.id);
    
    try {
      const provider = await storage.getEmailProviders(userId)
        .then(providers => providers.find(p => p.id === providerId));
      
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
    const folder = req.query.folder as string | undefined;
    
    try {
      const filters = folder ? { userId, folder } : { userId };
      const emails = await storage.getEmails(userId, filters);
      res.json(emails);
    } catch (error) {
      res.status(500).json({ message: 'Failed to retrieve emails' });
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
      // Get emails from the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const emails = await storage.getEmails(userId);
      
      // Calculate security statistics
      const scamBlocked = emails.filter(email => email.isFlagged).length;
      const encrypted = emails.filter(email => email.folder === 'sent').length;
      
      // Count recommended unsubscribes
      let unsubscribeCount = 0;
      for (const email of emails) {
        if (email.aiAnalysis && (email.aiAnalysis as any).unsubscribeRecommended) {
          unsubscribeCount++;
        }
      }
      
      res.json({
        scamBlocked,
        encrypted,
        unsubscribeCount,
        emailsAnalyzed: emails.length
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to retrieve security stats' });
    }
  });

  app.post('/api/emails/analyze', isAuthenticated, async (req: any, res) => {
    try {
      const { from, subject, body } = req.body;
      const analysis = await analyzeEmail(from, subject, body);
      res.json(analysis);
    } catch (error) {
      res.status(500).json({ message: 'Failed to analyze email' });
    }
  });

  app.post('/api/emails/encrypt', isAuthenticated, async (req: any, res) => {
    try {
      const { to, from, subject, body, useQuantumRng } = req.body;
      const encrypted = await encryptEmail(to, from, subject, body, useQuantumRng);
      res.json(encrypted);
    } catch (error) {
      res.status(500).json({ message: 'Failed to encrypt email' });
    }
  });

  app.post('/api/generate-unsubscribe', isAuthenticated, async (req: any, res) => {
    try {
      const { to, fromName, serviceDescription } = req.body;
      const unsubscribeEmail = await generateUnsubscribeEmail(to, fromName, serviceDescription);
      res.json({ email: unsubscribeEmail });
    } catch (error) {
      res.status(500).json({ message: 'Failed to generate unsubscribe email' });
    }
  });

  app.post('/api/quantum-random', isAuthenticated, async (req: any, res) => {
    try {
      const { length = 32 } = req.body;
      const randomString = await generateSecureRandomString(length);
      res.json({ random: randomString });
    } catch (error) {
      res.status(500).json({ message: 'Failed to generate quantum random number' });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);
  return httpServer;
}
