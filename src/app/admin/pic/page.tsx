'use client';
// @ts-nocheck
import { useEffect, useState } from 'react';
import { getLang, T, type Lang } from '@/lib/i18n';
import toast from 'react-hot-toast';

const KYC_B: Record<string,string> = { pending:'#FEF9C3', in_review:'#DBEAFE', approved:'#DCFCE7', rejected:'#FEE2E2' };
const KYC_C: Record<string,string> = { pending:'#854D0E', in_review:'#1E40AF', approved:'#166534', rejected:'#991B1B' };
const KYC_L: Record<string,{fr:string;en:string}> = {
  pending:{fr:'En attente',en:'Pending'}, in_review:{fr:'En cours',en:'In review'},
  approved:{fr:'Approuvé',en:'Approved'}, rejected:{fr:'Rejeté',en:'Rejected'},
};
const STATUS_L: Record<string,{fr:string;en:string}> = {
  active:{fr:'Actif',en:'Active'}, closed:{fr:'Fermé',en:'Closed'}, archived:{fr:'Archivé',en:'Archived'},
};

export default function PICPage() {
  const [lang, setL] = useState<Lang>('fr');
  const [pics, setPics] = useState<any[]>([]);
  const [stats, setStats] = useState({ total_pics:0, active_pics:0, total_members:0, total_fees_xaf:0 });
  const [loading, setLoading] = useState(true);
  const [selectedPic, setSelectedPic] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [processing, setProcessing] = useState<string|null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [investorId, setInvestorId] = useState('');
  const [projects, setProjects] = useState<any[]>([]);
  const [form, setForm] = useState({ name:'', project_id:'', max_members:'20', description:'' });

  useEffect(() => {
    setL(getLang());
    const h = () => setL(getLang());
    window.addEventListener('lang-change', h);
    return () => window.removeEventListener('lang-change', h);
  }, []);

  const loadPics = () => {
    setLoading(true);
    fetch('/api/admin/pic', { credentials:'include' })
      .then(r => r.json())
      .then(d => { setPics(d.pics ?? []); if (d.stats) setStats(d.stats); })
      .catch(() => toast.error(lang==='fr'?'Erreur de chargement':'Load error'))
      .finally(() => setLoading(false));
  };

  const loadProjects = () => {
    fetch('/api/admin/projects', { credentials:'include' })
      .then(r => r.json())
      .then(d => setProjects((d.projects ?? []).filter((p:any) => p.allows_pic !== false)))
      .catch(() => {});
  };

  useEffect(() => { loadPics(); loadProjects(); }, []);

  const loadMembers = async (pic: any) => {
    setSelectedPic(pic);
    setLoadingMembers(true);
    try {
      const r = await fetch(`/api/admin/pic/${pic.id}`, { credentials:'include' });
      const d = await r.json();
      setMembers(d.memberships ?? []);
    } catch { toast.error(lang==='fr'?'Erreur':'Error'); }
    setLoadingMembers(false);
  };

  const createPic = async () => {
    if (!form.name.trim()) return toast.error(lang==='fr'?'Nom requis':'Name required');
    const r = await fetch('/api/admin/pic', {
      method:'POST', headers:{'Content-Type':'application/json'},
      credentials:'include',
      body: JSON.stringify({
        name: form.name,
        project_id: form.project_id || undefined,
        max_members: parseInt(form.max_members)||20,
        description: form.description || undefined,
      }),
    });
    const d = await r.json();
    if (!r.ok) { toast.error(d.error ?? 'Erreur'); return; }
    toast.success(lang==='fr'?`✅ PIC "${d.pic.name}" créé`:`✅ PIC "${d.pic.name}" created`);
    setShowCreate(false);
    setForm({ name:'', project_id:'', max_members:'20', description:'' });
    loadPics();
  };

  const addMember = async () => {
    if (!investorId.trim()) return toast.error(lang==='fr'?'ID investisseur requis':'Investor ID required');
    const r = await fetch(`/api/admin/pic/${selectedPic.id}`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      credentials:'include', body: JSON.stringify({ investor_id: investorId.trim() }),
    });
    const d = await r.json();
    if (!r.ok) { toast.error(d.error ?? 'Erreur'); return; }
    toast.success(lang==='fr'
      ? `✅ Membre ajouté — N° ${d.membership.anonymous_number}`
      : `✅ Member added — No. ${d.membership.anonymous_number}`);
    setShowAddMember(false);
    setInvestorId('');
    loadMembers(selectedPic);
    loadPics();
  };

  const doMemberAction = async (membershipId: string, action: string) => {
    const confirmMsg = action === 'revoke'
      ? (lang==='fr'?'Révoquer cette adhésion ?':'Revoke this membership?')
      : action === 'record_fee'
      ? (lang==='fr'?'Confirmer le paiement des frais (50 000 XAF) ?':'Confirm fee payment (50,000 XAF)?')
      : (lang==='fr'?'Dispenser les frais pour ce membre ?':'Waive fee for this member?');
    if (!window.confirm(confirmMsg)) return;
    setProcessing(membershipId + action);
    try {
      const r = await fetch(`/api/admin/pic/${selectedPic.id}`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        credentials:'include', body: JSON.stringify({ membership_id: membershipId, action }),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error ?? 'Erreur'); }
      else {
        const msg = {
          record_fee: lang==='fr'?'✅ Frais enregistrés (50 000 XAF)':'✅ Fee recorded (50,000 XAF)',
          waive_fee: lang==='fr'?'✅ Frais dispensés':'✅ Fee waived',
          revoke: lang==='fr'?'⚠️ Adhésion révoquée':'⚠️ Membership revoked',
        }[action] ?? '✅';
        toast.success(msg);
        loadMembers(selectedPic);
        loadPics();
      }
    } catch { toast.error(lang==='fr'?'Erreur réseau':'Network error'); }
    setProcessing(null);
  };

  const closePic = async (pic: any) => {
    const t = T[lang].pic;
    if (!window.confirm(t.confirm_close_pic)) return;
    const r = await fetch(`/api/admin/pic/${pic.id}`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      credentials:'include', body: JSON.stringify({ status: pic.status === 'active' ? 'closed' : 'active' }),
    });
    const d = await r.json();
    if (!r.ok) { toast.error(d.error ?? 'Erreur'); return; }
    toast.success(pic.status === 'active'
      ? (lang==='fr'?'PIC fermé':'PIC closed')
      : (lang==='fr'?'PIC réouvert':'PIC reopened'));
    if (selectedPic?.id === pic.id) setSelectedPic({ ...selectedPic, status: d.pic.status });
    loadPics();
  };

  const fmtXAF = (n: number) => n >= 1e6 ? `${(n/1e6).toFixed(1)}M XAF` : n >= 1e3 ? `${(n/1e3).toFixed(0)}K XAF` : `${n} XAF`;
  const t = T[lang].pic;

  const kpis = [
    { label: t.total_pics,    value: String(stats.total_pics),    icon:'🏛️', color:'#1B3A6B' },
    { label: t.active_pics,   value: String(stats.active_pics),   icon:'✅', color:'#16a34a' },
    { label: t.total_members, value: String(stats.total_members), icon:'👥', color:'#C9963A' },
    { label: t.fees_paid,     value: fmtXAF(stats.total_fees_xaf), icon:'💰', color:'#0D2347' },
  ];

  return (
    <div style={{ fontFamily:'Outfit,sans-serif' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:24, fontWeight:800, color:'#0F1E35', margin:0 }}>{t.title}</h2>
          <p style={{ color:'#5A6E8A', fontSize:14, marginTop:4 }}>{t.subtitle}</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          style={{ padding:'10px 20px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#1B3A6B,#2E5BA8)', color:'#fff', cursor:'pointer', fontWeight:700, fontSize:13 }}>
          {t.create_pic}
        </button>
      </div>

      {/* Create PIC form */}
      {showCreate && (
        <div style={{ background:'#fff', borderRadius:16, border:'2px solid #C9963A', padding:24, marginBottom:24 }}>
          <h3 style={{ fontFamily:'Syne,sans-serif', fontWeight:700, color:'#0F1E35', marginBottom:16 }}>
            🏛️ {t.create_pic}
          </h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'#5A6E8A', display:'block', marginBottom:4 }}>{t.pic_name}</label>
              <input value={form.name} onChange={e => setForm({...form, name:e.target.value})}
                placeholder={lang==='fr'?'Ex: PIC Palmier 2026':'E.g.: Palm PIC 2026'}
                style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #E2E8F0', fontSize:13, outline:'none', boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'#5A6E8A', display:'block', marginBottom:4 }}>{t.project_link}</label>
              <select value={form.project_id} onChange={e => setForm({...form, project_id:e.target.value})}
                style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #E2E8F0', fontSize:13, outline:'none', background:'#fff', boxSizing:'border-box' }}>
                <option value="">{lang==='fr'?'— Aucun projet associé —':'— No associated project —'}</option>
                {projects.map((p:any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'#5A6E8A', display:'block', marginBottom:4 }}>{t.max_members_label}</label>
              <input type="number" min="2" max="500" value={form.max_members} onChange={e => setForm({...form, max_members:e.target.value})}
                style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #E2E8F0', fontSize:13, outline:'none', boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'#5A6E8A', display:'block', marginBottom:4 }}>{t.description_label}</label>
              <input value={form.description} onChange={e => setForm({...form, description:e.target.value})}
                placeholder={lang==='fr'?'Description optionnelle':'Optional description'}
                style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #E2E8F0', fontSize:13, outline:'none', boxSizing:'border-box' }} />
            </div>
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:16 }}>
            <button onClick={() => setShowCreate(false)}
              style={{ padding:'9px 18px', borderRadius:9, border:'1px solid #E2E8F0', background:'#fff', color:'#5A6E8A', cursor:'pointer', fontWeight:600, fontSize:13 }}>
              {t.cancel}
            </button>
            <button onClick={createPic}
              style={{ padding:'9px 18px', borderRadius:9, border:'none', background:'#1B3A6B', color:'#fff', cursor:'pointer', fontWeight:700, fontSize:13 }}>
              {t.create_button}
            </button>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background:'#fff', borderRadius:14, padding:'18px 20px', border:'1px solid #E2E8F0', boxShadow:'0 2px 8px rgba(27,58,107,0.06)', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', bottom:0, left:0, right:0, height:3, background:k.color }} />
            <div style={{ fontSize:22, marginBottom:8 }}>{k.icon}</div>
            <div style={{ fontSize:11, color:'#94A3B8', textTransform:'uppercase', fontWeight:700, marginBottom:4 }}>{k.label}</div>
            <div style={{ fontSize:26, fontWeight:800, color:k.color, fontFamily:'Syne,sans-serif' }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns: selectedPic ? '1fr 1.3fr' : '1fr', gap:20 }}>
        {/* PICs List */}
        <div>
          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E2E8F0', overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', borderBottom:'1px solid #F1F5F9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:15, color:'#0F1E35' }}>
                🏛️ {t.all_pics}
              </span>
              <span style={{ fontSize:11, padding:'3px 10px', borderRadius:999, background:'#F1F5F9', color:'#5A6E8A', fontWeight:600 }}>
                {pics.length} PIC{pics.length > 1 ? 's' : ''}
              </span>
            </div>
            {loading ? (
              <div style={{ textAlign:'center', padding:40, color:'#94A3B8' }}>{t.loading}</div>
            ) : pics.length === 0 ? (
              <div style={{ textAlign:'center', padding:48 }}>
                <div style={{ fontSize:40, marginBottom:12 }}>🏛️</div>
                <div style={{ color:'#94A3B8', fontSize:14 }}>{t.no_pics}</div>
              </div>
            ) : pics.map(pic => {
              const isSelected = selectedPic?.id === pic.id;
              const isFull = pic.spots_remaining <= 0;
              return (
                <div key={pic.id}
                  onClick={() => { if (isSelected) { setSelectedPic(null); } else { loadMembers(pic); } }}
                  style={{ padding:'16px 18px', borderBottom:'1px solid #F1F5F9', cursor:'pointer',
                    background: isSelected ? 'rgba(27,58,107,0.04)' : '#fff',
                    borderLeft: isSelected ? '3px solid #1B3A6B' : '3px solid transparent',
                    transition:'all 0.15s' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:36, height:36, borderRadius:9, background:'linear-gradient(135deg,#1B3A6B,#2E5BA8)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:14, fontWeight:800, fontFamily:'Syne,sans-serif', flexShrink:0 }}>
                        {pic.name.slice(0,2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight:700, fontSize:14, color:'#0F1E35' }}>{pic.name}</div>
                        {pic.project && (
                          <div style={{ fontSize:11, color:'#94A3B8' }}>📋 {pic.project.name}</div>
                        )}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:11, padding:'3px 9px', borderRadius:999, fontWeight:700,
                        background: pic.status==='active'?'#DCFCE7':pic.status==='closed'?'#FEE2E2':'#F1F5F9',
                        color: pic.status==='active'?'#166534':pic.status==='closed'?'#991B1B':'#64748B' }}>
                        {STATUS_L[pic.status]?.[lang] ?? pic.status}
                      </span>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:12, fontSize:12, color:'#5A6E8A' }}>
                    <span>👥 {pic.member_count}/{pic.max_members}</span>
                    <span>💰 {pic.fees_paid_count} {lang==='fr'?'frais payés':'fees paid'}</span>
                    {isFull && <span style={{ color:'#E63946', fontWeight:700 }}>🔴 {lang==='fr'?'Complet':'Full'}</span>}
                    {pic.spots_remaining > 0 && <span style={{ color:'#16a34a' }}>+{pic.spots_remaining} {t.spots_left}</span>}
                  </div>
                  <div style={{ display:'flex', gap:6, marginTop:8 }}>
                    <button onClick={e => { e.stopPropagation(); closePic(pic); }}
                      style={{ padding:'4px 10px', borderRadius:6, border:'1px solid #E2E8F0', background:'#fff', color:'#64748B', cursor:'pointer', fontSize:11, fontWeight:600 }}>
                      {pic.status === 'active' ? t.close_pic : t.open_pic}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Members Detail */}
        {selectedPic && (
          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E2E8F0', overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', borderBottom:'1px solid #F1F5F9', background:'#F8FAFC', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:15, color:'#0F1E35' }}>
                  🏛️ {selectedPic.name}
                </div>
                <div style={{ fontSize:11, color:'#5A6E8A', marginTop:2 }}>
                  {members.filter((m:any)=>m.status==='active').length}/{selectedPic.max_members} membres
                  {selectedPic.project && ` · 📋 ${selectedPic.project.name}`}
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                {selectedPic.status === 'active' && (
                  <button onClick={() => setShowAddMember(!showAddMember)}
                    style={{ padding:'7px 14px', borderRadius:8, border:'none', background:'#16a34a', color:'#fff', cursor:'pointer', fontWeight:700, fontSize:12 }}>
                    {t.add_member}
                  </button>
                )}
                <button onClick={() => setSelectedPic(null)}
                  style={{ padding:'7px 12px', borderRadius:8, border:'1px solid #E2E8F0', background:'#fff', color:'#5A6E8A', cursor:'pointer', fontSize:13 }}>
                  ✕
                </button>
              </div>
            </div>

            {/* Add member form */}
            {showAddMember && (
              <div style={{ padding:'14px 18px', background:'#FFFBEB', borderBottom:'1px solid #FDE68A', display:'flex', gap:10, alignItems:'center' }}>
                <input value={investorId} onChange={e => setInvestorId(e.target.value)}
                  placeholder={lang==='fr'?'UUID de l\'investisseur':'Investor UUID'}
                  style={{ flex:1, padding:'9px 12px', borderRadius:8, border:'1px solid #E2E8F0', fontSize:13, outline:'none' }} />
                <button onClick={addMember}
                  style={{ padding:'9px 16px', borderRadius:8, border:'none', background:'#1B3A6B', color:'#fff', cursor:'pointer', fontWeight:700, fontSize:12, whiteSpace:'nowrap' }}>
                  {t.confirm_add_member}
                </button>
                <button onClick={() => { setShowAddMember(false); setInvestorId(''); }}
                  style={{ padding:'9px 12px', borderRadius:8, border:'1px solid #E2E8F0', background:'#fff', color:'#64748B', cursor:'pointer', fontSize:12 }}>
                  {t.cancel}
                </button>
              </div>
            )}

            {/* Members table */}
            {loadingMembers ? (
              <div style={{ textAlign:'center', padding:40, color:'#94A3B8' }}>{t.loading}</div>
            ) : members.length === 0 ? (
              <div style={{ textAlign:'center', padding:40 }}>
                <div style={{ fontSize:36, marginBottom:12 }}>👥</div>
                <div style={{ color:'#94A3B8', fontSize:14 }}>{t.no_members}</div>
              </div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'#F8FAFC' }}>
                      {[t.anonymous_number, t.member_name, t.kyc, t.status, t.actions].map(h => (
                        <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:11, color:'#94A3B8', textTransform:'uppercase', fontWeight:700, borderBottom:'1px solid #E2E8F0', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m:any, i) => {
                      const inv = m.investor ?? {};
                      const kycStyle = { bg: KYC_B[inv.kyc_status]??'#F1F5F9', text: KYC_C[inv.kyc_status]??'#374151' };
                      const isRevoked = m.status === 'revoked';
                      return (
                        <tr key={m.id} style={{ borderBottom: i < members.length-1 ? '1px solid #F1F5F9' : 'none', opacity: isRevoked ? 0.5 : 1 }}>
                          <td style={{ padding:'12px 14px' }}>
                            <span style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:13, color:'#1B3A6B', background:'#EFF6FF', padding:'3px 8px', borderRadius:6 }}>
                              {m.anonymous_number}
                            </span>
                          </td>
                          <td style={{ padding:'12px 14px' }}>
                            <div style={{ fontSize:13, fontWeight:600, color:'#0F1E35' }}>{inv.full_name ?? '—'}</div>
                            <div style={{ fontSize:11, color:'#94A3B8' }}>{inv.email}</div>
                          </td>
                          <td style={{ padding:'12px 14px' }}>
                            <span style={{ fontSize:11, padding:'3px 8px', borderRadius:999, fontWeight:700, background:kycStyle.bg, color:kycStyle.text }}>
                              {KYC_L[inv.kyc_status]?.[lang] ?? inv.kyc_status}
                            </span>
                          </td>
                          <td style={{ padding:'12px 14px' }}>
                            {isRevoked ? (
                              <span style={{ fontSize:11, color:'#991B1B', fontWeight:700 }}>⚠️ {lang==='fr'?'Révoqué':'Revoked'}</span>
                            ) : m.fee_paid ? (
                              <span style={{ fontSize:11, padding:'3px 8px', borderRadius:999, fontWeight:700, background:'#DCFCE7', color:'#166534' }}>✅ {t.fee_paid}</span>
                            ) : (
                              <span style={{ fontSize:11, padding:'3px 8px', borderRadius:999, fontWeight:700, background:'#FEE2E2', color:'#991B1B' }}>⏳ {t.fee_pending}</span>
                            )}
                          </td>
                          <td style={{ padding:'12px 14px' }}>
                            {!isRevoked && (
                              <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                                {!m.fee_paid && (
                                  <button onClick={() => doMemberAction(m.id, 'record_fee')}
                                    disabled={processing === m.id+'record_fee'}
                                    style={{ padding:'5px 10px', borderRadius:6, border:'none', background:'#16a34a', color:'#fff', cursor:'pointer', fontSize:11, fontWeight:700, whiteSpace:'nowrap' }}>
                                    💰 {t.record_fee}
                                  </button>
                                )}
                                {!m.fee_paid && (
                                  <button onClick={() => doMemberAction(m.id, 'waive_fee')}
                                    disabled={processing === m.id+'waive_fee'}
                                    style={{ padding:'5px 10px', borderRadius:6, border:'1px solid #94A3B8', background:'#fff', color:'#64748B', cursor:'pointer', fontSize:11, fontWeight:600, whiteSpace:'nowrap' }}>
                                    {t.waive_fee}
                                  </button>
                                )}
                                <button onClick={() => doMemberAction(m.id, 'revoke')}
                                  disabled={processing === m.id+'revoke'}
                                  style={{ padding:'5px 10px', borderRadius:6, border:'1px solid #E63946', background:'#fff', color:'#E63946', cursor:'pointer', fontSize:11, fontWeight:700 }}>
                                  {t.revoke}
                                </button>
                                <a href={`/admin/investors/${inv.id}`}
                                  style={{ padding:'5px 10px', borderRadius:6, border:'1px solid #1B3A6B', background:'#fff', color:'#1B3A6B', fontSize:11, fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}>
                                  👤 {lang==='fr'?'Profil':'Profile'}
                                </a>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info footer */}
      <div style={{ marginTop:20, padding:'14px 18px', background:'linear-gradient(135deg,rgba(27,58,107,0.04),rgba(201,150,58,0.04))', borderRadius:12, border:'1px solid #E2E8F0' }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#1B3A6B', marginBottom:4 }}>🏛️ {lang==='fr'?'Règles du PIC':'PIC Rules'}</div>
        <div style={{ fontSize:12, color:'#5A6E8A', lineHeight:1.6 }}>
          {lang==='fr'
            ? 'Cotisation annuelle : 50 000 XAF · KYC approuvé obligatoire · Numéros anonymes visibles dans l\'app mobile · Projets avec "Accepte PIC" uniquement · Rappels automatiques 60/30/14/7 jours avant expiration'
            : 'Annual fee: 50,000 XAF · Approved KYC required · Anonymous numbers visible in mobile app · Projects with "Allows PIC" only · Auto reminders 60/30/14/7 days before expiry'}
        </div>
      </div>
    </div>
  );
}
