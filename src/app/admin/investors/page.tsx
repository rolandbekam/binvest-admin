'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { getLang, T, type Lang } from '@/lib/i18n';

const fmt = (n: number) => !n ? '₦0' : n >= 1e6 ? `₦${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `₦${(n/1e3).toFixed(0)}K` : `₦${n.toLocaleString()}`;

const KYC_C: Record<string,string> = { pending:'#854D0E', in_review:'#1E40AF', approved:'#166534', rejected:'#991B1B' };
const KYC_B: Record<string,string> = { pending:'#FEF9C3', in_review:'#DBEAFE', approved:'#DCFCE7', rejected:'#FEE2E2' };

const EMPTY_FORM = {
  full_name: '', email: '', phone: '', nationality: '', country: '',
  id_type: 'passport', id_number: '', address: '',
  kyc_status: 'pending', pic_member: false, dia_signed: false,
};

export default function InvestorsPage() {
  const router = useRouter();
  const [lang, setL] = useState<Lang>('fr');
  useEffect(() => {
    setL(getLang());
    const h = () => setL(getLang());
    window.addEventListener('lang-change', h);
    return () => window.removeEventListener('lang-change', h);
  }, []);

  const [investors, setInvestors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/investors', { credentials: 'include' });
      const d = await r.json();
      setInvestors(d.investors ?? []);
    } catch { setInvestors([]); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const t = T[lang];
  const ti = t.investors;

  const save = async () => {
    if (!form.full_name || !form.email) {
      toast.error(lang === 'fr' ? 'Nom et email obligatoires' : 'Name and email required');
      return;
    }
    setSaving(true);
    try {
      const r = await fetch('/api/admin/investors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error ?? 'Erreur'); setSaving(false); return; }
      toast.success(lang === 'fr' ? '✅ Investisseur ajouté !' : '✅ Investor added!');
      setShowModal(false);
      setForm(EMPTY_FORM);
      load();
    } catch { toast.error('Erreur réseau'); }
    setSaving(false);
  };

  const filtered = investors.filter(inv => {
    if (!search) return true;
    const q = search.toLowerCase();
    return inv.full_name?.toLowerCase().includes(q) || inv.email?.toLowerCase().includes(q) || inv.country?.toLowerCase().includes(q);
  });

  const stats = {
    total: investors.length,
    kyc_approved: investors.filter(i => i.kyc_status === 'approved').length,
    pic_members: investors.filter(i => i.pic_member).length,
    dia_signed: investors.filter(i => i.dia_signed).length,
  };

  const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 14, outline: 'none', fontFamily: 'Outfit,sans-serif' } as any;

  return (
    <div style={{ fontFamily: 'Outfit,sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: 'Syne,sans-serif', fontSize: 24, fontWeight: 800, color: '#0F1E35', margin: 0 }}>{ti.title}</h2>
          <p style={{ color: '#5A6E8A', fontSize: 14, marginTop: 4 }}>{investors.length} {ti.subtitle}</p>
        </div>
        <button onClick={() => { setForm(EMPTY_FORM); setShowModal(true); }}
          style={{ background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
          {ti.add}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: ti.total, value: stats.total, color: '#1B3A6B', icon: '👥' },
          { label: ti.kyc_approved, value: stats.kyc_approved, color: '#16a34a', icon: '✅' },
          { label: ti.pic_members, value: stats.pic_members, color: '#C9963A', icon: '🏆' },
          { label: ti.dia_signed, value: stats.dia_signed, color: '#E63946', icon: '📄' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(27,58,107,0.05)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: s.color }} />
            <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color, fontFamily: 'Syne,sans-serif' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '9px 14px', marginBottom: 20, maxWidth: 400 }}>
        <span style={{ color: '#94A3B8' }}>🔍</span>
        <input
          placeholder={ti.search}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ border: 'none', outline: 'none', fontSize: 14, flex: 1, fontFamily: 'Outfit,sans-serif' }}
        />
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 2px 12px rgba(27,58,107,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              {[ti.name, ti.country, ti.capital, ti.projects, ti.pic, ti.kyc, ti.actions].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '11px 16px', fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700, borderBottom: '1px solid #E2E8F0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48, color: '#94A3B8' }}>{t.common.loading}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48, color: '#94A3B8' }}>{ti.no_investors}</td></tr>
            ) : filtered.map((inv, i) => {
              const totalInvested = (inv.subscriptions ?? []).reduce((s: number, sub: any) => s + (sub.amount_ngn ?? 0), 0);
              const projectCount = (inv.subscriptions ?? []).length;
              const initials = inv.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() ?? '??';
              return (
                <tr key={inv.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = ''; }}>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1B3A6B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{initials}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0F1E35' }}>{inv.full_name}</div>
                        <div style={{ fontSize: 12, color: '#94A3B8' }}>{inv.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: '#5A6E8A' }}>
                    {inv.country ? `🌍 ${inv.country}` : '—'}
                  </td>
                  <td style={{ padding: '13px 16px', fontWeight: 700, color: '#1B3A6B', fontSize: 14 }}>{fmt(totalInvested)}</td>
                  <td style={{ padding: '13px 16px' }}>
                    <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, background: '#EFF6FF', color: '#1E40AF', fontWeight: 700 }}>
                      {projectCount}
                    </span>
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    {inv.pic_member
                      ? <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: '#DCFCE7', color: '#166534', fontWeight: 700 }}>✅ PIC</span>
                      : <span style={{ fontSize: 11, color: '#94A3B8' }}>—</span>
                    }
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: KYC_B[inv.kyc_status] ?? '#F1F5F9', color: KYC_C[inv.kyc_status] ?? '#64748B', fontWeight: 700 }}>
                      {inv.kyc_status ?? 'pending'}
                    </span>
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <button onClick={() => router.push(`/admin/investors/${inv.id}`)}
                      style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#1B3A6B', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                      {ti.view_profile}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal ajout investisseur */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 28, width: 560, boxShadow: '0 24px 80px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontFamily: 'Syne,sans-serif', fontSize: 20, fontWeight: 700, marginBottom: 20, color: '#0F1E35' }}>
              👤 {ti.add}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { label: ti.full_name, key: 'full_name', span: 2 },
                { label: ti.email, key: 'email', type: 'email' },
                { label: ti.phone, key: 'phone' },
                { label: ti.nationality, key: 'nationality' },
                { label: lang === 'fr' ? 'Pays de résidence' : 'Country of residence', key: 'country' },
                { label: ti.address, key: 'address', span: 2 },
                { label: ti.id_number, key: 'id_number' },
              ].map((f: any) => (
                <div key={f.key} style={{ gridColumn: f.span === 2 ? 'span 2' : 'span 1' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input type={f.type ?? 'text'} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} style={inp} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{ti.kyc_status}</label>
                <select value={form.kyc_status} onChange={e => setForm({ ...form, kyc_status: e.target.value })} style={inp}>
                  {['pending','in_review','approved','rejected'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151' }}>
                  <input type="checkbox" checked={form.pic_member} onChange={e => setForm({ ...form, pic_member: e.target.checked })} style={{ width: 16, height: 16 }} />
                  {ti.pic_member}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151' }}>
                  <input type="checkbox" checked={form.dia_signed} onChange={e => setForm({ ...form, dia_signed: e.target.checked })} style={{ width: 16, height: 16 }} />
                  {ti.dia_signed_label}
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24, paddingTop: 20, borderTop: '1px solid #E2E8F0' }}>
              <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM); }}
                style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#5A6E8A' }}>
                {t.common.cancel}
              </button>
              <button onClick={save} disabled={saving}
                style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: saving ? '#94A3B8' : '#1B3A6B', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700 }}>
                {saving ? t.common.loading : `✅ ${lang === 'fr' ? 'Ajouter l\'investisseur' : 'Add Investor'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
