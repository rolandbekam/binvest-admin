// @ts-nocheck
'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getLang, T, type Lang } from '@/lib/i18n';

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
const fmt = (n:number) => n>=1e6?`₦${(n/1e6).toFixed(1)}M`:n>=1e3?`₦${(n/1e3).toFixed(0)}K`:`₦${n||0}`;
const EMPTY = {name:'',type:'land_banking',status:'draft',description:'',location:'',min_investment_ngn:'',target_amount_ngn:'',horizon_years:'3',yield_min_pct:'',yield_max_pct:'',tranches_count:'1',spots_total:'10',max_amount_ngn:'',close_date:'',fee_facilitation_pct:'10',fee_management_pct:'3',fee_resale_pct:'15',is_visible_app:false,highlights:''};

function QuotaModal({type,project,t,onClose,onSave}:{type:string;project:any;t:any;onClose:()=>void;onSave:(t:string,v:string)=>void}) {
  const [val,setVal]=useState('');
  const cfg:{label:string;inputType:string;hint:string} = type==='spots'
    ?{label:t.projects.new_spots,inputType:'number',hint:`Actuel: ${project.spots_total}`}
    :type==='amount'
    ?{label:t.projects.new_amount,inputType:'number',hint:`Actuel: ${fmt(project.max_amount_ngn||project.target_amount_ngn)}`}
    :{label:t.projects.new_deadline,inputType:'date',hint:project.close_date?`Actuelle: ${new Date(project.close_date).toLocaleDateString('fr-FR')}`:''};
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:'#fff',borderRadius:20,padding:28,width:400,boxShadow:'0 24px 80px rgba(0,0,0,0.25)'}}>
        <div style={{fontSize:40,textAlign:'center',marginBottom:8}}>{type==='spots'?'👥':type==='amount'?'💰':'📅'}</div>
        <h3 style={{fontFamily:'Syne,sans-serif',fontSize:18,fontWeight:700,textAlign:'center',marginBottom:4,color:'#0F1E35'}}>
          {type==='spots'?t.projects.increase_spots:type==='amount'?t.projects.increase_amount:t.projects.extend_deadline}
        </h3>
        <p style={{color:'#94A3B8',fontSize:13,textAlign:'center',marginBottom:20}}>{cfg.hint}</p>
        <input type={cfg.inputType} value={val} onChange={e=>setVal(e.target.value)} placeholder={cfg.hint}
          style={{width:'100%',padding:'11px 14px',borderRadius:10,border:'2px solid #1B3A6B',fontSize:15,outline:'none',marginBottom:16,fontFamily:'Outfit,sans-serif'}} />
        <div style={{display:'flex',gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:'10px',borderRadius:10,border:'1px solid #E2E8F0',background:'#fff',cursor:'pointer',fontWeight:600,color:'#5A6E8A'}}>{t.common.cancel}</button>
          <button onClick={()=>{if(val){onSave(type,val);onClose();}else toast.error('Entrez une valeur');}}
            style={{flex:2,padding:'10px',borderRadius:10,border:'none',background:'#1B3A6B',color:'#fff',cursor:'pointer',fontWeight:700}}>{t.projects.confirm_increase}</button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const [lang,setLangState]=useState<Lang>('fr');
  useEffect(()=>{
    setLangState(getLang());
    const h=()=>setLangState(getLang());
    window.addEventListener('lang-change',h);
    return()=>window.removeEventListener('lang-change',h);
  },[]);
  const t=T[lang];

  const [projects,setProjects]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [showModal,setShowModal]=useState(false);
  const [editProject,setEditProject]=useState<any>(null);
  const [form,setForm]=useState<any>(EMPTY);
  const [saving,setSaving]=useState(false);
  const [filterStatus,setFilterStatus]=useState('');
  const [quotaModal,setQuotaModal]=useState<{type:string;project:any}|null>(null);

  const load=async()=>{
    setLoading(true);
    try{
      const r=await fetch('/api/admin/projects',{credentials:'include'});
      const d=await r.json();
      if(!r.ok){toast.error(d.error??`Erreur ${r.status}`);setProjects([]);}
      else setProjects(d.projects??[]);
    }catch(e:any){toast.error(e.message??'Erreur réseau');setProjects([]);}
    setLoading(false);
  };
  useEffect(()=>{load();},[]);

  const openEdit=(p:any)=>{
    setEditProject(p);
    setForm({name:p.name,type:p.type,status:p.status,description:p.description??'',location:p.location??'',min_investment_ngn:p.min_investment_ngn,target_amount_ngn:p.target_amount_ngn,horizon_years:p.horizon_years??3,yield_min_pct:p.yield_min_pct??'',yield_max_pct:p.yield_max_pct??'',tranches_count:p.tranches_count??1,spots_total:p.spots_total??10,max_amount_ngn:p.max_amount_ngn??'',close_date:p.close_date??'',fee_facilitation_pct:p.fee_facilitation_pct??10,fee_management_pct:p.fee_management_pct??3,fee_resale_pct:p.fee_resale_pct??15,is_visible_app:p.is_visible_app??false,highlights:(p.highlights??[]).join('\n')});
    setShowModal(true);
  };

  const save=async()=>{
    if(!form.name||!form.min_investment_ngn||!form.target_amount_ngn){toast.error('Remplissez les champs obligatoires (*)');return;}
    setSaving(true);
    const body={...form,min_investment_ngn:Number(form.min_investment_ngn),target_amount_ngn:Number(form.target_amount_ngn),max_amount_ngn:form.max_amount_ngn?Number(form.max_amount_ngn):null,horizon_years:Number(form.horizon_years),yield_min_pct:form.yield_min_pct?Number(form.yield_min_pct):null,yield_max_pct:form.yield_max_pct?Number(form.yield_max_pct):null,tranches_count:Number(form.tranches_count),spots_total:Number(form.spots_total),fee_facilitation_pct:Number(form.fee_facilitation_pct),fee_management_pct:Number(form.fee_management_pct),fee_resale_pct:Number(form.fee_resale_pct),close_date:form.close_date||null,highlights:form.highlights?form.highlights.split('\n').filter(Boolean):[]};
    const url=editProject?`/api/admin/projects/${editProject.id}`:'/api/admin/projects';
    const r=await fetch(url,{method:editProject?'PUT':'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify(body)});
    const d=await r.json();
    if(!r.ok){toast.error(d.error??'Erreur');setSaving(false);return;}
    toast.success(editProject?'✅ Projet mis à jour !':'✅ Projet créé !');
    setShowModal(false);setSaving(false);setEditProject(null);setForm(EMPTY);load();
  };

  const handleQuotaIncrease=async(type:string,value:string)=>{
    if(!quotaModal?.project)return;
    const updates:any=type==='spots'?{spots_total:Number(value)}:type==='amount'?{max_amount_ngn:Number(value)}:{close_date:value};
    await fetch(`/api/admin/projects/${quotaModal.project.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify(updates)});
    toast.success('✅ Quota mis à jour !');load();
  };

  const toggleVisible=async(p:any)=>{
    await fetch(`/api/admin/projects/${p.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({is_visible_app:!p.is_visible_app})});
    toast.success(p.is_visible_app?'Masqué dans l\'app':'Visible dans l\'app !');load();
  };

  const getAlerts=(p:any)=>{
    const alerts=[];
    if((p.spots_taken||0)>=(p.spots_total||0))alerts.push({type:'spots',label:t.projects.spots_full,color:'#991B1B',bg:'#FEE2E2'});
    if(p.max_amount_ngn&&(p.raised_amount_ngn||0)>=p.max_amount_ngn)alerts.push({type:'amount',label:t.projects.amount_reached,color:'#854D0E',bg:'#FEF9C3'});
    if(p.close_date&&new Date(p.close_date)<new Date())alerts.push({type:'deadline',label:t.projects.deadline_passed,color:'#1E40AF',bg:'#DBEAFE'});
    return alerts;
  };

  const filtered=filterStatus?projects.filter(p=>p.status===filterStatus):projects;

  const FIELDS=[
    {label:t.projects.name,key:'name',span:2},
    {label:t.projects.type,key:'type',sel:true,opts:Object.entries(TC).map(([v])=>({v,l:`${TC[v].icon} ${(t.types as any)[v]}`}))},
    {label:t.projects.status,key:'status',sel:true,opts:Object.entries(SS).map(([v])=>({v,l:(t.statuses as any)[v]}))},
    {label:t.projects.location,key:'location'},
    {label:t.projects.horizon,key:'horizon_years',num:true},
    {label:t.projects.min_invest,key:'min_investment_ngn',num:true},
    {label:t.projects.target,key:'target_amount_ngn',num:true},
    {label:t.projects.yield_min,key:'yield_min_pct',num:true},
    {label:t.projects.yield_max,key:'yield_max_pct',num:true},
    {label:t.projects.tranches,key:'tranches_count',num:true},
    {label:t.projects.spots,key:'spots_total',num:true,hint:t.projects.spots_hint},
    {label:t.projects.max_amount,key:'max_amount_ngn',num:true,hint:t.projects.max_amount_hint},
    {label:t.projects.deadline,key:'close_date',date:true,hint:t.projects.deadline_hint,span:2},
    {label:t.projects.fee_f,key:'fee_facilitation_pct',num:true},
    {label:t.projects.fee_m,key:'fee_management_pct',num:true},
    {label:t.projects.fee_r,key:'fee_resale_pct',num:true},
  ];

  const inp={width:'100%',padding:'9px 12px',borderRadius:'8px',border:'1px solid #E2E8F0',fontSize:'14px',outline:'none',fontFamily:'Outfit,sans-serif'} as any;

  return (
    <div style={{fontFamily:'Outfit,sans-serif'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24}}>
        <div>
          <h2 style={{fontFamily:'Syne,sans-serif',fontSize:24,fontWeight:800,color:'#0F1E35',margin:0}}>{t.projects.title}</h2>
          <p style={{color:'#5A6E8A',fontSize:14,marginTop:4}}>{projects.length} projet(s)</p>
        </div>
        <button onClick={()=>{setEditProject(null);setForm(EMPTY);setShowModal(true);}} style={{background:'#1B3A6B',color:'#fff',border:'none',borderRadius:10,padding:'10px 20px',fontWeight:700,cursor:'pointer',fontSize:14}}>{t.projects.new}</button>
      </div>

      <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap'}}>
        {['','draft','open','active','closed','completed'].map(s=>(
          <button key={s} onClick={()=>setFilterStatus(s)} style={{padding:'6px 14px',borderRadius:999,border:'1px solid',cursor:'pointer',fontSize:12,fontWeight:600,background:filterStatus===s?'#1B3A6B':'#fff',color:filterStatus===s?'#fff':'#5A6E8A',borderColor:filterStatus===s?'#1B3A6B':'#E2E8F0'}}>
            {s===''?t.common.all:(t.statuses as any)[s]}
          </button>
        ))}
      </div>

      {loading?<div style={{textAlign:'center',padding:60,color:'#94A3B8'}}>{t.common.loading}</div>:(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(360px,1fr))',gap:20}}>
          {filtered.map(p=>{
            const tc=TC[p.type]??TC.land_banking;
            const st=SS[p.status]??SS.draft;
            const pct=p.target_amount_ngn>0?Math.round((p.raised_amount_ngn||0)*100/p.target_amount_ngn):0;
            const spotsLeft=(p.spots_total||0)-(p.spots_taken||0);
            const alerts=getAlerts(p);
            const deadline=p.close_date?new Date(p.close_date):null;
            return (
              <div key={p.id} style={{background:'#fff',borderRadius:16,border:`1px solid ${alerts.length>0?'#FCA5A5':'#E2E8F0'}`,overflow:'hidden',boxShadow:'0 2px 12px rgba(27,58,107,0.06)'}}>
                <div style={{height:5,background:`linear-gradient(90deg,${tc.color},${tc.color}77)`}}/>
                <div style={{padding:20}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                    <div>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                        <span style={{fontSize:20}}>{tc.icon}</span>
                        <span style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:15,color:'#0F1E35'}}>{p.name}</span>
                      </div>
                      <span style={{fontSize:12,color:'#5A6E8A'}}>📍 {p.location||'—'}</span>
                    </div>
                    <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:999,background:st.bg,color:st.text,whiteSpace:'nowrap'}}>{(t.statuses as any)[p.status]}</span>
                  </div>

                  {/* Alertes quota */}
                  {alerts.length>0&&(
                    <div style={{marginBottom:12,display:'flex',flexDirection:'column',gap:6}}>
                      {alerts.map(a=>(
                        <div key={a.type} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',borderRadius:8,background:a.bg}}>
                          <span style={{fontSize:12,fontWeight:700,color:a.color}}>{a.label}</span>
                          <button onClick={()=>setQuotaModal({type:a.type,project:p})}
                            style={{fontSize:11,padding:'3px 10px',borderRadius:999,border:`1px solid ${a.color}`,background:'#fff',color:a.color,cursor:'pointer',fontWeight:700}}>
                            {a.type==='spots'?t.projects.increase_spots:a.type==='amount'?t.projects.increase_amount:t.projects.extend_deadline}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Stats */}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12,background:'#F8FAFC',borderRadius:10,padding:10}}>
                    {[[fmt(p.min_investment_ngn),'Min.'],[`${p.yield_min_pct||'?'}-${p.yield_max_pct||'?'}%`,'Rendement'],[`${p.horizon_years||'?'} ans`,'Horizon']].map(([v,l])=>(
                      <div key={l} style={{textAlign:'center'}}>
                        <div style={{fontSize:13,fontWeight:700,color:'#0F1E35'}}>{v}</div>
                        <div style={{fontSize:10,color:'#94A3B8',marginTop:1}}>{l}</div>
                      </div>
                    ))}
                  </div>

                  {/* Progress levée */}
                  <div style={{marginBottom:12}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#5A6E8A',marginBottom:5}}>
                      <span>Capital levé</span>
                      <span style={{fontWeight:700}}>{fmt(p.raised_amount_ngn||0)} / {fmt(p.target_amount_ngn)} ({pct}%)</span>
                    </div>
                    <div style={{height:6,background:'#F1F5F9',borderRadius:3,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${pct}%`,background:tc.color,borderRadius:3}}/>
                    </div>
                  </div>

                  {/* Quota info */}
                  <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
                    <div style={{flex:1,padding:'8px 10px',borderRadius:8,background:spotsLeft<=0?'#FEE2E2':'#F8FAFC',border:'1px solid #E2E8F0'}}>
                      <div style={{fontSize:10,color:'#94A3B8',textTransform:'uppercase'}}>Investisseurs</div>
                      <div style={{fontSize:13,fontWeight:700,color:spotsLeft<=0?'#E63946':'#0F1E35',marginTop:2}}>
                        {p.spots_taken||0}/{p.spots_total} {spotsLeft<=0?t.projects.spots_full:`(${spotsLeft} ${t.projects.spots_remaining})`}
                      </div>
                    </div>
                    {deadline&&(
                      <div style={{flex:1,padding:'8px 10px',borderRadius:8,background:deadline<new Date()?'#DBEAFE':'#F8FAFC',border:'1px solid #E2E8F0'}}>
                        <div style={{fontSize:10,color:'#94A3B8',textTransform:'uppercase'}}>Date limite</div>
                        <div style={{fontSize:13,fontWeight:700,color:deadline<new Date()?'#1E40AF':'#0F1E35',marginTop:2}}>
                          {deadline.toLocaleDateString('fr-FR')} {deadline<new Date()?t.projects.deadline_passed:''}
                        </div>
                      </div>
                    )}
                    {p.max_amount_ngn&&(
                      <div style={{flex:1,padding:'8px 10px',borderRadius:8,background:'#F8FAFC',border:'1px solid #E2E8F0'}}>
                        <div style={{fontSize:10,color:'#94A3B8',textTransform:'uppercase'}}>Max</div>
                        <div style={{fontSize:13,fontWeight:700,color:'#0F1E35',marginTop:2}}>{fmt(p.max_amount_ngn)}</div>
                      </div>
                    )}
                  </div>

                  {/* Toggle visibilité */}
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',background:p.is_visible_app?'#DCFCE7':'#F1F5F9',borderRadius:8,marginBottom:12}}>
                    <span style={{fontSize:12,color:p.is_visible_app?'#166534':'#64748B',fontWeight:600}}>{p.is_visible_app?t.projects.visible_label:t.projects.hidden_label}</span>
                    <button onClick={()=>toggleVisible(p)} style={{fontSize:11,padding:'3px 10px',borderRadius:999,border:'1px solid',cursor:'pointer',fontWeight:600,background:p.is_visible_app?'#fff':'#1B3A6B',color:p.is_visible_app?'#E63946':'#fff',borderColor:p.is_visible_app?'#E63946':'#1B3A6B'}}>
                      {p.is_visible_app?t.projects.hide:t.projects.publish}
                    </button>
                  </div>

                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>openEdit(p)} style={{flex:1,padding:'8px',borderRadius:8,border:'1px solid #E2E8F0',background:'#fff',cursor:'pointer',fontSize:13,fontWeight:600,color:'#1B3A6B'}}>{t.projects.edit_title.replace('✏️ ','✏️ ')}</button>
                    <a href={`/admin/projects/${p.id}`} style={{flex:1,padding:'8px',borderRadius:8,border:'none',background:'#1B3A6B',cursor:'pointer',fontSize:13,fontWeight:700,color:'#fff',textAlign:'center',textDecoration:'none',display:'block'}}>{t.projects.detail}</a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL PROJET */}
      {showModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,overflowY:'auto',padding:20}} onClick={e=>{if(e.target===e.currentTarget){setShowModal(false);setEditProject(null);}}}>
          <div style={{background:'#fff',borderRadius:20,padding:28,width:640,boxShadow:'0 24px 80px rgba(0,0,0,0.2)',margin:'auto'}}>
            <h3 style={{fontFamily:'Syne,sans-serif',fontSize:20,fontWeight:700,marginBottom:20,color:'#0F1E35'}}>{editProject?t.projects.edit_title:t.projects.new}</h3>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              {FIELDS.map(f=>(
                <div key={f.key} style={{gridColumn:(f as any).span===2?'span 2':'span 1'}}>
                  <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:4}}>{f.label}</label>
                  {(f as any).sel?(
                    <select value={form[f.key]} onChange={e=>setForm({...form,[f.key]:e.target.value})} style={inp}>
                      {(f as any).opts?.map((o:any)=><option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  ):(
                    <input type={(f as any).date?'date':(f as any).num?'number':'text'} value={form[f.key]} onChange={e=>setForm({...form,[f.key]:e.target.value})} style={inp}/>
                  )}
                  {(f as any).hint&&<p style={{fontSize:11,color:'#94A3B8',marginTop:3,lineHeight:1.4}}>{(f as any).hint}</p>}
                </div>
              ))}
              <div style={{gridColumn:'span 2'}}>
                <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:4}}>{t.projects.description}</label>
                <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={3} style={{...inp,resize:'vertical'}}/>
              </div>
              <div style={{gridColumn:'span 2'}}>
                <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:4}}>{t.projects.highlights}</label>
                <textarea value={form.highlights} onChange={e=>setForm({...form,highlights:e.target.value})} rows={3} placeholder="Point fort 1&#10;Point fort 2" style={{...inp,resize:'vertical'}}/>
              </div>
              <div style={{gridColumn:'span 2',display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'#F8FAFC',borderRadius:10}}>
                <input type="checkbox" id="vis" checked={form.is_visible_app} onChange={e=>setForm({...form,is_visible_app:e.target.checked})} style={{width:18,height:18}}/>
                <label htmlFor="vis" style={{fontSize:14,fontWeight:600,color:'#374151',cursor:'pointer'}}>{t.projects.visible_app}</label>
              </div>
            </div>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:24,paddingTop:20,borderTop:'1px solid #E2E8F0'}}>
              <button onClick={()=>{setShowModal(false);setEditProject(null);setForm(EMPTY);}} style={{padding:'10px 20px',borderRadius:10,border:'1px solid #E2E8F0',background:'#fff',cursor:'pointer',fontWeight:600,color:'#5A6E8A'}}>{t.common.cancel}</button>
              <button onClick={save} disabled={saving} style={{padding:'10px 24px',borderRadius:10,border:'none',background:'#1B3A6B',color:'#fff',cursor:'pointer',fontWeight:700,opacity:saving?0.7:1}}>{saving?t.projects.saving:editProject?t.projects.update:t.projects.create}</button>
            </div>
          </div>
        </div>
      )}

      {quotaModal&&<QuotaModal type={quotaModal.type} project={quotaModal.project} t={t} onClose={()=>setQuotaModal(null)} onSave={handleQuotaIncrease}/>}
    </div>
  );
}
