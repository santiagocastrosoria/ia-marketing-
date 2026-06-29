import type { SupabaseClient } from "@supabase/supabase-js";
import { getDemoUserId } from "@/lib/auth/getUserId";
import { mockStore } from "@/lib/db/mockStore";
import {
  createServerSupabaseClient,
  createSupabaseAdmin,
} from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/utils/config";
import type {
  ApprovalRequest,
  AuditLog,
  Business,
  CampaignMetrics,
  CampaignPlan,
  DashboardStats,
  MarketingObjective,
  Recommendation,
  StrategyPlan,
} from "@/lib/types/marketing";
import { toObjectiveDbRow, hydrateObjectiveFromRow } from "@/lib/db/objectiveMapper";
import type {
  BrandDocument,
  BrandKnowledgeChunk,
  BrandProfile,
} from "@/lib/types/brand";

export interface Repository {
  readonly userId: string;
  createBusiness(
    data: Omit<Business, "id" | "created_at" | "user_id"> & { user_id?: string }
  ): Promise<Business>;
  getBusinesses(): Promise<Business[]>;
  createObjective(
    data: Omit<MarketingObjective, "id" | "created_at" | "status">
  ): Promise<MarketingObjective>;
  getObjectives(): Promise<MarketingObjective[]>;
  getObjective(id: string): Promise<MarketingObjective | undefined>;
  createStrategy(
    data: Omit<StrategyPlan, "id" | "created_at">
  ): Promise<StrategyPlan>;
  getStrategies(objectiveId?: string): Promise<StrategyPlan[]>;
  createCampaignPlan(
    data: Omit<CampaignPlan, "id" | "created_at">
  ): Promise<CampaignPlan>;
  getCampaignPlans(objectiveId?: string): Promise<CampaignPlan[]>;
  getCampaignPlan(id: string): Promise<CampaignPlan | undefined>;
  updateCampaignPlan(
    id: string,
    updates: Partial<CampaignPlan>
  ): Promise<CampaignPlan | undefined>;
  createApprovalRequest(
    data: Omit<
      ApprovalRequest,
      "id" | "created_at" | "approved_by" | "approved_at" | "rejected_at"
    >
  ): Promise<ApprovalRequest>;
  getApprovalRequests(status?: string): Promise<ApprovalRequest[]>;
  getApprovalRequest(id: string): Promise<ApprovalRequest | undefined>;
  updateApprovalRequest(
    id: string,
    updates: Partial<ApprovalRequest>
  ): Promise<ApprovalRequest | undefined>;
  createMetrics(
    data: Omit<CampaignMetrics, "id" | "created_at">
  ): Promise<CampaignMetrics>;
  getMetrics(campaignPlanId?: string): Promise<CampaignMetrics[]>;
  createRecommendation(
    data: Omit<Recommendation, "id" | "created_at">
  ): Promise<Recommendation>;
  getRecommendations(campaignPlanId?: string): Promise<Recommendation[]>;
  getRecommendation(id: string): Promise<Recommendation | undefined>;
  updateRecommendation(
    id: string,
    updates: Partial<Recommendation>
  ): Promise<Recommendation | undefined>;
  createAuditLog(
    data: Omit<AuditLog, "id" | "created_at">
  ): Promise<AuditLog>;
  getDashboardStats(): Promise<DashboardStats>;
  getBusiness(id: string): Promise<Business | undefined>;
  findBusinessByName(name: string): Promise<Business | undefined>;
  createBrandProfile(
    data: Omit<BrandProfile, "id" | "created_at" | "updated_at">
  ): Promise<BrandProfile>;
  getBrandProfile(businessId: string): Promise<BrandProfile | undefined>;
  updateBrandProfile(
    id: string,
    updates: Partial<Omit<BrandProfile, "id" | "business_id" | "created_at">>
  ): Promise<BrandProfile | undefined>;
  createBrandDocument(
    data: Omit<BrandDocument, "id" | "created_at">
  ): Promise<BrandDocument>;
  getBrandDocuments(businessId: string): Promise<BrandDocument[]>;
  deleteBrandDocument(id: string): Promise<boolean>;
  createBrandKnowledgeChunk(
    data: Omit<BrandKnowledgeChunk, "id" | "created_at">
  ): Promise<BrandKnowledgeChunk>;
  getBrandKnowledgeChunks(businessId: string): Promise<BrandKnowledgeChunk[]>;
  deleteBrandKnowledgeChunks(businessId: string): Promise<void>;
  assertOwnsBusiness(businessId: string): Promise<void>;
}

export async function createRepository(userId: string): Promise<Repository> {
  if (!isSupabaseConfigured()) {
    return new ScopedMockRepository(userId);
  }

  // Service role en server-side: ownership validado manualmente en SupabaseRepository.
  // Evita fallos cuando auth.uid() no está disponible en route handlers con RLS.
  const admin = createSupabaseAdmin();
  if (admin) {
    return new SupabaseRepository(userId, admin);
  }

  const client = await createServerSupabaseClient();
  return new SupabaseRepository(userId, client);
}

class ScopedMockRepository implements Repository {
  readonly userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  private ownedBusinessIds(): string[] {
    return mockStore.getBusinesses(this.userId).map((b) => b.id);
  }

  private ownedObjectiveIds(): string[] {
    const ids = this.ownedBusinessIds();
    return mockStore
      .getObjectives()
      .filter((o) => ids.includes(o.business_id))
      .map((o) => o.id);
  }

  private ownedCampaignIds(): string[] {
    const ids = this.ownedObjectiveIds();
    return mockStore
      .getCampaignPlans()
      .filter((c) => ids.includes(c.objective_id))
      .map((c) => c.id);
  }

  async assertOwnsBusiness(businessId: string): Promise<void> {
    const business = await this.getBusiness(businessId);
    if (!business) throw new Error("Negocio no encontrado o sin permisos");
  }

  async createBusiness(
    data: Omit<Business, "id" | "created_at" | "user_id"> & { user_id?: string }
  ) {
    return mockStore.createBusiness({ ...data, user_id: this.userId });
  }

  async getBusinesses() {
    return mockStore.getBusinesses(this.userId);
  }

  async createObjective(
    data: Omit<MarketingObjective, "id" | "created_at" | "status">
  ) {
    await this.assertOwnsBusiness(data.business_id);
    return mockStore.createObjective(data);
  }

  async getObjectives() {
    const ids = this.ownedBusinessIds();
    return mockStore.getObjectives().filter((o) => ids.includes(o.business_id));
  }

  async getObjective(id: string) {
    const objective = mockStore.getObjective(id);
    if (!objective) return undefined;
    const ids = this.ownedBusinessIds();
    return ids.includes(objective.business_id) ? objective : undefined;
  }

  async createStrategy(data: Omit<StrategyPlan, "id" | "created_at">) {
    const objective = await this.getObjective(data.objective_id);
    if (!objective) throw new Error("Objetivo no encontrado o sin permisos");
    return mockStore.createStrategy(data);
  }

  async getStrategies(objectiveId?: string) {
    const owned = this.ownedObjectiveIds();
    const strategies = mockStore.getStrategies(objectiveId);
    return strategies.filter((s) => owned.includes(s.objective_id));
  }

  async createCampaignPlan(data: Omit<CampaignPlan, "id" | "created_at">) {
    const objective = await this.getObjective(data.objective_id);
    if (!objective) throw new Error("Objetivo no encontrado o sin permisos");
    return mockStore.createCampaignPlan(data);
  }

  async getCampaignPlans(objectiveId?: string) {
    const owned = this.ownedObjectiveIds();
    return mockStore
      .getCampaignPlans(objectiveId)
      .filter((c) => owned.includes(c.objective_id));
  }

  async getCampaignPlan(id: string) {
    const plan = mockStore.getCampaignPlan(id);
    if (!plan) return undefined;
    const owned = this.ownedObjectiveIds();
    return owned.includes(plan.objective_id) ? plan : undefined;
  }

  async updateCampaignPlan(id: string, updates: Partial<CampaignPlan>) {
    const plan = await this.getCampaignPlan(id);
    if (!plan) return undefined;
    return mockStore.updateCampaignPlan(id, updates);
  }

  async createApprovalRequest(
    data: Omit<
      ApprovalRequest,
      "id" | "created_at" | "approved_by" | "approved_at" | "rejected_at"
    >
  ) {
    const plan = await this.getCampaignPlan(data.campaign_plan_id);
    if (!plan) throw new Error("Campaña no encontrada o sin permisos");
    return mockStore.createApprovalRequest(data);
  }

  async getApprovalRequests(status?: string) {
    const owned = this.ownedCampaignIds();
    const requests = mockStore.getApprovalRequests(status);
    return requests.filter((r) => owned.includes(r.campaign_plan_id));
  }

  async getApprovalRequest(id: string) {
    const request = mockStore.getApprovalRequest(id);
    if (!request) return undefined;
    const owned = this.ownedCampaignIds();
    return owned.includes(request.campaign_plan_id) ? request : undefined;
  }

  async updateApprovalRequest(id: string, updates: Partial<ApprovalRequest>) {
    const request = await this.getApprovalRequest(id);
    if (!request) return undefined;
    return mockStore.updateApprovalRequest(id, updates);
  }

  async createMetrics(data: Omit<CampaignMetrics, "id" | "created_at">) {
    const plan = await this.getCampaignPlan(data.campaign_plan_id);
    if (!plan) throw new Error("Campaña no encontrada o sin permisos");
    return mockStore.createMetrics(data);
  }

  async getMetrics(campaignPlanId?: string) {
    const owned = this.ownedCampaignIds();
    return mockStore
      .getMetrics(campaignPlanId)
      .filter((m) => owned.includes(m.campaign_plan_id));
  }

  async createRecommendation(data: Omit<Recommendation, "id" | "created_at">) {
    const plan = await this.getCampaignPlan(data.campaign_plan_id);
    if (!plan) throw new Error("Campaña no encontrada o sin permisos");
    return mockStore.createRecommendation(data);
  }

  async getRecommendations(campaignPlanId?: string) {
    const owned = this.ownedCampaignIds();
    return mockStore
      .getRecommendations(campaignPlanId)
      .filter((r) => owned.includes(r.campaign_plan_id));
  }

  async getRecommendation(id: string) {
    const rec = mockStore.getRecommendation(id);
    if (!rec) return undefined;
    const owned = this.ownedCampaignIds();
    return owned.includes(rec.campaign_plan_id) ? rec : undefined;
  }

  async updateRecommendation(id: string, updates: Partial<Recommendation>) {
    const rec = await this.getRecommendation(id);
    if (!rec) return undefined;
    return mockStore.updateRecommendation(id, updates);
  }

  async createAuditLog(data: Omit<AuditLog, "id" | "created_at">) {
    return mockStore.createAuditLog({ ...data, user_id: this.userId });
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const campaigns = await this.getCampaignPlans();
    const metrics = await this.getMetrics();
    const approvals = await this.getApprovalRequests("PENDING");
    const recommendations = (await this.getRecommendations())
      .filter((r) => r.status === "PENDING")
      .slice(0, 5);

    const totalLeads = metrics.reduce((s, m) => s + m.leads, 0);
    const avgCpl =
      metrics.length > 0
        ? metrics.reduce((s, m) => s + m.cpl, 0) / metrics.length
        : 0;
    const avgCtr =
      metrics.length > 0
        ? metrics.reduce((s, m) => s + m.ctr, 0) / metrics.length
        : 0;
    const avgCpc =
      metrics.length > 0
        ? metrics.reduce((s, m) => s + m.cpc, 0) / metrics.length
        : 0;

    return {
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter((c) => c.status === "ACTIVE").length,
      pausedCampaigns: campaigns.filter(
        (c) => c.status === "PAUSED" || c.status === "DRAFT"
      ).length,
      pendingApprovals: approvals.length,
      dailySpendConfigured: campaigns.reduce((s, c) => s + c.dailyBudget, 0),
      totalLeads,
      avgCpl: Math.round(avgCpl * 100) / 100,
      avgCtr: Math.round(avgCtr * 10000) / 100,
      avgCpc: Math.round(avgCpc * 100) / 100,
      recommendations,
    };
  }

  async getBusiness(id: string) {
    const business = mockStore.getBusiness(id);
    return business?.user_id === this.userId ? business : undefined;
  }

  async findBusinessByName(name: string) {
    return mockStore.findBusinessByName(name, this.userId);
  }

  async createBrandProfile(
    data: Omit<BrandProfile, "id" | "created_at" | "updated_at">
  ) {
    await this.assertOwnsBusiness(data.business_id);
    return mockStore.createBrandProfile(data);
  }

  async getBrandProfile(businessId: string) {
    await this.assertOwnsBusiness(businessId);
    return mockStore.getBrandProfile(businessId);
  }

  async updateBrandProfile(
    id: string,
    updates: Partial<Omit<BrandProfile, "id" | "business_id" | "created_at">>
  ) {
    const profiles = mockStore.getStore().brandProfiles;
    const profile = profiles.find((p) => p.id === id);
    if (!profile) return undefined;
    await this.assertOwnsBusiness(profile.business_id);
    return mockStore.updateBrandProfile(id, updates);
  }

  async createBrandDocument(data: Omit<BrandDocument, "id" | "created_at">) {
    await this.assertOwnsBusiness(data.business_id);
    return mockStore.createBrandDocument(data);
  }

  async getBrandDocuments(businessId: string) {
    await this.assertOwnsBusiness(businessId);
    return mockStore.getBrandDocuments(businessId);
  }

  async deleteBrandDocument(id: string) {
    const docs = mockStore.getStore().brandDocuments;
    const doc = docs.find((d) => d.id === id);
    if (!doc) return false;
    await this.assertOwnsBusiness(doc.business_id);
    return mockStore.deleteBrandDocument(id);
  }

  async createBrandKnowledgeChunk(
    data: Omit<BrandKnowledgeChunk, "id" | "created_at">
  ) {
    await this.assertOwnsBusiness(data.business_id);
    return mockStore.createBrandKnowledgeChunk(data);
  }

  async getBrandKnowledgeChunks(businessId: string) {
    await this.assertOwnsBusiness(businessId);
    return mockStore.getBrandKnowledgeChunks(businessId);
  }

  async deleteBrandKnowledgeChunks(businessId: string) {
    await this.assertOwnsBusiness(businessId);
    return mockStore.deleteBrandKnowledgeChunks(businessId);
  }
}

class SupabaseRepository implements Repository {
  readonly userId: string;

  constructor(
    userId: string,
    private readonly client: SupabaseClient
  ) {
    this.userId = userId;
  }

  private async getOwnedBusinessIds(): Promise<string[]> {
    const { data, error } = await this.client
      .from("businesses")
      .select("id")
      .eq("user_id", this.userId);
    if (error) throw error;
    return (data ?? []).map((r) => r.id as string);
  }

  private async getOwnedObjectiveIds(): Promise<string[]> {
    const businessIds = await this.getOwnedBusinessIds();
    if (businessIds.length === 0) return [];
    const { data, error } = await this.client
      .from("marketing_objectives")
      .select("id")
      .in("business_id", businessIds);
    if (error) throw error;
    return (data ?? []).map((r) => r.id as string);
  }

  private async getOwnedCampaignIds(): Promise<string[]> {
    const objectiveIds = await this.getOwnedObjectiveIds();
    if (objectiveIds.length === 0) return [];
    const { data, error } = await this.client
      .from("campaign_plans")
      .select("id")
      .in("objective_id", objectiveIds);
    if (error) throw error;
    return (data ?? []).map((r) => r.id as string);
  }

  async assertOwnsBusiness(businessId: string): Promise<void> {
    const business = await this.getBusiness(businessId);
    if (!business) throw new Error("Negocio no encontrado o sin permisos");
  }

  async createBusiness(
    data: Omit<Business, "id" | "created_at" | "user_id"> & { user_id?: string }
  ): Promise<Business> {
    const { data: row, error } = await this.client
      .from("businesses")
      .insert({ ...data, user_id: this.userId })
      .select()
      .single();
    if (error) throw error;
    return row as Business;
  }

  async getBusinesses(): Promise<Business[]> {
    const { data, error } = await this.client
      .from("businesses")
      .select("*")
      .eq("user_id", this.userId);
    if (error) throw error;
    return data as Business[];
  }

  async createObjective(
    data: Omit<MarketingObjective, "id" | "created_at" | "status">
  ): Promise<MarketingObjective> {
    if (!data.business_id) {
      throw new Error("business_id es requerido para crear un objetivo");
    }
    await this.assertOwnsBusiness(data.business_id);
    const row = toObjectiveDbRow(data);
    const { data: inserted, error } = await this.client
      .from("marketing_objectives")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return hydrateObjectiveFromRow(inserted as MarketingObjective);
  }

  async getObjectives(): Promise<MarketingObjective[]> {
    const businessIds = await this.getOwnedBusinessIds();
    if (businessIds.length === 0) return [];
    const { data, error } = await this.client
      .from("marketing_objectives")
      .select("*")
      .in("business_id", businessIds)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as MarketingObjective[]).map(hydrateObjectiveFromRow);
  }

  async getObjective(id: string): Promise<MarketingObjective | undefined> {
    const { data, error } = await this.client
      .from("marketing_objectives")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return undefined;
    const businessIds = await this.getOwnedBusinessIds();
    return businessIds.includes(data.business_id as string)
      ? hydrateObjectiveFromRow(data as MarketingObjective)
      : undefined;
  }

  async createStrategy(
    data: Omit<StrategyPlan, "id" | "created_at">
  ): Promise<StrategyPlan> {
    const objective = await this.getObjective(data.objective_id);
    if (!objective) throw new Error("Objetivo no encontrado o sin permisos");
    const { data: row, error } = await this.client
      .from("strategy_plans")
      .insert({ objective_id: data.objective_id, plan_json: data })
      .select()
      .single();
    if (error) throw error;
    return { ...data, id: row.id, created_at: row.created_at } as StrategyPlan;
  }

  async getStrategies(objectiveId?: string): Promise<StrategyPlan[]> {
    const ownedObjectiveIds = await this.getOwnedObjectiveIds();
    if (ownedObjectiveIds.length === 0) return [];

    let query = this.client.from("strategy_plans").select("*");
    if (objectiveId) {
      if (!ownedObjectiveIds.includes(objectiveId)) return [];
      query = query.eq("objective_id", objectiveId);
    } else {
      query = query.in("objective_id", ownedObjectiveIds);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(
      (r: { plan_json: StrategyPlan; id: string; created_at: string }) => ({
        ...r.plan_json,
        id: r.id,
        created_at: r.created_at,
      })
    );
  }

  async createCampaignPlan(
    data: Omit<CampaignPlan, "id" | "created_at">
  ): Promise<CampaignPlan> {
    const objective = await this.getObjective(data.objective_id);
    if (!objective) throw new Error("Objetivo no encontrado o sin permisos");
    const { data: row, error } = await this.client
      .from("campaign_plans")
      .insert({
        objective_id: data.objective_id,
        platform: data.platform,
        campaign_name: data.campaignName,
        campaign_objective: data.objective,
        funnel_stage: data.funnelStage,
        daily_budget: data.dailyBudget,
        strategy_summary: data.strategy_summary,
        targeting_json: data.audience,
        keywords_json: data.keywords,
        negative_keywords_json: data.negativeKeywords,
        ads_json: {
          adGroups: data.adGroups,
          ads: data.ads,
          metaPlacements:
            data.platform === "META"
              ? {
                  publisherPlatforms: data.publisherPlatforms,
                  instagramPositions: data.instagramPositions,
                  facebookPositions: data.facebookPositions,
                  placementStrategy: data.placementStrategy,
                  metaChannelPreference: data.metaChannelPreference,
                  primaryChannel: data.primaryChannel,
                  primaryPlacement: data.primaryPlacement,
                }
              : data.platform === "GOOGLE"
                ? {
                    primaryChannel: data.primaryChannel,
                    primaryPlacement: data.primaryPlacement,
                  }
                : undefined,
        },
        utm_json: data.trackingUTM,
        status: data.status,
        requires_approval: data.requiresApproval,
        risk_level: data.riskLevel,
      })
      .select()
      .single();
    if (error) throw error;
    return this.mapCampaignRow(row);
  }

  private mapCampaignRow(row: Record<string, unknown>): CampaignPlan {
    const adsJson = row.ads_json as {
      adGroups?: CampaignPlan["adGroups"];
      ads?: CampaignPlan["ads"];
      metaPlacements?: {
        publisherPlatforms?: CampaignPlan["publisherPlatforms"];
        instagramPositions?: CampaignPlan["instagramPositions"];
        facebookPositions?: CampaignPlan["facebookPositions"];
        placementStrategy?: CampaignPlan["placementStrategy"];
        metaChannelPreference?: CampaignPlan["metaChannelPreference"];
        primaryChannel?: CampaignPlan["primaryChannel"];
        primaryPlacement?: CampaignPlan["primaryPlacement"];
      };
    };
    const audience = row.targeting_json as CampaignPlan["audience"];
    const meta = adsJson?.metaPlacements;

    return {
      id: row.id as string,
      objective_id: row.objective_id as string,
      platform: row.platform as CampaignPlan["platform"],
      campaignName: row.campaign_name as string,
      objective: row.campaign_objective as string,
      funnelStage: row.funnel_stage as CampaignPlan["funnelStage"],
      dailyBudget: row.daily_budget as number,
      monthlyBudgetEstimate: (row.daily_budget as number) * 30,
      locationTargeting: audience?.locations ?? [],
      audience: audience ?? {
        locations: [],
        interests: [],
        exclusions: [],
      },
      exclusions: audience?.exclusions ?? [],
      placements: audience?.placements ?? meta?.instagramPositions?.map(String) ?? [],
      publisherPlatforms: meta?.publisherPlatforms,
      instagramPositions: meta?.instagramPositions,
      facebookPositions: meta?.facebookPositions,
      placementStrategy: meta?.placementStrategy,
      metaChannelPreference: meta?.metaChannelPreference,
      primaryChannel: meta?.primaryChannel,
      primaryPlacement: meta?.primaryPlacement,
      adGroups: adsJson?.adGroups ?? [],
      ads: adsJson?.ads ?? [],
      keywords: (row.keywords_json as CampaignPlan["keywords"]) ?? [],
      negativeKeywords: (row.negative_keywords_json as string[]) ?? [],
      landingUrl: "",
      trackingUTM: row.utm_json as CampaignPlan["trackingUTM"],
      status: row.status as CampaignPlan["status"],
      requiresApproval: row.requires_approval as boolean,
      riskLevel: row.risk_level as CampaignPlan["riskLevel"],
      strategy_summary: row.strategy_summary as string,
      platform_campaign_id: row.platform_campaign_id as string | undefined,
      created_at: row.created_at as string,
    };
  }

  async getCampaignPlans(objectiveId?: string): Promise<CampaignPlan[]> {
    const ownedObjectiveIds = await this.getOwnedObjectiveIds();
    if (ownedObjectiveIds.length === 0) return [];

    let query = this.client.from("campaign_plans").select("*");
    if (objectiveId) {
      if (!ownedObjectiveIds.includes(objectiveId)) return [];
      query = query.eq("objective_id", objectiveId);
    } else {
      query = query.in("objective_id", ownedObjectiveIds);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((r) => this.mapCampaignRow(r));
  }

  async getCampaignPlan(id: string): Promise<CampaignPlan | undefined> {
    const { data, error } = await this.client
      .from("campaign_plans")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return undefined;
    const owned = await this.getOwnedObjectiveIds();
    return owned.includes(data.objective_id as string)
      ? this.mapCampaignRow(data)
      : undefined;
  }

  async updateCampaignPlan(
    id: string,
    updates: Partial<CampaignPlan>
  ): Promise<CampaignPlan | undefined> {
    const existing = await this.getCampaignPlan(id);
    if (!existing) return undefined;

    const dbUpdates: Record<string, unknown> = {};
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.dailyBudget) dbUpdates.daily_budget = updates.dailyBudget;
    if (updates.platform_campaign_id)
      dbUpdates.platform_campaign_id = updates.platform_campaign_id;

    if (
      updates.publisherPlatforms ||
      updates.instagramPositions ||
      updates.facebookPositions ||
      updates.placementStrategy ||
      updates.metaChannelPreference ||
      updates.primaryChannel ||
      updates.primaryPlacement
    ) {
      const { data: existing } = await this.client
        .from("campaign_plans")
        .select("ads_json")
        .eq("id", id)
        .single();
      const adsJson = (existing?.ads_json as Record<string, unknown>) ?? {};
      const metaPlacements = (adsJson.metaPlacements as Record<string, unknown>) ?? {};
      dbUpdates.ads_json = {
        ...adsJson,
        metaPlacements: {
          ...metaPlacements,
          ...(updates.publisherPlatforms && {
            publisherPlatforms: updates.publisherPlatforms,
          }),
          ...(updates.instagramPositions && {
            instagramPositions: updates.instagramPositions,
          }),
          ...(updates.facebookPositions && {
            facebookPositions: updates.facebookPositions,
          }),
          ...(updates.placementStrategy && {
            placementStrategy: updates.placementStrategy,
          }),
          ...(updates.metaChannelPreference && {
            metaChannelPreference: updates.metaChannelPreference,
          }),
          ...(updates.primaryChannel && {
            primaryChannel: updates.primaryChannel,
          }),
          ...(updates.primaryPlacement && {
            primaryPlacement: updates.primaryPlacement,
          }),
        },
      };
    }

    const { data, error } = await this.client
      .from("campaign_plans")
      .update(dbUpdates)
      .eq("id", id)
      .select()
      .single();
    if (error) return undefined;
    return this.mapCampaignRow(data);
  }

  async createApprovalRequest(
    data: Omit<
      ApprovalRequest,
      "id" | "created_at" | "approved_by" | "approved_at" | "rejected_at"
    >
  ): Promise<ApprovalRequest> {
    const plan = await this.getCampaignPlan(data.campaign_plan_id);
    if (!plan) throw new Error("Campaña no encontrada o sin permisos");
    const { data: row, error } = await this.client
      .from("approval_requests")
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return row as ApprovalRequest;
  }

  async getApprovalRequests(status?: string): Promise<ApprovalRequest[]> {
    const ownedCampaignIds = await this.getOwnedCampaignIds();
    if (ownedCampaignIds.length === 0) return [];

    let query = this.client
      .from("approval_requests")
      .select("*")
      .in("campaign_plan_id", ownedCampaignIds);
    if (status) query = query.eq("status", status);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    return data as ApprovalRequest[];
  }

  async getApprovalRequest(id: string): Promise<ApprovalRequest | undefined> {
    const { data, error } = await this.client
      .from("approval_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return undefined;
    const owned = await this.getOwnedCampaignIds();
    return owned.includes(data.campaign_plan_id as string)
      ? (data as ApprovalRequest)
      : undefined;
  }

  async updateApprovalRequest(
    id: string,
    updates: Partial<ApprovalRequest>
  ): Promise<ApprovalRequest | undefined> {
    const existing = await this.getApprovalRequest(id);
    if (!existing) return undefined;
    const { data, error } = await this.client
      .from("approval_requests")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) return undefined;
    return data as ApprovalRequest;
  }

  async createMetrics(
    data: Omit<CampaignMetrics, "id" | "created_at">
  ): Promise<CampaignMetrics> {
    const plan = await this.getCampaignPlan(data.campaign_plan_id);
    if (!plan) throw new Error("Campaña no encontrada o sin permisos");
    const { data: row, error } = await this.client
      .from("campaign_metrics")
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return row as CampaignMetrics;
  }

  async getMetrics(campaignPlanId?: string): Promise<CampaignMetrics[]> {
    const ownedCampaignIds = await this.getOwnedCampaignIds();
    if (ownedCampaignIds.length === 0) return [];

    let query = this.client
      .from("campaign_metrics")
      .select("*")
      .in("campaign_plan_id", ownedCampaignIds);
    if (campaignPlanId) {
      if (!ownedCampaignIds.includes(campaignPlanId)) return [];
      query = query.eq("campaign_plan_id", campaignPlanId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data as CampaignMetrics[];
  }

  async createRecommendation(
    data: Omit<Recommendation, "id" | "created_at">
  ): Promise<Recommendation> {
    const plan = await this.getCampaignPlan(data.campaign_plan_id);
    if (!plan) throw new Error("Campaña no encontrada o sin permisos");
    const { data: row, error } = await this.client
      .from("recommendations")
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return row as Recommendation;
  }

  async getRecommendations(campaignPlanId?: string): Promise<Recommendation[]> {
    const ownedCampaignIds = await this.getOwnedCampaignIds();
    if (ownedCampaignIds.length === 0) return [];

    let query = this.client
      .from("recommendations")
      .select("*")
      .in("campaign_plan_id", ownedCampaignIds);
    if (campaignPlanId) {
      if (!ownedCampaignIds.includes(campaignPlanId)) return [];
      query = query.eq("campaign_plan_id", campaignPlanId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data as Recommendation[];
  }

  async getRecommendation(id: string): Promise<Recommendation | undefined> {
    const { data, error } = await this.client
      .from("recommendations")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return undefined;
    const owned = await this.getOwnedCampaignIds();
    return owned.includes(data.campaign_plan_id as string)
      ? (data as Recommendation)
      : undefined;
  }

  async updateRecommendation(
    id: string,
    updates: Partial<Recommendation>
  ): Promise<Recommendation | undefined> {
    const existing = await this.getRecommendation(id);
    if (!existing) return undefined;
    const { data, error } = await this.client
      .from("recommendations")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) return undefined;
    return data as Recommendation;
  }

  async createAuditLog(
    data: Omit<AuditLog, "id" | "created_at">
  ): Promise<AuditLog> {
    const { data: row, error } = await this.client
      .from("audit_logs")
      .insert({ ...data, user_id: this.userId })
      .select()
      .single();
    if (error) throw error;
    return row as AuditLog;
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const campaigns = await this.getCampaignPlans();
    const metrics = await this.getMetrics();
    const approvals = await this.getApprovalRequests("PENDING");
    const recommendations = (await this.getRecommendations())
      .filter((r) => r.status === "PENDING")
      .slice(0, 5);

    const totalLeads = metrics.reduce((s, m) => s + m.leads, 0);
    const avgCpl =
      metrics.length > 0
        ? metrics.reduce((s, m) => s + m.cpl, 0) / metrics.length
        : 0;
    const avgCtr =
      metrics.length > 0
        ? metrics.reduce((s, m) => s + m.ctr, 0) / metrics.length
        : 0;
    const avgCpc =
      metrics.length > 0
        ? metrics.reduce((s, m) => s + m.cpc, 0) / metrics.length
        : 0;

    return {
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter((c) => c.status === "ACTIVE").length,
      pausedCampaigns: campaigns.filter(
        (c) => c.status === "PAUSED" || c.status === "DRAFT"
      ).length,
      pendingApprovals: approvals.length,
      dailySpendConfigured: campaigns.reduce((s, c) => s + c.dailyBudget, 0),
      totalLeads,
      avgCpl: Math.round(avgCpl * 100) / 100,
      avgCtr: Math.round(avgCtr * 10000) / 100,
      avgCpc: Math.round(avgCpc * 100) / 100,
      recommendations,
    };
  }

  async getBusiness(id: string): Promise<Business | undefined> {
    const { data, error } = await this.client
      .from("businesses")
      .select("*")
      .eq("id", id)
      .eq("user_id", this.userId)
      .maybeSingle();
    if (error) throw error;
    return data as Business | undefined;
  }

  async findBusinessByName(name: string): Promise<Business | undefined> {
    const { data, error } = await this.client
      .from("businesses")
      .select("*")
      .eq("user_id", this.userId)
      .ilike("name", name.trim())
      .maybeSingle();
    if (error) throw error;
    return data as Business | undefined;
  }

  async createBrandProfile(
    data: Omit<BrandProfile, "id" | "created_at" | "updated_at">
  ): Promise<BrandProfile> {
    await this.assertOwnsBusiness(data.business_id);
    const { data: row, error } = await this.client
      .from("brand_profiles")
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return row as BrandProfile;
  }

  async getBrandProfile(businessId: string): Promise<BrandProfile | undefined> {
    await this.assertOwnsBusiness(businessId);
    const { data, error } = await this.client
      .from("brand_profiles")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle();
    if (error) throw error;
    return data as BrandProfile | undefined;
  }

  async updateBrandProfile(
    id: string,
    updates: Partial<Omit<BrandProfile, "id" | "business_id" | "created_at">>
  ): Promise<BrandProfile | undefined> {
    const { data: existing, error: fetchError } = await this.client
      .from("brand_profiles")
      .select("business_id")
      .eq("id", id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return undefined;
    await this.assertOwnsBusiness(existing.business_id as string);

    const { data, error } = await this.client
      .from("brand_profiles")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as BrandProfile;
  }

  async createBrandDocument(
    data: Omit<BrandDocument, "id" | "created_at">
  ): Promise<BrandDocument> {
    await this.assertOwnsBusiness(data.business_id);
    const { data: row, error } = await this.client
      .from("brand_documents")
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return row as BrandDocument;
  }

  async getBrandDocuments(businessId: string): Promise<BrandDocument[]> {
    await this.assertOwnsBusiness(businessId);
    const { data, error } = await this.client
      .from("brand_documents")
      .select("*")
      .eq("business_id", businessId);
    if (error) throw error;
    return (data ?? []) as BrandDocument[];
  }

  async deleteBrandDocument(id: string): Promise<boolean> {
    const { data: doc, error: fetchError } = await this.client
      .from("brand_documents")
      .select("business_id")
      .eq("id", id)
      .maybeSingle();
    if (fetchError || !doc) return false;
    await this.assertOwnsBusiness(doc.business_id as string);

    const { error } = await this.client
      .from("brand_documents")
      .delete()
      .eq("id", id);
    return !error;
  }

  async createBrandKnowledgeChunk(
    data: Omit<BrandKnowledgeChunk, "id" | "created_at">
  ): Promise<BrandKnowledgeChunk> {
    await this.assertOwnsBusiness(data.business_id);
    const { data: row, error } = await this.client
      .from("brand_knowledge_chunks")
      .insert({ ...data, embedding: data.embedding ?? null })
      .select()
      .single();
    if (error) throw error;
    return row as BrandKnowledgeChunk;
  }

  async getBrandKnowledgeChunks(
    businessId: string
  ): Promise<BrandKnowledgeChunk[]> {
    await this.assertOwnsBusiness(businessId);
    const { data, error } = await this.client
      .from("brand_knowledge_chunks")
      .select("*")
      .eq("business_id", businessId);
    if (error) throw error;
    return (data ?? []) as BrandKnowledgeChunk[];
  }

  async deleteBrandKnowledgeChunks(businessId: string): Promise<void> {
    await this.assertOwnsBusiness(businessId);
    await this.client
      .from("brand_knowledge_chunks")
      .delete()
      .eq("business_id", businessId);
  }
}

/** @deprecated Usar createRepository(userId) */
export function getRepository(): never {
  throw new Error("getRepository() fue reemplazado por createRepository(userId)");
}

// Re-export for mockStore sync usage only
export { getDemoUserId };
