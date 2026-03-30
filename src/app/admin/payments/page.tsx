// @ts-nocheck
'use client';
import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getLang, type Lang } from '@/lib/i18n';

// ─── formatting helpers ─────────────────────────────────────────
const fmtNGN = (n: number) => !n ? '—' : n >= 1e6 ? `₦${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `₦${(n/1e3).toFixed(0)}K` : `₦${n}`;
const fmtXAF = (n: number) => !n ? '—' : n >= 1e6 ? `${(n/1e6).toFixed(1)}M XAF` : `${(n/1e3).toFixed(0)}K XAF`;
const fmtDate = (d: string, lang: string) => d ? new Date(d).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB') : '—';

// ─── constants ─────────────────────────────────────────────────
const TRANCHE_STYLE: Record<string,{bg:string;text:string;fr:string;en:string}> = {
  pending:  { bg:'#FEF9C3', text:'#854D0E', fr:'En attente', en:'Pending' },
  received: { bg:'#DCFCE7', text:'#166534', fr:'Reçu',       en:'Received' },
  late:     { bg:'#FEE2E2', text:'#991B1B', fr:'En retard',  en:'Late' },
  waived:   { bg:'#F1F5F9', text:'#64748B', fr:'Annulé',     en:'Waived' },
};
const TYPE_META = {
  project_tranche: { icon:'🏗️', bg:'#EFF6FF', text:'#1E40AF', fr:'Tranche projet', en:'Project instalment' },
  investor_fee:    { icon:'📋', bg:'#F0FDF4', text:'#166534', fr:'Inscription annuelle', en:'Annual subscription' },
  pic_fee:         { icon:'🏛️', bg:'#FEF9C3', text:'#854D0E', fr:'Adhésion PIC', en:'PIC membership' },
};
const METHOD_LABELS: Record<string,string> = {
  bank_transfer:'🏦 Virement', mobile_money:'📱 Mobile Money', cash:'💵 Cash', crypto:'₿ Crypto',
};
const METHODS = [
  ['bank_transfer','🏦',{fr:'Virement',en:'Transfer'}],
  ['mobile_money','📱','Mobile Money'],
  ['cash','💵','Cash'],
  ['crypto','₿','Crypto'],
] as [string,string,string|{fr:string,en:string}][];

const EMPTY_FORM = {
  payment_date: new Date().toISOString().slice(0,10),
  payment_method: 'bank_transfer',
  bank_reference: '',
  notes: '',
};

export default function PaymentsPage() {
  const [lang, setL] = useState<Lang>('fr');
  useEffect(() => {
    setL(getLang());
    const h = () => setL(getLang());
    window.addEventListener('lang-change', h);
    return () => window.removeEventListener('lang-change', h);
  }, []);

  // ── data ───────────────────────────────────────────────────────
  const [tranches, setTranches] = useState<any[]>([]);
  const [feePayments, setFeePayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentRequests, setPaymentRequests] = useState<any[]>([]);

  // ── filters ────────────────────────────────────────────────────
  const [filterType, setFilterType] = useState('');        // '' | 'project_tranche' | 'investor_fee' | 'pic_fee'
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  // ── modal state ────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState(1);                    // 1=investor 2=type 3=detail 4=confirm
  const [payType, setPayType] = useState<'project_tranche'|'investor_fee'|'pic_fee'|''>('');

  // investor search
  const [investorSearch, setInvestorSearch] = useState('');
  const [investorResults, setInvestorResults] = useState<any[]>([]);
  const [selectedInvestor, setSelectedInvestor] = useState<any>(null);
  const [searchingInv, setSearchingInv] = useState(false);

  // tranche selection (type A)
  const [investorSubs, setInvestorSubs] = useState<any[]>([]);
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [selectedTranche, setSelectedTranche] = useState<any>(null);

  // PIC selection (type C)
  const [pics, setPics] = useState<any[]>([]);
  const [selectedPic, setSelectedPic] = useState<any>(null);

  // form
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [processingReq, setProcessingReq] = useState<string|null>(null);

  // ── load ───────────────────────────────────────────────────────
  const load = useCallback(() => {
    setLoading(true);
    const qs = filterType ? `?payment_type=${filterType}` : '';
    fetch(`/api/admin/payments${qs}`, { credentials:'include' })
      .then(r => r.json())
      .then(d => { setTranches(d.tranches ?? []); setFeePayments(d.feePayments ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
    fetch('/api/admin/payment-requests', { credentials:'include' })
      .then(r => r.json())
      .then(d => setPaymentRequests(d.requests ?? []))
      .catch(() => {});
  }, [filterType]);

  useEffect(() => { load(); }, [load]);

  // ── investor search ────────────────────────────────────────────
  useEffect(() => {
    if (investorSearch.length < 2) { setInvestorResults([]); return; }
    setSearchingInv(true);
    const t = setTimeout(() => {
      fetch(`/api/admin/investors?search=${encodeURIComponent(investorSearch)}`, { credentials:'include' })
        .then(r => r.json())
        .then(d => setInvestorResults((d.investors ?? []).slice(0, 8)))
        .catch(() => {})
        .finally(() => setSearchingInv(false));
    }, 300);
    return () => clearTimeout(t);
  }, [investorSearch]);

  const selectInvestor = async (inv: any) => {
    setSelectedInvestor(inv);
    setInvestorSearch('');
    setInvestorResults([]);
    // Load their subscriptions for type A
    const r = await fetch(`/api/admin/subscriptions?investor_id=${inv.id}`, { credentials:'include' });
    const d = await r.json();
    setInvestorSubs(d.subscriptions ?? []);
    // Load PICs for type C
    const r2 = await fetch('/api/admin/pic', { credentials:'include' });
    const d2 = await r2.json();
    setPics((d2.pics ?? []).filter((p: any) => p.status === 'active' && p.spots_remaining > 0));
    setStep(2);
  };

  // ── open modal ─────────────────────────────────────────────────
  const openModal = (tranche?: any) => {
    setStep(tranche ? 3 : 1);
    setPayType(tranche ? 'project_tranche' : '');
    setSelectedInvestor(tranche ? tranche.subscription?.investor : null);
    setSelectedSub(tranche ? tranche.subscription : null);
    setSelectedTranche(tranche ?? null);
    setSelectedPic(null);
    setForm({ ...EMPTY_FORM, ...(tranche ? { amount: String(tranche.amount_ngn) } : {}) });
    setInvestorSearch('');
    setInvestorResults([]);
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setStep(1); setPayType(''); setSelectedInvestor(null); setSelectedTranche(null); setSelectedSub(null); setSelectedPic(null); };

  // ── save payment ───────────────────────────────────────────────
  const savePayment = async () => {
    if (!form.payment_date || !form.payment_method) {
      toast.error(lang==='fr'?'Date et méthode obligatoires':'Date and method required');
      return;
    }
    setSaving(true);
    try {
      if (payType === 'project_tranche') {
        if (!selectedTranche || !form.amount) { toast.error(lang==='fr'?'Tranche et montant requis':'Tranche and amount required'); setSaving(false); return; }
        const r = await fetch('/api/admin/payments', {
          method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
          body: JSON.stringify({
            subscription_id: selectedSub?.id ?? selectedTranche?.subscription?.id,
            tranche_number: selectedTranche.tranche_number,
            received_amount_ngn: Number(form.amount),
            received_date: form.payment_date,
            received_currency: 'NGN',
            payment_method: form.payment_method,
            bank_reference: form.bank_reference,
            notes: form.notes,
          }),
        });
        const d = await r.json();
        if (!r.ok) { toast.error(d.error ?? 'Erreur'); setSaving(false); return; }
        toast.success(lang==='fr'?'✅ Tranche enregistrée !':'✅ Instalment recorded!');
      } else {
        // Type B or C
        const r = await fetch('/api/admin/investor-subscriptions', {
          method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
          body: JSON.stringify({
            investor_id: selectedInvestor.id,
            type: payType,
            payment_date: form.payment_date,
            payment_method: form.payment_method,
            bank_reference: form.bank_reference,
            notes: form.notes,
            amount_xaf: 50000,
            ...(payType === 'pic_fee' ? { pic_id: selectedPic?.id } : {}),
          }),
        });
        const d = await r.json();
        if (!r.ok) { toast.error(d.error ?? 'Erreur'); setSaving(false); return; }
        const msg = payType === 'investor_fee'
          ? (lang==='fr'?`✅ Abonnement enregistré — valable jusqu'au ${fmtDate(d.end_date, lang)}`:`✅ Subscription recorded — valid until ${fmtDate(d.end_date, lang)}`)
          : (lang==='fr'?`✅ Adhésion PIC enregistrée — ${d.pic_name}`:`✅ PIC membership recorded — ${d.pic_name}`);
        toast.success(msg);
      }
      closeModal();
      load();
    } catch { toast.error(lang==='fr'?'Erreur réseau':'Network error'); }
    setSaving(false);
  };

  const handleRequest = async (requestId: string, action: 'approve'|'reject') => {
    setProcessingReq(requestId);
    try {
      const r = await fetch('/api/admin/payments', {
        method:'PATCH', headers:{'Content-Type':'application/json'}, credentials:'include',
        body: JSON.stringify({ request_id: requestId, action }),
      });
      const d = await r.json();
      if (!r.ok) toast.error(d.error ?? 'Erreur');
      else { toast.success(action==='approve'?'✅ Validé':'❌ Rejeté'); load(); }
    } catch { toast.error(lang==='fr'?'Erreur réseau':'Network error'); }
    setProcessingReq(null);
  };

  // ── filtered list ──────────────────────────────────────────────
  const allItems = [
    ...tranches.filter(t => {
      if (filterStatus && t.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        return t.subscription?.investor?.full_name?.toLowerCase().includes(q) ||
               t.subscription?.project?.name?.toLowerCase().includes(q);
      }
      return true;
    }),
    ...feePayments.filter(f => {
      if (filterType && f.type !== filterType) return false;
      if (search) {
        const q = search.toLowerCase();
        return f.investor?.full_name?.toLowerCase().includes(q) ||
               f.pic?.name?.toLowerCase().includes(q);
      }
      return true;
    }),
  ].sort((a, b) => {
    const da = a.received_date ?? a.payment_date ?? a.due_date ?? a.created_at ?? '';
    const db = b.received_date ?? b.payment_date ?? b.due_date ?? b.created_at ?? '';
    return db.localeCompare(da);
  });

  const stats = {
    received: tranches.filter(t=>t.status==='received').reduce((s,t)=>s+(t.received_amount_ngn||0),0),
    pending:  tranches.filter(t=>t.status==='pending').reduce((s,t)=>s+t.amount_ngn,0),
    late:     tranches.filter(t=>t.status==='late').reduce((s,t)=>s+t.amount_ngn,0),
    fees_xaf: feePayments.reduce((s,f)=>s+(f.amount_xaf||0),0),
    recovery: tranches.length>0 ? Math.round(tranches.filter(t=>t.status==='received').length*100/tranches.length):0,
  };

  const inp = { width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid #E2E8F0', fontSize:13, outline:'none', fontFamily:'Outfit,sans-serif', background:'#fff', boxSizing:'border-box' } as any;

  return (
    <div style={{ fontFamily:'Outfit,sans-serif' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:24, fontWeight:800, color:'#0F1E35', margin:0 }}>
            {lang==='fr'?'Paiements & Tranches':'Payments & Instalments'}
          </h2>
          <p style={{ color:'#5A6E8A', fontSize:14, marginTop:4 }}>
            {allItems.length} {lang==='fr'?'paiement(s) au total':'payment(s) total'}
          </p>
        </div>
        <button onClick={() => openModal()}
          style={{ background:'linear-gradient(135deg,#1B3A6B,#2E5BA8)', color:'#fff', border:'none', borderRadius:10, padding:'10px 20px', fontWeight:700, cursor:'pointer', fontSize:14, boxShadow:'0 4px 12px rgba(27,58,107,0.3)' }}>
          💰 {lang==='fr'?'Enregistrer un paiement':'Record Payment'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:14, marginBottom:24 }}>
        {[
          { label:lang==='fr'?'Total reçu (₦)':'Total received (₦)', value:fmtNGN(stats.received), color:'#16a34a', icon:'✅' },
          { label:lang==='fr'?'En attente':'Pending', value:fmtNGN(stats.pending), color:'#D97706', icon:'⏳' },
          { label:lang==='fr'?'En retard':'Late', value:fmtNGN(stats.late), color:stats.late>0?'#E63946':'#94A3B8', icon:'⚠️' },
          { label:lang==='fr'?'Frais & adhésions':'Fees collected', value:fmtXAF(stats.fees_xaf), color:'#C9963A', icon:'🏛️' },
          { label:lang==='fr'?'Recouvrement':'Recovery', value:`${stats.recovery}%`, color:'#1B3A6B', icon:'📊' },
        ].map(s => (
          <div key={s.label} style={{ background:'#fff', borderRadius:14, padding:'16px 18px', border:'1px solid #E2E8F0', boxShadow:'0 2px 8px rgba(27,58,107,0.05)', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', bottom:0, left:0, right:0, height:3, background:s.color }} />
            <div style={{ fontSize:20, marginBottom:6 }}>{s.icon}</div>
            <div style={{ fontSize:10, color:'#94A3B8', textTransform:'uppercase', fontWeight:700, marginBottom:3 }}>{s.label}</div>
            <div style={{ fontSize:22, fontWeight:800, color:s.color, fontFamily:'Syne,sans-serif' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Payment requests from app */}
      {paymentRequests.length > 0 && (
        <div style={{ marginBottom:24, background:'#fff', borderRadius:16, border:'2px solid #C9963A', overflow:'hidden' }}>
          <div style={{ padding:'12px 18px', background:'#FFFBEB', borderBottom:'1px solid #FDE68A', display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:18 }}>📱</span>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, color:'#92400E', fontSize:14 }}>
                {paymentRequests.length} {lang==='fr'?'demande(s) en attente de validation':'payment request(s) awaiting validation'}
              </div>
              <div style={{ fontSize:12, color:'#B45309' }}>{lang==='fr'?'Soumises depuis l\'app Buam Finance':'Submitted from the Buam Finance app'}</div>
            </div>
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#FFFBEB' }}>
                {[lang==='fr'?'Investisseur':'Investor','Projet','#','Montant','Méthode','Soumis','Preuve','Actions'].map(h=>(
                  <th key={h} style={{ textAlign:'left', padding:'9px 14px', fontSize:11, color:'#92400E', textTransform:'uppercase', fontWeight:700, borderBottom:'1px solid #FDE68A' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paymentRequests.map((req,i)=>(
                <tr key={req.id} style={{ borderBottom:i<paymentRequests.length-1?'1px solid #FEF9C3':'none' }}>
                  <td style={{ padding:'11px 14px', fontSize:13, fontWeight:600 }}>{req.subscription?.investor?.full_name??'—'}</td>
                  <td style={{ padding:'11px 14px', fontSize:12, color:'#5A6E8A' }}>{req.subscription?.project?.name??'—'}</td>
                  <td style={{ padding:'11px 14px' }}><span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:999, background:'#EFF6FF', color:'#1E40AF' }}>#{req.tranche_number??1}</span></td>
                  <td style={{ padding:'11px 14px', fontWeight:700 }}>{fmtNGN(req.amount_ngn??0)}</td>
                  <td style={{ padding:'11px 14px', fontSize:12, color:'#5A6E8A' }}>{req.payment_method?.replace(/_/g,' ')??'—'}</td>
                  <td style={{ padding:'11px 14px', fontSize:12, color:'#5A6E8A' }}>{fmtDate(req.submitted_at, lang)}</td>
                  <td style={{ padding:'11px 14px' }}>
                    {req.proof_url?<a href={req.proof_url} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'#1B3A6B', fontWeight:600, textDecoration:'none' }}>🔗 {lang==='fr'?'Voir':'View'}</a>:<span style={{ color:'#94A3B8', fontSize:12 }}>—</span>}
                  </td>
                  <td style={{ padding:'11px 14px' }}>
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={()=>handleRequest(req.id,'approve')} disabled={processingReq===req.id}
                        style={{ padding:'5px 10px', borderRadius:7, border:'none', background:'#16a34a', color:'#fff', cursor:'pointer', fontSize:11, fontWeight:700 }}>✅</button>
                      <button onClick={()=>handleRequest(req.id,'reject')} disabled={processingReq===req.id}
                        style={{ padding:'5px 10px', borderRadius:7, border:'1px solid #E63946', background:'#fff', color:'#E63946', cursor:'pointer', fontSize:11, fontWeight:700 }}>❌</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Late alert */}
      {stats.late > 0 && (
        <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:12, padding:'12px 18px', marginBottom:20, display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:20 }}>🚨</span>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, color:'#991B1B', fontSize:14 }}>{tranches.filter(t=>t.status==='late').length} {lang==='fr'?'tranche(s) en retard':'late instalment(s)'}</div>
            <div style={{ color:'#DC2626', fontSize:13 }}>{lang==='fr'?'Relance investisseurs requise':'Investor follow-up required'}</div>
          </div>
          <button onClick={()=>setFilterStatus('late')} style={{ padding:'7px 14px', borderRadius:8, border:'1px solid #EF4444', background:'#fff', color:'#EF4444', cursor:'pointer', fontWeight:700, fontSize:12 }}>
            {lang==='fr'?'Voir les retards':'View late'}
          </button>
        </div>
      )}

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'#fff', border:'1px solid #E2E8F0', borderRadius:10, padding:'8px 14px', flex:1, maxWidth:300 }}>
          <span style={{ color:'#94A3B8' }}>🔍</span>
          <input placeholder={lang==='fr'?'Investisseur, projet...':'Investor, project...'}
            value={search} onChange={e=>setSearch(e.target.value)}
            style={{ border:'none', outline:'none', fontSize:13, flex:1, fontFamily:'Outfit,sans-serif' }} />
        </div>
        {/* Type filter */}
        <div style={{ display:'flex', gap:5 }}>
          {(['','project_tranche','investor_fee','pic_fee'] as const).map(tp=>{
            const meta = tp ? TYPE_META[tp] : null;
            return (
              <button key={tp} onClick={()=>setFilterType(tp)}
                style={{ padding:'7px 13px', borderRadius:999, border:'1px solid', cursor:'pointer', fontSize:12, fontWeight:600,
                  background:filterType===tp?(meta?.bg??'#1B3A6B'):'#fff',
                  color:filterType===tp?(meta?.text??'#fff'):'#5A6E8A',
                  borderColor:filterType===tp?(meta?.text??'#1B3A6B'):'#E2E8F0' }}>
                {tp===''?(lang==='fr'?'Tous':'All'):`${meta?.icon} ${lang==='fr'?meta?.fr:meta?.en}`}
              </button>
            );
          })}
        </div>
        {/* Status filter (only for tranches) */}
        {(!filterType || filterType==='project_tranche') && (
          <div style={{ display:'flex', gap:5 }}>
            {(['','pending','received','late'] as const).map(s=>(
              <button key={s} onClick={()=>setFilterStatus(s)}
                style={{ padding:'7px 13px', borderRadius:999, border:'1px solid', cursor:'pointer', fontSize:12, fontWeight:600,
                  background:filterStatus===s?'#1B3A6B':'#fff',
                  color:filterStatus===s?'#fff':'#5A6E8A',
                  borderColor:filterStatus===s?'#1B3A6B':'#E2E8F0' }}>
                {s===''?(lang==='fr'?'Tous statuts':'All statuses'):TRANCHE_STYLE[s]?.[lang==='fr'?'fr':'en']}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Unified payment list */}
      <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E2E8F0', overflow:'hidden', boxShadow:'0 2px 12px rgba(27,58,107,0.06)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'#F8FAFC' }}>
              {[lang==='fr'?'Type':'Type', lang==='fr'?'Investisseur':'Investor', lang==='fr'?'Détail':'Detail', lang==='fr'?'Montant':'Amount', lang==='fr'?'Méthode':'Method', lang==='fr'?'Date':'Date', 'Statut', 'Actions'].map(h=>(
                <th key={h} style={{ textAlign:'left', padding:'11px 14px', fontSize:11, color:'#94A3B8', textTransform:'uppercase', fontWeight:700, borderBottom:'1px solid #E2E8F0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign:'center', padding:48, color:'#94A3B8' }}>{lang==='fr'?'Chargement...':'Loading...'}</td></tr>
            ) : allItems.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign:'center', padding:48, color:'#94A3B8' }}>{lang==='fr'?'Aucun paiement':'No payments'}</td></tr>
            ) : allItems.map((item, i) => {
              const isTranche = item.payment_type === 'project_tranche';
              const typeMeta = TYPE_META[item.payment_type ?? item.type ?? 'project_tranche'];
              const st = isTranche ? (TRANCHE_STYLE[item.status] ?? TRANCHE_STYLE.pending) : { bg:'#DCFCE7', text:'#166534', fr:'Enregistré', en:'Recorded' };
              const isLate = isTranche && item.status === 'late';

              const investorName = isTranche ? item.subscription?.investor?.full_name : item.investor?.full_name;
              const detail = isTranche
                ? `${item.subscription?.project?.name ?? '—'} · #${item.tranche_number}`
                : item.type === 'pic_fee'
                  ? (item.pic?.name ?? 'PIC')
                  : (lang==='fr'?'Abonnement annuel':'Annual subscription');
              const amount = isTranche ? fmtNGN(item.amount_ngn) : fmtXAF(item.amount_xaf);
              const date = isTranche
                ? (item.received_date ? fmtDate(item.received_date, lang) : (item.due_date ? fmtDate(item.due_date, lang) : '—'))
                : fmtDate(item.payment_date, lang);

              return (
                <tr key={item.id} style={{ borderBottom:i<allItems.length-1?'1px solid #F1F5F9':'none', background:isLate?'#FFF5F5':'' }}>
                  <td style={{ padding:'11px 14px' }}>
                    <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:999, background:typeMeta.bg, color:typeMeta.text, whiteSpace:'nowrap' }}>
                      {typeMeta.icon} {lang==='fr'?typeMeta.fr:typeMeta.en}
                    </span>
                  </td>
                  <td style={{ padding:'11px 14px', fontSize:13, fontWeight:600, color:'#0F1E35' }}>{investorName ?? '—'}</td>
                  <td style={{ padding:'11px 14px', fontSize:12, color:'#5A6E8A' }}>{detail}</td>
                  <td style={{ padding:'11px 14px', fontWeight:700, fontSize:14, color:'#0F1E35' }}>{amount}</td>
                  <td style={{ padding:'11px 14px', fontSize:12, color:'#5A6E8A' }}>
                    {METHOD_LABELS[item.payment_method] ?? item.payment_method ?? '—'}
                  </td>
                  <td style={{ padding:'11px 14px', fontSize:12, color:isLate?'#E63946':'#5A6E8A', fontWeight:isLate?700:400 }}>{date}</td>
                  <td style={{ padding:'11px 14px' }}>
                    <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:999, background:st.bg, color:st.text }}>
                      ● {lang==='fr'?st.fr:st.en}
                    </span>
                  </td>
                  <td style={{ padding:'11px 14px' }}>
                    {isTranche && item.status !== 'received' ? (
                      <button onClick={()=>openModal(item)}
                        style={{ padding:'5px 12px', borderRadius:7, border:'none', background:'#1B3A6B', color:'#fff', cursor:'pointer', fontSize:12, fontWeight:700 }}>
                        💰 {lang==='fr'?'Encaisser':'Record'}
                      </button>
                    ) : isTranche && item.status === 'received' ? (
                      <button onClick={()=>window.open(`/api/admin/pdf?subscription_id=${item.subscription_id ?? item.subscription?.id}&tranche=${item.tranche_number}&lang=${lang}`,'_blank')}
                        style={{ padding:'5px 12px', borderRadius:7, border:'1px solid #E2E8F0', background:'#fff', color:'#1B3A6B', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                        🧾 DIA
                      </button>
                    ) : <span style={{ color:'#94A3B8', fontSize:12 }}>✅</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── MODAL — Record Payment (4 steps) ── */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:1000 }}
          onClick={e=>{ if (e.target===e.currentTarget) closeModal(); }}>
          <div style={{ background:'#fff', borderRadius:'20px 20px 0 0', padding:28, width:'100%', maxWidth:640, maxHeight:'92vh', overflowY:'auto', boxShadow:'0 -16px 48px rgba(0,0,0,0.25)' }}>

            {/* Modal header */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div>
                <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:20, fontWeight:700, color:'#0F1E35', margin:0 }}>
                  💰 {lang==='fr'?'Enregistrer un paiement':'Record Payment'}
                </h3>
                {/* Step indicator */}
                <div style={{ display:'flex', gap:6, marginTop:8 }}>
                  {[
                    lang==='fr'?'Investisseur':'Investor',
                    lang==='fr'?'Type':'Type',
                    lang==='fr'?'Détails':'Details',
                    lang==='fr'?'Confirmer':'Confirm',
                  ].map((s,idx)=>(
                    <div key={s} style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <span style={{ width:22, height:22, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700,
                        background:step>idx+1?'#16a34a':step===idx+1?'#1B3A6B':'#E2E8F0',
                        color:step>=idx+1?'#fff':'#94A3B8' }}>{step>idx+1?'✓':idx+1}</span>
                      <span style={{ fontSize:11, color:step===idx+1?'#1B3A6B':'#94A3B8', fontWeight:step===idx+1?700:400 }}>{s}</span>
                      {idx<3 && <span style={{ color:'#E2E8F0', fontSize:11 }}>›</span>}
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={closeModal} style={{ background:'#F1F5F9', border:'none', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:13, fontWeight:600, color:'#5A6E8A' }}>✕</button>
            </div>

            {/* ── STEP 1: Select investor ── */}
            {step === 1 && (
              <div>
                <div style={{ marginBottom:16 }}>
                  <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:6 }}>
                    {lang==='fr'?'Rechercher un investisseur *':'Search investor *'}
                  </label>
                  <div style={{ position:'relative' }}>
                    <input value={investorSearch} onChange={e=>setInvestorSearch(e.target.value)}
                      placeholder={lang==='fr'?'Nom ou email...':'Name or email...'}
                      style={{ ...inp, paddingRight:36 }} autoFocus />
                    {searchingInv && <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:'#94A3B8', fontSize:13 }}>↻</span>}
                  </div>
                </div>
                {investorResults.length > 0 && (
                  <div style={{ border:'1px solid #E2E8F0', borderRadius:10, overflow:'hidden', marginBottom:16 }}>
                    {investorResults.map((inv,i)=>(
                      <div key={inv.id} onClick={()=>selectInvestor(inv)}
                        style={{ padding:'12px 16px', borderBottom:i<investorResults.length-1?'1px solid #F1F5F9':'none', cursor:'pointer', display:'flex', alignItems:'center', gap:12, background:'#fff' }}
                        onMouseEnter={e=>e.currentTarget.style.background='#F8FAFC'}
                        onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                        <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,#1B3A6B,#2E5BA8)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:13, fontWeight:700, flexShrink:0 }}>
                          {inv.full_name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600, color:'#0F1E35' }}>{inv.full_name}</div>
                          <div style={{ fontSize:11, color:'#94A3B8' }}>{inv.email} · KYC: {inv.kyc_status}</div>
                        </div>
                        <span style={{ marginLeft:'auto', fontSize:11, color:'#94A3B8' }}>→</span>
                      </div>
                    ))}
                  </div>
                )}
                {investorSearch.length >= 2 && investorResults.length === 0 && !searchingInv && (
                  <div style={{ textAlign:'center', padding:'24px', color:'#94A3B8', fontSize:13, border:'1px dashed #E2E8F0', borderRadius:10 }}>
                    {lang==='fr'?'Aucun investisseur trouvé':'No investor found'}
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 2: Payment type ── */}
            {step === 2 && selectedInvestor && (
              <div>
                {/* Investor recap */}
                <div style={{ background:'#F0F9FF', borderRadius:10, padding:'12px 16px', marginBottom:20, border:'1px solid #BAE6FD', display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:36, height:36, borderRadius:'50%', background:'#1B3A6B', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:13, fontWeight:700, flexShrink:0 }}>
                    {selectedInvestor.full_name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#0369A1' }}>{selectedInvestor.full_name}</div>
                    <div style={{ fontSize:11, color:'#0284C7' }}>{selectedInvestor.email}</div>
                  </div>
                  <button onClick={()=>{setStep(1);setSelectedInvestor(null);}} style={{ marginLeft:'auto', background:'none', border:'1px solid #BAE6FD', borderRadius:6, padding:'3px 8px', cursor:'pointer', color:'#0284C7', fontSize:11 }}>
                    ✏️ {lang==='fr'?'Changer':'Change'}
                  </button>
                </div>

                <div style={{ fontSize:13, fontWeight:700, color:'#374151', marginBottom:14 }}>
                  {lang==='fr'?'Choisissez le type de paiement :':'Choose the payment type:'}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {/* Type A */}
                  <div onClick={()=>{setPayType('project_tranche');setStep(3);}}
                    style={{ padding:'16px 18px', borderRadius:12, border:`2px solid ${payType==='project_tranche'?'#1B3A6B':'#E2E8F0'}`, cursor:'pointer', background:payType==='project_tranche'?'rgba(27,58,107,0.04)':'#fff' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <span style={{ fontSize:24 }}>🏗️</span>
                      <div>
                        <div style={{ fontWeight:700, fontSize:14, color:'#0F1E35' }}>
                          {lang==='fr'?'Tranche de projet d\'investissement':'Investment project instalment'}
                        </div>
                        <div style={{ fontSize:12, color:'#5A6E8A', marginTop:2 }}>
                          {lang==='fr'?`${investorSubs.length} souscription(s) active(s)`:`${investorSubs.length} active subscription(s)`}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Type B */}
                  <div onClick={()=>{setPayType('investor_fee');setStep(3);}}
                    style={{ padding:'16px 18px', borderRadius:12, border:`2px solid ${payType==='investor_fee'?'#16a34a':'#E2E8F0'}`, cursor:'pointer', background:payType==='investor_fee'?'#F0FDF4':'#fff' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <span style={{ fontSize:24 }}>📋</span>
                      <div>
                        <div style={{ fontWeight:700, fontSize:14, color:'#0F1E35' }}>
                          {lang==='fr'?'Inscription investisseur (50 000 XAF/an)':'Investor subscription (50,000 XAF/year)'}
                        </div>
                        <div style={{ fontSize:12, color:'#5A6E8A', marginTop:2 }}>
                          {selectedInvestor.subscription_status === 'active'
                            ? (lang==='fr'?'✅ Renouvellement — extension de 365 jours':'✅ Renewal — extends by 365 days')
                            : (lang==='fr'?'⏳ Nouvelle activation (365 jours)':'⏳ New activation (365 days)')}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Type C */}
                  <div onClick={()=>{setPayType('pic_fee');setStep(3);}}
                    style={{ padding:'16px 18px', borderRadius:12, border:`2px solid ${payType==='pic_fee'?'#C9963A':'#E2E8F0'}`, cursor:'pointer', background:payType==='pic_fee'?'#FFFBEB':'#fff' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <span style={{ fontSize:24 }}>🏛️</span>
                      <div>
                        <div style={{ fontWeight:700, fontSize:14, color:'#0F1E35' }}>
                          {lang==='fr'?'Adhésion PIC (50 000 XAF)':'PIC Membership (50,000 XAF)'}
                        </div>
                        <div style={{ fontSize:12, color:'#5A6E8A', marginTop:2 }}>
                          {lang==='fr'?`${pics.length} cercle(s) PIC disponible(s)`:`${pics.length} PIC circle(s) available`}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 3: Details ── */}
            {step === 3 && (
              <div>
                {/* Context recap */}
                <div style={{ background:'#F8FAFC', borderRadius:10, padding:'12px 16px', marginBottom:20, border:'1px solid #E2E8F0' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#5A6E8A', marginBottom:4 }}>
                    {TYPE_META[payType as keyof typeof TYPE_META]?.icon} {lang==='fr'?TYPE_META[payType as keyof typeof TYPE_META]?.fr:TYPE_META[payType as keyof typeof TYPE_META]?.en}
                    {selectedInvestor && ` · ${selectedInvestor.full_name}`}
                  </div>

                  {/* Type A: tranche selector */}
                  {payType === 'project_tranche' && !selectedTranche && (
                    <div style={{ marginTop:8 }}>
                      <div style={{ fontSize:12, color:'#374151', marginBottom:6 }}>{lang==='fr'?'Sélectionnez la souscription puis la tranche :':'Select the subscription then the instalment:'}</div>
                      {investorSubs.length === 0 ? (
                        <div style={{ color:'#94A3B8', fontSize:12 }}>{lang==='fr'?'Aucune souscription active':'No active subscription'}</div>
                      ) : investorSubs.map((sub:any)=>(
                        <div key={sub.id} style={{ marginBottom:8, border:'1px solid #E2E8F0', borderRadius:8, overflow:'hidden' }}>
                          <div style={{ padding:'8px 12px', background:'#EFF6FF', fontSize:12, fontWeight:700, color:'#1E40AF' }}>
                            📋 {sub.project?.name ?? 'Projet'} · {sub.dia_reference}
                          </div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:6, padding:8 }}>
                            {(sub.tranches ?? []).filter((t:any)=>t.status!=='received').map((t:any)=>(
                              <button key={t.id} onClick={()=>{setSelectedSub(sub);setSelectedTranche(t);setForm({...form,amount:String(t.amount_ngn)});}}
                                style={{ padding:'5px 12px', borderRadius:7, border:'1px solid #1B3A6B', background:'#fff', color:'#1B3A6B', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                                #{t.tranche_number} · {fmtNGN(t.amount_ngn)}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {payType === 'project_tranche' && selectedTranche && (
                    <div style={{ fontSize:12, color:'#1E40AF', marginTop:4 }}>
                      Tranche #{selectedTranche.tranche_number} · {fmtNGN(selectedTranche.amount_ngn)}
                      <button onClick={()=>setSelectedTranche(null)} style={{ marginLeft:8, background:'none', border:'none', cursor:'pointer', color:'#94A3B8', fontSize:11 }}>✏️</button>
                    </div>
                  )}

                  {/* Type B: subscription info */}
                  {payType === 'investor_fee' && (
                    <div style={{ fontSize:12, color:'#166534', marginTop:4 }}>
                      {lang==='fr'?'Cotisation annuelle : 50 000 XAF — validité 365 jours':'Annual fee: 50,000 XAF — 365 days validity'}
                    </div>
                  )}

                  {/* Type C: PIC selector */}
                  {payType === 'pic_fee' && (
                    <div style={{ marginTop:8 }}>
                      <div style={{ fontSize:12, color:'#374151', marginBottom:6 }}>{lang==='fr'?'Sélectionnez le PIC :':'Select the PIC:'}</div>
                      {pics.length === 0 ? (
                        <div style={{ color:'#94A3B8', fontSize:12 }}>{lang==='fr'?'Aucun PIC disponible (tous complets ou fermés)':'No PIC available (all full or closed)'}</div>
                      ) : pics.map((p:any)=>(
                        <div key={p.id} onClick={()=>setSelectedPic(p)}
                          style={{ padding:'8px 12px', borderRadius:8, border:`2px solid ${selectedPic?.id===p.id?'#C9963A':'#E2E8F0'}`, marginBottom:6, cursor:'pointer', background:selectedPic?.id===p.id?'#FFFBEB':'#fff', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                          <div>
                            <div style={{ fontWeight:700, fontSize:13 }}>🏛️ {p.name}</div>
                            <div style={{ fontSize:11, color:'#94A3B8' }}>{p.member_count}/{p.max_members} membres · {p.spots_remaining} {lang==='fr'?'places':'spots'}</div>
                          </div>
                          {selectedPic?.id===p.id && <span style={{ color:'#C9963A', fontWeight:700 }}>✓</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payment form */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                  {payType === 'project_tranche' && (
                    <div>
                      <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:5 }}>
                        {lang==='fr'?'Montant reçu (₦) *':'Amount received (₦) *'}
                      </label>
                      <input type="number" value={form.amount ?? ''} onChange={e=>setForm({...form, amount:e.target.value})} style={inp} />
                    </div>
                  )}
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:5 }}>
                      {lang==='fr'?'Date de réception *':'Date received *'}
                    </label>
                    <input type="date" value={form.payment_date} onChange={e=>setForm({...form, payment_date:e.target.value})} style={inp} />
                  </div>
                  <div style={{ gridColumn:'span 2' }}>
                    <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:6 }}>
                      {lang==='fr'?'Méthode de paiement *':'Payment method *'}
                    </label>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                      {METHODS.map(([v,ic,l])=>{
                        const label = typeof l === 'string' ? l : lang==='fr'?l.fr:l.en;
                        return (
                          <button key={v} type="button" onClick={()=>setForm({...form, payment_method:v})}
                            style={{ padding:'10px 6px', borderRadius:8, border:`2px solid ${form.payment_method===v?'#1B3A6B':'#E2E8F0'}`, background:form.payment_method===v?'rgba(27,58,107,0.08)':'#fff', cursor:'pointer', fontSize:12, fontWeight:600, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                            <span style={{ fontSize:18 }}>{ic}</span>
                            <span style={{ color:form.payment_method===v?'#1B3A6B':'#5A6E8A' }}>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:5 }}>
                      {lang==='fr'?'Référence bancaire / mobile':'Bank / mobile reference'}
                    </label>
                    <input value={form.bank_reference} onChange={e=>setForm({...form, bank_reference:e.target.value})}
                      placeholder="Ex: TRF2026033001" style={inp} />
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:5 }}>Notes</label>
                    <input value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})}
                      placeholder={lang==='fr'?'Remarques...':'Notes...'} style={inp} />
                  </div>
                </div>
              </div>
            )}

            {/* ── Nav buttons ── */}
            <div style={{ display:'flex', gap:10, marginTop:24 }}>
              {step > 1 && (
                <button onClick={()=>setStep(step-1)}
                  style={{ flex:1, padding:'12px', borderRadius:10, border:'1px solid #E2E8F0', background:'#fff', cursor:'pointer', fontWeight:600, color:'#5A6E8A' }}>
                  ← {lang==='fr'?'Retour':'Back'}
                </button>
              )}
              {step < 3 && step > 1 && (
                <button onClick={()=>setStep(step+1)} disabled={step===2 && !payType}
                  style={{ flex:2, padding:'12px', borderRadius:10, border:'none', background:'#1B3A6B', color:'#fff', cursor:'pointer', fontWeight:700, opacity:step===2&&!payType?0.4:1 }}>
                  {lang==='fr'?'Suivant →':'Next →'}
                </button>
              )}
              {step === 3 && (
                <button onClick={savePayment} disabled={saving ||
                  (payType==='project_tranche' && !selectedTranche) ||
                  (payType==='pic_fee' && !selectedPic)}
                  style={{ flex:2, padding:'12px', borderRadius:10, border:'none', background:saving?'#94A3B8':'#16a34a', color:'#fff', cursor:'pointer', fontWeight:700, fontSize:15 }}>
                  {saving?(lang==='fr'?'Enregistrement...':'Saving...'):`💾 ${lang==='fr'?'Confirmer le paiement':'Confirm payment'}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
