-- Migration : ajouter sudo_customer_id à profiles
-- Permet de retenir l'ID client Sudo pour ne pas re-créer un customer à chaque carte.
-- Date : 2026-05-05

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sudo_customer_id text,
  ADD COLUMN IF NOT EXISTS sudo_customer_status text;

COMMENT ON COLUMN public.profiles.sudo_customer_id IS
  'ID du customer chez Sudo Africa. Créé à la première demande de carte.';
COMMENT ON COLUMN public.profiles.sudo_customer_status IS
  'pending|active|rejected — selon la KYC interne de Sudo.';

CREATE INDEX IF NOT EXISTS idx_profiles_sudo_customer
  ON public.profiles (sudo_customer_id) WHERE sudo_customer_id IS NOT NULL;
