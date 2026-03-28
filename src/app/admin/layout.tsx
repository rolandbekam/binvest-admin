'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { getLang, setLang, T, type Lang } from '@/lib/i18n';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [admin, setAdmin] = useState<any>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [lang, setLangState] = useState<Lang>('fr');

  useEffect(() => {
    setLangState(getLang());
    const h = () => setLangState(getLang());
    window.addEventListener('lang-change', h);
    return () => window.removeEventListener('lang-change', h);
  }, []);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json()).then(d => { if (d.admin) setAdmin(d.admin); })
      .catch(() => {});
  }, []);

  const t = T[lang].nav;

  const NAV = [
    { section: t.s_main },
    { href: '/admin/dashboard', icon: '📊', label: t.dashboard },
    { href: '/admin/projects',  icon: '🌍', label: t.projects },
    { href: '/admin/subscriptions', icon: '📋', label: t.subscriptions },
    { href: '/admin/payments',  icon: '💰', label: t.payments },
    { section: t.s_finance },
    { href: '/admin/accounting', icon: '💼', label: t.accounting },
    { href: '/admin/finances',   icon: '🏦', label: t.finances },
    { section: t.s_market },
    { href: '/admin/ngx', icon: '📈', label: t.ngx },
    { section: t.s_members },
    { href: '/admin/investors',  icon: '👥', label: t.investors },
    { href: '/admin/pic',        icon: '🏛️', label: t.pic },
    { href: '/admin/tontines',   icon: '🤝', label: t.tontines },
    { href: '/admin/documents',  icon: '📄', label: t.documents },
    { section: t.s_security },
    { href: '/admin/audit',    icon: '🔍', label: t.audit },
    { href: '/admin/settings', icon: '⚙️', label: t.settings },
  ];

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    toast.success(lang === 'fr' ? 'Déconnexion réussie' : 'Logged out');
    router.push('/login');
  };

  const toggleLang = () => {
    const newLang: Lang = lang === 'fr' ? 'en' : 'fr';
    setLang(newLang);
    setLangState(newLang);
    toast.success(newLang === 'fr' ? '🇫🇷 Français' : '🇬🇧 English');
  };

  const currentLabel = NAV.find(n => 'href' in n && pathname.startsWith((n as any).href))?.label ?? '';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F4F6FA', fontFamily: 'Outfit,sans-serif' }}>

      {/* ── SIDEBAR ── */}
      <aside style={{
        width: collapsed ? 68 : 260,
        background: 'linear-gradient(180deg, #0D2347 0%, #1B3A6B 100%)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        transition: 'width 0.25s ease', overflow: 'hidden',
        boxShadow: '4px 0 20px rgba(13,35,71,0.25)',
      }}>

        {/* Logo */}
        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 10, minHeight: 80 }}>
          {collapsed ? (
            // Logo compact (juste le symbole pilier)
            <div style={{ width: 38, height: 38, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Image src="/logo-binvest.jpg" alt="B-Invest" width={36} height={36} style={{ objectFit: 'cover', objectPosition: 'top' }} />
            </div>
          ) : (
            // Logo plein
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: '#fff', padding: 3 }}>
                <Image src="/logo-binvest.jpg" alt="B-Invest" width={38} height={38} style={{ objectFit: 'contain', width: '100%', height: '100%' }} />
              </div>
              <div>
                <div style={{ color: '#fff', fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 15, letterSpacing: '0.5px', lineHeight: 1.1 }}>B-INVEST</div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', marginTop: 2 }}>Admin Panel</div>
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{ marginLeft: collapsed ? 'auto' : undefined, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 11, padding: '4px 7px', flexShrink: 0 }}>
            {collapsed ? '▶' : '◀'}
          </button>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {NAV.map((item, i) => {
            if ('section' in item) {
              if (collapsed) return null;
              return (
                <div key={i} style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', padding: '14px 10px 5px', marginTop: i > 0 ? 4 : 0 }}>
                  {item.section}
                </div>
              );
            }
            const active = pathname.startsWith(item.href!);
            return (
              <Link key={item.href} href={item.href!} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: collapsed ? '10px' : '9px 12px',
                borderRadius: 9, textDecoration: 'none', transition: 'all 0.15s',
                justifyContent: collapsed ? 'center' : 'flex-start',
                color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                background: active ? 'rgba(201,150,58,0.18)' : 'transparent',
                border: `1px solid ${active ? 'rgba(201,150,58,0.35)' : 'transparent'}`,
              }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && (
                  <span style={{ fontSize: 13, fontWeight: active ? 700 : 500 }}>{item.label}</span>
                )}
                {active && !collapsed && (
                  <div style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%', background: '#C9963A', flexShrink: 0 }} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Lang switcher */}
        {!collapsed && (
          <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <button onClick={toggleLang} style={{
              width: '100%', padding: '8px 12px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)', cursor: 'pointer',
              color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Outfit,sans-serif',
            }}>
              <span style={{ fontSize: 16 }}>{lang === 'fr' ? '🇫🇷' : '🇬🇧'}</span>
              <span>{lang === 'fr' ? 'Français → English' : 'English → Français'}</span>
            </button>
          </div>
        )}

        {/* User */}
        <div style={{ padding: '10px 8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.06)' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#E63946', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0, border: '2px solid rgba(255,255,255,0.15)' }}>
              {admin?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() ?? 'AD'}
            </div>
            {!collapsed && (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{admin?.name ?? '...'}</div>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 1 }}>{admin?.role}</div>
                </div>
                <button onClick={logout} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 15, padding: 4 }} title={T[lang].common.logout}>
                  ↪
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <header style={{ height: 60, background: '#fff', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0, boxShadow: '0 1px 6px rgba(27,58,107,0.05)' }}>
          <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, color: '#0F1E35', fontSize: 15 }}>
            {currentLabel}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, padding: '5px 12px', borderRadius: 999, background: 'rgba(27,58,107,0.07)', color: '#1B3A6B', fontWeight: 600 }}>
              {T[lang].common.session}
            </span>
            <span style={{ color: '#94A3B8', fontSize: 13 }}>{admin?.email}</span>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
