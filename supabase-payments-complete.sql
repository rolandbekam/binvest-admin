-- ═══════════════════════════════════════════════════════════════
-- B-INVEST ADMIN — Payments Complete Schema
-- Handles all payment types:
--   A) Project investment tranches  → payment_tranches (existing)
--   B) Annual investor subscription → investor_subscriptions (type='investor_fee')
--   C) PIC membership fee           → investor_subscriptions (type='pic_fee')
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── INVESTOR SUBSCRIPTIONS (types B & C) ───────────────────────
-- Stores every fee payment: annual investor subscription or PIC adhesion.
-- On INSERT, the application also updates the investors row directly.
CREATE TABLE IF NOT EXISTS investor_subscriptions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investor_id       UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,

  -- 'investor_fee' = 50 000 XAF/an (Type B)
  -- 'pic_fee'      = 50 000 XAF PIC adhesion (Type C)
  type              TEXT NOT NULL CHECK (type IN ('investor_fee', 'pic_fee')),

  amount_xaf        BIGINT NOT NULL DEFAULT 50000,
  payment_date      DATE NOT NULL,
  payment_method    TEXT CHECK (payment_method IN ('bank_transfer','mobile_money','cash','crypto','other')),
  bank_reference    TEXT,
  notes             TEXT,

  -- Validity window (filled by the API after recording)
  start_date        DATE NOT NULL,
  end_date          DATE,       -- NULL for one-time PIC fees

  -- PIC link (only for type='pic_fee')
  pic_id            UUID REFERENCES pics(id) ON DELETE SET NULL,
  pic_membership_id UUID REFERENCES pic_memberships(id) ON DELETE SET NULL,

  status            TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'expired', 'cancelled')),

  recorded_by       TEXT,       -- admin email
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_sub_investor ON investor_subscriptions(investor_id);
CREATE INDEX IF NOT EXISTS idx_inv_sub_type     ON investor_subscriptions(type);
CREATE INDEX IF NOT EXISTS idx_inv_sub_date     ON investor_subscriptions(payment_date DESC);

-- RLS: admin panel uses service role (bypasses RLS).
-- Mobile app: investor can read their own fee history.
ALTER TABLE investor_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "investor_sub_read_own"
  ON investor_subscriptions FOR SELECT
  USING (investor_id IN (
    SELECT id FROM investors WHERE user_id = auth.uid()
  ));

-- ─── HELPER VIEW — unified payment history ──────────────────────
-- Joins project tranches + investor_subscriptions into one ledger view.
-- Useful for reporting and the payments list page.
CREATE OR REPLACE VIEW unified_payments AS

  -- Type A: project tranches
  SELECT
    pt.id,
    'project_tranche'                          AS payment_type,
    i.id                                       AS investor_id,
    i.full_name                                AS investor_name,
    i.email                                    AS investor_email,
    p.name                                     AS project_name,
    pt.tranche_number                          AS tranche_number,
    pt.amount_ngn                              AS amount_ngn,
    NULL::BIGINT                               AS amount_xaf,
    pt.received_amount_ngn                     AS received_amount,
    pt.received_date                           AS payment_date,
    pt.payment_method,
    pt.bank_reference,
    pt.status,
    pt.due_date,
    pt.created_at
  FROM payment_tranches pt
  JOIN subscriptions s  ON s.id  = pt.subscription_id
  JOIN investors     i  ON i.id  = s.investor_id
  JOIN projects      p  ON p.id  = s.project_id

  UNION ALL

  -- Type B & C: fee payments
  SELECT
    isub.id,
    isub.type                                  AS payment_type,
    isub.investor_id,
    i.full_name                                AS investor_name,
    i.email                                    AS investor_email,
    COALESCE(pi.name, '—')                     AS project_name,
    NULL::INT                                  AS tranche_number,
    NULL::BIGINT                               AS amount_ngn,
    isub.amount_xaf,
    isub.amount_xaf                            AS received_amount,
    isub.payment_date,
    isub.payment_method,
    isub.bank_reference,
    isub.status,
    NULL::DATE                                 AS due_date,
    isub.created_at
  FROM investor_subscriptions isub
  JOIN investors i ON i.id = isub.investor_id
  LEFT JOIN pics pi ON pi.id = isub.pic_id;
