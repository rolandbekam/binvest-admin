# 🚀 Guide de déploiement Vercel — B-Invest Admin

## Variables d'environnement à configurer dans Vercel

Dans Vercel → Settings → Environment Variables, ajoutez :

### Obligatoires
| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | https://qmruhwvjbzejzfcpgxtr.supabase.co |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (votre clé anon Supabase) |
| `SUPABASE_SERVICE_ROLE_KEY` | (votre service role key) |
| `JWT_SECRET` | (votre secret JWT généré) |
| `PASSWORD_PEPPER` | 40b17800a0bd3313bc015041e1784a10fbcdc404dd9294b9a2accfb742d76f55 |
| `ENCRYPTION_KEY` | (votre clé chiffrement) |
| `NEXT_PUBLIC_APP_URL` | https://votre-projet.vercel.app |

### Email (optionnel — notifications automatiques)
| Variable | Valeur |
|---|---|
| `RESEND_API_KEY` | Créer un compte gratuit sur resend.com (3000 emails/mois gratuits) |
| `EMAIL_FROM` | B-Invest Limited <noreply@binvest.ng> |

## Protection par mot de passe Vercel (Plan Pro requis)
Settings → Password Protection → Enable

## HTTPS
Automatique sur Vercel — aucune configuration requise.

## Domaine personnalisé (ex: admin.binvest.ng)
Settings → Domains → Add → admin.binvest.ng
Puis ajoutez un CNAME chez votre registrar DNS.

## Étapes de déploiement
1. git push origin main
2. Vercel détecte automatiquement et déploie
3. Vérifiez les variables d'environnement
4. Testez la connexion sur l'URL Vercel
