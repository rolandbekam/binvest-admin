# 🏦 B-Invest Admin — Panel Sécurisé

Stack : **Next.js 15 + Supabase + Vercel**

## 🔐 Architecture de sécurité

```
Browser → HTTPS → Vercel Edge (middleware) → API Routes (serveur) → Supabase
                        ↓
                  JWT verification
                  Rate limiting (5 logins/15min)
                  Role-based access control
                  Security headers
                        ↓
                  Audit Trail (toutes les actions)
                  Service Role Key (jamais exposée)
                  RLS PostgreSQL (accès service_role only)
                  Chiffrement données sensibles (pgcrypto)
```

## 📁 Structure du projet

```
binvest-admin-next/
├── src/
│   ├── middleware.ts              ← Sécurité globale (JWT, rate limit, headers)
│   ├── app/
│   │   ├── login/page.tsx         ← Page connexion sécurisée
│   │   ├── admin/
│   │   │   ├── layout.tsx         ← Layout avec sidebar + auth check
│   │   │   ├── dashboard/page.tsx ← Tableau de bord
│   │   │   ├── projects/          ← Gestion projets
│   │   │   ├── subscriptions/     ← Souscriptions
│   │   │   ├── payments/          ← Paiements & tranches
│   │   │   ├── investors/         ← Investisseurs
│   │   │   └── audit/page.tsx     ← Audit trail
│   │   └── api/
│   │       ├── auth/login/route.ts  ← Auth avec rate limiting
│   │       └── admin/
│   │           ├── projects/route.ts
│   │           ├── payments/route.ts
│   │           └── audit/route.ts
│   └── lib/
│       └── supabase.ts            ← Client serveur + audit logger
├── supabase-admin-schema.sql      ← Schema DB complet
└── .env.example                   ← Variables d'env requises
```

---

## 🚀 Déploiement sur Vercel (étape par étape)

### Étape 1 — Préparer Supabase

1. Allez sur **supabase.com** → votre projet existant
2. **SQL Editor** → Nouveau requête → Collez `supabase-admin-schema.sql` → Exécuter
3. **Settings → API** → Copiez :
   - `URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ SECRET

### Étape 2 — Générer les secrets

Dans PowerShell ou terminal :
```bash
# JWT Secret (64 chars)
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"

# Password Pepper (32 chars)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Encryption Key (32 chars)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Étape 3 — GitHub

```powershell
cd binvest-admin-next

# Créer .gitignore
echo ".env.local
.env
node_modules/
.next/" > .gitignore

git init
git add .
git commit -m "B-Invest Admin - Initial commit"
git branch -M main

# Sur github.com : New repository "binvest-admin"
git remote add origin https://github.com/VOTRE-USERNAME/binvest-admin.git
git push -u origin main
```

### Étape 4 — Vercel

1. **vercel.com** → Import Project → Votre repo `binvest-admin`
2. **Framework** : Next.js (auto-détecté)
3. **Environment Variables** : Ajoutez toutes les variables de `.env.example`
4. **Deploy** → ✅

### Étape 5 — Créer le premier admin

Dans Supabase SQL Editor :
```sql
-- Générer un hash SHA256 du mot de passe
-- En production, utilisez bcrypt. Pour le setup:
UPDATE admin_users
SET password_hash = encode(
  sha256(('VOTRE_MOT_DE_PASSE' || 'VOTRE_PASSWORD_PEPPER')::bytea),
  'hex'
)
WHERE email = 'raissa@binvest.ng';
```

### Étape 6 — Accéder au panel

```
https://votre-projet.vercel.app/login
→ Email : raissa@binvest.ng
→ Mot de passe : défini à l'étape 5
```

---

## 🔒 Mesures de sécurité implémentées

| Mesure | Détail |
|--------|--------|
| **Rate limiting** | 5 tentatives login / 15 min par IP |
| **JWT HttpOnly** | Token inaccessible au JavaScript client |
| **Audit trail** | 100% des actions loguées en DB |
| **RLS Supabase** | Tables accessibles service_role uniquement |
| **RBAC** | Super Admin / Admin / Viewer |
| **Headers HTTP** | X-Frame-Options, CSP, HSTS, XSS-Protection |
| **Chiffrement** | Numéros ID chiffrés avec pgcrypto |
| **Verrouillage** | Compte bloqué 30min après 5 échecs |
| **HTTPS** | Forcé par Vercel en production |
| **Secrets** | Jamais dans le code, uniquement env vars |

---

## 💰 Flux paiement sécurisé

```
1. Admin reçoit paiement → vérifie référence bancaire
2. POST /api/admin/payments → validation Zod
3. Middleware vérifie JWT + rôle admin
4. Mise à jour DB + calcul frais automatique
5. Audit log CRITICAL enregistré (immuable)
6. Accusé de réception DIA généré (référence unique)
7. Statut souscription mis à jour automatiquement
```

---

## 📧 Support

Pour toute question : raissa@binvest.ng
