-- ═══════════════════════════════════════════════════════════════
-- BUAM FINANCE — Supabase PostgreSQL Schema
-- Run this in your Supabase SQL Editor to set up the database
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── PROFILES ───────────────────────────────────────────────────
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  country TEXT DEFAULT 'CM' CHECK (country IN ('CM','NG','SN','CI','GH','TG','BJ','GA')),
  currency TEXT DEFAULT 'FCFA' CHECK (currency IN ('FCFA','NGN','USD','EUR','GHS','XOF')),
  avatar_url TEXT,
  monthly_income BIGINT DEFAULT 0,
  monthly_budget BIGINT DEFAULT 0,
  biometric_enabled BOOLEAN DEFAULT false,
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TRANSACTIONS ────────────────────────────────────────────────
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income','expense','transfer')),
  amount BIGINT NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'FCFA',
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  mobile_money_platform TEXT CHECK (mobile_money_platform IN ('mtn','orange','wave')),
  mobile_money_ref TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_recurring BOOLEAN DEFAULT false,
  recurring_interval TEXT CHECK (recurring_interval IN ('daily','weekly','monthly')),
  tags TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_category ON transactions(user_id, category);
CREATE INDEX idx_transactions_type ON transactions(user_id, type);

-- ─── BUDGETS ────────────────────────────────────────────────────
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month TEXT NOT NULL,  -- YYYY-MM
  category TEXT NOT NULL,
  limit_amount BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month, category)
);

-- View: budget with computed spent amount
CREATE OR REPLACE VIEW budgets_with_spent AS
SELECT
  b.*,
  COALESCE(SUM(t.amount), 0) AS spent_amount,
  ROUND(COALESCE(SUM(t.amount), 0) * 100.0 / NULLIF(b.limit_amount, 0), 1) AS percent_used
FROM budgets b
LEFT JOIN transactions t ON
  t.user_id = b.user_id
  AND t.category = b.category
  AND TO_CHAR(t.date, 'YYYY-MM') = b.month
  AND t.type = 'expense'
GROUP BY b.id;

-- ─── SAVINGS GOALS ──────────────────────────────────────────────
CREATE TABLE savings_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount BIGINT NOT NULL,
  current_amount BIGINT NOT NULL DEFAULT 0,
  target_date DATE,
  icon TEXT DEFAULT '🎯',
  color TEXT DEFAULT '#C9963A',
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TONTINES ───────────────────────────────────────────────────
CREATE TABLE tontines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contribution_amount BIGINT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly','monthly')),
  total_members INT NOT NULL,
  my_turn_number INT NOT NULL,
  current_turn INT NOT NULL DEFAULT 1,
  next_payment_date DATE,
  members JSONB DEFAULT '[]',
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INVESTMENTS ────────────────────────────────────────────────
CREATE TABLE investments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('ngx_stock','crypto')),
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity NUMERIC(18, 8) NOT NULL,
  avg_buy_price NUMERIC(18, 4) NOT NULL,
  avg_buy_price_currency TEXT NOT NULL DEFAULT 'NGN',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, symbol, type)
);

-- ─── INVESTMENT TRANSACTIONS ────────────────────────────────────
CREATE TABLE investment_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  investment_id UUID REFERENCES investments(id),
  type TEXT NOT NULL CHECK (type IN ('buy','sell')),
  symbol TEXT NOT NULL,
  quantity NUMERIC(18, 8) NOT NULL,
  price NUMERIC(18, 4) NOT NULL,
  price_currency TEXT NOT NULL,
  fee NUMERIC(18, 4) DEFAULT 0,
  total_amount NUMERIC(18, 4) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MOMO MESSAGES ──────────────────────────────────────────────
CREATE TABLE momo_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  raw_sms TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('mtn','orange','wave')),
  parsed_amount BIGINT,
  parsed_type TEXT CHECK (parsed_type IN ('credit','debit')),
  parsed_sender TEXT,
  parsed_recipient TEXT,
  parsed_ref TEXT,
  parsed_balance BIGINT,
  is_imported BOOLEAN DEFAULT false,
  transaction_id UUID REFERENCES transactions(id),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tontines ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE momo_messages ENABLE ROW LEVEL SECURITY;

-- Policies: users can only access their own data
CREATE POLICY "Users own profile" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users own transactions" ON transactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own budgets" ON budgets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own savings" ON savings_goals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own tontines" ON tontines FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own investments" ON investments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own inv_tx" ON investment_transactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own momo" ON momo_messages FOR ALL USING (auth.uid() = user_id);

-- ─── TRIGGER: auto-create profile on signup ─────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.phone);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── MONTHLY SUMMARY FUNCTION ───────────────────────────────────
CREATE OR REPLACE FUNCTION get_monthly_summary(p_user_id UUID, p_month TEXT)
RETURNS TABLE (
  total_income BIGINT,
  total_expense BIGINT,
  net_balance BIGINT,
  transaction_count INT,
  top_category TEXT,
  savings_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN type='income' THEN amount END), 0)::BIGINT AS total_income,
    COALESCE(SUM(CASE WHEN type='expense' THEN amount END), 0)::BIGINT AS total_expense,
    COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE -amount END), 0)::BIGINT AS net_balance,
    COUNT(*)::INT AS transaction_count,
    (SELECT category FROM transactions
     WHERE user_id=p_user_id AND TO_CHAR(date,'YYYY-MM')=p_month AND type='expense'
     GROUP BY category ORDER BY SUM(amount) DESC LIMIT 1) AS top_category,
    CASE
      WHEN SUM(CASE WHEN type='income' THEN amount END) > 0
      THEN ROUND(
        (SUM(CASE WHEN type='income' THEN amount END) - SUM(CASE WHEN type='expense' THEN amount END))
        * 100.0 / SUM(CASE WHEN type='income' THEN amount END), 1)
      ELSE 0
    END AS savings_rate
  FROM transactions
  WHERE user_id=p_user_id AND TO_CHAR(date,'YYYY-MM')=p_month;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- B-INVEST ADMIN — Core Tables (investors, projects, subscriptions…)
-- Run this BEFORE the Patch section below
-- ═══════════════════════════════════════════════════════════════

-- ─── INVESTORS ──────────────────────────────────────────────────
-- user_id links to auth.users so the Buam Finance mobile app can
-- locate its own KYC record via auth.uid() = user_id
CREATE TABLE IF NOT EXISTS investors (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name            TEXT NOT NULL,
  email                TEXT UNIQUE NOT NULL,
  phone                TEXT,
  country              TEXT DEFAULT 'CM',
  nationality          TEXT,
  address              TEXT,
  id_type              TEXT,
  id_number            TEXT,
  -- KYC
  kyc_status           TEXT NOT NULL DEFAULT 'pending'
                         CHECK (kyc_status IN ('pending','in_review','approved','rejected')),
  kyc_notes            TEXT,
  kyc_rejection_reason TEXT,
  -- KYC document URLs (uploaded by mobile app to Storage)
  id_front_url         TEXT,
  id_back_url          TEXT,
  selfie_url           TEXT,
  -- PIC
  pic_member           BOOLEAN DEFAULT false,
  pic_fee_paid         BOOLEAN DEFAULT false,
  pic_joined_at        TIMESTAMPTZ,
  -- DIA (Direct Investment Account)
  dia_signed           BOOLEAN DEFAULT false,
  dia_signed_date      DATE,
  -- B-Invest subscription
  subscription_start_date DATE,
  subscription_end_date   DATE,
  subscription_status  TEXT DEFAULT 'pending'
                         CHECK (subscription_status IN ('active','expired','pending')),
  -- Misc
  risk_profile         TEXT DEFAULT 'moderate'
                         CHECK (risk_profile IN ('conservative','moderate','aggressive')),
  notes                TEXT,
  is_active            BOOLEAN DEFAULT true,
  total_invested_ngn   BIGINT DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investors_user_id    ON investors(user_id);
CREATE INDEX IF NOT EXISTS idx_investors_email      ON investors(email);
CREATE INDEX IF NOT EXISTS idx_investors_kyc_status ON investors(kyc_status);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS investors_updated_at ON investors;
CREATE TRIGGER investors_updated_at
  BEFORE UPDATE ON investors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── RLS for investors ──────────────────────────────────────────
ALTER TABLE investors ENABLE ROW LEVEL SECURITY;

-- Mobile app: users can read ONLY their own investor row
CREATE POLICY IF NOT EXISTS "Investor read own"
  ON investors FOR SELECT
  USING (auth.uid() = user_id);

-- Mobile app: users can update a limited subset of their own row
-- (e.g. to upload KYC doc URLs from the mobile app itself)
CREATE POLICY IF NOT EXISTS "Investor update own docs"
  ON investors FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin panel uses service role key — bypasses RLS, no policy needed.
-- No INSERT/DELETE policy for regular users.

-- ─── PROJECTS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                 TEXT NOT NULL,
  type                 TEXT NOT NULL
                         CHECK (type IN ('land_banking','agriculture_palmier','agriculture_manioc','capital_markets','immobilier')),
  status               TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','open','active','closed','completed')),
  location             TEXT,
  horizon_years        INT DEFAULT 1,
  min_investment_ngn   BIGINT DEFAULT 0,
  target_amount_ngn    BIGINT DEFAULT 0,
  max_amount_ngn       BIGINT,
  yield_min_pct        NUMERIC(5,2),
  yield_max_pct        NUMERIC(5,2),
  fee_facilitation_pct NUMERIC(5,2) DEFAULT 10,
  fee_management_pct   NUMERIC(5,2) DEFAULT 3,
  fee_resale_pct       NUMERIC(5,2),
  tranches_count       INT DEFAULT 1,
  spots_total          INT,
  spots_taken          INT DEFAULT 0,
  deadline             DATE,
  visible_in_app       BOOLEAN DEFAULT false,
  allows_pic           BOOLEAN DEFAULT true,
  description          TEXT,
  highlights           TEXT[],
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Mobile app: anyone authenticated can read open/active projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Projects readable by all"
  ON projects FOR SELECT
  USING (auth.role() = 'authenticated' AND status IN ('open','active'));

-- ─── SUBSCRIPTIONS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investor_id     UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  amount_ngn      BIGINT NOT NULL,
  fee_ngn         BIGINT NOT NULL DEFAULT 0,
  total_amount_ngn BIGINT NOT NULL,
  tranches_count  INT NOT NULL DEFAULT 1,
  dia_reference   TEXT UNIQUE,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','active','completed','cancelled')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Subscription read own"
  ON subscriptions FOR SELECT
  USING (investor_id IN (SELECT id FROM investors WHERE user_id = auth.uid()));

-- ─── PAYMENT TRANCHES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_tranches (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id     UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  tranche_number      INT NOT NULL,
  amount_ngn          BIGINT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','received','late','waived')),
  received_amount_ngn BIGINT,
  received_date       DATE,
  due_date            DATE,
  payment_method      TEXT,
  bank_reference      TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payment_tranches ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Tranche read own"
  ON payment_tranches FOR SELECT
  USING (subscription_id IN (
    SELECT s.id FROM subscriptions s
    JOIN investors i ON i.id = s.investor_id
    WHERE i.user_id = auth.uid()
  ));

-- ─── AUDIT LOGS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id      UUID,
  admin_email   TEXT NOT NULL DEFAULT 'system',
  action        TEXT NOT NULL,
  resource_type TEXT,
  resource_id   TEXT,
  old_values    JSONB,
  new_values    JSONB,
  ip_address    TEXT,
  user_agent    TEXT,
  severity      TEXT DEFAULT 'info'
                  CHECK (severity IN ('info','warning','critical')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action   ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created  ON audit_logs(created_at DESC);
-- Audit logs: no RLS — service role only (admin panel)

-- ═══════════════════════════════════════════════════════════════
-- B-INVEST ADMIN — PIC Groups & Investor Subscriptions (Patch)
-- Run after the initial schema
-- ═══════════════════════════════════════════════════════════════

-- ─── allows_pic field on projects ───────────────────────────────
ALTER TABLE projects ADD COLUMN IF NOT EXISTS allows_pic BOOLEAN DEFAULT true;

-- ─── PICS TABLE (PIC groups managed by admin) ───────────────────
CREATE TABLE IF NOT EXISTS pics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  max_members INT NOT NULL DEFAULT 20,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PIC_MEMBERSHIPS TABLE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS pic_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pic_id UUID NOT NULL REFERENCES pics(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  anonymous_number TEXT NOT NULL,
  fee_paid BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  notes TEXT,
  UNIQUE(pic_id, investor_id),
  UNIQUE(anonymous_number)
);

CREATE INDEX IF NOT EXISTS idx_pic_memberships_pic ON pic_memberships(pic_id);
CREATE INDEX IF NOT EXISTS idx_pic_memberships_investor ON pic_memberships(investor_id);

-- ─── INVESTOR SUBSCRIPTION FIELDS ──────────────────────────────
ALTER TABLE investors
  ADD COLUMN IF NOT EXISTS subscription_start_date DATE,
  ADD COLUMN IF NOT EXISTS subscription_end_date DATE,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'pending'
    CHECK (subscription_status IN ('active', 'expired', 'pending'));

CREATE INDEX IF NOT EXISTS idx_investors_sub_end
  ON investors(subscription_end_date)
  WHERE subscription_status = 'active';

-- ─── SUBSCRIPTION REMINDERS TRACKING ───────────────────────────
CREATE TABLE IF NOT EXISTS subscription_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  days_before INT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  subscription_end_date DATE NOT NULL,
  UNIQUE(investor_id, days_before, subscription_end_date)
);
