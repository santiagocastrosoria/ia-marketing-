-- =============================================================================
-- AI Marketing Agent — Aplicar RLS en Supabase (ejecutar en SQL Editor)
-- =============================================================================
-- Requisitos:
-- 1. Tablas creadas desde schema.sql
-- 2. SUPABASE_SERVICE_ROLE_KEY en .env.local para escrituras server-side
-- 3. Auth habilitado (email/password)
--
-- Arquitectura: el backend Next.js usa service role + ownership manual
-- (user_id desde sesión). RLS protege acceso directo desde el cliente anon.

-- Helper
CREATE OR REPLACE FUNCTION public.user_owns_business(bid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM businesses b
    WHERE b.id = bid AND b.user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- businesses
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "businesses_select_own" ON businesses;
DROP POLICY IF EXISTS "businesses_insert_own" ON businesses;
DROP POLICY IF EXISTS "businesses_update_own" ON businesses;
DROP POLICY IF EXISTS "businesses_delete_own" ON businesses;
CREATE POLICY "businesses_select_own" ON businesses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "businesses_insert_own" ON businesses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "businesses_update_own" ON businesses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "businesses_delete_own" ON businesses FOR DELETE USING (auth.uid() = user_id);

-- marketing_objectives (business_id NOT NULL)
ALTER TABLE marketing_objectives ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "objectives_all_own" ON marketing_objectives;
CREATE POLICY "objectives_all_own" ON marketing_objectives FOR ALL
  USING (public.user_owns_business(business_id))
  WITH CHECK (public.user_owns_business(business_id));

-- strategy_plans
ALTER TABLE strategy_plans ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE campaign_plans ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE campaign_metrics ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_logs_select_own" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_own" ON audit_logs;
CREATE POLICY "audit_logs_select_own" ON audit_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "audit_logs_insert_own" ON audit_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- brand_profiles
ALTER TABLE brand_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "brand_profiles_all_own" ON brand_profiles;
CREATE POLICY "brand_profiles_all_own" ON brand_profiles FOR ALL
  USING (public.user_owns_business(business_id))
  WITH CHECK (public.user_owns_business(business_id));

-- brand_documents
ALTER TABLE brand_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "brand_documents_all_own" ON brand_documents;
CREATE POLICY "brand_documents_all_own" ON brand_documents FOR ALL
  USING (public.user_owns_business(business_id))
  WITH CHECK (public.user_owns_business(business_id));

-- brand_knowledge_chunks
ALTER TABLE brand_knowledge_chunks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "brand_chunks_all_own" ON brand_knowledge_chunks;
CREATE POLICY "brand_chunks_all_own" ON brand_knowledge_chunks FOR ALL
  USING (public.user_owns_business(business_id))
  WITH CHECK (public.user_owns_business(business_id));

-- Migración opcional si la tabla ya existe sin NOT NULL:
-- ALTER TABLE marketing_objectives ALTER COLUMN business_id SET NOT NULL;
