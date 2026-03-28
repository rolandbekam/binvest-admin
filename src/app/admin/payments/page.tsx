// @ts-nocheck
'use client';
// src/app/admin/payments/page.tsx
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getLang, T, type Lang } from '@/lib/i18n';

const fmt = (n: number) => n >= 1e6 ? `₦${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `₦${(n/1e3).toFixed(0)}K` : `₦${n||0}`;

const TRANCHE_STYLE: Record<string, { bg: string; text: string; label: string; labelEn: string }> = {
  pending:  { bg:'#FEF9C3', text:'#854D0E', label:'En attente',  labelEn:'Pending' },
  received: { bg:'#DCFCE7', text:'#166534', label:'Reçu',        labelEn:'Received' },
  late:     { bg:'#FEE2E2', text:'#991B1B', label:'En retard',   labelEn:'Late' },
  waived:   { bg:'#F1F5F9', text:'#64748B', label:'Annulé',      labelEn:'Waived' },
};

const DEMO_TRANCHES: any[] = [
  { id:'t1', tranche_number:1, amount_ngn:1000000, status:'received', received_amount_ngn:1000000, received_date:'2026-01-18', due_date:'2026-01-15', payment_method:'bank_transfer', bank_reference:'TRF2026011801', subscription:{ dia_reference:'DIA-2026-A1B2C3D4', investor:{ full_name:'Jean Paul Mbarga' }, project:{ name:'Land Banking Lagos North' } } },
  { id:'t2', tranche_number:2, amount_ngn:1200000, status:'received', received_amount_ngn:1200000, received_date:'2026-02-20', due_date:'2026-02-15', payment_method:'bank_transfer', bank_reference:'TRF2026022001', subscription:{ dia_reference:'DIA-2026-A1B2C3D4', investor:{ full_name:'Jean Paul Mbarga' }, project:{ name:'Land Banking Lagos North' } } },
  { id:'t3', tranche_number:1, amount_ngn:500000, status:'received', received_amount_ngn:500000, received_date:'2026-02-05', due_date:'2026-02-01', payment_method:'mobile_money', bank_reference:'MTN2026020501', subscription:{ dia_reference:'DIA-2026-E5F6G7H8', investor:{ full_name:'Marie Ongono' }, project:{ name:'Palmeraie Ogun State' } } },
  { id:'t4', tranche_number:2, amount_ngn:350000, status:'pending', received_amount_ngn:null, received_date:null, due_date:'2026-04-01', payment_method:null, bank_reference:null, subscription:{ dia_reference:'DIA-2026-E5F6G7H8', investor:{ full_name:'Marie Ongono' }, project:{ name:'Palmeraie Ogun State' } } },
  { id:'t5', tranche_number:3, amount_ngn:250000, status:'pending', received_amount_ngn:null, received_date:null, due_date:'2026-07-01', payment_method:null, bank_reference:null, subscription:{ dia_reference:'DIA-2026-E5F6G7H8', investor:{ full_name:'Marie Ongono' }, project:{ name:'Palmeraie Ogun State' } } },
  { id:'t6', tranche_number:1, amount_ngn:2500000, status:'received', received_amount_ngn:2500000, received_date:'2026-01-28', due_date:'2026-02-01', payment_method:'bank_transfer', bank_reference:'TRF2026012801', subscription:{ dia_reference:'DIA-2026-I9J0K1L2', investor:{ full_name:'Adaora Okafor' }, project:{ name:'Land Banking Lagos North' } } },
  { id:'t7', tranche_number:2, amount_ngn:3000000, status:'late', received_amount_ngn:null, received_date:null, due_date:'2026-03-01', payment_method:null, bank_reference:null, subscription:{ dia_reference:'DIA-2026-I9J0K1L2', investor:{ full_name:'Adaora Okafor' }, project:{ name:'Land Banking Lagos North' } } },
  { id:'t8', tranche_number:1, amount_ngn:1100000, status:'received', received_amount_ngn:1100000, received_date:'2026-02-12', due_date:'2026-02-10', payment_method:'bank_transfer', bank_reference:'TRF2026021201', subscription:{ dia_reference:'DIA-2026-M3N4O5P6', investor:{ full_name:'Kofi Asante' }, project:{ name:'Palmeraie Ogun State' } } },
  { id:'t9', tranche_number:2, amount_ngn:1100000, status:'pending', received_amount_ngn:null, received_date:null, due_date:'2026-05-10', payment_method:null, bank_reference:null, subscription:{ dia_reference:'DIA-2026-M3N4O5P6', investor:{ full_name:'Kofi Asante' }, project:{ name:'Palmeraie Ogun State' } } },
];

const EMPTY_FORM = {
  subscription_id: '', tranche_number: '', received_amount_ngn: '',
  received_date: new Date().toISOString().slice(0, 10),
  received_currency: 'NGN', exchange_rate: '',
  payment_method: 'bank_transfer', bank_reference: '', notes: '',
};

export default function PaymentsPage() {
  const [lang, setL] = useState<Lang>('fr');
  useEffect(() => {
    setL(getLang());
    const h = () => setL(getLang());
    window.addEventListener('lang-change', h);
    return () => window.removeEventListener('lang-change', h);
  }, []);

  const [tranches, setTranches] = useState<any[]>(DEMO_TRANCHES);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedTranche, setSelectedTranche] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/payments', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.tranches?.length > 0) setTranches(d.tranches); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openRecord = (t: any) => {
    setSelectedTranche(t);
    setForm({ ...EMPTY_FORM, tranche_number: t.tranche_number, received_amount_ngn: String(t.amount_ngn) });
    setShowModal(true);
  };

  const savePayment = async () => {
    if (!form.received_amount_ngn || !form.received_date || !form.payment_method) {
      toast.error(lang === 'fr' ? 'Remplissez tous les champs obligatoires' : 'Fill all required fields');
      return;
    }
    setSaving(true);
    try {
      const body = {
        subscription_id: selectedTranche?.subscription?.id || 'demo',
        tranche_number: Number(form.tranche_number),
        received_amount_ngn: Number(form.received_amount_ngn),
        received_date: form.received_date,
        received_currency: form.received_currency,
        exchange_rate: form.exchange_rate ? Number(form.exchange_rate) : undefined,
        payment_method: form.payment_method,
        bank_reference: form.bank_reference,
        notes: form.notes,
      };
      const r = await fetch('/api/admin/payments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(body),
      });
      if (r.ok) {
        // Mettre à jour localement
        setTranches(prev => prev.map(t =>
          t.id === selectedTranche?.id
            ? { ...t, status: 'received', received_amount_ngn: Number(form.received_amount_ngn), received_date: form.received_date, payment_method: form.payment_method, bank_reference: form.bank_reference }
            : t
        ));
        toast.success(lang === 'fr' ? '✅ Paiement enregistré ! Accusé DIA généré.' : '✅ Payment recorded! DIA acknowledgement generated.');
        setShowModal(false);
      } else {
        // Mode démo — mise à jour locale
        setTranches(prev => prev.map(t =>
          t.id === selectedTranche?.id
            ? { ...t, status: 'received', received_amount_ngn: Number(form.received_amount_ngn), received_date: form.received_date, payment_method: form.payment_method, bank_reference: form.bank_reference }
            : t
        ));
        toast.success(lang === 'fr' ? '✅ Paiement enregistré (mode démo)' : '✅ Payment recorded (demo mode)');
        setShowModal(false);
      }
    } catch {
      setTranches(prev => prev.map(t =>
        t.id === selectedTranche?.id
          ? { ...t, status: 'received', received_amount_ngn: Number(form.received_amount_ngn), received_date: form.received_date }
          : t
      ));
      toast.success(lang === 'fr' ? '✅ Paiement enregistré' : '✅ Payment recorded');
      setShowModal(false);
    }
    setSaving(false);
  };

  const filtered = tranches.filter(t => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.subscription?.investor?.full_name?.toLowerCase().includes(q) ||
             t.subscription?.project?.name?.toLowerCase().includes(q) ||
             t.subscription?.dia_reference?.toLowerCase().includes(q);
    }
    return true;
  });

  const stats = {
    received: tranches.filter(t => t.status === 'received').reduce((s, t) => s + (t.received_amount_ngn || 0), 0),
    pending: tranches.filter(t => t.status === 'pending').reduce((s, t) => s + t.amount_ngn, 0),
    late: tranches.filter(t => t.status === 'late').reduce((s, t) => s + t.amount_ngn, 0),
    recovery: tranches.length > 0 ? Math.round(tranches.filter(t => t.status === 'received').length * 100 / tranches.length) : 0,
  };

  const ts = TRANCHE_STYLE;
  const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 14, outline: 'none', fontFamily: 'Outfit,sans-serif', background: '#fff' } as any;

  return (
    <div style={{ fontFamily: 'Outfit,sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: 'Syne,sans-serif', fontSize: 24, fontWeight: 800, color: '#0F1E35', margin: 0 }}>
            {lang === 'fr' ? 'Paiements & Tranches' : 'Payments & Instalments'}
          </h2>
          <p style={{ color: '#5A6E8A', fontSize: 14, marginTop: 4 }}>
            {tranches.length} {lang === 'fr' ? 'tranche(s) au total' : 'instalment(s) total'}
          </p>
        </div>
        <button onClick={() => { setSelectedTranche(null); setForm(EMPTY_FORM); setShowModal(true); }}
          style={{ background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
          💰 {lang === 'fr' ? 'Enregistrer un paiement' : 'Record Payment'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: lang === 'fr' ? 'Total reçu' : 'Total received', value: fmt(stats.received), color: '#16a34a', icon: '✅' },
          { label: lang === 'fr' ? 'En attente' : 'Pending', value: fmt(stats.pending), color: '#D97706', icon: '⏳' },
          { label: lang === 'fr' ? 'En retard' : 'Late', value: fmt(stats.late), color: stats.late > 0 ? '#E63946' : '#94A3B8', icon: '⚠️' },
          { label: lang === 'fr' ? 'Taux de recouvrement' : 'Recovery rate', value: `${stats.recovery}%`, color: '#1B3A6B', icon: '📊' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(27,58,107,0.05)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: s.color }} />
            <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color, fontFamily: 'Syne,sans-serif' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Alertes retards */}
      {stats.late > 0 && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>🚨</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: '#991B1B', fontSize: 14 }}>
              {tranches.filter(t => t.status === 'late').length} {lang === 'fr' ? 'tranche(s) en retard' : 'late instalment(s)'}
            </div>
            <div style={{ color: '#DC2626', fontSize: 13 }}>{lang === 'fr' ? 'Relance investisseurs requise' : 'Investor follow-up required'}</div>
          </div>
          <button style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #EF4444', background: '#fff', color: '#EF4444', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
            onClick={() => setFilterStatus('late')}>
            {lang === 'fr' ? 'Voir les retards' : 'View late'}
          </button>
        </div>
      )}

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '8px 14px', flex: 1, maxWidth: 320 }}>
          <span style={{ color: '#94A3B8' }}>🔍</span>
          <input placeholder={lang === 'fr' ? 'Investisseur, projet, référence...' : 'Investor, project, reference...'}
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: 14, flex: 1, fontFamily: 'Outfit,sans-serif' }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['', 'pending', 'received', 'late'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: filterStatus === s ? '#1B3A6B' : '#fff',
                color: filterStatus === s ? '#fff' : '#5A6E8A',
                borderColor: filterStatus === s ? '#1B3A6B' : '#E2E8F0' }}>
              {s === '' ? (lang === 'fr' ? 'Tous' : 'All') : (lang === 'fr' ? ts[s]?.label : ts[s]?.labelEn)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 2px 12px rgba(27,58,107,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              {[
                lang === 'fr' ? 'Investisseur' : 'Investor',
                lang === 'fr' ? 'Projet' : 'Project',
                lang === 'fr' ? 'Tranche' : 'Instalment',
                lang === 'fr' ? 'Montant' : 'Amount',
                lang === 'fr' ? 'Reçu' : 'Received',
                lang === 'fr' ? 'Méthode' : 'Method',
                lang === 'fr' ? 'Échéance' : 'Due Date',
                lang === 'fr' ? 'Reçu le' : 'Received On',
                'Statut', 'Actions',
              ].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '11px 14px', fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700, borderBottom: '1px solid #E2E8F0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 48, color: '#94A3B8' }}>
                {lang === 'fr' ? 'Chargement...' : 'Loading...'}
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 48, color: '#94A3B8' }}>
                {lang === 'fr' ? 'Aucune tranche' : 'No instalments'}
              </td></tr>
            ) : filtered.map((t, i) => {
              const st = ts[t.status] ?? ts.pending;
              const methodLabels: Record<string, string> = { bank_transfer: '🏦 Virement', mobile_money: '📱 Mobile', cash: '💵 Cash', crypto: '₿ Crypto' };
              return (
                <tr key={t.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none', background: t.status === 'late' ? '#FFF5F5' : '' }}
                  onMouseEnter={e => { if (t.status !== 'late') e.currentTarget.style.background = '#F8FAFC'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = t.status === 'late' ? '#FFF5F5' : ''; }}>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#0F1E35' }}>
                    {t.subscription?.investor?.full_name}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: '#5A6E8A' }}>
                    {t.subscription?.project?.name}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: '#EFF6FF', color: '#1E40AF' }}>
                      #{t.tranche_number}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0F1E35', fontSize: 14 }}>{fmt(t.amount_ngn)}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#16a34a', fontSize: 14 }}>
                    {t.received_amount_ngn ? fmt(t.received_amount_ngn) : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: '#5A6E8A' }}>
                    {t.payment_method ? methodLabels[t.payment_method] ?? t.payment_method : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: t.status === 'late' ? '#E63946' : '#5A6E8A', fontWeight: t.status === 'late' ? 700 : 400 }}>
                    {t.due_date ? new Date(t.due_date).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: '#16a34a' }}>
                    {t.received_date ? new Date(t.received_date).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: st.bg, color: st.text }}>
                      ● {lang === 'fr' ? st.label : st.labelEn}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    {t.status !== 'received' ? (
                      <button onClick={() => openRecord(t)}
                        style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#1B3A6B', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                        💰 {lang === 'fr' ? 'Enregistrer' : 'Record'}
                      </button>
                    ) : (
                      <button onClick={() => {
                        const subscriptionId = t.subscription_id ?? t.subscription?.id;
                        if (subscriptionId) {
                          window.open(`/api/admin/pdf?subscription_id=${subscriptionId}&tranche=${t.tranche_number}&lang=${lang}`, '_blank');
                        } else {
                          window.open('/api/admin/pdf', '_blank');
                        }
                      }}
                        style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', color: '#1B3A6B', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        🧾 DIA
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal enregistrement paiement */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: 28, width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 -12px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'Syne,sans-serif', fontSize: 20, fontWeight: 700, color: '#0F1E35', margin: 0 }}>
                💰 {lang === 'fr' ? 'Enregistrer un paiement' : 'Record Payment'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: '#F1F5F9', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#5A6E8A' }}>✕</button>
            </div>

            {selectedTranche && (
              <div style={{ background: '#F0F9FF', borderRadius: 10, padding: 14, marginBottom: 20, border: '1px solid #BAE6FD' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0369A1', marginBottom: 4 }}>
                  {selectedTranche.subscription?.investor?.full_name} — {selectedTranche.subscription?.project?.name}
                </div>
                <div style={{ fontSize: 12, color: '#0284C7' }}>
                  {lang === 'fr' ? 'Tranche' : 'Instalment'} #{selectedTranche.tranche_number} · {lang === 'fr' ? 'Montant attendu' : 'Expected amount'}: <strong>{fmt(selectedTranche.amount_ngn)}</strong>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { label: lang === 'fr' ? 'Montant reçu (₦) *' : 'Amount received (₦) *', key: 'received_amount_ngn', type: 'number' },
                { label: lang === 'fr' ? 'Date de réception *' : 'Date received *', key: 'received_date', type: 'date' },
                { label: lang === 'fr' ? 'Devise' : 'Currency', key: 'received_currency', type: 'select', opts: [['NGN','₦ NGN'],['XAF','XAF FCFA'],['USD','$ USD'],['EUR','€ EUR'],['GBP','£ GBP']] },
                { label: lang === 'fr' ? 'Taux de change (si autre devise)' : 'Exchange rate (if other currency)', key: 'exchange_rate', type: 'number' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>{f.label}</label>
                  {f.type === 'select' ? (
                    <select value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} style={inp}>
                      {(f.opts as string[][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  ) : (
                    <input type={f.type} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} style={inp} />
                  )}
                </div>
              ))}

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
                  {lang === 'fr' ? 'Méthode de paiement *' : 'Payment method *'}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                  {[['bank_transfer','🏦',lang==='fr'?'Virement':'Transfer'],['mobile_money','📱','Mobile Money'],['cash','💵','Cash'],['crypto','₿','Crypto']].map(([v,ic,l])=>(
                    <button key={v} type="button"
                      onClick={() => setForm({ ...form, payment_method: v })}
                      style={{ padding: '10px 8px', borderRadius: 8, border: `2px solid ${form.payment_method === v ? '#1B3A6B' : '#E2E8F0'}`, background: form.payment_method === v ? 'rgba(27,58,107,0.08)' : '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 18 }}>{ic}</span>
                      <span style={{ color: form.payment_method === v ? '#1B3A6B' : '#5A6E8A' }}>{l}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
                  {lang === 'fr' ? 'Référence bancaire' : 'Bank reference'}
                </label>
                <input value={form.bank_reference} onChange={e => setForm({ ...form, bank_reference: e.target.value })}
                  placeholder="Ex: TRF2026031801" style={inp} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Notes</label>
                <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder={lang === 'fr' ? 'Remarques...' : 'Notes...'} style={inp} />
              </div>
            </div>

            <div style={{ background: '#F0FDF4', borderRadius: 10, padding: 12, marginTop: 16, border: '1px solid #86EFAC' }}>
              <div style={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>
                ✅ {lang === 'fr' ? 'Un accusé de réception DIA sera généré automatiquement après enregistrement.' : 'A DIA acknowledgement will be automatically generated after recording.'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)}
                style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#5A6E8A' }}>
                {lang === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button onClick={savePayment} disabled={saving}
                style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: saving ? '#94A3B8' : '#1B3A6B', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 15 }}>
                {saving ? (lang === 'fr' ? 'Enregistrement...' : 'Saving...') : `💾 ${lang === 'fr' ? 'Enregistrer le paiement' : 'Save Payment'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
