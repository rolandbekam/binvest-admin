'use client';
import { useEffect, useState } from 'react';
import { getLang, T, type Lang } from '@/lib/i18n';
import toast from 'react-hot-toast';

const KYC_B: Record<string, string> = { pending: '#FEF9C3', in_review: '#DBEAFE', approved: '#DCFCE7', rejected: '#FEE2E2' };
const KYC_C: Record<string, string> = { pending: '#854D0E', in_review: '#1E40AF', approved: '#166534', rejected: '#991B1B' };
const KYC_L: Record<string, { fr: string; en: string }> = {
  pending: { fr: 'En attente', en: 'Pending' },
  in_review: { fr: 'En cours', en: 'In review' },
  approved: { fr: 'Approuvé', en: 'Approved' },
  rejected: { fr: 'Rejeté', en: 'Rejected' },
};

export default function PICPage() {
  const [lang, setL] = useState<Lang>('fr');
  const [members, setMembers] = useState<any[]>([]);
  const [stats, setStats] = useState({ total_members: 0, fees_paid_count: 0, fees_pending_count: 0, total_fees_xaf: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterFee, setFilterFee] = useState<'all' | 'paid' | 'pending'>('all');
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    setL(getLang());
    const h = () => setL(getLang());
    window.addEventListener('lang-change', h);
    return () => window.removeEventListener('lang-change', h);
  }, []);

  const load = () => {
    setLoading(true);
    fetch('/api/admin/pic', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setMembers(d.members ?? []);
        if (d.stats) setStats(d.stats);
      })
      .catch(() => toast.error(lang === 'fr' ? 'Erreur de chargement' : 'Load error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const t = T[lang].pic;

  const doAction = async (investor_id: string, action: 'validate_pic' | 'record_fee' | 'revoke_pic') => {
    const confirmMsg = action === 'validate_pic' ? t.confirm_validate
      : action === 'record_fee' ? t.confirm_fee
      : t.confirm_revoke;

    if (!window.confirm(confirmMsg)) return;

    setProcessing(investor_id + action);
    try {
      const r = await fetch('/api/admin/pic', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ investor_id, action }),
      });
      const d = await r.json();
      if (!r.ok) {
        toast.error(d.error ?? (lang === 'fr' ? 'Erreur' : 'Error'));
      } else {
        const msg = {
          validate_pic: lang === 'fr' ? '✅ Adhésion PIC validée' : '✅ PIC membership validated',
          record_fee: lang === 'fr' ? '✅ Paiement frais enregistré (50 000 XAF)' : '✅ Fee payment recorded (50,000 XAF)',
          revoke_pic: lang === 'fr' ? '⚠️ Adhésion révoquée' : '⚠️ Membership revoked',
        }[action];
        toast.success(msg ?? '✅');
        load();
      }
    } catch {
      toast.error(lang === 'fr' ? 'Erreur réseau' : 'Network error');
    }
    setProcessing(null);
  };

  const filtered = members.filter(m => {
    const matchSearch = !search ||
      m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.email?.toLowerCase().includes(search.toLowerCase());
    const matchFee = filterFee === 'all' ||
      (filterFee === 'paid' && m.pic_fee_paid) ||
      (filterFee === 'pending' && !m.pic_fee_paid);
    return matchSearch && matchFee;
  });

  const fmtXAF = (n: number) => n >= 1e6 ? `${(n/1e6).toFixed(1)}M XAF` : n >= 1e3 ? `${(n/1e3).toFixed(0)}K XAF` : `${n} XAF`;

  const kpis = [
    { label: t.total_members,  value: String(stats.total_members),            icon: '🏛️', color: '#1B3A6B' },
    { label: t.fees_paid,      value: fmtXAF(stats.total_fees_xaf),           icon: '💰', color: '#16a34a' },
    { label: lang === 'fr' ? 'Frais payés' : 'Fees Paid', value: String(stats.fees_paid_count),    icon: '✅', color: '#C9963A' },
    { label: t.fees_pending,   value: String(stats.fees_pending_count),        icon: '⏳', color: stats.fees_pending_count > 0 ? '#E63946' : '#94A3B8' },
  ];

  return (
    <div style={{ fontFamily: 'Outfit,sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: 'Syne,sans-serif', fontSize: 24, fontWeight: 800, color: '#0F1E35', margin: 0 }}>{t.title}</h2>
          <p style={{ color: '#5A6E8A', fontSize: 14, marginTop: 4 }}>{t.subtitle}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12, background: 'linear-gradient(135deg,#1B3A6B,#0D2347)', color: '#fff' }}>
          <span style={{ fontSize: 18 }}>🏛️</span>
          <div>
            <div style={{ fontSize: 11, opacity: 0.7, textTransform: 'uppercase', fontWeight: 700 }}>{t.fee_amount}</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Private Investment Circle</div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(27,58,107,0.06)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: k.color }} />
            <div style={{ fontSize: 22, marginBottom: 8 }}>{k.icon}</div>
            <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: k.color, fontFamily: 'Syne,sans-serif' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={lang === 'fr' ? '🔍 Rechercher un membre…' : '🔍 Search member…'}
          style={{ flex: 1, padding: '8px 12px', borderRadius: 9, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none', fontFamily: 'Outfit,sans-serif' }}
        />
        {(['all', 'paid', 'pending'] as const).map(f => (
          <button key={f} onClick={() => setFilterFee(f)}
            style={{ padding: '8px 16px', borderRadius: 999, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: filterFee === f ? '#1B3A6B' : '#fff',
              color: filterFee === f ? '#fff' : '#5A6E8A',
              borderColor: filterFee === f ? '#1B3A6B' : '#E2E8F0' }}>
            {f === 'all' ? (lang === 'fr' ? 'Tous' : 'All')
              : f === 'paid' ? (lang === 'fr' ? 'Frais payés' : 'Fees paid')
              : (lang === 'fr' ? 'En attente' : 'Pending')}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              {[t.member_name, t.country, t.kyc, t.status, t.joined, t.actions].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700, borderBottom: '1px solid #E2E8F0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 48, color: '#94A3B8' }}>{t.loading}</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 48 }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🏛️</div>
                  <div style={{ color: '#94A3B8', fontSize: 14 }}>{t.no_members}</div>
                </td>
              </tr>
            ) : filtered.map((m, i) => {
              const kycStyle = { bg: KYC_B[m.kyc_status] ?? '#F1F5F9', text: KYC_C[m.kyc_status] ?? '#374151' };
              const kycLabel = KYC_L[m.kyc_status]?.[lang] ?? m.kyc_status;
              const initials = m.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() ?? '??';

              return (
                <tr key={m.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#1B3A6B,#2E5BA8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                        {initials}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1E35' }}>{m.full_name}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: '#374151' }}>
                    🌍 {m.country ?? '—'}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, fontWeight: 700, background: kycStyle.bg, color: kycStyle.text }}>
                      {kycLabel}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {m.pic_fee_paid ? (
                      <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, fontWeight: 700, background: '#DCFCE7', color: '#166534' }}>
                        ✅ {t.fee_paid}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, fontWeight: 700, background: '#FEE2E2', color: '#991B1B' }}>
                        ⏳ {t.fee_pending}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 12, color: '#5A6E8A' }}>
                    {m.pic_joined_at
                      ? new Date(m.pic_joined_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB')
                      : new Date(m.created_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB')}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {!m.pic_fee_paid && (
                        <button
                          onClick={() => doAction(m.id, 'record_fee')}
                          disabled={processing === m.id + 'record_fee'}
                          style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          💰 {lang === 'fr' ? 'Enreg. frais' : 'Record Fee'}
                        </button>
                      )}
                      <button
                        onClick={() => doAction(m.id, 'revoke_pic')}
                        disabled={processing === m.id + 'revoke_pic'}
                        style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E63946', background: '#fff', color: '#E63946', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                        {t.revoke}
                      </button>
                      <a href={`/admin/investors/${m.id}`}
                        style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #1B3A6B', background: '#fff', color: '#1B3A6B', fontSize: 11, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                        👤 {lang === 'fr' ? 'Profil' : 'Profile'}
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Info footer */}
      <div style={{ marginTop: 20, padding: '14px 18px', background: 'linear-gradient(135deg,rgba(27,58,107,0.04),rgba(201,150,58,0.04))', borderRadius: 12, border: '1px solid #E2E8F0', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1B3A6B', marginBottom: 4 }}>
            🏛️ {lang === 'fr' ? 'Règles du PIC' : 'PIC Rules'}
          </div>
          <div style={{ fontSize: 12, color: '#5A6E8A', lineHeight: 1.6 }}>
            {lang === 'fr'
              ? 'Cotisation annuelle : 50 000 XAF · KYC approuvé obligatoire · Accès aux projets exclusifs B-Invest · Documents constitutifs disponibles dans la section Documents'
              : 'Annual fee: 50,000 XAF · Approved KYC required · Access to exclusive B-Invest projects · Founding documents available in the Documents section'}
          </div>
        </div>
      </div>
    </div>
  );
}
