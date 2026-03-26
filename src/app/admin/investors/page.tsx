'use client';
// src/app/admin/investors/page.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

const KYC_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  pending:   { bg:'#FEF9C3', text:'#854D0E', label:'En attente' },
  in_review: { bg:'#DBEAFE', text:'#1E40AF', label:'En cours' },
  approved:  { bg:'#DCFCE7', text:'#166534', label:'Approuvé' },
  rejected:  { bg:'#FEE2E2', text:'#991B1B', label:'Rejeté' },
};

const EMPTY_FORM = {
  full_name:'', email:'', phone:'', country:'CM', nationality:'',
  id_type:'passport', id_number_encrypted:'',
  address:'', pic_member:false, kyc_status:'pending', notes:'',
};

export default function InvestorsPage() {
  const router = useRouter();
  const [investors, setInvestors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const r = await fetch('/api/admin/investors', { credentials:'include' });
    const d = await r.json();
    setInvestors(d.investors ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.full_name || !form.email) { toast.error('Nom et email obligatoires'); return; }
    setSaving(true);
    const r = await fetch('/api/admin/investors', {
      method:'POST', headers:{'Content-Type':'application/json'},
      credentials:'include', body: JSON.stringify(form),
    });
    const d = await r.json();
    if (!r.ok) { toast.error(d.error ?? 'Erreur'); setSaving(false); return; }
    toast.success('Investisseur ajouté !');
    setShowModal(false); setSaving(false); setForm(EMPTY_FORM);
    load();
  };

  const filtered = investors.filter(i =>
    !search || i.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    i.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ fontFamily:'Outfit,sans-serif' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:24, fontWeight:800, color:'#0F1E35', margin:0 }}>Investisseurs</h2>
          <p style={{ color:'#5A6E8A', fontSize:14, marginTop:4 }}>{investors.length} investisseur(s) enregistré(s)</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ background:'#1B3A6B', color:'#fff', border:'none', borderRadius:10, padding:'10px 20px', fontWeight:700, cursor:'pointer', fontSize:14 }}>
          ➕ Ajouter
        </button>
      </div>

      {/* Stats rapides */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
        {[
          { label:'Total', value: investors.length, color:'#1B3A6B' },
          { label:'KYC Approuvé', value: investors.filter(i=>i.kyc_status==='approved').length, color:'#16a34a' },
          { label:'Membres PIC', value: investors.filter(i=>i.pic_member).length, color:'#C9963A' },
          { label:'DIA Signé', value: investors.filter(i=>i.dia_signed).length, color:'#7C3AED' },
        ].map(s => (
          <div key={s.label} style={{ background:'#fff', borderRadius:14, padding:'16px 20px', border:'1px solid #E2E8F0', boxShadow:'0 2px 8px rgba(27,58,107,0.06)' }}>
            <div style={{ fontSize:11, color:'#94A3B8', textTransform:'uppercase', fontWeight:700, marginBottom:4 }}>{s.label}</div>
            <div style={{ fontSize:28, fontWeight:800, color:s.color, fontFamily:'Syne,sans-serif' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ display:'flex', alignItems:'center', gap:8, background:'#fff', border:'1px solid #E2E8F0', borderRadius:10, padding:'8px 14px', marginBottom:16, maxWidth:380 }}>
        <span style={{ color:'#94A3B8' }}>🔍</span>
        <input placeholder="Rechercher par nom ou email..." value={search} onChange={e=>setSearch(e.target.value)}
          style={{ border:'none', outline:'none', fontSize:14, flex:1, fontFamily:'Outfit,sans-serif' }} />
      </div>

      {/* Table */}
      <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E2E8F0', overflow:'hidden', boxShadow:'0 2px 12px rgba(27,58,107,0.06)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'#F8FAFC' }}>
              {['Investisseur','Pays','Capital investi','Projets','PIC','DIA','KYC','Actions'].map(h => (
                <th key={h} style={{ textAlign:'left', padding:'11px 16px', fontSize:11, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.5px', fontWeight:700, borderBottom:'1px solid #E2E8F0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:'#94A3B8' }}>Chargement...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:'#94A3B8' }}>Aucun investisseur</td></tr>
            ) : filtered.map((inv, i) => {
              const kyc = KYC_STYLE[inv.kyc_status] ?? KYC_STYLE.pending;
              const initials = inv.full_name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase() ?? '??';
              return (
                <tr key={inv.id} style={{ borderBottom: i < filtered.length-1 ? '1px solid #F1F5F9' : 'none' }}
                  onMouseEnter={e=>(e.currentTarget.style.background='#F8FAFC')}
                  onMouseLeave={e=>(e.currentTarget.style.background='')}>
                  <td style={{ padding:'14px 16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:34, height:34, borderRadius:'50%', background:'#1B3A6B', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:12, fontWeight:700, flexShrink:0 }}>{initials}</div>
                      <div>
                        <div style={{ fontWeight:600, color:'#0F1E35', fontSize:14 }}>{inv.full_name}</div>
                        <div style={{ color:'#94A3B8', fontSize:12 }}>{inv.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:'14px 16px', color:'#5A6E8A', fontSize:13 }}>{inv.country}</td>
                  <td style={{ padding:'14px 16px', fontWeight:700, color:'#0F1E35', fontSize:13 }}>
                    {inv.total_invested_ngn > 0 ? `₦${(inv.total_invested_ngn/1000000).toFixed(1)}M` : '—'}
                  </td>
                  <td style={{ padding:'14px 16px', color:'#5A6E8A', fontSize:13 }}>{inv.subscriptions_count?.[0]?.count ?? 0}</td>
                  <td style={{ padding:'14px 16px' }}>
                    <span style={{ fontSize:11, padding:'3px 8px', borderRadius:999, fontWeight:600, background: inv.pic_member ? '#DCFCE7' : '#F1F5F9', color: inv.pic_member ? '#166534' : '#94A3B8' }}>
                      {inv.pic_member ? '✓ Oui' : 'Non'}
                    </span>
                  </td>
                  <td style={{ padding:'14px 16px' }}>
                    <span style={{ fontSize:11, padding:'3px 8px', borderRadius:999, fontWeight:600, background: inv.dia_signed ? '#DCFCE7' : '#F1F5F9', color: inv.dia_signed ? '#166534' : '#94A3B8' }}>
                      {inv.dia_signed ? '✓ Signé' : 'Non'}
                    </span>
                  </td>
                  <td style={{ padding:'14px 16px' }}>
                    <span style={{ fontSize:11, padding:'3px 8px', borderRadius:999, fontWeight:600, background:kyc.bg, color:kyc.text }}>
                      {kyc.label}
                    </span>
                  </td>
                  <td style={{ padding:'14px 16px' }}>
                    <button onClick={() => router.push(`/admin/investors/${inv.id}`)}
                      style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #1B3A6B', background:'#fff', color:'#1B3A6B', cursor:'pointer', fontSize:12, fontWeight:700 }}>
                      Voir le profil →
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal ajout */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}
          onClick={e=>{ if(e.target===e.currentTarget) setShowModal(false); }}>
          <div style={{ background:'#fff', borderRadius:20, padding:28, width:520, maxHeight:'90vh', overflowY:'auto' }}>
            <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:20, fontWeight:700, marginBottom:20 }}>👤 Nouvel investisseur</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              {[
                {label:'Nom complet *', key:'full_name', span:2},
                {label:'Email *', key:'email', type:'email'},
                {label:'Téléphone', key:'phone', type:'tel'},
                {label:'Pays', key:'country'},
                {label:'Nationalité', key:'nationality'},
                {label:'Type de pièce ID', key:'id_type', type:'select', options:[{value:'passport',label:'Passeport'},{value:'cni',label:'CNI'},{value:'residence',label:'Titre de séjour'}]},
                {label:'Numéro pièce ID', key:'id_number_encrypted'},
                {label:'Adresse', key:'address', span:2},
                {label:'Statut KYC', key:'kyc_status', type:'select', options:Object.entries(KYC_STYLE).map(([v,s])=>({value:v,label:s.label}))},
                {label:'Notes', key:'notes', span:2},
              ].map(f => (
                <div key={f.key} style={{ gridColumn: f.span===2 ? 'span 2' : 'span 1' }}>
                  <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:5 }}>{f.label}</label>
                  {f.type==='select' ? (
                    <select value={form[f.key]} onChange={e=>setForm({...form,[f.key]:e.target.value})}
                      style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid #E2E8F0', fontSize:14, outline:'none' }}>
                      {f.options?.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input type={f.type||'text'} value={form[f.key]} onChange={e=>setForm({...form,[f.key]:e.target.value})}
                      style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid #E2E8F0', fontSize:14, outline:'none' }} />
                  )}
                </div>
              ))}
              <div style={{ gridColumn:'span 2', display:'flex', gap:16 }}>
                {[{key:'pic_member',label:'Membre PIC'},{key:'dia_signed',label:'DIA Signé'}].map(c=>(
                  <label key={c.key} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:14, fontWeight:500 }}>
                    <input type="checkbox" checked={form[c.key]} onChange={e=>setForm({...form,[c.key]:e.target.checked})} style={{ width:18,height:18 }} />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:24, paddingTop:20, borderTop:'1px solid #E2E8F0' }}>
              <button onClick={()=>{setShowModal(false);setForm(EMPTY_FORM);}} style={{ padding:'10px 20px', borderRadius:10, border:'1px solid #E2E8F0', background:'#fff', cursor:'pointer', fontWeight:600, color:'#5A6E8A' }}>Annuler</button>
              <button onClick={save} disabled={saving} style={{ padding:'10px 24px', borderRadius:10, border:'none', background:'#1B3A6B', color:'#fff', cursor:'pointer', fontWeight:700, opacity:saving?0.7:1 }}>
                {saving ? 'Enregistrement...' : '✅ Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
