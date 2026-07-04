import type {
  ApprovalRequest,
  AuditLog,
  Business,
  CampaignMetrics,
  CampaignPlan,
  MarketingObjective,
  Recommendation,
  StrategyPlan,
} from "@/lib/types/marketing";
import type {
  BrandDocument,
  BrandKnowledgeChunk,
  BrandProfile,
} from "@/lib/types/brand";
import type { CampaignBlueprint } from "@/lib/types/campaignBlueprint";
import { v4 as uuidv4 } from "uuid";
import { getDemoUserId } from "@/lib/auth/getUserId";

interface MockStore {
  businesses: Business[];
  objectives: MarketingObjective[];
  strategies: StrategyPlan[];
  campaignPlans: CampaignPlan[];
  approvalRequests: ApprovalRequest[];
  metrics: CampaignMetrics[];
  recommendations: Recommendation[];
  auditLogs: AuditLog[];
  brandProfiles: BrandProfile[];
  brandDocuments: BrandDocument[];
  brandKnowledgeChunks: BrandKnowledgeChunk[];
  campaignBlueprints: CampaignBlueprint[];
}

const globalForMock = globalThis as unknown as {
  __mockStore?: MockStore;
};

function getStore(): MockStore {
  if (!globalForMock.__mockStore) {
    globalForMock.__mockStore = {
      businesses: [],
      objectives: [],
      strategies: [],
      campaignPlans: [],
      approvalRequests: [],
      metrics: [],
      recommendations: [],
      auditLogs: [],
      brandProfiles: [],
      brandDocuments: [],
      brandKnowledgeChunks: [],
      campaignBlueprints: [],
    };
  }
  return globalForMock.__mockStore;
}

function now(): string {
  return new Date().toISOString();
}

export const mockStore = {
  getStore,

  createBusiness(data: Omit<Business, "id" | "created_at" | "user_id"> & { user_id?: string }): Business {
    const store = getStore();
    const business: Business = {
      id: uuidv4(),
      user_id: data.user_id ?? getDemoUserId(),
      created_at: now(),
      ...data,
    };
    store.businesses.push(business);
    return business;
  },

  getBusinesses(userId?: string): Business[] {
    const uid = userId ?? getDemoUserId();
    return getStore().businesses.filter((b) => b.user_id === uid);
  },

  createObjective(
    data: Omit<MarketingObjective, "id" | "created_at" | "status">
  ): MarketingObjective {
    const store = getStore();
    const objective: MarketingObjective = {
      id: uuidv4(),
      status: "DRAFT",
      created_at: now(),
      ...data,
    };
    store.objectives.push(objective);
    return objective;
  },

  getObjectives(): MarketingObjective[] {
    return getStore().objectives;
  },

  getObjective(id: string): MarketingObjective | undefined {
    return getStore().objectives.find((o) => o.id === id);
  },

  createStrategy(data: Omit<StrategyPlan, "id" | "created_at">): StrategyPlan {
    const store = getStore();
    const strategy: StrategyPlan = {
      id: uuidv4(),
      created_at: now(),
      ...data,
    };
    store.strategies.push(strategy);
    return strategy;
  },

  getStrategies(objectiveId?: string): StrategyPlan[] {
    const strategies = getStore().strategies;
    if (objectiveId) return strategies.filter((s) => s.objective_id === objectiveId);
    return strategies;
  },

  createCampaignPlan(
    data: Omit<CampaignPlan, "id" | "created_at">
  ): CampaignPlan {
    const store = getStore();
    const plan: CampaignPlan = {
      id: uuidv4(),
      created_at: now(),
      ...data,
    };
    store.campaignPlans.push(plan);
    return plan;
  },

  getCampaignPlans(objectiveId?: string): CampaignPlan[] {
    const plans = getStore().campaignPlans;
    if (objectiveId) return plans.filter((p) => p.objective_id === objectiveId);
    return plans;
  },

  getCampaignPlan(id: string): CampaignPlan | undefined {
    return getStore().campaignPlans.find((p) => p.id === id);
  },

  updateCampaignPlan(
    id: string,
    updates: Partial<CampaignPlan>
  ): CampaignPlan | undefined {
    const store = getStore();
    const idx = store.campaignPlans.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;
    store.campaignPlans[idx] = { ...store.campaignPlans[idx], ...updates };
    return store.campaignPlans[idx];
  },

  createApprovalRequest(
    data: Omit<
      ApprovalRequest,
      "id" | "created_at" | "approved_by" | "approved_at" | "rejected_at"
    >
  ): ApprovalRequest {
    const store = getStore();
    const request: ApprovalRequest = {
      id: uuidv4(),
      created_at: now(),
      ...data,
    };
    store.approvalRequests.push(request);
    return request;
  },

  getApprovalRequests(status?: string): ApprovalRequest[] {
    const requests = getStore().approvalRequests;
    if (status) return requests.filter((r) => r.status === status);
    return requests;
  },

  getApprovalRequest(id: string): ApprovalRequest | undefined {
    return getStore().approvalRequests.find((r) => r.id === id);
  },

  updateApprovalRequest(
    id: string,
    updates: Partial<ApprovalRequest>
  ): ApprovalRequest | undefined {
    const store = getStore();
    const idx = store.approvalRequests.findIndex((r) => r.id === id);
    if (idx === -1) return undefined;
    store.approvalRequests[idx] = { ...store.approvalRequests[idx], ...updates };
    return store.approvalRequests[idx];
  },

  createMetrics(
    data: Omit<CampaignMetrics, "id" | "created_at">
  ): CampaignMetrics {
    const store = getStore();
    const metric: CampaignMetrics = {
      id: uuidv4(),
      created_at: now(),
      ...data,
    };
    store.metrics.push(metric);
    return metric;
  },

  getMetrics(campaignPlanId?: string): CampaignMetrics[] {
    const metrics = getStore().metrics;
    if (campaignPlanId)
      return metrics.filter((m) => m.campaign_plan_id === campaignPlanId);
    return metrics;
  },

  createRecommendation(
    data: Omit<Recommendation, "id" | "created_at">
  ): Recommendation {
    const store = getStore();
    const rec: Recommendation = {
      id: uuidv4(),
      created_at: now(),
      ...data,
    };
    store.recommendations.push(rec);
    return rec;
  },

  getRecommendations(campaignPlanId?: string): Recommendation[] {
    const recs = getStore().recommendations;
    if (campaignPlanId)
      return recs.filter((r) => r.campaign_plan_id === campaignPlanId);
    return recs;
  },

  getRecommendation(id: string): Recommendation | undefined {
    return getStore().recommendations.find((r) => r.id === id);
  },

  updateRecommendation(
    id: string,
    updates: Partial<Recommendation>
  ): Recommendation | undefined {
    const store = getStore();
    const idx = store.recommendations.findIndex((r) => r.id === id);
    if (idx === -1) return undefined;
    store.recommendations[idx] = { ...store.recommendations[idx], ...updates };
    return store.recommendations[idx];
  },

  createAuditLog(
    data: Omit<AuditLog, "id" | "created_at">
  ): AuditLog {
    const store = getStore();
    const log: AuditLog = {
      id: uuidv4(),
      created_at: now(),
      ...data,
    };
    store.auditLogs.push(log);
    return log;
  },

  getAuditLogs(): AuditLog[] {
    return getStore().auditLogs;
  },

  getBusiness(id: string): Business | undefined {
    return getStore().businesses.find((b) => b.id === id);
  },

  findBusinessByName(name: string, userId?: string): Business | undefined {
    const uid = userId ?? getDemoUserId();
    const normalized = name.trim().toLowerCase();
    return getStore().businesses.find(
      (b) => b.user_id === uid && b.name.trim().toLowerCase() === normalized
    );
  },

  createBrandProfile(
    data: Omit<BrandProfile, "id" | "created_at" | "updated_at">
  ): BrandProfile {
    const store = getStore();
    const ts = now();
    const profile: BrandProfile = {
      id: uuidv4(),
      created_at: ts,
      updated_at: ts,
      ...data,
    };
    store.brandProfiles.push(profile);
    return profile;
  },

  getBrandProfile(businessId: string): BrandProfile | undefined {
    return getStore().brandProfiles.find((p) => p.business_id === businessId);
  },

  updateBrandProfile(
    id: string,
    updates: Partial<Omit<BrandProfile, "id" | "business_id" | "created_at">>
  ): BrandProfile | undefined {
    const store = getStore();
    const idx = store.brandProfiles.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;
    store.brandProfiles[idx] = {
      ...store.brandProfiles[idx],
      ...updates,
      updated_at: now(),
    };
    return store.brandProfiles[idx];
  },

  createBrandDocument(
    data: Omit<BrandDocument, "id" | "created_at">
  ): BrandDocument {
    const store = getStore();
    const doc: BrandDocument = {
      id: uuidv4(),
      created_at: now(),
      ...data,
    };
    store.brandDocuments.push(doc);
    return doc;
  },

  getBrandDocuments(businessId: string): BrandDocument[] {
    return getStore().brandDocuments.filter((d) => d.business_id === businessId);
  },

  deleteBrandDocument(id: string): boolean {
    const store = getStore();
    const idx = store.brandDocuments.findIndex((d) => d.id === id);
    if (idx === -1) return false;
    store.brandDocuments.splice(idx, 1);
    store.brandKnowledgeChunks = store.brandKnowledgeChunks.filter(
      (c) => c.document_id !== id
    );
    return true;
  },

  createBrandKnowledgeChunk(
    data: Omit<BrandKnowledgeChunk, "id" | "created_at">
  ): BrandKnowledgeChunk {
    const store = getStore();
    const chunk: BrandKnowledgeChunk = {
      id: uuidv4(),
      created_at: now(),
      ...data,
    };
    store.brandKnowledgeChunks.push(chunk);
    return chunk;
  },

  getBrandKnowledgeChunks(businessId: string): BrandKnowledgeChunk[] {
    return getStore().brandKnowledgeChunks.filter(
      (c) => c.business_id === businessId
    );
  },

  deleteBrandKnowledgeChunks(businessId: string): void {
    const store = getStore();
    store.brandKnowledgeChunks = store.brandKnowledgeChunks.filter(
      (c) => c.business_id !== businessId
    );
  },

  createCampaignBlueprint(
    data: Omit<CampaignBlueprint, "id" | "created_at">
  ): CampaignBlueprint {
    const store = getStore();
    const blueprint: CampaignBlueprint = {
      id: uuidv4(),
      created_at: now(),
      ...data,
    };
    store.campaignBlueprints.push(blueprint);
    return blueprint;
  },

  getCampaignBlueprints(userId?: string): CampaignBlueprint[] {
    const uid = userId ?? getDemoUserId();
    return getStore()
      .campaignBlueprints.filter((b) => b.user_id === uid)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  },

  getCampaignBlueprint(id: string, userId?: string): CampaignBlueprint | undefined {
    const uid = userId ?? getDemoUserId();
    return getStore().campaignBlueprints.find(
      (b) => b.id === id && b.user_id === uid
    );
  },

  updateCampaignBlueprint(
    id: string,
    userId: string,
    updates: {
      status?: CampaignBlueprint["status"];
      review?: CampaignBlueprint["review"];
    }
  ): CampaignBlueprint | undefined {
    const store = getStore();
    const idx = store.campaignBlueprints.findIndex(
      (b) => b.id === id && b.user_id === userId
    );
    if (idx === -1) return undefined;
    store.campaignBlueprints[idx] = {
      ...store.campaignBlueprints[idx],
      ...updates,
    };
    return store.campaignBlueprints[idx];
  },
};
