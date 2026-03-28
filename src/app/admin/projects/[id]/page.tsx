'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { getLang, T, type Lang } from '@/lib/i18n';

const fmt = (n: number) => !n ? '₦0' : n >= 1e9 ? `₦${(n/1e9).toFixed(2)}Mrd` : n >= 1e6 ? `₦${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `₦${(n/1e3).toFixed(0)}K` : `₦${n.toLocaleString()}`;

const TC: Record<string,{icon:string;color:string}> = {
  land_banking:{icon:'🌍',color:'#1B3A6B'},
  agriculture_palmier:{icon:'🌴',color:'#16a34a'},
  agriculture_manioc:{icon:'🌿',color:'#65a30d'},
  capital_markets:{icon:'📈',color:'#E63946'},
  immobilier:{icon:'🏗️',color:'#7C3AED'},
};
const SS: Record<string,{bg:string;text:string}> = {
  draft:{bg:'#F1F5F9',text:'#64748B'},open:{bg:'#FEF9C3',text:'#854D0E'},
  active:{bg:'#DCFCE7',text:'#166534'},closed:{bg:'#FEE2E2',text:'#991B1B'},completed:{bg:'#E0F2FE',text:'#075985'},
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lang, setL] = useState<Lang>('fr');
  useEffect(() => {
    setL(getLang());
    const h = () => setL(getLang());
    window.addEventListener('lang-change', h);
    return () => window.removeEventListener('lang-change', h);
  }, []);

  const [project, setProject] = useState<any>(null);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<any>({});

  const t = T[lang];

  const load = async () => {
    setLoading(true);
    try {
      const [projRes, subsRes] = await Promise.all([
        fetch(`/api/admin/projects/${id}`, { credentials: 'include' }),
        fetch(`/api/admin/subscriptions`, { credentials: 'include' }),
      ]);
      const projData = await projRes.json();
      const subsData = await subsRes.json();
      if (projData.project) {
        setProject(projData.project);
        setForm(projData.project);
      }
      if (subsData.subscriptions) {
        setSubscriptions(subsData.subscriptions.filter((s: any) => s.project_id === id || s.project?.id === id));
      }
    } catch { toast.error(lang === 'fr' ? 'Erreur de chargement' : 'Load error'); }
    setLoading(false);
  };

  useEffect(() => { if (id) load(); }, [id]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: form.name,
          status: form.status,
          description: form.description,
          location: form.location,
          min_investment_ngn: Number(form.min_investment_ngn),
          target_amount_ngn: Number(form.target_amount_ngn),
          horizon_years: form.horizon_years ? Number(form.horizon_years) : null,
          yield_min_pct: form.yield_min_pct ? Number(form.yield_min_pct) : null,
          yield_max_pct: form.yield_max_pct ? Number(form.yield_max_pct) : null,
          spots_total: form.spots_total ? Number(form.spots_total) : null,
          is_visible_app: form.is_visible_app,
        }),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error ?? 'Erreur'); setSaving(false); return; }
      setProject(d.project);
      setForm(d.project);
      setEditMode(false);
      toast.success(lang === 'fr' ? '✅ Projet mis à jour' : '✅ Project updated');
    } catch { toast.error('Erreur réseau'); }
    setSaving(false);
  };

  const toggleVisible = async () => {
    try {
      const r = await fetch(`/api/admin/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_visible_app: !project.is_visible_app }),
      });
      const d = await r.json();
      if (r.ok) {
        setProject(d.project);
        toast.success(d.project.is_visible_app
          ? (lang === 'fr' ? '✅ Visible dans l\'app' : '✅ Visible in app')
          : (lang === 'fr' ? '👁️ Masqué dans l\'app' : '👁️ Hidden in app'));
      }
    } catch {}
  };

  if (loading) return (
    <div style={{ fontFamily:'Outfit,sans-serif', textAlign:'center', padding:80, color:'#94A3B8' }}>
      {t.common.loading}
    </div>
  );

  if (!project) return (
    <div style={{ fontFamily:'Outfit,sans-serif', textAlign:'center', padding:80 }}>
      <div style={{ fontSize:48, marginBottom:16 }}>❌</div>
      <div style={{ fontSize:18, fontWeight:600, color:'#374151' }}>
        {lang === 'fr' ? 'Projet introuvable' : 'Project not found'}
      </div>
      <button onClick={() => router.push('/admin/projects')}
        style={{ marginTop:24, padding:'10px 20px', borderRadius:10, border:'none', background:'#1B3A6B', color:'#fff', cursor:'pointer', fontWeight:700 }}>
        {t.common.back}
      </button>
    </div>
  );

  const tc = TC[project.type] ?? TC.land_banking;
  const st = SS[project.status] ?? SS.draft;
  const pct = project.target_amount_ngn > 0 ? Math.round((project.raised_amount_ngn || 0) * 100 / project.target_amount_ngn) : 0;
  const facilFee = Math.round((project.raised_amount_ngn || 0) * (project.fee_facilitation_pct || 10) / 100);
  const mgmtFee = Math.round((project.raised_amount_ngn || 0) * (project.fee_management_pct || 3) / 100);
  const inp = { width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid #E2E8F0', fontSize:14, outline:'none', fontFamily:'Outfit,sans-serif' } as any;

  return (
    <div style={{ fontFamily:'Outfit,sans-serif' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={() => router.push('/admin/projects')}
            style={{ padding:'8px 14px', borderRadius:10, border:'1px solid #E2E8F0', background:'#fff', cursor:'pointer', fontSize:13, fontWeight:600, color:'#5A6E8A' }}>
            {t.common.back}
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:28 }}>{tc.icon}</span>
            <div>
              <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:22, fontWeight:800, color:'#0F1E35', margin:0 }}>{project.name}</h2>
              <p style={{ color:'#5A6E8A', fontSize:13, marginTop:2 }}>📍 {project.location || '—'} · {(t.types as any)[project.type]}</p>
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={toggleVisible}
            style={{ padding:'9px 16px', borderRadius:10, border:`1px solid ${project.is_visible_app ? '#E63946' : '#1B3A6B'}`, background:'#fff', cursor:'pointer', fontWeight:600, fontSize:13, color: project.is_visible_app ? '#E63946' : '#1B3A6B' }}>
            {project.is_visible_app ? (lang === 'fr' ? '👁️ Masquer' : '👁️ Hide') : (lang === 'fr' ? '✅ Publier' : '✅ Publish')}
          </button>
          {editMode ? (
            <>
              <button onClick={() => { setEditMode(false); setForm(project); }}
                style={{ padding:'9px 16px', borderRadius:10, border:'1px solid #E2E8F0', background:'#fff', cursor:'pointer', fontWeight:600, fontSize:13, color:'#5A6E8A' }}>
                {t.common.cancel}
              </button>
              <button onClick={save} disabled={saving}
                style={{ padding:'9px 20px', borderRadius:10, border:'none', background: saving ? '#94A3B8' : '#1B3A6B', color:'#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight:700, fontSize:13 }}>
                {saving ? t.projects.saving : t.projects.update}
              </button>
            </>
          ) : (
            <button onClick={() => setEditMode(true)}
              style={{ padding:'9px 20px', borderRadius:10, border:'none', background:'#1B3A6B', color:'#fff', cursor:'pointer', fontWeight:700, fontSize:13 }}>
              ✏️ {t.common.edit}
            </button>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, padding:'10px 16px', background:'#fff', borderRadius:12, border:'1px solid #E2E8F0' }}>
        <span style={{ fontSize:11, fontWeight:700, padding:'4px 12px', borderRadius:999, background:st.bg, color:st.text }}>● {(t.statuses as any)[project.status]}</span>
        <span style={{ fontSize:12, color:'#94A3B8' }}>·</span>
        <span style={{ fontSize:12, color:project.is_visible_app ? '#16a34a' : '#94A3B8', fontWeight:600 }}>
          {project.is_visible_app ? '✅ Visible Buam Finance' : (lang === 'fr' ? '👁️ Masqué' : '👁️ Hidden')}
        </span>
        <span style={{ fontSize:12, color:'#94A3B8' }}>·</span>
        <span style={{ fontSize:12, color:'#5A6E8A' }}>ID: <code style={{ fontSize:11, fontFamily:'monospace', background:'#F1F5F9', padding:'2px 6px', borderRadius:4 }}>{project.id}</code></span>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
        {[
          { label: lang === 'fr' ? 'Capital levé' : 'Capital raised', value: fmt(project.raised_amount_ngn || 0), sub: `/ ${fmt(project.target_amount_ngn)} (${pct}%)`, color: tc.color, icon: '💼' },
          { label: lang === 'fr' ? 'Investisseurs' : 'Investors', value: `${project.spots_taken || 0}/${project.spots_total || '—'}`, sub: lang === 'fr' ? 'places occupées' : 'spots taken', color: '#C9963A', icon: '👥' },
          { label: lang === 'fr' ? 'Frais facilitation' : 'Facilitation fees', value: fmt(facilFee), sub: `${project.fee_facilitation_pct || 10}% du capital`, color: '#E63946', icon: '💰' },
          { label: lang === 'fr' ? 'Frais gestion /an' : 'Mgmt fees /yr', value: fmt(mgmtFee), sub: `${project.fee_management_pct || 3}% /an`, color: '#7C3AED', icon: '📊' },
        ].map(k => (
          <div key={k.label} style={{ background:'#fff', borderRadius:14, padding:'18px 20px', border:'1px solid #E2E8F0', boxShadow:'0 2px 8px rgba(27,58,107,0.05)', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', bottom:0, left:0, right:0, height:3, background:k.color }} />
            <div style={{ fontSize:22, marginBottom:8 }}>{k.icon}</div>
            <div style={{ fontSize:11, color:'#94A3B8', textTransform:'uppercase', fontWeight:700, marginBottom:4 }}>{k.label}</div>
            <div style={{ fontSize:22, fontWeight:800, color:k.color, fontFamily:'Syne,sans-serif' }}>{k.value}</div>
            <div style={{ fontSize:11, color:'#94A3B8', marginTop:2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ background:'#fff', borderRadius:14, padding:'16px 20px', marginBottom:24, border:'1px solid #E2E8F0' }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:8 }}>
          <span style={{ color:'#5A6E8A', fontWeight:500 }}>{lang === 'fr' ? 'Progression de la levée de fonds' : 'Fundraising Progress'}</span>
          <span style={{ fontWeight:800, color:tc.color }}>{pct}%</span>
        </div>
        <div style={{ height:10, background:'#F1F5F9', borderRadius:5, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${pct}%`, background:`linear-gradient(90deg, ${tc.color}, ${tc.color}99)`, borderRadius:5, transition:'width 0.6s ease' }} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#94A3B8', marginTop:6 }}>
          <span>{fmt(project.raised_amount_ngn || 0)} {lang === 'fr' ? 'levés' : 'raised'}</span>
          <span>{fmt(project.target_amount_ngn)} {lang === 'fr' ? 'objectif' : 'target'}</span>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns: editMode ? '1fr' : '1fr 1fr', gap:20 }}>
        {/* Fiche projet */}
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E2E8F0', padding:24 }}>
          <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:15, color:'#0F1E35', marginBottom:18 }}>
            {lang === 'fr' ? '📋 Informations du projet' : '📋 Project Information'}
          </div>

          {editMode ? (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              {[
                { label: t.projects.name, key:'name', span:2 },
                { label: t.projects.location, key:'location' },
                { label: t.projects.horizon, key:'horizon_years', type:'number' },
                { label: t.projects.min_invest, key:'min_investment_ngn', type:'number' },
                { label: t.projects.target, key:'target_amount_ngn', type:'number' },
                { label: t.projects.yield_min, key:'yield_min_pct', type:'number' },
                { label: t.projects.yield_max, key:'yield_max_pct', type:'number' },
                { label: t.projects.spots, key:'spots_total', type:'number' },
              ].map((f: any) => (
                <div key={f.key} style={{ gridColumn: f.span === 2 ? 'span 2' : 'span 1' }}>
                  <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>{f.label}</label>
                  {f.key === 'status' ? (
                    <select value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} style={inp}>
                      {Object.keys(SS).map(s => <option key={s} value={s}>{(t.statuses as any)[s]}</option>)}
                    </select>
                  ) : (
                    <input type={f.type ?? 'text'} value={form[f.key] ?? ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} style={inp} />
                  )}
                </div>
              ))}
              <div style={{ gridColumn:'span 2' }}>
                <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>{t.projects.status}</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={inp}>
                  {Object.keys(SS).map(s => <option key={s} value={s}>{(t.statuses as any)[s]}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:'span 2' }}>
                <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>{t.projects.description}</label>
                <textarea value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} style={{ ...inp, resize:'vertical' }} />
              </div>
              <div style={{ gridColumn:'span 2', display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'#F8FAFC', borderRadius:10 }}>
                <input type="checkbox" id="vis" checked={!!form.is_visible_app} onChange={e => setForm({ ...form, is_visible_app: e.target.checked })} style={{ width:18, height:18 }} />
                <label htmlFor="vis" style={{ fontSize:14, fontWeight:600, color:'#374151', cursor:'pointer' }}>{t.projects.visible_app}</label>
              </div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
              {[
                [lang === 'fr' ? 'Type' : 'Type', `${tc.icon} ${(t.types as any)[project.type]}`],
                [lang === 'fr' ? 'Localisation' : 'Location', project.location || '—'],
                [lang === 'fr' ? 'Horizon' : 'Horizon', project.horizon_years ? `${project.horizon_years} ${lang === 'fr' ? 'ans' : 'years'}` : '—'],
                [lang === 'fr' ? 'Rendement estimé' : 'Est. yield', project.yield_min_pct ? `${project.yield_min_pct}–${project.yield_max_pct}%` : '—'],
                [lang === 'fr' ? 'Invest. minimum' : 'Min. investment', fmt(project.min_investment_ngn)],
                [lang === 'fr' ? 'Nombre de tranches' : 'Instalments', project.tranches_count || 1],
                [lang === 'fr' ? 'Frais facilitation' : 'Facilitation fee', `${project.fee_facilitation_pct || 10}%`],
                [lang === 'fr' ? 'Frais gestion /an' : 'Mgmt fee /yr', `${project.fee_management_pct || 3}%`],
                [lang === 'fr' ? 'Commission revente' : 'Resale commission', `${project.fee_resale_pct || 15}%`],
                [lang === 'fr' ? 'Date limite' : 'Deadline', project.close_date ? new Date(project.close_date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB') : '—'],
              ].map(([l, v]) => (
                <div key={String(l)} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid #F1F5F9' }}>
                  <span style={{ color:'#5A6E8A', fontSize:13 }}>{l}</span>
                  <span style={{ color:'#0F1E35', fontWeight:600, fontSize:13 }}>{v}</span>
                </div>
              ))}
              {project.description && (
                <div style={{ marginTop:12, padding:12, background:'#F8FAFC', borderRadius:10, fontSize:13, color:'#374151', lineHeight:1.6 }}>
                  {project.description}
                </div>
              )}
              {project.highlights?.length > 0 && (
                <div style={{ marginTop:12 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#5A6E8A', textTransform:'uppercase', marginBottom:8 }}>
                    {lang === 'fr' ? 'Points forts' : 'Highlights'}
                  </div>
                  <ul style={{ paddingLeft:16 }}>
                    {project.highlights.map((h: string, i: number) => (
                      <li key={i} style={{ fontSize:13, color:'#374151', marginBottom:4 }}>{h}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Souscriptions liées */}
        {!editMode && (
          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E2E8F0', overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #E2E8F0', fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:15, color:'#0F1E35' }}>
              👥 {lang === 'fr' ? `Souscripteurs (${subscriptions.length})` : `Subscribers (${subscriptions.length})`}
            </div>
            {subscriptions.length === 0 ? (
              <div style={{ textAlign:'center', padding:40, color:'#94A3B8' }}>
                {lang === 'fr' ? 'Aucune souscription encore' : 'No subscriptions yet'}
              </div>
            ) : (
              <div style={{ overflowY:'auto', maxHeight:500 }}>
                {subscriptions.map((sub: any) => {
                  const paid = (sub.tranches ?? []).filter((t: any) => t.status === 'received').length;
                  const total = sub.tranches?.length ?? sub.tranches_count ?? 1;
                  const p = total > 0 ? Math.round(paid * 100 / total) : 0;
                  const initials = sub.investor?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase() ?? '??';
                  return (
                    <div key={sub.id} style={{ padding:'14px 18px', borderBottom:'1px solid #F1F5F9' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                        <div style={{ width:32, height:32, borderRadius:'50%', background:'#1B3A6B', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:11, fontWeight:700, flexShrink:0 }}>{initials}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:'#0F1E35' }}>{sub.investor?.full_name}</div>
                          <div style={{ fontSize:11, color:'#94A3B8' }}>{sub.dia_reference}</div>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:13, fontWeight:700, color:'#1B3A6B' }}>
                            {fmt((sub.tranches ?? []).filter((t: any) => t.status === 'received').reduce((s: number, t: any) => s + (t.received_amount_ngn || 0), 0))}
                          </div>
                          <div style={{ fontSize:11, color:'#94A3B8' }}>/ {fmt(sub.total_amount_ngn)}</div>
                        </div>
                      </div>
                      <div style={{ height:5, background:'#F1F5F9', borderRadius:3, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${p}%`, background:p === 100 ? '#16a34a' : tc.color, borderRadius:3 }} />
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', marginTop:4, fontSize:11, color:'#94A3B8' }}>
                        <span>{paid}/{total} {lang === 'fr' ? 'tranche(s)' : 'instalment(s)'}</span>
                        <span>{p}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
