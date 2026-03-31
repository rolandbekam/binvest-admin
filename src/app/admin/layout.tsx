'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { getLang, setLang, T, type Lang } from '@/lib/i18n';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

// ── Helper: notification icon + label by type ────────────────────
function notifMeta(n: any, lang: string) {
  const action = n.data?.action ?? n.type;
  if (n.type === 'kyc' || action === 'kyc_submitted') {
    return { icon: '🪪', color: '#991B1B', bg: '#FEF2F2', label: lang === 'fr' ? 'KYC soumis' : 'KYC submitted' };
  }
  if (n.type === 'payment' || action === 'payment_submitted') {
    return { icon: '💳', color: '#92400E', bg: '#FFFBEB', label: lang === 'fr' ? 'Paiement soumis' : 'Payment submitted' };
  }
  return { icon: '🔔', color: '#1B3A6B', bg: '#EFF6FF', label: n.type ?? 'Notification' };
}

function timeAgo(ts: string, lang: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return lang === 'fr' ? 'à l\'instant' : 'just now';
  if (m < 60) return lang === 'fr' ? `il y a ${m} min` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return lang === 'fr' ? `il y a ${h}h` : `${h}h ago`;
  return lang === 'fr' ? `il y a ${Math.floor(h/24)}j` : `${Math.floor(h/24)}d ago`;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [admin, setAdmin] = useState<any>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [lang, setLangState] = useState<Lang>('fr');

  // ── Notification state ──────────────────────────────────────────
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Derived counts for sidebar badges
  const kycPending = notifications.filter(n => n.type === 'kyc').length;
  const paymentPending = notifications.filter(n => n.type === 'payment').length;
  const [kycDismissed, setKycDismissed] = useState(false);
  const [payDismissed, setPayDismissed] = useState(false);

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

  // Fetch notifications from the `notifications` table
  const fetchNotifications = useCallback(() => {
    fetch('/api/admin/notifications', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setNotifications(d.notifications ?? []))
      .catch(() => {});
  }, []);

  // Initial load + polling every 30s
  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 30000);
    return () => clearInterval(timer);
  }, [fetchNotifications]);

  // Supabase Realtime on the notifications table
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    const channel = supabase
      .channel('admin-notif-bell')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => fetchNotifications())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, () => fetchNotifications())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

  // Mark a single notification as read
  const markRead = useCallback(async (id: string) => {
    await fetch('/api/admin/notifications', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ id }),
    });
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Mark all as read
  const markAllRead = useCallback(async () => {
    await fetch('/api/admin/notifications', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ mark_all: true }),
    });
    setNotifications([]);
    setNotifOpen(false);
  }, []);

  // Reset dismissed banners when counts change
  useEffect(() => { setKycDismissed(false); }, [kycPending]);
  useEffect(() => { setPayDismissed(false); }, [paymentPending]);

  const t = T[lang].nav;

  const NAV = [
    { section: t.s_main },
    { href: '/admin/dashboard', icon: '📊', label: t.dashboard },
    { href: '/admin/projects',  icon: '🌍', label: t.projects },
    { href: '/admin/subscriptions', icon: '📋', label: t.subscriptions },
    { href: '/admin/payments',  icon: '💰', label: t.payments, badge: paymentPending > 0 ? paymentPending : undefined },
    { section: t.s_finance },
    { href: '/admin/accounting', icon: '💼', label: t.accounting },
    { href: '/admin/finances',   icon: '🏦', label: t.finances },
    { section: t.s_market },
    { href: '/admin/ngx', icon: '📈', label: t.ngx },
    { section: t.s_members },
    { href: '/admin/investors',  icon: '👥', label: t.investors, badge: kycPending > 0 ? kycPending : undefined },
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

  const showKycBanner = kycPending > 0 && !kycDismissed && !pathname.startsWith('/admin/investors');
  const showPayBanner = paymentPending > 0 && !payDismissed && !pathname.startsWith('/admin/payments');

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
            <div style={{ width: 38, height: 38, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Image src="/logo-binvest.jpg" alt="B-Invest" width={36} height={36} style={{ objectFit: 'cover', objectPosition: 'top' }} />
            </div>
          ) : (
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
            const badge = (item as any).badge as number | undefined;
            return (
              <Link key={item.href} href={item.href!} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: collapsed ? '10px' : '9px 12px',
                borderRadius: 9, textDecoration: 'none', transition: 'all 0.15s',
                justifyContent: collapsed ? 'center' : 'flex-start',
                color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                background: active ? 'rgba(201,150,58,0.18)' : 'transparent',
                border: `1px solid ${active ? 'rgba(201,150,58,0.35)' : 'transparent'}`,
                position: 'relative',
              }}>
                <span style={{ fontSize: 16, flexShrink: 0, position: 'relative' }}>
                  {item.icon}
                  {/* Badge on icon when collapsed */}
                  {badge && collapsed && (
                    <span style={{
                      position: 'absolute', top: -4, right: -6,
                      minWidth: 16, height: 16, borderRadius: 999,
                      background: '#E63946', color: '#fff',
                      fontSize: 9, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 3px', lineHeight: 1, border: '1.5px solid #1B3A6B',
                    }}>
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </span>
                {!collapsed && (
                  <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, flex: 1 }}>{item.label}</span>
                )}
                {/* Badge inline when expanded */}
                {badge && !collapsed && (
                  <span style={{
                    minWidth: 20, height: 18, borderRadius: 999,
                    background: '#E63946', color: '#fff',
                    fontSize: 10, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 5px', lineHeight: 1, flexShrink: 0,
                  }}>
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
                {active && !collapsed && !badge && (
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

            {/* 🔔 Notification bell + dropdown */}
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setNotifOpen(v => !v)}
                style={{
                  position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: notifOpen ? '#EFF6FF' : notifications.length > 0 ? '#FEF2F2' : '#F8FAFC',
                  transition: 'all 0.15s',
                }}
                title={lang === 'fr' ? 'Notifications' : 'Notifications'}
              >
                <span style={{ fontSize: 18 }}>🔔</span>
                {notifications.length > 0 && (
                  <span style={{
                    position: 'absolute', top: 1, right: 1,
                    minWidth: 18, height: 18, borderRadius: 999,
                    background: '#E63946', color: '#fff',
                    fontSize: 10, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 4px', lineHeight: 1, border: '2px solid #fff',
                  }}>
                    {notifications.length > 99 ? '99+' : notifications.length}
                  </span>
                )}
              </button>

              {/* Dropdown panel */}
              {notifOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                  width: 360, background: '#fff', borderRadius: 16,
                  border: '1px solid #E2E8F0', boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                  zIndex: 999, overflow: 'hidden',
                }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #F1F5F9' }}>
                    <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 14, color: '#0F1E35' }}>
                      🔔 {lang === 'fr' ? 'Notifications' : 'Notifications'}
                      {notifications.length > 0 && (
                        <span style={{ marginLeft: 8, background: '#E63946', color: '#fff', borderRadius: 999, fontSize: 11, padding: '2px 7px', fontWeight: 800 }}>
                          {notifications.length}
                        </span>
                      )}
                    </div>
                    {notifications.length > 0 && (
                      <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#5A6E8A', fontWeight: 600, textDecoration: 'underline' }}>
                        {lang === 'fr' ? 'Tout marquer lu' : 'Mark all read'}
                      </button>
                    )}
                  </div>

                  {/* Notification list */}
                  <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94A3B8', fontSize: 13 }}>
                        {lang === 'fr' ? '✅ Aucune notification non lue' : '✅ No unread notifications'}
                      </div>
                    ) : notifications.slice(0, 20).map((n, i) => {
                      const meta = notifMeta(n, lang);
                      const investorId = n.data?.investor_id ?? n.data?.user_id ?? n.user_id;
                      const isKyc = n.type === 'kyc' || n.data?.action === 'kyc_submitted';
                      const isPayment = n.type === 'payment' || n.data?.action === 'payment_submitted';
                      const name = n.data?.investor_name ?? n.data?.name ?? n.data?.full_name ?? '';
                      return (
                        <div key={n.id} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          padding: '12px 16px',
                          borderBottom: i < notifications.length - 1 ? '1px solid #F8FAFC' : 'none',
                          background: '#fff',
                        }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                            {meta.icon}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: meta.color }}>{meta.label}</div>
                            {name && <div style={{ fontSize: 12, color: '#374151', marginTop: 1 }}>{name}</div>}
                            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{timeAgo(n.created_at, lang)}</div>
                            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                              {isKyc && investorId && (
                                <Link href={`/admin/investors/${investorId}`} onClick={() => setNotifOpen(false)}
                                  style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: '#1B3A6B', color: '#fff', textDecoration: 'none' }}>
                                  👁 {lang === 'fr' ? 'Voir profil' : 'View profile'}
                                </Link>
                              )}
                              {isPayment && (
                                <Link href="/admin/payments" onClick={() => setNotifOpen(false)}
                                  style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: '#92400E', color: '#fff', textDecoration: 'none' }}>
                                  💳 {lang === 'fr' ? 'Voir paiements' : 'View payments'}
                                </Link>
                              )}
                              <button onClick={() => markRead(n.id)}
                                style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', cursor: 'pointer' }}>
                                ✓ {lang === 'fr' ? 'Lu' : 'Read'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer */}
                  <div style={{ padding: '10px 16px', borderTop: '1px solid #F1F5F9', textAlign: 'center' }}>
                    <Link href="/admin/dashboard" onClick={() => setNotifOpen(false)}
                      style={{ fontSize: 12, color: '#1B3A6B', fontWeight: 600, textDecoration: 'none' }}>
                      {lang === 'fr' ? 'Voir toutes les alertes →' : 'View all alerts →'}
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <span style={{ color: '#E2E8F0', fontSize: 18 }}>|</span>
            <span style={{ fontSize: 11, padding: '5px 12px', borderRadius: 999, background: 'rgba(27,58,107,0.07)', color: '#1B3A6B', fontWeight: 600 }}>
              {T[lang].common.session}
            </span>
            <span style={{ color: '#94A3B8', fontSize: 13 }}>{admin?.email}</span>
          </div>
        </header>

        {/* KYC banner */}
        {showKycBanner && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 24px', background: 'linear-gradient(90deg, #7F1D1D, #991B1B)', borderBottom: '1px solid #B91C1C', flexShrink: 0 }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>🔴</span>
            <div style={{ flex: 1 }}>
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>
                {lang === 'fr'
                  ? `${kycPending} investisseur${kycPending > 1 ? 's' : ''} en attente de validation KYC`
                  : `${kycPending} investor${kycPending > 1 ? 's' : ''} pending KYC validation`}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, marginLeft: 8 }}>
                {lang === 'fr' ? '— Souscriptions bloquées jusqu\'à validation' : '— Subscriptions blocked until validated'}
              </span>
            </div>
            <Link href="/admin/investors?kyc_status=in_review" style={{ padding: '6px 14px', borderRadius: 8, background: '#fff', color: '#991B1B', fontSize: 12, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>
              {lang === 'fr' ? 'Valider maintenant →' : 'Validate now →'}
            </Link>
            <button onClick={() => setKycDismissed(true)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 14, padding: '4px 8px', flexShrink: 0, lineHeight: 1 }}>✕</button>
          </div>
        )}
        {/* Payment banner */}
        {showPayBanner && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 24px', background: 'linear-gradient(90deg, #78350F, #92400E)', borderBottom: '1px solid #B45309', flexShrink: 0 }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>💳</span>
            <div style={{ flex: 1 }}>
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>
                {lang === 'fr'
                  ? `${paymentPending} paiement${paymentPending > 1 ? 's' : ''} en attente de confirmation`
                  : `${paymentPending} payment${paymentPending > 1 ? 's' : ''} awaiting confirmation`}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, marginLeft: 8 }}>
                {lang === 'fr' ? '— Soumis depuis l\'app Buam Finance' : '— Submitted from the Buam Finance app'}
              </span>
            </div>
            <Link href="/admin/payments" style={{ padding: '6px 14px', borderRadius: 8, background: '#fff', color: '#92400E', fontSize: 12, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>
              {lang === 'fr' ? 'Confirmer →' : 'Confirm →'}
            </Link>
            <button onClick={() => setPayDismissed(true)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 14, padding: '4px 8px', flexShrink: 0, lineHeight: 1 }}>✕</button>
          </div>
        )}

        {/* Content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
