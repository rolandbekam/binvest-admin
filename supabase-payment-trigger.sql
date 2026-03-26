-- ═══════════════════════════════════════════════════════════════
-- PAIEMENTS AUTOMATIQUES DEPUIS L'APP → PANEL ADMIN
-- À exécuter dans Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. TABLE payment_requests ───────────────────────────────
-- L'app mobile crée une demande de paiement
-- L'admin la confirme dans le panel → tranche mise à jour automatiquement

CREATE TABLE IF NOT EXISTS payment_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id),
  tranche_number INT NOT NULL,
  amount_ngn BIGINT NOT NULL,
  currency TEXT DEFAULT 'NGN',
  payment_method TEXT CHECK (payment_method IN ('bank_transfer','mobile_money','cash','crypto','other')),
  payment_proof_url TEXT,         -- photo reçu uploadée par l'investisseur
  bank_reference TEXT,
  mobile_reference TEXT,
  notes TEXT,
  status TEXT DEFAULT 'submitted'
    CHECK (status IN ('submitted','under_review','confirmed','rejected')),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: investisseur ne voit que ses demandes
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE payment_requests;

CREATE POLICY "investor_own_requests" ON payment_requests
  FOR ALL USING (
    auth.role() = 'service_role'
    OR subscription_id IN (
      SELECT s.id FROM subscriptions s
      JOIN investors i ON i.id = s.investor_id
      WHERE i.buam_user_id = auth.uid()
    )
  );

-- ─── 2. TRIGGER: Quand admin confirme → met à jour payment_tranches ─
CREATE OR REPLACE FUNCTION auto_confirm_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Quand le statut passe à 'confirmed'
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    -- Mettre à jour la tranche correspondante
    UPDATE payment_tranches
    SET
      status = 'received',
      received_amount_ngn = NEW.amount_ngn,
      received_date = CURRENT_DATE,
      received_currency = NEW.currency,
      payment_method = NEW.payment_method,
      bank_reference = COALESCE(NEW.bank_reference, NEW.mobile_reference),
      acknowledgement_issued = true,
      acknowledgement_date = NOW(),
      recorded_by = NEW.reviewed_by
    WHERE
      subscription_id = NEW.subscription_id
      AND tranche_number = NEW.tranche_number
      AND status != 'received';

    -- Mettre à jour le montant levé du projet
    UPDATE projects p
    SET raised_amount_ngn = raised_amount_ngn + NEW.amount_ngn
    FROM subscriptions s
    WHERE s.id = NEW.subscription_id AND s.project_id = p.id;

    -- Vérifier si toutes les tranches sont payées → marquer souscription complète
    UPDATE subscriptions s
    SET status = 'complete'
    WHERE s.id = NEW.subscription_id
    AND NOT EXISTS (
      SELECT 1 FROM payment_tranches pt
      WHERE pt.subscription_id = s.id AND pt.status != 'received'
    );

    -- Envoyer notification à l'investisseur
    INSERT INTO notifications (user_id, title, body, type, data)
    SELECT
      i.buam_user_id,
      '✅ Paiement confirmé',
      'Votre paiement de ₦' || NEW.amount_ngn::TEXT || ' a été confirmé par B-Invest.',
      'payment_received',
      jsonb_build_object('subscription_id', NEW.subscription_id, 'tranche', NEW.tranche_number, 'amount', NEW.amount_ngn)
    FROM subscriptions s
    JOIN investors i ON i.id = s.investor_id
    WHERE s.id = NEW.subscription_id AND i.buam_user_id IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_payment_confirmed
  AFTER UPDATE ON payment_requests
  FOR EACH ROW EXECUTE FUNCTION auto_confirm_payment();

-- ─── 3. TRIGGER: Notification admin quand l'app soumet un paiement ─
CREATE OR REPLACE FUNCTION notify_admin_payment_submitted()
RETURNS TRIGGER AS $$
DECLARE
  investor_name TEXT;
  project_name TEXT;
BEGIN
  -- Récupérer les infos
  SELECT i.full_name, p.name INTO investor_name, project_name
  FROM subscriptions s
  JOIN investors i ON i.id = s.investor_id
  JOIN projects p ON p.id = s.project_id
  WHERE s.id = NEW.subscription_id;

  -- Log audit
  INSERT INTO audit_logs (action, resource_type, resource_id, new_values, severity)
  VALUES (
    'payment_request.submitted',
    'payment_request',
    NEW.id::TEXT,
    jsonb_build_object(
      'investor', investor_name,
      'project', project_name,
      'amount', NEW.amount_ngn,
      'tranche', NEW.tranche_number
    ),
    'info'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_payment_submitted
  AFTER INSERT ON payment_requests
  FOR EACH ROW EXECUTE FUNCTION notify_admin_payment_submitted();

-- ─── 4. VUE: Demandes de paiement en attente (pour le panel admin) ─
CREATE OR REPLACE VIEW pending_payment_requests AS
SELECT
  pr.*,
  i.full_name AS investor_name,
  i.email AS investor_email,
  i.country AS investor_country,
  p.name AS project_name,
  p.type AS project_type,
  s.dia_reference
FROM payment_requests pr
JOIN subscriptions s ON s.id = pr.subscription_id
JOIN investors i ON i.id = s.investor_id
JOIN projects p ON p.id = s.project_id
WHERE pr.status IN ('submitted', 'under_review')
ORDER BY pr.submitted_at DESC;

-- ─── 5. RLS payment_requests: accès depuis l'app ─────────────────
-- L'investisseur peut créer une demande
CREATE POLICY "investor_create_request" ON payment_requests
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND subscription_id IN (
      SELECT s.id FROM subscriptions s
      JOIN investors i ON i.id = s.investor_id
      WHERE i.buam_user_id = auth.uid()
    )
  );

-- ─── RÉSUMÉ ──────────────────────────────────────────────────────
-- ✅ L'investisseur soumet un paiement depuis l'app
-- ✅ L'admin voit la demande dans le panel (temps réel)
-- ✅ L'admin confirme → payment_tranches mis à jour automatiquement
-- ✅ Le projet updated (raised_amount_ngn)
-- ✅ La souscription passe à 'complete' si tout est payé
-- ✅ Notification push envoyée à l'investisseur
-- ✅ Audit trail enregistré
