'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

function InvestorsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  // ── Bulk KYC sélection ───────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | null>(null);
  const [bulkReason, setBulkReason] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = (visible: any[]) => {
    setSelectedIds(prev => {
      const allSelected = visible.every(inv => prev.has(inv.id));
      return allSelected ? new Set() : new Set(visible.map(inv => inv.id));
    });
  };

  const runBulkKyc = async () => {
    if (!bulkAction || selectedIds.size === 0) return;
    if (bulkAction === 'reject' && !bulkReason.trim()) {
      toast.error(lang === 'fr' ? 'Raison du refus requise' : 'Rejection reason required');
      return;
    }
    setBulkProcessing(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let success = 0, fail = 0;
    for (const id of ids) {
      try {
        const r = await fetch('/api/admin/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            investor_id: id,
            action: bulkAction,
            rejection_reason: bulkAction === 'reject' ? bulkReason.trim() : undefined,
            send_email: true,
          }),
        });
        r.ok ? success++ : fail++;
      } catch { fail++; }
      setBulkProgress(p => ({ ...p, done: p.done + 1 }));
    }
    setBulkProcessing(false);
    setBulkAction(null);
    setBulkReason('');
    setSelectedIds(new Set());
    setBulkProgress({ done: 0, total: 0 });
    if (fail === 0) {
      toast.success(lang === 'fr' ? `✅ ${success} dossier(s) traité(s)` : `✅ ${success} processed`);
    } else {
      toast.error(lang === 'fr' ? `${success} OK · ${fail} échec(s)` : `${success} OK · ${fail} failed`);
    }
    load();
  };

  // Filtre KYC piloté par l'URL (?kyc_status=in_review|pending|approved|rejected)
  // Multi-valeurs séparées par virgule (ex: pending,in_review)
  const kycFilterParam = searchParams.get('kyc_status') ?? '';
  const kycFilters = kycFilterParam ? kycFilterParam.split(',').map(s => s.trim()).filter(Boolean) : [];

  const clearKycFilter = () => {
    const sp = new URLSearchParams(window.location.search);
    sp.delete('kyc_status');
    const qs = sp.toString();
    router.replace(`/admin/investors${qs ? '?' + qs : ''}`);
  };

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
    if (kycFilters.length > 0 && !kycFilters.includes(inv.kyc_status ?? 'pending')) return false;
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

      {/* Bandeau filtre KYC actif */}
      {kycFilters.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 18 }}>🔍</span>
          <div style={{ flex: 1, fontSize: 13, color: '#991B1B', fontWeight: 600 }}>
            {lang === 'fr' ? 'Filtre actif :' : 'Active filter:'}{' '}
            <strong>KYC = {kycFilters.join(', ')}</strong>{' '}
            <span style={{ color: '#7F1D1D', fontWeight: 400 }}>
              ({filtered.length} {lang === 'fr' ? 'résultat(s)' : 'result(s)'})
            </span>
          </div>
          <button onClick={clearKycFilter}
            style={{ padding: '5px 12px', borderRadius: 8, background: '#fff', border: '1px solid #FECACA', color: '#991B1B', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            ✕ {lang === 'fr' ? 'Effacer le filtre' : 'Clear filter'}
          </button>
        </div>
      )}

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
              <th style={{ width: 36, padding: '11px 0 11px 16px', borderBottom: '1px solid #E2E8F0' }}>
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && filtered.every(inv => selectedIds.has(inv.id))}
                  onChange={() => toggleSelectAllVisible(filtered)}
                  style={{ cursor: 'pointer', width: 16, height: 16 }}
                  title={lang === 'fr' ? 'Tout sélectionner' : 'Select all'}
                />
              </th>
              {[ti.name, ti.country, ti.capital, ti.projects, ti.pic, ti.kyc, ti.actions].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '11px 16px', fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700, borderBottom: '1px solid #E2E8F0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48, color: '#94A3B8' }}>{t.common.loading}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: '#94A3B8' }}>{ti.no_investors}</td></tr>
            ) : filtered.map((inv, i) => {
              const totalInvested = (inv.subscriptions ?? []).reduce((s: number, sub: any) => s + (sub.amount_ngn ?? 0), 0);
              const projectCount = (inv.subscriptions ?? []).length;
              const initials = inv.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() ?? '??';
              return (
                <tr key={inv.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none', background: selectedIds.has(inv.id) ? '#FFFBEC' : undefined }}
                  onMouseEnter={e => { if (!selectedIds.has(inv.id)) e.currentTarget.style.background = '#F8FAFC'; }}
                  onMouseLeave={e => { if (!selectedIds.has(inv.id)) e.currentTarget.style.background = ''; }}>
                  <td style={{ padding: '13px 0 13px 16px' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(inv.id)}
                      onChange={() => toggleSelected(inv.id)}
                      style={{ cursor: 'pointer', width: 16, height: 16 }}
                      onClick={e => e.stopPropagation()}
                    />
                  </td>
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

      {/* ── Barre flottante actions bulk ── */}
      {selectedIds.size > 0 && !bulkAction && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#0F1E35', color: '#fff', borderRadius: 14, padding: '12px 20px',
          display: 'flex', alignItems: 'center', gap: 16, zIndex: 1000,
          boxShadow: '0 12px 40px rgba(15,30,53,0.35)',
          fontFamily: 'Outfit,sans-serif',
        }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>
            {selectedIds.size} {lang === 'fr' ? 'sélectionné(s)' : 'selected'}
          </span>
          <button
            onClick={() => setBulkAction('approve')}
            style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            ✅ {lang === 'fr' ? 'Approuver' : 'Approve'}
          </button>
          <button
            onClick={() => setBulkAction('reject')}
            style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: '#E63946', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            ❌ {lang === 'fr' ? 'Refuser' : 'Reject'}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 13 }}>
            ✕
          </button>
        </div>
      )}

      {/* ── Modal de confirmation bulk ── */}
      {bulkAction && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20, fontFamily: 'Outfit,sans-serif' }}
          onClick={e => { if (e.target === e.currentTarget && !bulkProcessing) setBulkAction(null); }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: 28, width: 480, maxWidth: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}>
            <h3 style={{ fontFamily: 'Syne,sans-serif', fontSize: 20, fontWeight: 800, color: '#0F1E35', margin: '0 0 8px' }}>
              {bulkAction === 'approve' ? '✅' : '❌'} {lang === 'fr' ? 'Action en lot' : 'Bulk action'}
            </h3>
            <p style={{ color: '#5A6E8A', fontSize: 14, margin: '0 0 20px' }}>
              {bulkAction === 'approve'
                ? (lang === 'fr' ? `Approuver le KYC de ${selectedIds.size} investisseur(s) ?` : `Approve KYC for ${selectedIds.size} investor(s)?`)
                : (lang === 'fr' ? `Refuser le KYC de ${selectedIds.size} investisseur(s) ?` : `Reject KYC for ${selectedIds.size} investor(s)?`)}
            </p>
            {bulkAction === 'reject' && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                  {lang === 'fr' ? 'Raison du refus (commune à tous)' : 'Rejection reason (applies to all)'} *
                </label>
                <textarea
                  value={bulkReason}
                  onChange={e => setBulkReason(e.target.value)}
                  placeholder={lang === 'fr' ? 'Ex: Documents illisibles, à resoumettre.' : 'Ex: Documents unreadable, please resubmit.'}
                  disabled={bulkProcessing}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 14, fontFamily: 'Outfit,sans-serif', minHeight: 80, resize: 'vertical', outline: 'none' }}
                />
              </div>
            )}
            {bulkProcessing && (
              <div style={{ background: '#F1F5F9', borderRadius: 10, padding: 12, marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: '#5A6E8A', marginBottom: 6, fontWeight: 600 }}>
                  {lang === 'fr' ? 'Traitement en cours...' : 'Processing...'} ({bulkProgress.done}/{bulkProgress.total})
                </div>
                <div style={{ height: 6, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${bulkProgress.total ? (bulkProgress.done / bulkProgress.total) * 100 : 0}%`,
                    background: bulkAction === 'approve' ? '#16a34a' : '#E63946',
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { if (!bulkProcessing) { setBulkAction(null); setBulkReason(''); } }}
                disabled={bulkProcessing}
                style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', color: '#5A6E8A', cursor: bulkProcessing ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14 }}>
                {t.common.cancel}
              </button>
              <button onClick={runBulkKyc}
                disabled={bulkProcessing || (bulkAction === 'reject' && !bulkReason.trim())}
                style={{
                  padding: '10px 24px', borderRadius: 10, border: 'none',
                  background: bulkProcessing ? '#94A3B8' : (bulkAction === 'approve' ? '#16a34a' : '#E63946'),
                  color: '#fff', cursor: bulkProcessing ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14,
                }}>
                {bulkProcessing
                  ? (lang === 'fr' ? 'En cours...' : 'Processing...')
                  : (bulkAction === 'approve'
                      ? `✅ ${lang === 'fr' ? 'Confirmer l\'approbation' : 'Confirm approval'}`
                      : `❌ ${lang === 'fr' ? 'Confirmer le refus' : 'Confirm rejection'}`)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InvestorsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 20, textAlign: 'center', color: '#64748B' }}>Chargement...</div>}>
      <InvestorsPageContent />
    </Suspense>
  );
}
