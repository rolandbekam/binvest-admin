'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getLang, type Lang } from '@/lib/i18n';

const fmt = (n: number) => n >= 1e6 ? `₦${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `₦${(n/1e3).toFixed(0)}K` : `₦${n||0}`;

const SS: Record<string, {bg:string;text:string;label:string}> = {
  pending:   {bg:'#FEF9C3',text:'#854D0E',label:'En attente'},
  active:    {bg:'#DBEAFE',text:'#1E40AF',label:'Actif'},
  partial:   {bg:'#FEF3C7',text:'#92400E',label:'Partiel'},
  complete:  {bg:'#DCFCE7',text:'#166534',label:'Complet'},
  cancelled: {bg:'#F1F5F9',text:'#64748B',label:'Annulé'},
  defaulted: {bg:'#FEE2E2',text:'#991B1B',label:'En défaut'},
};
const TS: Record<string, {bg:string;text:string;label:string;icon:string}> = {
  pending:  {bg:'#FEF9C3',text:'#854D0E',label:'En attente',icon:'⏳'},
  received: {bg:'#DCFCE7',text:'#166534',label:'Reçu',icon:'✅'},
  late:     {bg:'#FEE2E2',text:'#991B1B',label:'En retard',icon:'⚠️'},
  waived:   {bg:'#F1F5F9',text:'#64748B',label:'Annulé',icon:'—'},
};
const TI: Record<string,string> = {land_banking:'🌍',agriculture_palmier:'🌴',agriculture_manioc:'🌿',capital_markets:'📈',immobilier:'🏗️'};

const DEMO: any[] = [
  {id:'s1',investor:{full_name:'Jean Paul Mbarga',email:'jp@mail.com',country:'CM'},project:{name:'Land Banking Lagos North',type:'land_banking'},status:'complete',amount_ngn:2000000,facilitation_fee_ngn:200000,total_amount_ngn:2200000,tranches_count:2,dia_reference:'DIA-2026-A1B2C3D4',created_at:'2026-01-15T10:00:00Z',tranches:[{id:'t1',tranche_number:1,amount_ngn:1200000,status:'received',received_amount_ngn:1200000,received_date:'2026-01-18',payment_method:'bank_transfer',bank_reference:'TRF2026011801'},{id:'t2',tranche_number:2,amount_ngn:1000000,status:'received',received_amount_ngn:1000000,received_date:'2026-02-20',payment_method:'bank_transfer',bank_reference:'TRF2026022001'}]},
  {id:'s2',investor:{full_name:'Marie Ongono',email:'marie@mail.com',country:'CM'},project:{name:'Palmeraie Ogun State',type:'agriculture_palmier'},status:'partial',amount_ngn:1000000,facilitation_fee_ngn:100000,total_amount_ngn:1100000,tranches_count:3,dia_reference:'DIA-2026-E5F6G7H8',created_at:'2026-02-01T10:00:00Z',tranches:[{id:'t3',tranche_number:1,amount_ngn:400000,status:'received',received_amount_ngn:400000,received_date:'2026-02-05',payment_method:'mobile_money',bank_reference:'MTN2026020501'},{id:'t4',tranche_number:2,amount_ngn:350000,status:'pending',received_amount_ngn:null,received_date:null,payment_method:null,bank_reference:null,due_date:'2026-04-01'},{id:'t5',tranche_number:3,amount_ngn:250000,status:'pending',received_amount_ngn:null,received_date:null,payment_method:null,bank_reference:null,due_date:'2026-07-01'}]},
  {id:'s3',investor:{full_name:'Adaora Okafor',email:'adaora@mail.com',country:'NG'},project:{name:'Land Banking Lagos North',type:'land_banking'},status:'partial',amount_ngn:5000000,facilitation_fee_ngn:500000,total_amount_ngn:5500000,tranches_count:2,dia_reference:'DIA-2026-I9J0K1L2',created_at:'2026-01-20T10:00:00Z',tranches:[{id:'t6',tranche_number:1,amount_ngn:2500000,status:'received',received_amount_ngn:2500000,received_date:'2026-01-28',payment_method:'bank_transfer',bank_reference:'TRF2026012801'},{id:'t7',tranche_number:2,amount_ngn:3000000,status:'late',received_amount_ngn:null,received_date:null,payment_method:null,bank_reference:null,due_date:'2026-03-01'}]},
  {id:'s4',investor:{full_name:'Kofi Asante',email:'kofi@mail.com',country:'GH'},project:{name:'Palmeraie Ogun State',type:'agriculture_palmier'},status:'active',amount_ngn:3000000,facilitation_fee_ngn:300000,total_amount_ngn:3300000,tranches_count:3,dia_reference:'DIA-2026-M3N4O5P6',created_at:'2026-02-10T10:00:00Z',tranches:[{id:'t8',tranche_number:1,amount_ngn:1100000,status:'received',received_amount_ngn:1100000,received_date:'2026-02-12',payment_method:'bank_transfer',bank_reference:'TRF2026021201'},{id:'t9',tranche_number:2,amount_ngn:1100000,status:'pending',received_amount_ngn:null,received_date:null,payment_method:null,bank_reference:null,due_date:'2026-05-10'},{id:'t10',tranche_number:3,amount_ngn:1100000,status:'pending',received_amount_ngn:null,received_date:null,payment_method:null,bank_reference:null,due_date:'2026-08-10'}]},
  {id:'s5',investor:{full_name:'Rose Bella',email:'rose@mail.com',country:'CM'},project:{name:'Capital Markets PIC Q2',type:'capital_markets'},status:'complete',amount_ngn:550000,facilitation_fee_ngn:55000,total_amount_ngn:605000,tranches_count:1,dia_reference:'DIA-2026-Q7R8S9T0',created_at:'2026-02-15T10:00:00Z',tranches:[{id:'t11',tranche_number:1,amount_ngn:605000,status:'received',received_amount_ngn:605000,received_date:'2026-02-15',payment_method:'bank_transfer',bank_reference:'TRF2026021501'}]},
];

export default function SubscriptionsPage() {
  const [lang, setL] = useState<Lang>('fr');
  useEffect(() => { setL(getLang()); const h=()=>setL(getLang()); window.addEventListener('lang-change',h); return()=>window.removeEventListener('lang-change',h); },[]);

  const [subs, setSubs] = useState<any[]>(DEMO);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [histTab, setHistTab] = useState<'detail'|'history'>('detail');

  useEffect(() => {
    fetch('/api/admin/subscriptions', { credentials: 'include' })
      .then(r=>r.json()).then(d=>{ if(d.subscriptions?.length>0) setSubs(d.subscriptions); }).catch(()=>{});
  }, []);

  const filtered = subs.filter(s => {
    if (filterStatus && s.status !== filterStatus) return false;
    if (search) { const q=search.toLowerCase(); return s.investor?.full_name?.toLowerCase().includes(q)||s.project?.name?.toLowerCase().includes(q)||s.dia_reference?.toLowerCase().includes(q); }
    return true;
  });

  const pct = (sub: any) => {
    const paid = sub.tranches?.filter((t:any)=>t.status==='received').length??0;
    const total = sub.tranches?.length??sub.tranches_count??1;
    return total>0?Math.round(paid*100/total):0;
  };

  const paidAmount = (sub: any) => sub.tranches?.filter((t:any)=>t.status==='received').reduce((s:number,t:any)=>s+(t.received_amount_ngn||0),0)??0;

  const downloadDIA = async (sub: any) => {
    try {
      const res = await fetch(`/api/admin/documents/dia?type=dia&subscription_id=${sub.id}`, { credentials:'include' });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url; a.download=`DIA-${sub.dia_reference}.docx`; a.click();
      URL.revokeObjectURL(url);
      toast.success('✅ Contrat DIA téléchargé');
    } catch { toast.error('Erreur téléchargement'); }
  };

  const INP = {border:'none',outline:'none',fontSize:'14px',flex:'1',fontFamily:'Outfit,sans-serif'} as any;

  return (
    <div style={{fontFamily:'Outfit,sans-serif',display:'flex',gap:20,height:'calc(100vh - 88px)',overflow:'hidden'}}>

      {/* ─── LISTE ─── */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
          <div>
            <h2 style={{fontFamily:'Syne,sans-serif',fontSize:22,fontWeight:800,color:'#0F1E35',margin:0}}>{lang==='fr'?'Souscriptions':'Subscriptions'}</h2>
            <p style={{color:'#5A6E8A',fontSize:13,marginTop:2}}>{subs.length} {lang==='fr'?'souscription(s)':'subscription(s)'}</p>
          </div>
        </div>

        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
          {[
            {label:'Total',value:subs.length,color:'#1B3A6B'},
            {label:lang==='fr'?'Complètes':'Complete',value:subs.filter(s=>s.status==='complete').length,color:'#16a34a'},
            {label:lang==='fr'?'En cours':'Active',value:subs.filter(s=>['active','partial'].includes(s.status)).length,color:'#D97706'},
            {label:'Capital',value:fmt(subs.reduce((s,x)=>s+(x.total_amount_ngn||0),0)),color:'#C9963A'},
          ].map(s=>(
            <div key={s.label} style={{background:'#fff',borderRadius:10,padding:'12px 14px',border:'1px solid #E2E8F0'}}>
              <div style={{fontSize:10,color:'#94A3B8',textTransform:'uppercase',fontWeight:700,marginBottom:2}}>{s.label}</div>
              <div style={{fontSize:20,fontWeight:800,color:s.color,fontFamily:'Syne,sans-serif'}}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filtres */}
        <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,background:'#fff',border:'1px solid #E2E8F0',borderRadius:9,padding:'7px 12px',flex:1,maxWidth:280}}>
            <span style={{color:'#94A3B8'}}>🔍</span>
            <input placeholder={lang==='fr'?'Rechercher...':'Search...'} value={search} onChange={e=>setSearch(e.target.value)} style={INP}/>
          </div>
          <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
            {['','pending','active','partial','complete','cancelled'].map(s=>(
              <button key={s} onClick={()=>setFilterStatus(s)} style={{padding:'7px 12px',borderRadius:999,border:'1px solid',cursor:'pointer',fontSize:11,fontWeight:600,background:filterStatus===s?'#1B3A6B':'#fff',color:filterStatus===s?'#fff':'#5A6E8A',borderColor:filterStatus===s?'#1B3A6B':'#E2E8F0'}}>
                {s===''?'Tous':SS[s]?.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table scrollable */}
        <div style={{background:'#fff',borderRadius:14,border:'1px solid #E2E8F0',overflow:'auto',flex:1}}>
          <table style={{width:'100%',borderCollapse:'collapse',minWidth:800}}>
            <thead>
              <tr style={{background:'#F8FAFC',position:'sticky',top:0,zIndex:1}}>
                {['Investisseur','Projet','Montant','Total','Tranches','DIA Ref','Statut','Actions'].map(h=>(
                  <th key={h} style={{textAlign:'left',padding:'10px 14px',fontSize:11,color:'#94A3B8',textTransform:'uppercase',fontWeight:700,borderBottom:'1px solid #E2E8F0',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((sub,i)=>{
                const st=SS[sub.status]??SS.pending;
                const p=pct(sub);
                const initials=sub.investor?.full_name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase()??'??';
                const isSelected=selected?.id===sub.id;
                return (
                  <tr key={sub.id} onClick={()=>{setSelected(isSelected?null:sub);setHistTab('detail');}}
                    style={{borderBottom:i<filtered.length-1?'1px solid #F1F5F9':'none',cursor:'pointer',background:isSelected?'#EFF6FF':''}}
                    onMouseEnter={e=>{if(!isSelected)e.currentTarget.style.background='#F8FAFC';}}
                    onMouseLeave={e=>{if(!isSelected)e.currentTarget.style.background='';}}>
                    <td style={{padding:'12px 14px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div style={{width:30,height:30,borderRadius:'50%',background:isSelected?'#1B3A6B':'#E2E8F0',display:'flex',alignItems:'center',justifyContent:'center',color:isSelected?'#fff':'#5A6E8A',fontSize:11,fontWeight:700,flexShrink:0}}>{initials}</div>
                        <div>
                          <div style={{fontWeight:600,color:'#0F1E35',fontSize:13}}>{sub.investor?.full_name}</div>
                          <div style={{color:'#94A3B8',fontSize:11}}>{sub.investor?.country}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{padding:'12px 14px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:5}}>
                        <span style={{fontSize:14}}>{TI[sub.project?.type]??'📁'}</span>
                        <span style={{fontSize:12,color:'#374151',fontWeight:500}}>{sub.project?.name}</span>
                      </div>
                    </td>
                    <td style={{padding:'12px 14px',fontWeight:600,color:'#0F1E35',fontSize:13,whiteSpace:'nowrap'}}>{fmt(sub.amount_ngn)}</td>
                    <td style={{padding:'12px 14px',fontWeight:800,color:'#1B3A6B',fontFamily:'Syne,sans-serif',fontSize:13,whiteSpace:'nowrap'}}>{fmt(sub.total_amount_ngn)}</td>
                    <td style={{padding:'12px 14px',minWidth:110}}>
                      <div style={{fontSize:11,color:'#5A6E8A',marginBottom:4}}>{p}% ({sub.tranches?.filter((t:any)=>t.status==='received').length??0}/{sub.tranches?.length??sub.tranches_count})</div>
                      <div style={{height:5,background:'#F1F5F9',borderRadius:3,overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${p}%`,background:p===100?'#16a34a':'#1B3A6B',borderRadius:3}}/>
                      </div>
                    </td>
                    <td style={{padding:'12px 14px'}}>
                      <span style={{fontSize:10,fontFamily:'monospace',color:'#5A6E8A',background:'#F8FAFC',padding:'2px 6px',borderRadius:4}}>{sub.dia_reference?.slice(0,16)}</span>
                    </td>
                    <td style={{padding:'12px 14px'}}>
                      <span style={{fontSize:11,fontWeight:700,padding:'3px 8px',borderRadius:999,background:st.bg,color:st.text,whiteSpace:'nowrap'}}>● {st.label}</span>
                    </td>
                    <td style={{padding:'12px 14px'}}>
                      <div style={{display:'flex',gap:5}}>
                        <button onClick={e=>{e.stopPropagation();setSelected(sub);setHistTab('history');}}
                          style={{padding:'5px 10px',borderRadius:7,border:'1px solid #1B3A6B',background:'#fff',color:'#1B3A6B',cursor:'pointer',fontSize:11,fontWeight:700}}>
                          💰
                        </button>
                        <button onClick={e=>{e.stopPropagation();downloadDIA(sub);}}
                          style={{padding:'5px 10px',borderRadius:7,border:'1px solid #C9963A',background:'#FEFCE8',color:'#C9963A',cursor:'pointer',fontSize:11,fontWeight:700}}>
                          📄
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── PANNEAU LATÉRAL ─── */}
      {selected && (
        <div style={{width:400,flexShrink:0,background:'#fff',borderRadius:16,border:'1px solid #E2E8F0',overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'0 4px 24px rgba(27,58,107,0.1)'}}>
          {/* Header panneau */}
          <div style={{padding:'16px 18px',borderBottom:'1px solid #E2E8F0',background:'#F8FAFC'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:15,color:'#0F1E35'}}>{selected.investor?.full_name}</div>
              <button onClick={()=>setSelected(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#94A3B8',fontSize:18}}>✕</button>
            </div>
            <div style={{fontSize:12,color:'#5A6E8A'}}>{selected.project?.name}</div>
            {/* Tabs */}
            <div style={{display:'flex',gap:4,marginTop:12,background:'#E2E8F0',padding:3,borderRadius:8}}>
              {([['detail',lang==='fr'?'📋 Détail':'📋 Detail'],['history',lang==='fr'?'💰 Paiements':'💰 Payments']] as const).map(([k,l])=>(
                <button key={k} onClick={()=>setHistTab(k)}
                  style={{flex:1,padding:'6px',borderRadius:6,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,background:histTab===k?'#fff':'transparent',color:histTab===k?'#0F1E35':'#5A6E8A',boxShadow:histTab===k?'0 1px 4px rgba(0,0,0,0.1)':'none'}}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div style={{flex:1,overflowY:'auto',padding:18}}>
            {histTab === 'detail' ? (
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                {/* Résumé financier */}
                <div style={{background:'linear-gradient(135deg,#1B3A6B,#0D2347)',borderRadius:12,padding:16,color:'#fff'}}>
                  <div style={{fontSize:11,opacity:0.7,marginBottom:4}}>{lang==='fr'?'Total souscrit':'Total subscribed'}</div>
                  <div style={{fontFamily:'Syne,sans-serif',fontSize:28,fontWeight:900,letterSpacing:'-0.5px'}}>{fmt(selected.total_amount_ngn)}</div>
                  <div style={{display:'flex',justifyContent:'space-between',marginTop:10}}>
                    <div><div style={{fontSize:10,opacity:0.6}}>Reçu</div><div style={{fontWeight:700,color:'#4ADE80'}}>{fmt(paidAmount(selected))}</div></div>
                    <div><div style={{fontSize:10,opacity:0.6}}>Restant</div><div style={{fontWeight:700,color:'#FCA5A5'}}>{fmt(selected.total_amount_ngn-paidAmount(selected))}</div></div>
                    <div><div style={{fontSize:10,opacity:0.6}}>Progression</div><div style={{fontWeight:700,color:'#FDE68A'}}>{pct(selected)}%</div></div>
                  </div>
                </div>

                {/* Infos */}
                {[
                  ['Réf DIA', selected.dia_reference],
                  ['Investissement', fmt(selected.amount_ngn)],
                  ['Frais facilitation (10%)', fmt(selected.facilitation_fee_ngn)],
                  ['Souscrit le', new Date(selected.created_at).toLocaleDateString('fr-FR')],
                  ['Tranches', `${selected.tranches_count} tranche(s)`],
                  ['Statut', SS[selected.status]?.label],
                ].map(([l,v])=>(
                  <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #F1F5F9'}}>
                    <span style={{color:'#5A6E8A',fontSize:13}}>{l}</span>
                    <span style={{color:'#0F1E35',fontWeight:600,fontSize:13}}>{v}</span>
                  </div>
                ))}

                <button onClick={()=>downloadDIA(selected)}
                  style={{width:'100%',padding:'11px',borderRadius:10,border:'1px solid #C9963A',background:'#FEFCE8',color:'#C9963A',cursor:'pointer',fontWeight:700,fontSize:13,marginTop:4}}>
                  📄 {lang==='fr'?'Télécharger contrat DIA':'Download DIA contract'}
                </button>
                <button onClick={()=>setHistTab('history')}
                  style={{width:'100%',padding:'11px',borderRadius:10,border:'none',background:'#1B3A6B',color:'#fff',cursor:'pointer',fontWeight:700,fontSize:13}}>
                  💰 {lang==='fr'?'Voir l\'historique des paiements':'View payment history'}
                </button>
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:14,color:'#0F1E35',marginBottom:4}}>
                  {lang==='fr'?'Historique complet des paiements':'Complete Payment History'}
                </div>

                {/* Résumé paiements */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:4}}>
                  {[
                    {label:lang==='fr'?'Total reçu':'Total received',value:fmt(paidAmount(selected)),color:'#16a34a'},
                    {label:lang==='fr'?'Restant dû':'Remaining',value:fmt(selected.total_amount_ngn-paidAmount(selected)),color:'#E63946'},
                  ].map(s=>(
                    <div key={s.label} style={{background:'#F8FAFC',borderRadius:8,padding:'10px 12px',border:'1px solid #E2E8F0'}}>
                      <div style={{fontSize:10,color:'#94A3B8',marginBottom:3}}>{s.label}</div>
                      <div style={{fontSize:16,fontWeight:800,color:s.color,fontFamily:'Syne,sans-serif'}}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Timeline paiements */}
                {(selected.tranches??[]).map((t:any,i:number)=>{
                  const ts=TS[t.status]??TS.pending;
                  const methodIcon: Record<string,string> = {bank_transfer:'🏦',mobile_money:'📱',cash:'💵',crypto:'₿'};
                  return (
                    <div key={t.id||i} style={{background:t.status==='received'?'#F0FDF4':t.status==='late'?'#FFF5F5':'#FFFBEB',borderRadius:12,padding:'14px 16px',border:`1px solid ${t.status==='received'?'#86EFAC':t.status==='late'?'#FCA5A5':'#FDE68A'}`}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:28,height:28,borderRadius:'50%',background:t.status==='received'?'#16a34a':t.status==='late'?'#E63946':'#D97706',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:12,fontWeight:700}}>
                            {t.tranche_number}
                          </div>
                          <div>
                            <div style={{fontSize:13,fontWeight:700,color:'#0F1E35'}}>{lang==='fr'?`Tranche ${t.tranche_number}`:`Instalment ${t.tranche_number}`}</div>
                            {t.due_date&&<div style={{fontSize:11,color:'#5A6E8A'}}>{lang==='fr'?'Échéance':'Due'}: {new Date(t.due_date).toLocaleDateString('fr-FR')}</div>}
                          </div>
                        </div>
                        <span style={{fontSize:11,fontWeight:700,padding:'3px 8px',borderRadius:999,background:ts.bg,color:ts.text}}>{ts.icon} {ts.label}</span>
                      </div>

                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                        <div>
                          <div style={{fontSize:11,color:'#94A3B8'}}>{lang==='fr'?'Montant attendu':'Expected'}</div>
                          <div style={{fontSize:15,fontWeight:800,color:'#0F1E35'}}>{fmt(t.amount_ngn)}</div>
                        </div>
                        {t.status==='received'&&(
                          <div style={{textAlign:'right'}}>
                            <div style={{fontSize:11,color:'#94A3B8'}}>{lang==='fr'?'Reçu le':'Received'}</div>
                            <div style={{fontSize:13,fontWeight:700,color:'#16a34a'}}>{new Date(t.received_date).toLocaleDateString('fr-FR')}</div>
                            {t.payment_method&&<div style={{fontSize:11,color:'#5A6E8A',marginTop:2}}>{methodIcon[t.payment_method]??'💳'} {t.payment_method?.replace(/_/g,' ')}</div>}
                            {t.bank_reference&&<div style={{fontSize:10,fontFamily:'monospace',color:'#94A3B8',marginTop:2}}>Réf: {t.bank_reference}</div>}
                          </div>
                        )}
                        {t.status!=='received'&&(
                          <button onClick={()=>{ window.location.href='/admin/payments'; }}
                            style={{padding:'6px 12px',borderRadius:8,border:'none',background:'#1B3A6B',color:'#fff',cursor:'pointer',fontSize:11,fontWeight:700}}>
                            💰 {lang==='fr'?'Enregistrer':'Record'}
                          </button>
                        )}
                      </div>

                      {t.status==='received'&&t.received_amount_ngn&&(
                        <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid rgba(0,0,0,0.06)',display:'flex',justifyContent:'space-between'}}>
                          <span style={{fontSize:11,color:'#5A6E8A'}}>{lang==='fr'?'Montant reçu':'Amount received'}</span>
                          <span style={{fontSize:13,fontWeight:800,color:'#16a34a'}}>{fmt(t.received_amount_ngn)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Total recap */}
                <div style={{background:'#1B3A6B',borderRadius:12,padding:'14px 16px',marginTop:4}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                    <span style={{color:'rgba(255,255,255,0.7)',fontSize:13}}>{lang==='fr'?'Total payé':'Total paid'}</span>
                    <span style={{color:'#4ADE80',fontWeight:800,fontSize:15}}>{fmt(paidAmount(selected))}</span>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span style={{color:'rgba(255,255,255,0.7)',fontSize:13}}>{lang==='fr'?'Solde restant':'Balance due'}</span>
                    <span style={{color:'#FCA5A5',fontWeight:800,fontSize:15}}>{fmt(selected.total_amount_ngn-paidAmount(selected))}</span>
                  </div>
                  <div style={{height:6,background:'rgba(255,255,255,0.1)',borderRadius:3,overflow:'hidden',marginTop:12}}>
                    <div style={{height:'100%',width:`${pct(selected)}%`,background:'#4ADE80',borderRadius:3}}/>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
