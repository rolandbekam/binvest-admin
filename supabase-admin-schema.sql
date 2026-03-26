-- ═══════════════════════════════════════════════════════════════
-- B-INVEST ADMIN — Supabase Schema Sécurisé
-- ═══════════════════════════════════════════════════════════════

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ADMIN USERS ────────────────────────────────────────────────
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('super_admin', 'admin', 'viewer')),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  login_attempts INT DEFAULT 0,
  locked_until TIMESTAMPTZ,
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_secret TEXT,              -- chiffré
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ADMIN SESSIONS ─────────────────────────────────────────────
CREATE TABLE admin_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,     -- hash du JWT, jamais le token brut
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_token ON admin_sessions(token_hash);
CREATE INDEX idx_sessions_admin ON admin_sessions(admin_id);

-- ─── AUDIT TRAIL ────────────────────────────────────────────────
-- Log immuable de TOUTES les actions (INSERT only, jamais UPDATE/DELETE)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES admin_users(id),
  admin_email TEXT,                    -- dénormalisé pour historique
  action TEXT NOT NULL,                -- ex: 'project.create', 'payment.record'
  resource_type TEXT,                  -- 'project', 'subscription', 'payment'...
  resource_id TEXT,
  old_values JSONB,                    -- état avant
  new_values JSONB,                    -- état après
  ip_address INET,
  user_agent TEXT,
  severity TEXT DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'critical')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX idx_audit_admin ON audit_logs(admin_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_date ON audit_logs(created_at DESC);

-- ─── RATE LIMITING ──────────────────────────────────────────────
CREATE TABLE rate_limit_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier TEXT NOT NULL,            -- IP ou email
  action TEXT NOT NULL,                -- 'login', 'api_call'...
  attempts INT DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(identifier, action)
);

-- Cleanup auto des vieilles entrées
CREATE INDEX idx_rate_limit_window ON rate_limit_attempts(window_start);

-- ─── PROJECTS ───────────────────────────────────────────────────
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL
    CHECK (type IN ('land_banking', 'agriculture_palmier', 'agriculture_manioc', 'capital_markets', 'immobilier')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'open', 'active', 'closed', 'completed')),
  description TEXT,
  location TEXT,
  state_country TEXT,
  surface_ha NUMERIC(10,2),
  price_per_ha_ngn BIGINT,
  min_investment_ngn BIGINT NOT NULL,
  max_investment_ngn BIGINT,
  target_amount_ngn BIGINT NOT NULL,
  raised_amount_ngn BIGINT DEFAULT 0,
  horizon_years INT,
  yield_min_pct NUMERIC(5,2),
  yield_max_pct NUMERIC(5,2),
  tranches_count INT DEFAULT 1,
  spots_total INT DEFAULT 10,
  spots_taken INT DEFAULT 0,
  fee_facilitation_pct NUMERIC(5,2) DEFAULT 10,
  fee_management_pct NUMERIC(5,2) DEFAULT 3,
  fee_resale_pct NUMERIC(5,2) DEFAULT 15,
  highlights TEXT[],
  documents JSONB DEFAULT '[]',
  progress_updates JSONB DEFAULT '[]',
  launch_date DATE,
  close_date DATE,
  is_visible_app BOOLEAN DEFAULT false,  -- visible dans Buam Finance app
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INVESTORS (admin view des users Buam Finance) ───────────────
CREATE TABLE investors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buam_user_id UUID,                   -- lien vers profiles table Buam Finance
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  country TEXT DEFAULT 'CM',
  nationality TEXT,
  id_type TEXT,                        -- passeport, CNI, etc.
  id_number_encrypted TEXT,            -- CHIFFRÉ avec pgcrypto
  address TEXT,
  pic_member BOOLEAN DEFAULT false,
  pic_fee_paid BOOLEAN DEFAULT false,
  pic_fee_date DATE,
  dia_signed BOOLEAN DEFAULT false,
  dia_signed_date DATE,
  kyc_status TEXT DEFAULT 'pending'
    CHECK (kyc_status IN ('pending', 'in_review', 'approved', 'rejected')),
  kyc_notes TEXT,
  risk_profile TEXT DEFAULT 'moderate'
    CHECK (risk_profile IN ('conservative', 'moderate', 'aggressive')),
  total_invested_ngn BIGINT DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SUBSCRIPTIONS ──────────────────────────────────────────────
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investor_id UUID NOT NULL REFERENCES investors(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'partial', 'complete', 'cancelled', 'defaulted')),
  amount_ngn BIGINT NOT NULL,
  facilitation_fee_ngn BIGINT,         -- calculé auto : 10%
  total_amount_ngn BIGINT,             -- montant + frais
  tranches_count INT NOT NULL DEFAULT 1,
  dia_reference TEXT UNIQUE,           -- numéro contrat DIA
  dia_signed_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(investor_id, project_id)
);

-- Trigger: calcul auto des frais à l'insertion
CREATE OR REPLACE FUNCTION calculate_subscription_fees()
RETURNS TRIGGER AS $$
DECLARE
  proj_fee NUMERIC;
BEGIN
  SELECT fee_facilitation_pct INTO proj_fee FROM projects WHERE id = NEW.project_id;
  NEW.facilitation_fee_ngn := ROUND(NEW.amount_ngn * proj_fee / 100);
  NEW.total_amount_ngn := NEW.amount_ngn + NEW.facilitation_fee_ngn;
  NEW.dia_reference := 'DIA-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
    UPPER(SUBSTRING(NEW.id::TEXT, 1, 8));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_subscription_insert
  BEFORE INSERT ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION calculate_subscription_fees();

-- ─── PAYMENT TRANCHES ───────────────────────────────────────────
CREATE TABLE payment_tranches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  tranche_number INT NOT NULL,
  amount_ngn BIGINT NOT NULL,
  percentage_pct NUMERIC(5,2),
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'received', 'late', 'waived')),
  -- Paiement reçu
  received_amount_ngn BIGINT,
  received_date DATE,
  received_currency TEXT DEFAULT 'NGN',
  exchange_rate NUMERIC(12,6),         -- si paiement en autre devise
  equivalent_ngn BIGINT,
  payment_method TEXT
    CHECK (payment_method IN ('bank_transfer', 'mobile_money', 'cash', 'crypto', 'other')),
  bank_reference TEXT,
  acknowledgement_issued BOOLEAN DEFAULT false,
  acknowledgement_date TIMESTAMPTZ,
  notes TEXT,
  recorded_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subscription_id, tranche_number)
);

-- ─── PROJECT UPDATES ────────────────────────────────────────────
CREATE TABLE project_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  update_type TEXT DEFAULT 'general'
    CHECK (update_type IN ('general', 'milestone', 'financial', 'alert')),
  milestone_status TEXT
    CHECK (milestone_status IN ('completed', 'in_progress', 'planned')),
  visible_to_investors BOOLEAN DEFAULT true,
  attachments JSONB DEFAULT '[]',
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── HELPER FUNCTIONS ───────────────────────────────────────────

-- Chiffrement données sensibles (numéro ID)
CREATE OR REPLACE FUNCTION encrypt_sensitive(data TEXT, key TEXT DEFAULT current_setting('app.encryption_key', true))
RETURNS TEXT AS $$
BEGIN
  RETURN encode(pgp_sym_encrypt(data, COALESCE(key, 'default_dev_key')), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_sensitive(encrypted TEXT, key TEXT DEFAULT current_setting('app.encryption_key', true))
RETURNS TEXT AS $$
BEGIN
  RETURN pgp_sym_decrypt(decode(encrypted, 'base64'), COALESCE(key, 'default_dev_key'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Statistiques mensuelles
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_raised_ngn', COALESCE(SUM(raised_amount_ngn), 0),
    'active_projects', COUNT(*) FILTER (WHERE status IN ('open','active')),
    'total_investors', (SELECT COUNT(*) FROM investors),
    'pending_payments', (SELECT COUNT(*) FROM payment_tranches WHERE status = 'pending'),
    'late_payments', (SELECT COUNT(*) FROM payment_tranches WHERE status = 'late'),
    'total_subscriptions', (SELECT COUNT(*) FROM subscriptions WHERE status != 'cancelled'),
    'monthly_received', (
      SELECT COALESCE(SUM(received_amount_ngn), 0) FROM payment_tranches
      WHERE status = 'received'
      AND received_date >= DATE_TRUNC('month', CURRENT_DATE)
    )
  ) INTO result FROM projects;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────────
-- NOTE: L'accès admin passe par les API Routes Next.js (server-side)
-- Les tables admin ne sont PAS accessibles directement depuis le client
-- On utilise un service role key côté serveur uniquement

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_tranches ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_updates ENABLE ROW LEVEL SECURITY;

-- Seul le service role (server-side) peut accéder
-- Aucun accès anon ou authenticated direct
CREATE POLICY "service_role_only" ON admin_users
  USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only" ON admin_sessions
  USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only" ON audit_logs
  USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only" ON projects
  USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only" ON investors
  USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only" ON subscriptions
  USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only" ON payment_tranches
  USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only" ON project_updates
  USING (auth.role() = 'service_role');

-- ─── PREMIER SUPER ADMIN ─────────────────────────────────────────
-- À exécuter après déploiement - remplacez l'email
INSERT INTO admin_users (email, full_name, role)
VALUES ('raissa@binvest.ng', 'Raissa Bekamba', 'super_admin')
ON CONFLICT (email) DO NOTHING;

-- ─── TRIGGERS: updated_at auto ──────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_investors_updated_at BEFORE UPDATE ON investors FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tranches_updated_at BEFORE UPDATE ON payment_tranches FOR EACH ROW EXECUTE FUNCTION update_updated_at();
