'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { getLang, T, type Lang } from '@/lib/i18n';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [lang, setLangState] = useState<Lang>('fr');

  useEffect(() => {
    setLangState(getLang());
    if (searchParams.get('reason') === 'session_expired') {
      toast.error(lang === 'fr' ? 'Session expirée. Reconnectez-vous.' : 'Session expired. Please log in again.');
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Remplissez tous les champs'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Erreur de connexion');
        return;
      }
      toast.success(`Bienvenue, ${data.admin.name} !`);
      router.push('/admin/dashboard');
      router.refresh();
    } catch {
      toast.error('Erreur réseau.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0D2347 0%, #1B3A6B 50%, #0D2347 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, fontFamily: 'Outfit, sans-serif', position: 'relative', overflow: 'hidden',
    }}>
      {/* Background decoration */}
      <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,150,58,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -100, left: -100, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(230,57,70,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Pattern */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4z'/%3E%3C/g%3E%3C/svg%3E\")", pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative' }}>
        {/* Kente stripe top */}
        <div style={{ display: 'flex', height: 5, borderRadius: 999, overflow: 'hidden', marginBottom: 32 }}>
          {['#1B3A6B','#E63946','#C9963A','#1B2A3A','#1B3A6B','#E63946','#C9963A','#1B2A3A','#1B3A6B','#C9963A'].map((c, i) => (
            <div key={i} style={{ flex: 1, background: c }} />
          ))}
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 24,
          padding: 40,
          boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
        }}>
          {/* Logo B-Invest */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              width: 110, height: 110, borderRadius: 22, background: '#fff',
              margin: '0 auto 16px', padding: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Image
                src="/logo-binvest.jpg"
                alt="B-Invest Limited"
                width={90}
                height={90}
                style={{ objectFit: 'contain', width: '100%', height: '100%' }}
              />
            </div>
            <div style={{ color: '#fff', fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 800, letterSpacing: '1px' }}>
              B-INVEST
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 4 }}>
              {lang === 'fr' ? 'Panel Administrateur' : 'Admin Panel'}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: 600, marginBottom: 7 }}>
                {lang === 'fr' ? 'Email administrateur' : 'Admin Email'}
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="raissa@binvest.ng"
                autoComplete="username" required
                style={{
                  width: '100%', padding: '13px 16px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff', fontSize: 15, outline: 'none', fontFamily: 'Outfit,sans-serif',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = '#C9963A'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: 600, marginBottom: 7 }}>
                {lang === 'fr' ? 'Mot de passe' : 'Password'}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password" required minLength={8}
                  style={{
                    width: '100%', padding: '13px 48px 13px 16px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff', fontSize: 15, outline: 'none', fontFamily: 'Outfit,sans-serif',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#C9963A'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13, padding: 4 }}>
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                background: loading ? 'rgba(201,150,58,0.5)' : 'linear-gradient(135deg, #C9963A, #E8B455)',
                color: '#0D2347', fontWeight: 800, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'Syne,sans-serif', letterSpacing: '0.5px', marginTop: 4,
                boxShadow: loading ? 'none' : '0 6px 20px rgba(201,150,58,0.35)',
                transition: 'all 0.2s',
              }}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <svg style={{ animation: 'spin 1s linear infinite', width: 16, height: 16 }} fill="none" viewBox="0 0 24 24">
                    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  {lang === 'fr' ? 'Connexion...' : 'Signing in...'}
                </span>
              ) : (
                lang === 'fr' ? 'Se connecter →' : 'Sign in →'
              )}
            </button>
          </form>

          {/* Security notice */}
          <div style={{
            marginTop: 20, padding: '10px 14px', borderRadius: 10,
            background: 'rgba(201,150,58,0.08)', border: '1px solid rgba(201,150,58,0.2)',
          }}>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, textAlign: 'center', margin: 0 }}>
              🔒 {lang === 'fr' ? 'Connexion sécurisée · Toutes les actions sont auditées · Session 8h' : 'Secure login · All actions are audited · 8h session'}
            </p>
          </div>

          {/* Lang toggle */}
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button onClick={() => setLangState(lang === 'fr' ? 'en' : 'fr')}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 12, fontFamily: 'Outfit,sans-serif' }}>
              {lang === 'fr' ? '🇬🇧 Switch to English' : '🇫🇷 Passer en Français'}
            </button>
          </div>
        </div>

        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, textAlign: 'center', marginTop: 20 }}>
          © 2026 B Invest Limited · {lang === 'fr' ? 'Accès réservé aux administrateurs' : 'Restricted to authorized admins'}
        </p>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
