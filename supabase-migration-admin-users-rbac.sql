-- Migration : table admin_users + RBAC roles
-- Date : 2026-05-03
-- Note : si table déjà existante, l'IF NOT EXISTS la laisse intacte.

CREATE TABLE IF NOT EXISTS public.admin_users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text UNIQUE NOT NULL,
  full_name       text,
  password_hash   text NOT NULL,
  role            text NOT NULL DEFAULT 'viewer'
                    CHECK (role IN ('super_admin', 'admin', 'viewer')),
  is_active       boolean DEFAULT true,
  login_attempts  int DEFAULT 0,
  locked_until    timestamptz,
  last_login_at   timestamptz,
  created_at      timestamptz DEFAULT NOW(),
  updated_at      timestamptz DEFAULT NOW()
);

-- Si la table existait déjà sans la colonne role, on l'ajoute :
ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('super_admin', 'admin', 'viewer'));

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users (email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role  ON public.admin_users (role);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_admin_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_admin_users_updated_at ON public.admin_users;
CREATE TRIGGER trg_admin_users_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_admin_users_updated_at();

-- IMPORTANT : Créer manuellement le premier super_admin via l'API d'auth ou un INSERT direct.
-- Exemple (remplacer les valeurs) :
-- INSERT INTO public.admin_users (email, full_name, role, password_hash)
-- VALUES (
--   'admin@binvest.ng', 'Admin Principal', 'super_admin',
--   encode(digest('VOTRE_PASSWORD' || 'VOTRE_PEPPER', 'sha256'), 'hex')
-- );

COMMENT ON COLUMN public.admin_users.role IS
  'super_admin = tout (gestion admins, settings, suppressions); admin = lecture+écriture; viewer = lecture seule';
