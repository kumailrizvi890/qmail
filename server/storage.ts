import { users, type User, type InsertUser, userSettings, type UserSettings, type InsertUserSettings, emails, type Email, type InsertEmail, filterRules, type FilterRule, type InsertFilterRule, emailProviders, type EmailProvider, type InsertEmailProvider } from "../shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

// modify the interface with any CRUD methods
// you might need
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByReplitId(replitId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>;

  // Email provider methods
  getEmailProviders(userId: number): Promise<EmailProvider[]>;
  createEmailProvider(provider: InsertEmailProvider): Promise<EmailProvider>;
  updateEmailProvider(id: number, provider: Partial<EmailProvider>): Promise<EmailProvider | undefined>;
  deleteEmailProvider(id: number): Promise<boolean>;

  // Email methods
  getEmails(userId: number, filters?: Partial<Email>): Promise<Email[]>;
  getEmailById(id: number): Promise<Email | undefined>;
  createEmail(email: InsertEmail): Promise<Email>;
  updateEmail(id: number, email: Partial<Email>): Promise<Email | undefined>;
  deleteEmail(id: number): Promise<boolean>;

  // Filter rule methods
  getFilterRules(userId: number): Promise<FilterRule[]>;
  createFilterRule(rule: InsertFilterRule): Promise<FilterRule>;
  updateFilterRule(id: number, rule: Partial<FilterRule>): Promise<FilterRule | undefined>;
  deleteFilterRule(id: number): Promise<boolean>;

  // User settings methods
  getUserSettings(userId: number): Promise<UserSettings | undefined>;
  createUserSettings(settings: InsertUserSettings): Promise<UserSettings>;
  updateUserSettings(userId: number, settings: Partial<UserSettings>): Promise<UserSettings | undefined>;

  // Session store
  sessionStore: session.SessionStore;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private emailProviders: Map<number, EmailProvider>;
  private emails: Map<number, Email>;
  private filterRules: Map<number, FilterRule>;
  private userSettings: Map<number, UserSettings>;
  public sessionStore: session.SessionStore;
  
  private currentUserId: number;
  private currentEmailProviderId: number;
  private currentEmailId: number;
  private currentFilterRuleId: number;
  private currentUserSettingsId: number;

  constructor() {
    this.users = new Map();
    this.emailProviders = new Map();
    this.emails = new Map();
    this.filterRules = new Map();
    this.userSettings = new Map();
    
    this.currentUserId = 1;
    this.currentEmailProviderId = 1;
    this.currentEmailId = 1;
    this.currentFilterRuleId = 1;
    this.currentUserSettingsId = 1;
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24h in ms
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByReplitId(replitId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.replitId === replitId,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Email provider methods
  async getEmailProviders(userId: number): Promise<EmailProvider[]> {
    return Array.from(this.emailProviders.values()).filter(
      (provider) => provider.userId === userId,
    );
  }

  async createEmailProvider(provider: InsertEmailProvider): Promise<EmailProvider> {
    const id = this.currentEmailProviderId++;
    const now = new Date();
    const newProvider: EmailProvider = { 
      ...provider, 
      id, 
      createdAt: now 
    };
    this.emailProviders.set(id, newProvider);
    return newProvider;
  }

  async updateEmailProvider(id: number, updates: Partial<EmailProvider>): Promise<EmailProvider | undefined> {
    const provider = this.emailProviders.get(id);
    if (!provider) return undefined;
    
    const updatedProvider = { ...provider, ...updates };
    this.emailProviders.set(id, updatedProvider);
    return updatedProvider;
  }

  async deleteEmailProvider(id: number): Promise<boolean> {
    return this.emailProviders.delete(id);
  }

  // Email methods
  async getEmails(userId: number, filters?: Partial<Email>): Promise<Email[]> {
    let emails = Array.from(this.emails.values()).filter(
      (email) => email.userId === userId,
    );
    
    if (filters) {
      emails = emails.filter(email => {
        for (const [key, value] of Object.entries(filters)) {
          if (email[key as keyof Email] !== value) {
            return false;
          }
        }
        return true;
      });
    }
    
    return emails;
  }

  async getEmailById(id: number): Promise<Email | undefined> {
    return this.emails.get(id);
  }

  async createEmail(email: InsertEmail): Promise<Email> {
    const id = this.currentEmailId++;
    const now = new Date();
    const newEmail: Email = { 
      ...email, 
      id, 
      createdAt: now 
    };
    this.emails.set(id, newEmail);
    return newEmail;
  }

  async updateEmail(id: number, updates: Partial<Email>): Promise<Email | undefined> {
    const email = this.emails.get(id);
    if (!email) return undefined;
    
    const updatedEmail = { ...email, ...updates };
    this.emails.set(id, updatedEmail);
    return updatedEmail;
  }

  async deleteEmail(id: number): Promise<boolean> {
    return this.emails.delete(id);
  }

  // Filter rule methods
  async getFilterRules(userId: number): Promise<FilterRule[]> {
    return Array.from(this.filterRules.values()).filter(
      (rule) => rule.userId === userId,
    );
  }

  async createFilterRule(rule: InsertFilterRule): Promise<FilterRule> {
    const id = this.currentFilterRuleId++;
    const now = new Date();
    const newRule: FilterRule = { 
      ...rule, 
      id, 
      createdAt: now 
    };
    this.filterRules.set(id, newRule);
    return newRule;
  }

  async updateFilterRule(id: number, updates: Partial<FilterRule>): Promise<FilterRule | undefined> {
    const rule = this.filterRules.get(id);
    if (!rule) return undefined;
    
    const updatedRule = { ...rule, ...updates };
    this.filterRules.set(id, updatedRule);
    return updatedRule;
  }

  async deleteFilterRule(id: number): Promise<boolean> {
    return this.filterRules.delete(id);
  }

  // User settings methods
  async getUserSettings(userId: number): Promise<UserSettings | undefined> {
    return Array.from(this.userSettings.values()).find(
      (settings) => settings.userId === userId,
    );
  }

  async createUserSettings(settings: InsertUserSettings): Promise<UserSettings> {
    const id = this.currentUserSettingsId++;
    const now = new Date();
    const newSettings: UserSettings = { 
      ...settings, 
      id, 
      createdAt: now,
      updatedAt: now
    };
    this.userSettings.set(id, newSettings);
    return newSettings;
  }

  async updateUserSettings(userId: number, updates: Partial<UserSettings>): Promise<UserSettings | undefined> {
    const settings = Array.from(this.userSettings.values()).find(
      (s) => s.userId === userId,
    );
    
    if (!settings) return undefined;
    
    const now = new Date();
    const updatedSettings = { 
      ...settings, 
      ...updates,
      updatedAt: now
    };
    
    this.userSettings.set(settings.id, updatedSettings);
    return updatedSettings;
  }
}

export const storage = new MemStorage();
