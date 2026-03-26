-- ═══════════════════════════════════════════════════════════════
-- PONT DE SYNCHRONISATION — App Buam Finance ↔ Panel Admin
-- À exécuter dans Supabase SQL Editor après les deux schemas
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. VUES PUBLIQUES (lisibles par l'app) ──────────────────────
-- L'app mobile voit les projets via cette vue sécurisée

CREATE OR REPLACE VIEW public_projects AS
SELECT
  id,
  name,
  slug,
  type,
  status,
  description,
  location,
  state_country,
  surface_ha,
  min_investment_ngn,
  max_investment_ngn,
  target_amount_ngn,
  raised_amount_ngn,
  ROUND(raised_amount_ngn * 100.0 / NULLIF(target_amount_ngn, 0), 1) AS raised_pct,
  horizon_years,
  yield_min_pct,
  yield_max_pct,
  tranches_count,
  spots_total,
  spots_taken,
  spots_total - spots_taken AS spots_remaining,
  fee_facilitation_pct,
  highlights,
  is_visible_app,
  launch_date,
  close_date,
  -- Dernière mise à jour projet (pour afficher dans l'app)
  (
    SELECT jsonb_build_object(
      'title', title,
      'content', content,
      'type', update_type,
      'date', created_at
    )
    FROM project_updates pu
    WHERE pu.project_id = projects.id
      AND pu.visible_to_investors = true
    ORDER BY created_at DESC
    LIMIT 1
  ) AS latest_update,
  created_at,
  updated_at
FROM projects
WHERE is_visible_app = true
  AND status IN ('open', 'active');

-- Vue des mises à jour projet (timeline dans l'app)
CREATE OR REPLACE VIEW public_project_updates AS
SELECT
  pu.id,
  pu.project_id,
  pu.title,
  pu.content,
  pu.update_type,
  pu.milestone_status,
  pu.created_at,
  p.name AS project_name
FROM project_updates pu
JOIN projects p ON p.id = pu.project_id
WHERE pu.visible_to_investors = true
  AND p.is_visible_app = true;

-- Vue souscriptions de l'utilisateur connecté (via son buam_user_id)
CREATE OR REPLACE VIEW my_subscriptions AS
SELECT
  s.id,
  s.status,
  s.amount_ngn,
  s.facilitation_fee_ngn,
  s.total_amount_ngn,
  s.tranches_count,
  s.dia_reference,
  s.created_at,
  -- Infos projet
  p.id AS project_id,
  p.name AS project_name,
  p.type AS project_type,
  p.status AS project_status,
  p.raised_pct AS project_raised_pct,
  p.latest_update AS project_latest_update,
  -- Tranches
  (
    SELECT jsonb_agg(jsonb_build_object(
      'id', pt.id,
      'tranche_number', pt.tranche_number,
      'amount_ngn', pt.amount_ngn,
      'percentage_pct', pt.percentage_pct,
      'due_date', pt.due_date,
      'status', pt.status,
      'received_date', pt.received_date,
      'acknowledgement_issued', pt.acknowledgement_issued
    ) ORDER BY pt.tranche_number)
    FROM payment_tranches pt
    WHERE pt.subscription_id = s.id
  ) AS tranches,
  -- Progression globale
  (
    SELECT COUNT(*) FILTER (WHERE pt.status = 'received') * 100.0 / NULLIF(COUNT(*), 0)
    FROM payment_tranches pt WHERE pt.subscription_id = s.id
  ) AS payment_progress_pct
FROM subscriptions s
JOIN public_projects p ON p.id = s.project_id
JOIN investors i ON i.id = s.investor_id
WHERE i.buam_user_id = auth.uid()   -- ← Sécurité: chaque user ne voit QUE ses données
  AND s.status != 'cancelled';

-- ─── 2. POLITIQUES RLS POUR L'APP ────────────────────────────────

-- Projets publics : tous les users authentifiés peuvent lire
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_read_visible_projects" ON projects;
CREATE POLICY "app_read_visible_projects" ON projects
  FOR SELECT
  USING (
    auth.role() = 'service_role'          -- Admin panel : tout
    OR (
      auth.role() = 'authenticated'       -- App : seulement les projets visibles
      AND is_visible_app = true
      AND status IN ('open', 'active')
    )
  );

-- Project updates : lisibles par les investisseurs authentifiés
ALTER TABLE project_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_read_project_updates" ON project_updates;
CREATE POLICY "app_read_project_updates" ON project_updates
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND visible_to_investors = true)
  );

-- Souscriptions : un user ne voit QUE les siennes
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_read_own_subscriptions" ON subscriptions;
CREATE POLICY "app_read_own_subscriptions" ON subscriptions
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR (
      auth.role() = 'authenticated'
      AND investor_id IN (
        SELECT id FROM investors WHERE buam_user_id = auth.uid()
      )
    )
  );

-- Tranches : un user ne voit QUE les siennes
ALTER TABLE payment_tranches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_read_own_tranches" ON payment_tranches;
CREATE POLICY "app_read_own_tranches" ON payment_tranches
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR (
      auth.role() = 'authenticated'
      AND subscription_id IN (
        SELECT s.id FROM subscriptions s
        JOIN investors i ON i.id = s.investor_id
        WHERE i.buam_user_id = auth.uid()
      )
    )
  );

-- ─── 3. SOUSCRIPTIONS DEPUIS L'APP ───────────────────────────────
-- Permet à un user de soumettre une demande de souscription depuis l'app
-- (statut 'pending' — l'admin valide ensuite)

DROP POLICY IF EXISTS "app_create_subscription_request" ON subscriptions;
CREATE POLICY "app_create_subscription_request" ON subscriptions
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND status = 'pending'
    AND investor_id IN (
      SELECT id FROM investors WHERE buam_user_id = auth.uid()
    )
  );

-- ─── 4. TEMPS RÉEL (Realtime) ─────────────────────────────────────
-- Activer Realtime sur les tables que l'app doit écouter

ALTER PUBLICATION supabase_realtime ADD TABLE projects;
ALTER PUBLICATION supabase_realtime ADD TABLE project_updates;
ALTER PUBLICATION supabase_realtime ADD TABLE subscriptions;
ALTER PUBLICATION supabase_realtime ADD TABLE payment_tranches;

-- ─── 5. FONCTION: Lier un user Buam Finance à un investisseur ────
-- Appelée quand un user s'inscrit dans l'app ET existe déjà dans investors

CREATE OR REPLACE FUNCTION link_buam_user_to_investor()
RETURNS TRIGGER AS $$
BEGIN
  -- Si l'email du nouvel user correspond à un investisseur existant, on le lie
  UPDATE investors
  SET buam_user_id = NEW.id
  WHERE email = NEW.email
    AND buam_user_id IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_buam_user_created ON auth.users;
CREATE TRIGGER on_buam_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION link_buam_user_to_investor();

-- ─── 6. FONCTION: Créer automatiquement l'investisseur ──────────
-- Quand un user s'inscrit dans l'app, créer son profil investisseur

CREATE OR REPLACE FUNCTION create_investor_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO investors (
    buam_user_id,
    full_name,
    email,
    kyc_status
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Utilisateur Buam'),
    NEW.email,
    'pending'
  )
  ON CONFLICT (email) DO UPDATE
  SET buam_user_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_investor ON auth.users;
CREATE TRIGGER on_auth_user_created_investor
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_investor_on_signup();

-- ─── 7. NOTIFICATIONS TEMPS RÉEL ─────────────────────────────────
-- Table pour les notifications push (admin → users)

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT DEFAULT 'info'
    CHECK (type IN ('info', 'payment_due', 'payment_received', 'project_update', 'kyc')),
  is_read BOOLEAN DEFAULT false,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Users ne voient que leurs notifications
CREATE POLICY "user_own_notifications" ON notifications
  FOR ALL USING (
    auth.role() = 'service_role'
    OR user_id = auth.uid()
  );

-- ─── 8. FONCTION: Envoyer une notification depuis l'admin ────────
CREATE OR REPLACE FUNCTION send_notification(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_type TEXT DEFAULT 'info',
  p_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  notif_id UUID;
BEGIN
  INSERT INTO notifications (user_id, title, body, type, data)
  VALUES (p_user_id, p_title, p_body, p_type, p_data)
  RETURNING id INTO notif_id;
  RETURN notif_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Exemple d'usage (admin envoie notif paiement reçu):
-- SELECT send_notification(
--   'user-uuid-ici',
--   '✅ Paiement reçu',
--   'Votre tranche 1/2 de ₦1,000,000 pour "Palmeraie Ogun State" a été confirmée.',
--   'payment_received',
--   '{"subscription_id": "sub-uuid", "tranche": 1}'::jsonb
-- );

-- ─── RÉSUMÉ ──────────────────────────────────────────────────────
-- Après ce script:
-- ✅ Admin crée projet → visible dans l'app immédiatement (si is_visible_app = true)
-- ✅ User s'inscrit → profil investisseur créé automatiquement
-- ✅ User souscrit dans l'app → admin voit la demande dans le panel
-- ✅ Admin enregistre paiement → user voit son statut mis à jour (Realtime)
-- ✅ Admin poste update projet → user voit l'avancement (Realtime)
-- ✅ Notifications push admin → app (Realtime)
-- ✅ Chaque user ne voit QUE ses propres données (RLS)
