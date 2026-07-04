-- AI Marketing Agent - Supabase Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Businesses
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  industry TEXT,
  website_url TEXT,
  whatsapp_number TEXT,
  instagram_url TEXT,
  default_location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Marketing objectives
CREATE TABLE IF NOT EXISTS marketing_objectives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  goal TEXT NOT NULL,
  product TEXT,
  daily_budget NUMERIC NOT NULL,
  monthly_budget NUMERIC,
  locations JSONB DEFAULT '[]',
  platforms TEXT DEFAULT 'BOTH',
  ideal_customer TEXT,
  average_ticket NUMERIC,
  brand_awareness_level TEXT DEFAULT 'medium',
  landing_url TEXT,
  whatsapp_url TEXT,
  creative_types JSONB,
  restrictions TEXT,
  industry TEXT,
  meta_channel_preference TEXT DEFAULT 'INSTAGRAM_PRIORITY',
  placement_strategy TEXT,
  status TEXT DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Strategy plans (stored as JSON for flexibility)
CREATE TABLE IF NOT EXISTS strategy_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  objective_id UUID REFERENCES marketing_objectives(id) ON DELETE CASCADE,
  plan_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign plans
CREATE TABLE IF NOT EXISTS campaign_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  objective_id UUID REFERENCES marketing_objectives(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('META', 'GOOGLE')),
  campaign_name TEXT NOT NULL,
  campaign_objective TEXT,
  funnel_stage TEXT,
  daily_budget NUMERIC NOT NULL,
  strategy_summary TEXT,
  targeting_json JSONB,
  keywords_json JSONB,
  negative_keywords_json JSONB,
  ads_json JSONB,
  utm_json JSONB,
  status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PAUSED', 'ACTIVE', 'ARCHIVED')),
  requires_approval BOOLEAN DEFAULT TRUE,
  risk_level TEXT DEFAULT 'LOW' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
  platform_campaign_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approval requests
CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_plan_id UUID REFERENCES campaign_plans(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_payload JSONB,
  reason TEXT,
  risk_level TEXT DEFAULT 'LOW',
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign metrics
CREATE TABLE IF NOT EXISTS campaign_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_plan_id UUID REFERENCES campaign_plans(id) ON DELETE CASCADE,
  platform_campaign_id TEXT,
  date DATE NOT NULL,
  spend NUMERIC DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  cpc NUMERIC DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  cpm NUMERIC DEFAULT 0,
  leads INTEGER DEFAULT 0,
  cpl NUMERIC DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_rate NUMERIC DEFAULT 0,
  lead_quality_score NUMERIC DEFAULT 0,
  raw_metrics_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recommendations
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_plan_id UUID REFERENCES campaign_plans(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  reason TEXT,
  supporting_metrics_json JSONB,
  expected_impact TEXT DEFAULT 'MEDIUM',
  risk_level TEXT DEFAULT 'LOW',
  requires_approval BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPLIED', 'DISMISSED')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API connections
CREATE TABLE IF NOT EXISTS api_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('META', 'GOOGLE')),
  account_id TEXT,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  status TEXT DEFAULT 'disconnected',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Brand knowledge
CREATE TABLE IF NOT EXISTS brand_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,
  positioning TEXT,
  brand_voice TEXT,
  ideal_customer TEXT,
  main_products TEXT,
  materials TEXT,
  differentiators TEXT,
  locations JSONB DEFAULT '[]',
  forbidden_words JSONB DEFAULT '[]',
  preferred_words JSONB DEFAULT '[]',
  primary_cta TEXT,
  secondary_cta TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brand_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL,
  content_text TEXT,
  file_url TEXT,
  metadata_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brand_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  document_id UUID REFERENCES brand_documents(id) ON DELETE SET NULL,
  chunk_text TEXT NOT NULL,
  embedding JSONB,
  metadata_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign blueprints (internal drafts — no Meta write)
CREATE TABLE IF NOT EXISTS campaign_blueprints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  input_json JSONB NOT NULL,
  proposal_json JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'INTERNAL_DRAFT' CHECK (
    status IN (
      'INTERNAL_DRAFT',
      'READY_FOR_META_DRAFT',
      'NEEDS_ASSETS',
      'NEEDS_REVIEW',
      'APPROVAL_REQUIRED'
    )
  ),
  review_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_brand_profiles_business ON brand_profiles(business_id);
CREATE INDEX IF NOT EXISTS idx_brand_documents_business ON brand_documents(business_id);
CREATE INDEX IF NOT EXISTS idx_brand_chunks_business ON brand_knowledge_chunks(business_id);
CREATE INDEX IF NOT EXISTS idx_brand_chunks_document ON brand_knowledge_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_campaign_blueprints_user ON campaign_blueprints(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_blueprints_business ON campaign_blueprints(business_id);
CREATE INDEX IF NOT EXISTS idx_campaign_blueprints_status ON campaign_blueprints(status);

-- Row Level Security
ALTER TABLE campaign_blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_objectives_business ON marketing_objectives(business_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_objective ON campaign_plans(objective_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaign_plans(status);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_metrics_campaign ON campaign_metrics(campaign_plan_id);
CREATE INDEX IF NOT EXISTS idx_metrics_date ON campaign_metrics(date);
CREATE INDEX IF NOT EXISTS idx_recommendations_campaign ON recommendations(campaign_plan_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- Row Level Security (enable when auth is configured)
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_connections ENABLE ROW LEVEL SECURITY;

-- Helper: verificar que un business pertenece al usuario autenticado
CREATE OR REPLACE FUNCTION public.user_owns_business(bid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM businesses b
    WHERE b.id = bid AND b.user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- businesses
DROP POLICY IF EXISTS "businesses_select_own" ON businesses;
DROP POLICY IF EXISTS "businesses_insert_own" ON businesses;
DROP POLICY IF EXISTS "businesses_update_own" ON businesses;
DROP POLICY IF EXISTS "businesses_delete_own" ON businesses;
CREATE POLICY "businesses_select_own" ON businesses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "businesses_insert_own" ON businesses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "businesses_update_own" ON businesses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "businesses_delete_own" ON businesses FOR DELETE USING (auth.uid() = user_id);

-- marketing_objectives
DROP POLICY IF EXISTS "objectives_all_own" ON marketing_objectives;
CREATE POLICY "objectives_all_own" ON marketing_objectives FOR ALL
  USING (public.user_owns_business(business_id))
  WITH CHECK (public.user_owns_business(business_id));

-- strategy_plans
DROP POLICY IF EXISTS "strategy_plans_all_own" ON strategy_plans;
CREATE POLICY "strategy_plans_all_own" ON strategy_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM marketing_objectives mo
      WHERE mo.id = objective_id AND public.user_owns_business(mo.business_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM marketing_objectives mo
      WHERE mo.id = objective_id AND public.user_owns_business(mo.business_id)
    )
  );

-- campaign_plans
DROP POLICY IF EXISTS "campaign_plans_all_own" ON campaign_plans;
CREATE POLICY "campaign_plans_all_own" ON campaign_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM marketing_objectives mo
      WHERE mo.id = objective_id AND public.user_owns_business(mo.business_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM marketing_objectives mo
      WHERE mo.id = objective_id AND public.user_owns_business(mo.business_id)
    )
  );

-- approval_requests
DROP POLICY IF EXISTS "approval_requests_all_own" ON approval_requests;
CREATE POLICY "approval_requests_all_own" ON approval_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM campaign_plans cp
      JOIN marketing_objectives mo ON mo.id = cp.objective_id
      WHERE cp.id = campaign_plan_id AND public.user_owns_business(mo.business_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaign_plans cp
      JOIN marketing_objectives mo ON mo.id = cp.objective_id
      WHERE cp.id = campaign_plan_id AND public.user_owns_business(mo.business_id)
    )
  );

-- campaign_metrics
DROP POLICY IF EXISTS "campaign_metrics_all_own" ON campaign_metrics;
CREATE POLICY "campaign_metrics_all_own" ON campaign_metrics FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM campaign_plans cp
      JOIN marketing_objectives mo ON mo.id = cp.objective_id
      WHERE cp.id = campaign_plan_id AND public.user_owns_business(mo.business_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaign_plans cp
      JOIN marketing_objectives mo ON mo.id = cp.objective_id
      WHERE cp.id = campaign_plan_id AND public.user_owns_business(mo.business_id)
    )
  );

-- recommendations
DROP POLICY IF EXISTS "recommendations_all_own" ON recommendations;
CREATE POLICY "recommendations_all_own" ON recommendations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM campaign_plans cp
      JOIN marketing_objectives mo ON mo.id = cp.objective_id
      WHERE cp.id = campaign_plan_id AND public.user_owns_business(mo.business_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaign_plans cp
      JOIN marketing_objectives mo ON mo.id = cp.objective_id
      WHERE cp.id = campaign_plan_id AND public.user_owns_business(mo.business_id)
    )
  );

-- audit_logs
DROP POLICY IF EXISTS "audit_logs_select_own" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_own" ON audit_logs;
CREATE POLICY "audit_logs_select_own" ON audit_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "audit_logs_insert_own" ON audit_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- brand_profiles
DROP POLICY IF EXISTS "brand_profiles_all_own" ON brand_profiles;
CREATE POLICY "brand_profiles_all_own" ON brand_profiles FOR ALL
  USING (public.user_owns_business(business_id))
  WITH CHECK (public.user_owns_business(business_id));

-- brand_documents
DROP POLICY IF EXISTS "brand_documents_all_own" ON brand_documents;
CREATE POLICY "brand_documents_all_own" ON brand_documents FOR ALL
  USING (public.user_owns_business(business_id))
  WITH CHECK (public.user_owns_business(business_id));

-- brand_knowledge_chunks
DROP POLICY IF EXISTS "brand_chunks_all_own" ON brand_knowledge_chunks;
CREATE POLICY "brand_chunks_all_own" ON brand_knowledge_chunks FOR ALL
  USING (public.user_owns_business(business_id))
  WITH CHECK (public.user_owns_business(business_id));

-- api_connections
DROP POLICY IF EXISTS "api_connections_all_own" ON api_connections;
CREATE POLICY "api_connections_all_own" ON api_connections FOR ALL
  USING (public.user_owns_business(business_id))
  WITH CHECK (public.user_owns_business(business_id));

-- campaign_blueprints
DROP POLICY IF EXISTS "campaign_blueprints_all_own" ON campaign_blueprints;
CREATE POLICY "campaign_blueprints_all_own" ON campaign_blueprints FOR ALL
  USING (auth.uid() = user_id AND public.user_owns_business(business_id))
  WITH CHECK (auth.uid() = user_id AND public.user_owns_business(business_id));
