'use client';
import { useEffect, useState } from 'react';
import { getLang, T, type Lang } from '@/lib/i18n';
const fmt=(n:number)=>n>=1e6?`₦${(n/1e6).toFixed(1)}M`:n>=1e3?`₦${(n/1e3).toFixed(0)}K`:`₦${n||0}`;
const MONTHS_FR=['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const MONTHS_EN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_DATA=[12,8,18,15,22,0,0,0,0,0,0,0];
export default function FinancesPage() {
  const [lang,setL]=useState<Lang>('fr');
  useEffect(()=>{ setL(getLang()); const h=()=>setL(getLang()); window.addEventListener('lang-change',h); return()=>window.removeEventListener('lang-change',h); },[]);
  const t=T[lang].finances;
  const MONTHS=lang==='fr'?MONTHS_FR:MONTHS_EN;
  const DATA=MONTH_DATA.map((v,i)=>({m:MONTHS[i],v:v*1e6}));
  const MAX=Math.max(...DATA.map(d=>d.v),1);
  const kpis=[[t.aum,'₦48.5M','💼','#1B3A6B','+12% T1 2026'],[t.rev_f,'₦4.85M','💰','#E63946','10% × capital levé'],[t.rev_m,'₦1.46M/an','📈','#C9963A','3% × valeur proj.'],[t.rev_pic,'₦1.85M','🤝','#7C3AED','37 membres × 50K XAF']];
  const fees=[[lang==='fr'?'Facilitation':'Facilitation','10%',lang==='fr'?'Valeur transaction':'Transaction value',fmt(4850000),'#E63946'],[lang==='fr'?'Gestion annuelle':'Annual management','3%',lang==='fr'?'Valeur propriété/an':'Property value/yr',fmt(1460000),'#C9963A'],[lang==='fr'?'Commission revente':'Resale commission','15%',lang==='fr'?'Prix de vente':'Sale price','Variable','#7C3AED'],[lang==='fr'?'Adhésion PIC':'PIC membership','50K XAF',lang==='fr'?'Par membre/an':'Per member/yr',fmt(1850000),'#16a34a'],[lang==='fr'?'Pénalité sortie':'Early exit penalty','30%',lang==='fr'?'Capital engagé':'Committed capital','Variable','#E63946']];
  return (
    <div style={{fontFamily:'Outfit,sans-serif'}}>
      <div style={{marginBottom:24}}><h2 style={{fontFamily:'Syne,sans-serif',fontSize:24,fontWeight:800,color:'#0F1E35',margin:0}}>{t.title}</h2><p style={{color:'#5A6E8A',fontSize:14,marginTop:4}}>{t.subtitle}</p></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
        {kpis.map(([l,v,i,c,s])=>(
          <div key={String(l)} style={{background:'#fff',borderRadius:14,padding:'18px 20px',border:'1px solid #E2E8F0',boxShadow:'0 2px 8px rgba(27,58,107,0.06)',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',bottom:0,left:0,right:0,height:3,background:String(c)}}/>
            <div style={{fontSize:22,marginBottom:8}}>{String(i)}</div>
            <div style={{fontSize:11,color:'#94A3B8',textTransform:'uppercase',fontWeight:700,marginBottom:4}}>{String(l)}</div>
            <div style={{fontSize:24,fontWeight:800,fontFamily:'Syne,sans-serif',color:String(c)}}>{String(v)}</div>
            <div style={{fontSize:12,color:'#94A3B8',marginTop:4}}>{String(s)}</div>
          </div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        <div style={{background:'#fff',borderRadius:16,border:'1px solid #E2E8F0',overflow:'hidden'}}>
          <div style={{padding:'16px 20px',borderBottom:'1px solid #E2E8F0',fontFamily:'Syne,sans-serif',fontWeight:700}}>{t.fee_table}</div>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr style={{background:'#F8FAFC'}}>{[lang==='fr'?'Type':'Type',lang==='fr'?'Taux':'Rate',lang==='fr'?'Base':'Base',lang==='fr'?'Revenu estimé':'Est. Revenue'].map(h=><th key={h} style={{textAlign:'left',padding:'10px 16px',fontSize:11,color:'#94A3B8',textTransform:'uppercase',fontWeight:700,borderBottom:'1px solid #E2E8F0'}}>{h}</th>)}</tr></thead>
            <tbody>
              {fees.map(([l,r,b,e,c],i)=>(
                <tr key={i} style={{borderBottom:i<fees.length-1?'1px solid #F1F5F9':'none',background:i%2===0?'#fff':'#FAFBFC'}}>
                  <td style={{padding:'12px 16px',fontSize:13,fontWeight:600}}>{l}</td>
                  <td style={{padding:'12px 16px'}}><span style={{fontSize:13,fontWeight:800,padding:'3px 10px',borderRadius:999,background:`${c}15`,color:String(c)}}>{r}</span></td>
                  <td style={{padding:'12px 16px',fontSize:12,color:'#5A6E8A'}}>{b}</td>
                  <td style={{padding:'12px 16px',fontSize:13,fontWeight:700,color:e==='Variable'?'#94A3B8':'#16a34a'}}>{e}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{background:'#fff',borderRadius:16,border:'1px solid #E2E8F0',padding:24}}>
          <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,marginBottom:20}}>{lang==='fr'?'Flux financiers mensuels 2026':'Monthly Financial Flows 2026'}</div>
          <div style={{display:'flex',alignItems:'flex-end',gap:6,height:160}}>
            {DATA.map((d,i)=>(
              <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4,height:'100%',justifyContent:'flex-end'}}>
                {d.v>0&&<div style={{fontSize:9,color:'#5A6E8A',fontWeight:600}}>{fmt(d.v).replace('₦','')}</div>}
                <div style={{width:'100%',borderRadius:'4px 4px 0 0',background:d.v>0?'#1B3A6B':'#E2E8F0',height:`${Math.max((d.v/MAX)*120,4)}px`,minHeight:4}}/>
                <div style={{fontSize:10,color:'#94A3B8'}}>{d.m}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:24,padding:16,background:'linear-gradient(135deg,#1B3A6B,#0D2347)',borderRadius:12}}>
            <div style={{color:'rgba(255,255,255,0.7)',fontSize:12,marginBottom:4}}>{lang==='fr'?'Revenu consolidé T1 2026':'Consolidated Revenue Q1 2026'}</div>
            <div style={{color:'#fff',fontFamily:'Syne,sans-serif',fontSize:30,fontWeight:900}}>₦75.6M</div>
            <div style={{color:'rgba(255,255,255,0.5)',fontSize:12,marginTop:4}}>{lang==='fr'?'Paiements + Frais + Adhésions PIC':'Payments + Fees + PIC Memberships'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
