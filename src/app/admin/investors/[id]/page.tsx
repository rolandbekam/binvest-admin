// @ts-nocheck
'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { getLang, T, type Lang } from '@/lib/i18n';

const fmt = (n: number) => !n ? '₦0' : n >= 1e6 ? `₦${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `₦${(n/1e3).toFixed(0)}K` : `₦${n.toLocaleString()}`;

const KYC_C: Record<string,string> = { pending:'#854D0E', in_review:'#1E40AF', approved:'#166534', rejected:'#991B1B' };
const KYC_B: Record<string,string> = { pending:'#FEF9C3', in_review:'#DBEAFE', approved:'#DCFCE7', rejected:'#FEE2E2' };
const KYC_L: Record<string,{fr:string;en:string}> = {
  pending:{fr:'En attente',en:'Pending'}, in_review:{fr:'En cours',en:'In review'},
  approved:{fr:'Approuvé',en:'Approved'}, rejected:{fr:'Rejeté',en:'Rejected'},
};
const TR_C: Record<string,string> = { pending:'#D97706', received:'#166534', late:'#991B1B', waived:'#64748B' };
const TR_B: Record<string,string> = { pending:'#FEF9C3', received:'#DCFCE7', late:'#FEE2E2', waived:'#F1F5F9' };
const TR_L: Record<string,{fr:string;en:string}> = {
  pending:{fr:'En attente',en:'Pending'}, received:{fr:'Reçu',en:'Received'},
  late:{fr:'En retard',en:'Late'}, waived:{fr:'Annulé',en:'Waived'},
};

function DocImage({ url, label, lang }: { url: string | null; label: string; lang: string }) {
  const [zoom, setZoom] = useState(false);
  const [err, setErr] = useState(false);

  if (!url || err) {
    return (
      <div style={{ borderRadius:12, border:'2px dashed #E2E8F0', padding:32, textAlign:'center', background:'#F8FAFC' }}>
        <div style={{ fontSize:32, marginBottom:8 }}>🖼️</div>
        <div style={{ fontSize:12, color:'#94A3B8', fontWeight:600 }}>{label}</div>
        <div style={{ fontSize:11, color:'#CBD5E1', marginTop:4 }}>
          {lang === 'fr' ? 'Document non disponible' : 'Document not available'}
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ position:'relative', borderRadius:12, overflow:'hidden', border:'1px solid #E2E8F0', cursor:'zoom-in', boxShadow:'0 2px 8px rgba(0,0,0,0.08)' }}
        onClick={() => setZoom(true)}>
        <img src={url} alt={label} onError={() => setErr(true)}
          style={{ width:'100%', height:180, objectFit:'cover', display:'block' }} />
        <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'8px 12px', background:'linear-gradient(transparent,rgba(0,0,0,0.6))', color:'#fff', fontSize:12, fontWeight:700 }}>
          {label}
        </div>
        <div style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,0.5)', borderRadius:6, padding:'3px 7px', color:'#fff', fontSize:10, fontWeight:700 }}>
          🔍 {lang === 'fr' ? 'Agrandir' : 'Zoom'}
        </div>
      </div>

      {zoom && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:24 }}
          onClick={() => setZoom(false)}>
          <div style={{ position:'relative', maxWidth:'90vw', maxHeight:'90vh' }}>
            <img src={url} alt={label} style={{ maxWidth:'100%', maxHeight:'85vh', borderRadius:12, objectFit:'contain', boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }} />
            <div style={{ position:'absolute', top:-16, right:-16, width:36, height:36, borderRadius:'50%', background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:16, fontWeight:900, color:'#374151', boxShadow:'0 4px 12px rgba(0,0,0,0.3)' }}>✕</div>
            <div style={{ textAlign:'center', color:'rgba(255,255,255,0.7)', fontSize:13, marginTop:12 }}>{label}</div>
          </div>
        </div>
      )}
    </>
  );
}

function LinkAccountForm({ investorId, lang, onLinked }: { investorId: string; lang: string; onLinked: () => void }) {
  const [uid, setUid] = useState('');
  const [saving, setSaving] = useState(false);

  const link = async () => {
    if (!uid.trim()) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/investors/${investorId}`, {
        method:'PUT', headers:{'Content-Type':'application/json'},
        credentials:'include', body: JSON.stringify({ user_id: uid.trim() }),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error ?? 'Erreur'); }
      else { toast.success(lang==='fr'?'✅ Compte lié':'✅ Account linked'); onLinked(); }
    } catch { toast.error(lang==='fr'?'Erreur réseau':'Network error'); }
    setSaving(false);
  };

  return (
    <div style={{ marginTop:12, padding:12, background:'#FFFBEB', borderRadius:10, border:'1px solid #FDE68A' }}>
      <div style={{ fontSize:12, fontWeight:700, color:'#92400E', marginBottom:8 }}>
        🔗 {lang==='fr'?'Lier un compte Buam Finance (auth.users UUID)':'Link a Buam Finance account (auth.users UUID)'}
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <input value={uid} onChange={e => setUid(e.target.value)}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          style={{ flex:1, padding:'8px 10px', borderRadius:7, border:'1px solid #E2E8F0', fontSize:12, outline:'none', fontFamily:'monospace' }} />
        <button onClick={link} disabled={saving || !uid.trim()}
          style={{ padding:'8px 14px', borderRadius:7, border:'none', background:'#1B3A6B', color:'#fff', cursor:'pointer', fontWeight:700, fontSize:12, opacity:saving?0.7:1 }}>
          {saving?'…':(lang==='fr'?'Lier':'Link')}
        </button>
      </div>
    </div>
  );
}

export default function InvestorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lang, setL] = useState<Lang>('fr');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'profil'|'kyc'|'projets'|'paiements'|'notes'|'abonnement'>('profil');
  const [updatingSub, setUpdatingSub] = useState(false);
  const [editKyc, setEditKyc] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [notes, setNotes] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    setL(getLang());
    const h = () => setL(getLang());
    window.addEventListener('lang-change', h);
    return () => window.removeEventListener('lang-change', h);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/investors/${id}`, { credentials:'include' });
      const d = await r.json();
      setData(d);
      setEditKyc(d.investor?.kyc_status ?? 'pending');
      setNotes(d.investor?.notes ?? '');
    } catch { setData(null); }
    setLoading(false);
  };

  useEffect(() => { if (id) load(); }, [id]);

  const t = T[lang];

  const updateKyc = async (status: string, reason?: string) => {
    const body: any = { kyc_status: status };
    if (reason) body.kyc_rejection_reason = reason;
    const r = await fetch(`/api/admin/investors/${id}`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      credentials:'include', body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) { toast.error(d.error ?? 'Erreur'); return; }
    toast.success(
      status === 'approved' ? (lang==='fr' ? '✅ KYC approuvé — email envoyé' : '✅ KYC approved — email sent')
      : status === 'rejected' ? (lang==='fr' ? '❌ KYC rejeté — email envoyé' : '❌ KYC rejected — email sent')
      : (lang==='fr' ? 'Statut KYC mis à jour' : 'KYC status updated')
    );
    // Send email notification (non-blocking)
    if (status === 'approved' || status === 'rejected') {
      fetch('/api/admin/email', {
        method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
        body: JSON.stringify({
          type: status === 'approved' ? 'kyc_approved' : 'kyc_rejected',
          investor_id: id,
          variables: { name: data?.investor?.full_name ?? '', reason: reason ?? '', lang },
        }),
      }).catch(() => {});
    }
    setShowRejectBox(false);
    setRejectionReason('');
    load();
  };

  const archiveInvestor = async () => {
    const inv = data?.investor;
    const isActive = inv?.is_active !== false;
    const confirmMsg = isActive
      ? (lang==='fr' ? `Archiver ${inv?.full_name} ? L'investisseur ne pourra plus se connecter ni effectuer de souscriptions.` : `Archive ${inv?.full_name}? The investor will no longer be able to log in or make subscriptions.`)
      : (lang==='fr' ? `Réactiver ${inv?.full_name} ?` : `Reactivate ${inv?.full_name}?`);
    if (!window.confirm(confirmMsg)) return;
    setArchiving(true);
    try {
      const r = await fetch(`/api/admin/investors/${id}`, {
        method:'PUT', headers:{'Content-Type':'application/json'},
        credentials:'include', body: JSON.stringify({ is_active: !isActive }),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error ?? 'Erreur'); }
      else toast.success(isActive
        ? (lang==='fr' ? '📦 Investisseur archivé' : '📦 Investor archived')
        : (lang==='fr' ? '✅ Investisseur réactivé' : '✅ Investor reactivated'));
      load();
    } catch { toast.error(lang==='fr' ? 'Erreur réseau' : 'Network error'); }
    setArchiving(false);
  };

  const saveNotes = async () => {
    setSavingNote(true);
    await fetch(`/api/admin/investors/${id}`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      credentials:'include', body: JSON.stringify({ notes }),
    });
    toast.success(lang === 'fr' ? 'Notes sauvegardées' : 'Notes saved');
    setSavingNote(false);
  };

  const sendEmail = async (type: string) => {
    setSendingEmail(true);
    try {
      const r = await fetch('/api/admin/email', {
        method:'POST', headers:{'Content-Type':'application/json'},
        credentials:'include',
        body: JSON.stringify({ type, investor_id: id, variables: { lang, name: data?.investor?.full_name } }),
      });
      const d = await r.json();
      if (d.preview) toast.success(lang==='fr' ? `📧 Email simulé` : `📧 Email simulated`);
      else toast.success(lang==='fr' ? `📧 Email envoyé à ${data?.investor?.email}` : `📧 Email sent to ${data?.investor?.email}`);
    } catch { toast.error(lang==='fr' ? 'Erreur envoi email' : 'Email send error'); }
    setSendingEmail(false);
  };

  const updateSubscription = async (action: 'activate' | 'renew') => {
    const startDate = new Date().toISOString().slice(0, 10);
    const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const body: any = { subscription_status: 'active', subscription_start_date: startDate, subscription_end_date: endDate };
    if (action === 'renew' && data?.investor?.subscription_end_date) {
      const current = new Date(data.investor.subscription_end_date);
      const extended = new Date(current.getTime() + 365 * 24 * 60 * 60 * 1000);
      body.subscription_end_date = extended.toISOString().slice(0, 10);
      body.subscription_start_date = data.investor.subscription_start_date;
    }
    setUpdatingSub(true);
    try {
      const r = await fetch(`/api/admin/investors/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error ?? 'Erreur'); }
      else toast.success(action === 'activate'
        ? (lang === 'fr' ? '✅ Abonnement activé (365 jours)' : '✅ Subscription activated (365 days)')
        : (lang === 'fr' ? '✅ Abonnement renouvelé (+365 jours)' : '✅ Subscription renewed (+365 days)'));
      load();
    } catch { toast.error(lang === 'fr' ? 'Erreur réseau' : 'Network error'); }
    setUpdatingSub(false);
  };

  const openDIAPDF = (tranche: any, sub: any) => {
    const params = new URLSearchParams({
      reference: sub.dia_reference,
      investor_name: data.investor.full_name,
      investor_country: data.investor.country,
      project_name: sub.project?.name,
      amount_ngn: String(tranche.amount_ngn),
      facilitation_fee: String(Math.round(tranche.amount_ngn * 0.1)),
      tranche_number: String(tranche.tranche_number),
      tranches_total: String(sub.tranches_count),
      received_date: tranche.received_date ?? new Date().toISOString().slice(0,10),
      payment_method: tranche.payment_method ?? 'bank_transfer',
      bank_reference: tranche.bank_reference ?? '',
      lang,
    });
    window.open(`/api/admin/pdf?${params.toString()}`, '_blank');
  };

  if (loading) return <div style={{ textAlign:'center', padding:60, color:'#94A3B8', fontFamily:'Outfit,sans-serif' }}>{t.common.loading}</div>;

  if (!data?.investor) return (
    <div style={{ textAlign:'center', padding:80, fontFamily:'Outfit,sans-serif' }}>
      <div style={{ fontSize:48, marginBottom:16 }}>❌</div>
      <div style={{ fontSize:18, fontWeight:600, color:'#374151' }}>
        {lang==='fr' ? 'Investisseur introuvable' : 'Investor not found'}
      </div>
      <button onClick={() => router.push('/admin/investors')}
        style={{ marginTop:24, padding:'10px 20px', borderRadius:10, border:'none', background:'#1B3A6B', color:'#fff', cursor:'pointer', fontWeight:700 }}>
        {t.common.back}
      </button>
    </div>
  );

  const inv = data.investor;
  const subs = data?.subscriptions ?? [];
  const tranches = data?.tranches ?? [];
  const kyc_docs = data?.kyc_docs ?? { id_front: null, id_back: null, selfie: null };
  const isArchived = inv.is_active === false;

  const totalPaid = tranches.filter((t:any) => t.status==='received').reduce((s:number,t:any) => s+(t.received_amount_ngn||0), 0);
  const totalPending = tranches.filter((t:any) => t.status==='pending').reduce((s:number,t:any) => s+t.amount_ngn, 0);
  const totalLate = tranches.filter((t:any) => t.status==='late').reduce((s:number,t:any) => s+t.amount_ngn, 0);
  const initials = inv.full_name?.split(' ').map((n:string) => n[0]).join('').slice(0,2).toUpperCase() ?? '??';

  const subStatus = inv.subscription_status ?? 'pending';
  const subStatusEmoji = subStatus === 'active' ? '🟢' : subStatus === 'expired' ? '🔴' : '🟡';
  const daysLeft = inv.subscription_end_date
    ? Math.ceil((new Date(inv.subscription_end_date).getTime() - Date.now()) / 86400000)
    : null;

  const TABS = [
    { key:'profil',      label:`👤 ${lang==='fr'?'Profil':'Profile'}` },
    { key:'abonnement',  label:`💳 ${lang==='fr'?'Abonnement':'Subscription'} ${subStatusEmoji}` },
    { key:'kyc',         label:`🪪 KYC ${inv.kyc_status === 'pending' ? '🔴' : inv.kyc_status === 'in_review' ? '🟡' : inv.kyc_status === 'approved' ? '🟢' : '⚫'}` },
    { key:'projets',     label:`📋 ${lang==='fr'?'Projets':'Projects'} (${subs.length})` },
    { key:'paiements',   label:`💰 ${lang==='fr'?'Paiements':'Payments'} (${tranches.length})` },
    { key:'notes',       label:`📝 ${lang==='fr'?'Notes':'Notes'}` },
  ];

  return (
    <div style={{ fontFamily:'Outfit,sans-serif' }}>
      {/* Back */}
      <button onClick={() => router.push('/admin/investors')}
        style={{ background:'none', border:'none', cursor:'pointer', color:'#5A6E8A', fontSize:14, marginBottom:20, display:'flex', alignItems:'center', gap:6, padding:0 }}>
        {t.common.back} {lang==='fr'?'aux investisseurs':'to investors'}
      </button>

      {/* Archived banner */}
      {isArchived && (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 18px', borderRadius:12, background:'#F1F5F9', border:'1px solid #CBD5E1', marginBottom:16 }}>
          <span style={{ fontSize:18 }}>📦</span>
          <span style={{ fontSize:13, fontWeight:700, color:'#475569' }}>
            {lang==='fr' ? 'Ce compte investisseur est archivé — accès et souscriptions désactivés' : 'This investor account is archived — access and subscriptions disabled'}
          </span>
        </div>
      )}

      {/* Header */}
      <div style={{ background:'#fff', borderRadius:20, border:`1px solid ${isArchived ? '#CBD5E1' : '#E2E8F0'}`, padding:28, marginBottom:24, boxShadow:'0 2px 12px rgba(27,58,107,0.06)', opacity: isArchived ? 0.85 : 1 }}>
        {/* Kente */}
        <div style={{ display:'flex', height:4, borderRadius:2, overflow:'hidden', marginBottom:20 }}>
          {['#1B3A6B','#E63946','#C9963A','#0D2347','#1B3A6B','#E63946','#C9963A','#0D2347'].map((c,i) => (
            <div key={i} style={{ flex:1, background: isArchived ? '#CBD5E1' : c }} />
          ))}
        </div>

        <div style={{ display:'flex', gap:20, alignItems:'flex-start' }}>
          {/* Avatar */}
          <div style={{ width:72, height:72, borderRadius:'50%', background: isArchived ? '#94A3B8' : 'linear-gradient(135deg,#1B3A6B,#2E5BA8)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:26, fontWeight:900, fontFamily:'Syne,sans-serif', flexShrink:0, border:`3px solid ${isArchived ? '#CBD5E1' : '#C9963A'}`, boxShadow:'0 4px 16px rgba(27,58,107,0.25)' }}>
            {initials}
          </div>

          {/* Infos */}
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:6 }}>
              <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:24, fontWeight:800, color: isArchived ? '#64748B' : '#0F1E35', margin:0 }}>{inv.full_name}</h2>
              <span style={{ fontSize:11, fontWeight:700, padding:'4px 12px', borderRadius:999, background:KYC_B[inv.kyc_status], color:KYC_C[inv.kyc_status] }}>
                KYC: {KYC_L[inv.kyc_status]?.[lang] ?? inv.kyc_status}
              </span>
              {isArchived && <span style={{ fontSize:11, fontWeight:700, padding:'4px 12px', borderRadius:999, background:'#F1F5F9', color:'#64748B' }}>📦 {lang==='fr'?'Archivé':'Archived'}</span>}
              {inv.pic_member && <span style={{ fontSize:11, fontWeight:700, padding:'4px 12px', borderRadius:999, background:'#FEF9C3', color:'#854D0E' }}>✦ PIC</span>}
              {inv.dia_signed && <span style={{ fontSize:11, fontWeight:700, padding:'4px 12px', borderRadius:999, background:'#DCFCE7', color:'#166534' }}>📋 DIA</span>}
            </div>
            <div style={{ display:'flex', gap:16, color:'#5A6E8A', fontSize:13, flexWrap:'wrap' }}>
              <span>📧 {inv.email}</span>
              {inv.phone && <span>📱 {inv.phone}</span>}
              <span>🌍 {inv.country}</span>
              <span>📅 {lang==='fr'?'Inscrit le':'Registered'}: {new Date(inv.created_at).toLocaleDateString(lang==='fr'?'fr-FR':'en-GB')}</span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <button onClick={() => sendEmail('welcome')} disabled={sendingEmail}
              style={{ padding:'8px 14px', borderRadius:8, border:'1px solid #1B3A6B', background:'rgba(27,58,107,0.06)', color:'#1B3A6B', cursor:'pointer', fontSize:12, fontWeight:600, whiteSpace:'nowrap' }}>
              {t.investors.send_welcome}
            </button>
            <button onClick={() => sendEmail('reminder')} disabled={sendingEmail}
              style={{ padding:'8px 14px', borderRadius:8, border:'1px solid #D97706', background:'rgba(217,119,6,0.06)', color:'#D97706', cursor:'pointer', fontSize:12, fontWeight:600, whiteSpace:'nowrap' }}>
              {t.investors.send_reminder}
            </button>
            <select value={editKyc} onChange={e => { setEditKyc(e.target.value); updateKyc(e.target.value); }}
              style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #E2E8F0', fontSize:12, outline:'none', background:'#fff', cursor:'pointer' }}>
              {Object.entries(KYC_L).map(([v,l]) => <option key={v} value={v}>{l[lang]}</option>)}
            </select>
            {/* Archive / Reactivate button */}
            <button onClick={archiveInvestor} disabled={archiving}
              style={{ padding:'8px 14px', borderRadius:8, border:`1px solid ${isArchived ? '#16a34a' : '#64748B'}`, background: isArchived ? 'rgba(22,163,74,0.06)' : 'rgba(100,116,139,0.06)', color: isArchived ? '#16a34a' : '#64748B', cursor:'pointer', fontSize:12, fontWeight:700, whiteSpace:'nowrap' }}>
              {archiving ? '…' : isArchived ? (lang==='fr'?'♻️ Réactiver':'♻️ Reactivate') : (lang==='fr'?'📦 Archiver':'📦 Archive')}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginTop:24 }}>
          {[
            { label:t.investors.total_invested, value:fmt(inv.total_invested_ngn||0), color:'#1B3A6B', icon:'💼' },
            { label:t.investors.total_paid, value:fmt(totalPaid), color:'#16a34a', icon:'✅' },
            { label:t.investors.total_pending, value:fmt(totalPending), color:'#D97706', icon:'⏳' },
            { label:t.investors.total_late, value:fmt(totalLate), color:totalLate>0?'#E63946':'#94A3B8', icon:'⚠️' },
          ].map(s => (
            <div key={s.label} style={{ background:'#F8FAFC', borderRadius:12, padding:'14px 16px', border:'1px solid #E2E8F0' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                <span>{s.icon}</span>
                <span style={{ fontSize:10, color:'#94A3B8', fontWeight:600, textTransform:'uppercase' }}>{s.label}</span>
              </div>
              <div style={{ fontSize:20, fontWeight:800, color:s.color, fontFamily:'Syne,sans-serif' }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* TABS */}
      <div style={{ display:'flex', gap:4, background:'#F1F5F9', padding:4, borderRadius:12, marginBottom:24 }}>
        {TABS.map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key as any)}
            style={{ flex:1, padding:'9px 14px', borderRadius:10, border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
              background:tab===tb.key?'#fff':'transparent', color:tab===tb.key?'#0F1E35':'#5A6E8A',
              boxShadow:tab===tb.key?'0 2px 8px rgba(27,58,107,0.08)':'none' }}>
            {tb.label}
          </button>
        ))}
      </div>

      {/* ── PROFIL ── */}
      {tab === 'profil' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E2E8F0', padding:24 }}>
            <h3 style={{ fontFamily:'Syne,sans-serif', fontWeight:700, marginBottom:16, color:'#0F1E35' }}>{t.investors.personal_info}</h3>
            {[
              [lang==='fr'?'Nom complet':'Full name', inv.full_name],
              ['Email', inv.email],
              [lang==='fr'?'Téléphone':'Phone', inv.phone||'—'],
              [lang==='fr'?'Pays':'Country', inv.country],
              [lang==='fr'?'Nationalité':'Nationality', inv.nationality||'—'],
              [lang==='fr'?'Adresse':'Address', inv.address||'—'],
            ].map(([l,v]) => (
              <div key={String(l)} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #F1F5F9' }}>
                <span style={{ color:'#5A6E8A', fontSize:13 }}>{l}</span>
                <span style={{ color:'#0F1E35', fontWeight:600, fontSize:13 }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E2E8F0', padding:24 }}>
            <h3 style={{ fontFamily:'Syne,sans-serif', fontWeight:700, marginBottom:16, color:'#0F1E35' }}>{t.investors.compliance}</h3>
            {[
              ['KYC', KYC_L[inv.kyc_status]?.[lang] ?? inv.kyc_status],
              [lang==='fr'?'Membre PIC':'PIC Member', inv.pic_member?(lang==='fr'?`✅ Oui${inv.pic_fee_paid?` (frais payés)`:` (frais en attente)`}`:`✅ Yes${inv.pic_fee_paid?` (fees paid)`:` (fees pending)`}`):(lang==='fr'?'❌ Non':'❌ No')],
              [lang==='fr'?'DIA Signé':'DIA Signed', inv.dia_signed?(lang==='fr'?'✅ Oui':'✅ Yes'):(lang==='fr'?'❌ Non':'❌ No')],
              [lang==='fr'?'Profil risque':'Risk profile', inv.risk_profile==='conservative'?(lang==='fr'?'Conservateur':'Conservative'):inv.risk_profile==='aggressive'?(lang==='fr'?'Agressif':'Aggressive'):(lang==='fr'?'Modéré':'Moderate')],
              [lang==='fr'?'Type pièce ID':'ID type', inv.id_type||'—'],
              [lang==='fr'?'Numéro ID':'ID number', inv.id_number||'—'],
              [lang==='fr'?'Inscrit le':'Registered', new Date(inv.created_at).toLocaleDateString(lang==='fr'?'fr-FR':'en-GB')],
              [lang==='fr'?'Statut compte':'Account status', isArchived?(lang==='fr'?'📦 Archivé':'📦 Archived'):(lang==='fr'?'✅ Actif':'✅ Active')],
              [lang==='fr'?'Compte app lié':'App account linked', inv.user_id?(lang==='fr'?`✅ Lié (${inv.user_id.slice(0,8)}…)`:`✅ Linked (${inv.user_id.slice(0,8)}…)`):(lang==='fr'?'⚠️ Non lié — KYC non accessible depuis l\'app':'⚠️ Not linked — KYC not readable from app')],
            ].map(([l,v]) => (
              <div key={String(l)} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #F1F5F9' }}>
                <span style={{ color:'#5A6E8A', fontSize:13 }}>{l}</span>
                <span style={{ color: String(v).startsWith('⚠️') ? '#D97706' : '#0F1E35', fontWeight:600, fontSize:13 }}>{v}</span>
              </div>
            ))}
            {!inv.user_id && (
              <LinkAccountForm investorId={id} lang={lang} onLinked={() => load()} />
            )}
            {inv.kyc_rejection_reason && (
              <div style={{ marginTop:12, padding:10, background:'#FEF2F2', borderRadius:8, border:'1px solid #FECACA' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#991B1B', marginBottom:2 }}>
                  {lang==='fr'?'Motif de rejet KYC :':'KYC rejection reason:'}
                </div>
                <div style={{ fontSize:12, color:'#7F1D1D' }}>{inv.kyc_rejection_reason}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── KYC DOCUMENTS ── */}
      {tab === 'kyc' && (
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

          {/* KYC status banner */}
          <div style={{ padding:'16px 20px', borderRadius:14, border:`2px solid ${KYC_C[inv.kyc_status]}40`, background:`${KYC_B[inv.kyc_status]}`, display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ fontSize:32 }}>
              {inv.kyc_status==='approved'?'✅':inv.kyc_status==='rejected'?'❌':inv.kyc_status==='in_review'?'🔍':'⏳'}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:16, color:KYC_C[inv.kyc_status] }}>
                KYC : {KYC_L[inv.kyc_status]?.[lang]}
              </div>
              <div style={{ fontSize:13, color:'#5A6E8A', marginTop:2 }}>
                {inv.kyc_status==='pending'
                  ? (lang==='fr'?'Documents soumis — en attente de vérification manuelle':'Documents submitted — awaiting manual review')
                  : inv.kyc_status==='in_review'
                  ? (lang==='fr'?'Vérification en cours par l\'équipe':'Under review by the team')
                  : inv.kyc_status==='approved'
                  ? (lang==='fr'?'Identité vérifiée et approuvée':'Identity verified and approved')
                  : (lang==='fr'?`Rejeté${inv.kyc_rejection_reason ? ` — ${inv.kyc_rejection_reason}` : ''}`:
                               `Rejected${inv.kyc_rejection_reason ? ` — ${inv.kyc_rejection_reason}` : ''}`)}
              </div>
            </div>
            {/* Quick approve / reject buttons */}
            {inv.kyc_status !== 'approved' && (
              <button onClick={() => updateKyc('approved')}
                style={{ padding:'9px 18px', borderRadius:10, border:'none', background:'#16a34a', color:'#fff', cursor:'pointer', fontWeight:700, fontSize:13, whiteSpace:'nowrap' }}>
                ✅ {lang==='fr'?'Approuver':'Approve'}
              </button>
            )}
            {inv.kyc_status !== 'rejected' && (
              <button onClick={() => setShowRejectBox(v => !v)}
                style={{ padding:'9px 18px', borderRadius:10, border:'2px solid #E63946', background:'#fff', color:'#E63946', cursor:'pointer', fontWeight:700, fontSize:13, whiteSpace:'nowrap' }}>
                ❌ {lang==='fr'?'Rejeter':'Reject'}
              </button>
            )}
          </div>

          {/* Rejection reason box */}
          {showRejectBox && (
            <div style={{ background:'#FEF2F2', borderRadius:12, border:'1px solid #FECACA', padding:18 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#991B1B', marginBottom:8 }}>
                {lang==='fr'?'Motif du rejet (envoyé à l\'investisseur) :':'Rejection reason (sent to investor):'}
              </div>
              <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} rows={3}
                placeholder={lang==='fr'?'Ex: Photo floue, document expiré, selfie non conforme...':'E.g. Blurry photo, expired document, non-conforming selfie...'}
                style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1px solid #FECACA', fontSize:13, outline:'none', resize:'vertical', fontFamily:'Outfit,sans-serif', background:'#fff' }} />
              <div style={{ display:'flex', gap:8, marginTop:10 }}>
                <button onClick={() => setShowRejectBox(false)}
                  style={{ padding:'8px 16px', borderRadius:8, border:'1px solid #E2E8F0', background:'#fff', cursor:'pointer', fontSize:12, fontWeight:600, color:'#5A6E8A' }}>
                  {lang==='fr'?'Annuler':'Cancel'}
                </button>
                <button onClick={() => updateKyc('rejected', rejectionReason)}
                  style={{ padding:'8px 20px', borderRadius:8, border:'none', background:'#E63946', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:700 }}>
                  {lang==='fr'?'Confirmer le rejet':'Confirm rejection'}
                </button>
              </div>
            </div>
          )}

          {/* Document photos */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:'#5A6E8A', textTransform:'uppercase', marginBottom:10, letterSpacing:'0.5px' }}>
                🪪 {lang==='fr'?`Pièce d'identité — Recto`:'ID Document — Front'}
              </div>
              <DocImage url={kyc_docs.id_front} label={lang==='fr'?'Recto pièce ID':'ID Front'} lang={lang} />
            </div>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:'#5A6E8A', textTransform:'uppercase', marginBottom:10, letterSpacing:'0.5px' }}>
                🪪 {lang==='fr'?`Pièce d'identité — Verso`:'ID Document — Back'}
              </div>
              <DocImage url={kyc_docs.id_back} label={lang==='fr'?'Verso pièce ID':'ID Back'} lang={lang} />
            </div>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:'#5A6E8A', textTransform:'uppercase', marginBottom:10, letterSpacing:'0.5px' }}>
                🤳 {lang==='fr'?'Selfie de vérification':'Verification Selfie'}
              </div>
              <DocImage url={kyc_docs.selfie} label={lang==='fr'?'Selfie':'Selfie'} lang={lang} />
            </div>
          </div>

          {/* Checklist */}
          <div style={{ background:'#fff', borderRadius:14, border:'1px solid #E2E8F0', padding:20 }}>
            <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:14, color:'#0F1E35', marginBottom:14 }}>
              {lang==='fr'?'✅ Checklist de vérification':'✅ Verification Checklist'}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {[
                lang==='fr'?'Le nom sur la pièce correspond au profil':'Name on ID matches profile',
                lang==='fr'?'La pièce n\'est pas expirée':'ID is not expired',
                lang==='fr'?'Les 4 coins de la pièce sont visibles':'All 4 corners of ID are visible',
                lang==='fr'?'La photo est nette et lisible':'Photo is clear and legible',
                lang==='fr'?'Le selfie montre clairement le visage':'Selfie clearly shows the face',
                lang==='fr'?'Le selfie correspond à la photo de la pièce':'Selfie matches ID photo',
              ].map((item, i) => (
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'8px 12px', borderRadius:8, background:'#F8FAFC', border:'1px solid #E2E8F0' }}>
                  <span style={{ color:'#94A3B8', fontSize:14, flexShrink:0 }}>☐</span>
                  <span style={{ fontSize:12, color:'#374151', lineHeight:1.4 }}>{item}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop:14, padding:'10px 14px', background:'#F0F9FF', borderRadius:10, border:'1px solid #BAE6FD', fontSize:12, color:'#0369A1' }}>
              ℹ️ {lang==='fr'
                ? 'Cochez mentalement chaque point avant d\'approuver. Le refus doit être motivé avec un message clair envoyé à l\'investisseur.'
                : 'Mentally check each point before approving. Rejection must be motivated with a clear message sent to the investor.'}
            </div>
          </div>

          {/* Investor info summary for cross-check */}
          <div style={{ background:'#fff', borderRadius:14, border:'1px solid #E2E8F0', padding:20 }}>
            <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:14, color:'#0F1E35', marginBottom:12 }}>
              {lang==='fr'?'📋 Informations déclarées à croiser':'📋 Declared information to cross-check'}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
              {[
                [lang==='fr'?'Nom complet':'Full name', inv.full_name],
                [lang==='fr'?'Nationalité':'Nationality', inv.nationality||'—'],
                [lang==='fr'?'Type pièce ID':'ID type', inv.id_type||'—'],
                [lang==='fr'?'Numéro ID':'ID number', inv.id_number||'—'],
                [lang==='fr'?'Pays':'Country', inv.country||'—'],
                ['Email', inv.email],
              ].map(([l,v]) => (
                <div key={String(l)} style={{ padding:'10px 14px', background:'#F8FAFC', borderRadius:8, border:'1px solid #E2E8F0' }}>
                  <div style={{ fontSize:10, color:'#94A3B8', fontWeight:700, textTransform:'uppercase', marginBottom:4 }}>{l}</div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#0F1E35' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── PROJETS ── */}
      {tab === 'projets' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {subs.length === 0 ? (
            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E2E8F0', padding:48, textAlign:'center', color:'#94A3B8' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
              <div>{t.investors.no_subscriptions}</div>
            </div>
          ) : subs.map((sub: any) => {
            const paid = (sub.tranches ?? []).filter((t:any) => t.status==='received').reduce((s:number,t:any) => s+(t.received_amount_ngn||0), 0);
            const progress = sub.total_amount_ngn > 0 ? Math.round(paid * 100 / sub.total_amount_ngn) : 0;
            return (
              <div key={sub.id} style={{ background:'#fff', borderRadius:16, border:'1px solid #E2E8F0', padding:24 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
                  <div>
                    <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:18, color:'#0F1E35', marginBottom:4 }}>{sub.project?.name ?? 'Projet'}</div>
                    <div style={{ display:'flex', gap:8 }}>
                      <span style={{ fontSize:11, padding:'3px 10px', borderRadius:999, background:'#DBEAFE', color:'#1E40AF', fontWeight:600 }}>{sub.project?.type?.replace(/_/g,' ')}</span>
                      <span style={{ fontSize:11, padding:'3px 10px', borderRadius:999, background:'#F1F5F9', color:'#374151', fontWeight:600 }}>Réf: {sub.dia_reference}</span>
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:22, fontWeight:800, color:'#1B3A6B', fontFamily:'Syne,sans-serif' }}>{fmt(sub.amount_ngn)}</div>
                    <div style={{ fontSize:12, color:'#94A3B8' }}>+ {fmt(sub.facilitation_fee_ngn)} {lang==='fr'?'frais':'fees'}</div>
                  </div>
                </div>
                <div style={{ marginBottom:16 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#5A6E8A', marginBottom:6 }}>
                    <span>{t.investors.payment_progress}</span>
                    <span style={{ fontWeight:700 }}>{fmt(paid)} / {fmt(sub.total_amount_ngn)} ({progress}%)</span>
                  </div>
                  <div style={{ height:8, background:'#F1F5F9', borderRadius:4, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${progress}%`, background:progress===100?'#16a34a':'#1B3A6B', borderRadius:4 }} />
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {(sub.tranches ?? []).map((t: any) => (
                    <div key={t.id} style={{ padding:'10px 14px', borderRadius:10, background:TR_B[t.status]||'#F1F5F9', border:`1px solid ${TR_B[t.status]}`, flex:'1 1 140px' }}>
                      <div style={{ fontSize:11, fontWeight:700, color:TR_C[t.status]||'#374151' }}>
                        {lang==='fr'?'Tranche':'Instalment'} {t.tranche_number} — {TR_L[t.status]?.[lang]}
                      </div>
                      <div style={{ fontSize:14, fontWeight:800, color:'#0F1E35', margin:'4px 0' }}>{fmt(t.amount_ngn)}</div>
                      {t.due_date && <div style={{ fontSize:11, color:'#94A3B8' }}>{lang==='fr'?'Échéance':'Due'}: {new Date(t.due_date).toLocaleDateString(lang==='fr'?'fr-FR':'en-GB')}</div>}
                      {t.received_date && <div style={{ fontSize:11, color:'#16a34a' }}>{lang==='fr'?'Reçu le':'Received'}: {new Date(t.received_date).toLocaleDateString(lang==='fr'?'fr-FR':'en-GB')}</div>}
                      {t.status === 'received' && (
                        <button onClick={() => openDIAPDF(t, sub)}
                          style={{ marginTop:6, padding:'4px 10px', borderRadius:6, border:'1px solid #1B3A6B', background:'#fff', color:'#1B3A6B', cursor:'pointer', fontSize:11, fontWeight:700 }}>
                          🧾 PDF DIA
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── PAIEMENTS ── */}
      {tab === 'paiements' && (
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E2E8F0', overflow:'hidden' }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid #E2E8F0', fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:16 }}>
            {t.investors.payment_history}
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#F8FAFC' }}>
                {[lang==='fr'?'Projet':'Project', lang==='fr'?'Tranche':'Instalment', lang==='fr'?'Attendu':'Expected', lang==='fr'?'Reçu':'Received', lang==='fr'?'Méthode':'Method', lang==='fr'?'Échéance':'Due', lang==='fr'?'Reçu le':'Received', 'Statut', 'PDF'].map(h => (
                  <th key={h} style={{ textAlign:'left', padding:'10px 16px', fontSize:11, color:'#94A3B8', textTransform:'uppercase', fontWeight:700, borderBottom:'1px solid #E2E8F0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tranches.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign:'center', padding:40, color:'#94A3B8' }}>{lang==='fr'?'Aucun paiement':'No payments'}</td></tr>
              ) : tranches.map((t: any, i: number) => {
                const sub = subs.find((s: any) => s.id === t.subscription?.id);
                return (
                  <tr key={t.id} style={{ borderBottom:i<tranches.length-1?'1px solid #F1F5F9':'none' }}>
                    <td style={{ padding:'12px 16px', fontSize:13, fontWeight:600, color:'#0F1E35' }}>{t.subscription?.project?.name ?? '—'}</td>
                    <td style={{ padding:'12px 16px' }}><span style={{ fontSize:12, fontWeight:700, padding:'2px 8px', borderRadius:6, background:'#EFF6FF', color:'#1E40AF' }}>#{t.tranche_number}</span></td>
                    <td style={{ padding:'12px 16px', fontSize:13, fontWeight:600 }}>{fmt(t.amount_ngn)}</td>
                    <td style={{ padding:'12px 16px', fontSize:13, fontWeight:700, color:'#16a34a' }}>{t.received_amount_ngn ? fmt(t.received_amount_ngn) : '—'}</td>
                    <td style={{ padding:'12px 16px', fontSize:12, color:'#5A6E8A' }}>{t.payment_method?.replace(/_/g,' ') ?? '—'}</td>
                    <td style={{ padding:'12px 16px', fontSize:12, color:'#5A6E8A' }}>{t.due_date ? new Date(t.due_date).toLocaleDateString(lang==='fr'?'fr-FR':'en-GB') : '—'}</td>
                    <td style={{ padding:'12px 16px', fontSize:12, color:'#16a34a' }}>{t.received_date ? new Date(t.received_date).toLocaleDateString(lang==='fr'?'fr-FR':'en-GB') : '—'}</td>
                    <td style={{ padding:'12px 16px' }}>
                      <span style={{ fontSize:11, padding:'3px 8px', borderRadius:999, fontWeight:600, background:TR_B[t.status], color:TR_C[t.status] }}>
                        {TR_L[t.status]?.[lang] ?? t.status}
                      </span>
                    </td>
                    <td style={{ padding:'12px 16px' }}>
                      {t.status === 'received' && t.subscription && (
                        <button onClick={() => openDIAPDF(t, t.subscription)}
                          style={{ padding:'5px 10px', borderRadius:6, border:'1px solid #1B3A6B', background:'#fff', color:'#1B3A6B', cursor:'pointer', fontSize:11, fontWeight:700 }}>
                          🧾 PDF
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ABONNEMENT ── */}
      {tab === 'abonnement' && (
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          {/* Status banner */}
          <div style={{ padding:'20px 24px', borderRadius:14, border:`2px solid ${subStatus==='active'?'#16a34a':subStatus==='expired'?'#E63946':'#D97706'}40`,
            background: subStatus==='active'?'#F0FDF4':subStatus==='expired'?'#FEF2F2':'#FFFBEB',
            display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ fontSize:40 }}>
              {subStatus==='active'?'✅':subStatus==='expired'?'❌':'⏳'}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:18,
                color: subStatus==='active'?'#166534':subStatus==='expired'?'#991B1B':'#92400E' }}>
                {subStatus==='active'
                  ? (lang==='fr'?'Abonnement actif':'Active subscription')
                  : subStatus==='expired'
                  ? (lang==='fr'?'Abonnement expiré — accès suspendu':'Expired subscription — access suspended')
                  : (lang==='fr'?'Abonnement non activé':'Subscription not activated')}
              </div>
              <div style={{ fontSize:13, color:'#5A6E8A', marginTop:4 }}>
                {lang==='fr'?'Cotisation annuelle :':'Annual fee:'} <strong>50 000 FCFA</strong>
                {subStatus==='active' && daysLeft !== null && (
                  <span style={{ marginLeft:12, fontWeight:700, color: daysLeft<=30?'#E63946':daysLeft<=60?'#D97706':'#16a34a' }}>
                    · {daysLeft} {t.investors.sub_days_left}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display:'flex', gap:10, flexShrink:0 }}>
              {subStatus !== 'active' && (
                <button onClick={() => updateSubscription('activate')} disabled={updatingSub}
                  style={{ padding:'10px 18px', borderRadius:9, border:'none', background:'#16a34a', color:'#fff', cursor:'pointer', fontWeight:700, fontSize:13, opacity:updatingSub?0.7:1 }}>
                  {updatingSub ? '…' : t.investors.sub_activate}
                </button>
              )}
              {subStatus === 'active' && (
                <button onClick={() => updateSubscription('renew')} disabled={updatingSub}
                  style={{ padding:'10px 18px', borderRadius:9, border:'1px solid #1B3A6B', background:'rgba(27,58,107,0.06)', color:'#1B3A6B', cursor:'pointer', fontWeight:700, fontSize:13, opacity:updatingSub?0.7:1 }}>
                  {updatingSub ? '…' : t.investors.sub_renew}
                </button>
              )}
              {subStatus === 'expired' && (
                <button onClick={() => updateSubscription('activate')} disabled={updatingSub}
                  style={{ padding:'10px 18px', borderRadius:9, border:'none', background:'#1B3A6B', color:'#fff', cursor:'pointer', fontWeight:700, fontSize:13, opacity:updatingSub?0.7:1 }}>
                  {updatingSub ? '…' : lang==='fr'?'♻️ Renouveler':'♻️ Renew'}
                </button>
              )}
            </div>
          </div>

          {/* Dates & details */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E2E8F0', padding:24 }}>
              <h3 style={{ fontFamily:'Syne,sans-serif', fontWeight:700, marginBottom:16, color:'#0F1E35' }}>
                📅 {lang==='fr'?'Dates d\'abonnement':'Subscription Dates'}
              </h3>
              {[
                [t.investors.sub_status, subStatus==='active'?t.investors.sub_active:subStatus==='expired'?t.investors.sub_expired:t.investors.sub_pending],
                [t.investors.sub_start, inv.subscription_start_date ? new Date(inv.subscription_start_date).toLocaleDateString(lang==='fr'?'fr-FR':'en-GB') : '—'],
                [t.investors.sub_end, inv.subscription_end_date ? new Date(inv.subscription_end_date).toLocaleDateString(lang==='fr'?'fr-FR':'en-GB') : '—'],
                [lang==='fr'?'Jours restants':'Days remaining', subStatus==='active' && daysLeft !== null ? `${daysLeft} ${lang==='fr'?'jours':'days'}` : '—'],
              ].map(([l,v]) => (
                <div key={String(l)} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #F1F5F9' }}>
                  <span style={{ color:'#5A6E8A', fontSize:13 }}>{l}</span>
                  <span style={{ color:'#0F1E35', fontWeight:600, fontSize:13 }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E2E8F0', padding:24 }}>
              <h3 style={{ fontFamily:'Syne,sans-serif', fontWeight:700, marginBottom:16, color:'#0F1E35' }}>
                ℹ️ {lang==='fr'?'Conditions d\'accès':'Access Conditions'}
              </h3>
              {[
                [lang==='fr'?'Frais annuels':'Annual fee', '50 000 FCFA'],
                [lang==='fr'?'Durée':'Duration', lang==='fr'?'365 jours à partir de l\'activation':'365 days from activation'],
                ['KYC', inv.kyc_status==='approved'?(lang==='fr'?'✅ Approuvé':'✅ Approved'):(lang==='fr'?'⚠️ Requis pour investir':'⚠️ Required to invest')],
                [lang==='fr'?'Accès projets':'Project access', subStatus==='active'?(lang==='fr'?'✅ Actif':'✅ Active'):(lang==='fr'?'❌ Suspendu':'❌ Suspended')],
                [lang==='fr'?'Notifications projets':'Project notifications', subStatus!=='pending'?(lang==='fr'?'✅ Actives (même à expiration)':'✅ Active (even on expiry)'):'—'],
              ].map(([l,v]) => (
                <div key={String(l)} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #F1F5F9' }}>
                  <span style={{ color:'#5A6E8A', fontSize:13 }}>{l}</span>
                  <span style={{ color:'#0F1E35', fontWeight:600, fontSize:13 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Reminder schedule */}
          {subStatus === 'active' && inv.subscription_end_date && (
            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E2E8F0', padding:24 }}>
              <h3 style={{ fontFamily:'Syne,sans-serif', fontWeight:700, marginBottom:12, color:'#0F1E35' }}>
                📧 {lang==='fr'?'Rappels automatiques programmés':'Scheduled Automatic Reminders'}
              </h3>
              <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                {[60, 30, 14, 7].map(d => {
                  const reminderDate = new Date(new Date(inv.subscription_end_date).getTime() - d * 86400000);
                  const isPast = reminderDate < new Date();
                  return (
                    <div key={d} style={{ flex:1, minWidth:120, padding:'12px 16px', borderRadius:10, border:'1px solid',
                      borderColor: isPast?'#CBD5E1':'#C9963A',
                      background: isPast?'#F8FAFC':'#FFFBEB' }}>
                      <div style={{ fontSize:18, marginBottom:4 }}>{isPast?'✅':'⏰'}</div>
                      <div style={{ fontWeight:700, fontSize:13, color: isPast?'#94A3B8':'#92400E' }}>J-{d}</div>
                      <div style={{ fontSize:11, color:'#94A3B8', marginTop:2 }}>
                        {reminderDate.toLocaleDateString(lang==='fr'?'fr-FR':'en-GB')}
                      </div>
                      <div style={{ fontSize:11, color: isPast?'#94A3B8':'#5A6E8A', marginTop:2 }}>
                        {isPast?(lang==='fr'?'Envoyé':'Sent'):(lang==='fr'?'Programmé':'Scheduled')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── NOTES ── */}
      {tab === 'notes' && (
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E2E8F0', padding:24 }}>
          <h3 style={{ fontFamily:'Syne,sans-serif', fontWeight:700, marginBottom:8, color:'#0F1E35' }}>{t.investors.internal_notes}</h3>
          <p style={{ color:'#94A3B8', fontSize:13, marginBottom:16 }}>{t.investors.notes_hint}</p>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={12}
            placeholder={lang==='fr'?'Ajoutez des notes internes...':'Add internal notes...'}
            style={{ width:'100%', padding:'12px 16px', borderRadius:10, border:'1px solid #E2E8F0', fontSize:14, outline:'none', resize:'vertical', fontFamily:'Outfit,sans-serif', lineHeight:1.6 }} />
          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:12 }}>
            <button onClick={saveNotes} disabled={savingNote}
              style={{ padding:'10px 24px', borderRadius:10, border:'none', background:'#1B3A6B', color:'#fff', cursor:'pointer', fontWeight:700, opacity:savingNote?0.7:1 }}>
              {savingNote ? (lang==='fr'?'Sauvegarde...':'Saving...') : t.investors.save_notes}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
