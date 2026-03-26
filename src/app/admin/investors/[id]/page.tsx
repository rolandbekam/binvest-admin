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

export default function InvestorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lang, setL] = useState<Lang>('fr');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'profil'|'projets'|'paiements'|'notes'>('profil');
  const [editKyc, setEditKyc] = useState('');
  const [notes, setNotes] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

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

  const updateKyc = async (status: string) => {
    await fetch(`/api/admin/investors/${id}`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      credentials:'include', body: JSON.stringify({ kyc_status: status }),
    });
    toast.success(lang === 'fr' ? 'Statut KYC mis à jour' : 'KYC status updated');
    load();
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
      if (d.preview) {
        toast.success(lang === 'fr' ? `📧 Email simulé (configurez RESEND_API_KEY pour l'envoi réel)` : `📧 Email simulated (configure RESEND_API_KEY for real sending)`);
      } else {
        toast.success(lang === 'fr' ? `📧 Email envoyé à ${data?.investor?.email}` : `📧 Email sent to ${data?.investor?.email}`);
      }
    } catch { toast.error(lang === 'fr' ? 'Erreur envoi email' : 'Email send error'); }
    setSendingEmail(false);
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

  // Données démo si API pas encore connectée
  const inv = data?.investor ?? {
    full_name:'Jean Paul Mbarga', email:'jp@binvest.ng', phone:'+237 6XX XXX XXX',
    country:'CM', nationality:'Camerounaise', id_type:'passport', address:'Yaoundé, Cameroun',
    pic_member:true, pic_fee_paid:true, dia_signed:true, kyc_status:'approved',
    risk_profile:'moderate', total_invested_ngn:2000000, created_at:'2026-01-15T00:00:00Z', notes:'',
  };
  const subs = data?.subscriptions ?? [
    { id:'s1', project:{ name:'Land Banking Lagos North', type:'land_banking', status:'open' }, status:'complete', amount_ngn:2000000, facilitation_fee_ngn:200000, total_amount_ngn:2200000, tranches_count:2, dia_reference:'DIA-2026-A1B2C3D4', created_at:'2026-01-15T00:00:00Z',
      tranches:[
        { id:'t1', tranche_number:1, amount_ngn:1200000, status:'received', received_amount_ngn:1200000, received_date:'2026-01-18', due_date:'2026-01-15', payment_method:'bank_transfer', bank_reference:'TRF202601180' },
        { id:'t2', tranche_number:2, amount_ngn:1000000, status:'received', received_amount_ngn:1000000, received_date:'2026-03-20', due_date:'2026-03-15', payment_method:'bank_transfer', bank_reference:'TRF202603200' },
      ]
    },
  ];
  const tranches = data?.tranches ?? subs.flatMap((s: any) => s.tranches ?? []);

  const totalPaid = tranches.filter((t:any) => t.status === 'received').reduce((s:number,t:any) => s+(t.received_amount_ngn||0), 0);
  const totalPending = tranches.filter((t:any) => t.status === 'pending').reduce((s:number,t:any) => s+t.amount_ngn, 0);
  const totalLate = tranches.filter((t:any) => t.status === 'late').reduce((s:number,t:any) => s+t.amount_ngn, 0);
  const initials = inv.full_name?.split(' ').map((n:string) => n[0]).join('').slice(0,2).toUpperCase() ?? '??';

  const TABS = [
    { key:'profil', label:`👤 ${lang==='fr'?t.investors.personal_info:'Profile'}` },
    { key:'projets', label:`📋 ${lang==='fr'?'Projets':'Projects'} (${subs.length})` },
    { key:'paiements', label:`💰 ${lang==='fr'?'Paiements':'Payments'} (${tranches.length})` },
    { key:'notes', label:`📝 ${lang==='fr'?'Notes':'Notes'}` },
  ];

  return (
    <div style={{ fontFamily:'Outfit,sans-serif' }}>
      {/* Back */}
      <button onClick={() => router.push('/admin/investors')}
        style={{ background:'none', border:'none', cursor:'pointer', color:'#5A6E8A', fontSize:14, marginBottom:20, display:'flex', alignItems:'center', gap:6, padding:0 }}>
        {t.common.back} {lang==='fr'?'aux investisseurs':'to investors'}
      </button>

      {/* Header investisseur */}
      <div style={{ background:'#fff', borderRadius:20, border:'1px solid #E2E8F0', padding:28, marginBottom:24, boxShadow:'0 2px 12px rgba(27,58,107,0.06)' }}>
        {/* Kente */}
        <div style={{ display:'flex', height:4, borderRadius:2, overflow:'hidden', marginBottom:20 }}>
          {['#1B3A6B','#E63946','#C9963A','#0D2347','#1B3A6B','#E63946','#C9963A','#0D2347'].map((c,i) => (
            <div key={i} style={{ flex:1, background:c }} />
          ))}
        </div>

        <div style={{ display:'flex', gap:20, alignItems:'flex-start' }}>
          {/* Avatar */}
          <div style={{ width:72, height:72, borderRadius:'50%', background:'linear-gradient(135deg,#1B3A6B,#2E5BA8)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:26, fontWeight:900, fontFamily:'Syne,sans-serif', flexShrink:0, border:'3px solid #C9963A', boxShadow:'0 4px 16px rgba(27,58,107,0.25)' }}>
            {initials}
          </div>

          {/* Infos */}
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:6 }}>
              <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:24, fontWeight:800, color:'#0F1E35', margin:0 }}>{inv.full_name}</h2>
              <span style={{ fontSize:11, fontWeight:700, padding:'4px 12px', borderRadius:999, background:KYC_B[inv.kyc_status], color:KYC_C[inv.kyc_status] }}>
                KYC: {KYC_L[inv.kyc_status]?.[lang] ?? inv.kyc_status}
              </span>
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

          {/* Actions email */}
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
          </div>
        </div>

        {/* Stats financières */}
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
                <span style={{ fontSize:10, color:'#94A3B8', fontWeight:600, textTransform:'uppercase', fontSize:10 }}>{s.label}</span>
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
              [lang==='fr'?'DIA Signé':'DIA Signed', inv.dia_signed?(lang==='fr'?`✅ Oui${inv.dia_signed_date?` le ${new Date(inv.dia_signed_date).toLocaleDateString('fr-FR')}`:''}`:`)✅ Yes`):(lang==='fr'?'❌ Non':'❌ No')],
              [lang==='fr'?'Profil risque':'Risk profile', inv.risk_profile==='conservative'?(lang==='fr'?'Conservateur':'Conservative'):inv.risk_profile==='aggressive'?(lang==='fr'?'Agressif':'Aggressive'):(lang==='fr'?'Modéré':'Moderate')],
              [lang==='fr'?'Type pièce ID':'ID type', inv.id_type||'—'],
              [lang==='fr'?'Inscrit le':'Registered', new Date(inv.created_at).toLocaleDateString(lang==='fr'?'fr-FR':'en-GB')],
            ].map(([l,v]) => (
              <div key={String(l)} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #F1F5F9' }}>
                <span style={{ color:'#5A6E8A', fontSize:13 }}>{l}</span>
                <span style={{ color:'#0F1E35', fontWeight:600, fontSize:13 }}>{v}</span>
              </div>
            ))}
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
              <div key={sub.id} style={{ background:'#fff', borderRadius:16, border:'1px solid #E2E8F0', padding:24, boxShadow:'0 2px 8px rgba(27,58,107,0.04)' }}>
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
                const sub = subs.find((s: any) => (s.tranches ?? []).some((tr: any) => tr.id === t.id));
                return (
                  <tr key={t.id} style={{ borderBottom:i<tranches.length-1?'1px solid #F1F5F9':'none' }}>
                    <td style={{ padding:'12px 16px', fontSize:13, fontWeight:600, color:'#0F1E35' }}>{sub?.project?.name ?? '—'}</td>
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
                      {t.status === 'received' && sub && (
                        <button onClick={() => openDIAPDF(t, sub)}
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
