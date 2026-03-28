'use client';
import { useEffect, useState } from 'react';
import { getLang, T, type Lang } from '@/lib/i18n';
const NGX_STOCKS = [
  {symbol:'DANGCEM',name:'Dangote Cement',price:286.50,change:4.2,vol:'12.4M',sector:'Matériaux'},
  {symbol:'GTCO',name:'GTBank Holdings',price:42.30,change:1.8,vol:'28.1M',sector:'Banque'},
  {symbol:'ZENITH',name:'Zenith Bank',price:38.15,change:2.1,vol:'32.8M',sector:'Banque'},
  {symbol:'MTNN',name:'MTN Nigeria',price:224.80,change:-0.5,vol:'8.7M',sector:'Télécom'},
  {symbol:'UBA',name:'United Bank Africa',price:28.40,change:3.5,vol:'45.2M',sector:'Banque'},
  {symbol:'AIRTEL',name:'Airtel Africa',price:2185,change:0.8,vol:'1.9M',sector:'Télécom'},
  {symbol:'FBNH',name:'FBN Holdings',price:24.60,change:-1.2,vol:'18.4M',sector:'Banque'},
  {symbol:'NESTLE',name:'Nestle Nigeria',price:1590,change:-2.1,vol:'0.3M',sector:'FMCG'},
];
export default function NGXPage() {
  const [lang,setL]=useState<Lang>('fr');
  useEffect(()=>{ setL(getLang()); const h=()=>setL(getLang()); window.addEventListener('lang-change',h); return()=>window.removeEventListener('lang-change',h); },[]);
  const t=T[lang].ngx;
  return (
    <div style={{fontFamily:'Outfit,sans-serif'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24}}>
        <div><h2 style={{fontFamily:'Syne,sans-serif',fontSize:24,fontWeight:800,color:'#0F1E35',margin:0}}>{t.title}</h2><p style={{color:'#5A6E8A',fontSize:14,marginTop:4}}>{t.subtitle}</p></div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <span style={{fontSize:12,padding:'6px 14px',borderRadius:999,background:'#DCFCE7',color:'#166534',fontWeight:700}}>{t.market_open}</span>
          <button style={{padding:'8px 16px',borderRadius:10,border:'1px solid #E2E8F0',background:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>{t.refresh}</button>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
        {[[t.all_share,'98,432','+0.35%','📈','#1B3A6B'],[t.market_cap,'₦58.4T','+0.8%','🏦','#16a34a'],['NGX 30','3,847','+0.47%','💹','#C9963A'],[t.volume,'₦12.8B','—','📊','#E63946']].map(([l,v,c,ic,col])=>(
          <div key={String(l)} style={{background:'#fff',borderRadius:14,padding:'18px 20px',border:'1px solid #E2E8F0',boxShadow:'0 2px 8px rgba(27,58,107,0.06)',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',bottom:0,left:0,right:0,height:3,background:String(col)}}/>
            <div style={{fontSize:22,marginBottom:8}}>{String(ic)}</div>
            <div style={{fontSize:11,color:'#94A3B8',textTransform:'uppercase',fontWeight:700,marginBottom:4}}>{String(l)}</div>
            <div style={{fontSize:24,fontWeight:800,fontFamily:'Syne,sans-serif',color:'#0F1E35'}}>{String(v)}</div>
            <div style={{fontSize:12,color:String(c).startsWith('+')?'#16a34a':String(c).startsWith('-')?'#E63946':'#94A3B8',marginTop:4}}>{String(c)}</div>
          </div>
        ))}
      </div>
      <div style={{background:'#1B3A6B',borderRadius:14,padding:'12px 0',overflow:'hidden',marginBottom:24,position:'relative'}}>
        <div style={{display:'inline-flex',gap:32,whiteSpace:'nowrap',paddingLeft:20,animation:'tickerAnim 25s linear infinite'}}>
          {[...NGX_STOCKS,...NGX_STOCKS].map((s,i)=>(
            <span key={i} style={{fontFamily:'monospace',fontSize:13,color:'#fff',display:'inline-flex',alignItems:'center',gap:8}}>
              <span style={{color:'rgba(255,255,255,0.5)',fontSize:11}}>{s.symbol}</span>
              <span>₦{s.price.toLocaleString()}</span>
              <span style={{color:s.change>=0?'#4ADE80':'#F87171',fontWeight:700}}>{s.change>=0?'▲':'▼'}{Math.abs(s.change)}%</span>
            </span>
          ))}
        </div>
        <style>{`@keyframes tickerAnim{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'3fr 2fr',gap:20}}>
        <div style={{background:'#fff',borderRadius:16,border:'1px solid #E2E8F0',overflow:'hidden'}}>
          <div style={{padding:'16px 20px',borderBottom:'1px solid #E2E8F0',fontFamily:'Syne,sans-serif',fontWeight:700}}>{t.stocks}</div>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr style={{background:'#F8FAFC'}}>{[t.symbol,t.company,t.sector,t.price,t.change,'Volume'].map(h=><th key={h} style={{textAlign:'left',padding:'10px 16px',fontSize:11,color:'#94A3B8',textTransform:'uppercase',fontWeight:700,borderBottom:'1px solid #E2E8F0'}}>{h}</th>)}</tr></thead>
            <tbody>
              {NGX_STOCKS.map((s,i)=>(
                <tr key={s.symbol} style={{borderBottom:i<NGX_STOCKS.length-1?'1px solid #F1F5F9':'none'}}>
                  <td style={{padding:'12px 16px'}}><span style={{fontFamily:'monospace',fontSize:12,fontWeight:700,padding:'2px 8px',borderRadius:6,background:'#EFF6FF',color:'#1E40AF'}}>{s.symbol}</span></td>
                  <td style={{padding:'12px 16px',fontSize:13,color:'#0F1E35'}}>{s.name}</td>
                  <td style={{padding:'12px 16px',fontSize:12,color:'#5A6E8A'}}>{s.sector}</td>
                  <td style={{padding:'12px 16px',fontSize:14,fontWeight:700}}>₦{s.price.toLocaleString()}</td>
                  <td style={{padding:'12px 16px',fontSize:13,fontWeight:700,color:s.change>=0?'#16a34a':'#E63946'}}>{s.change>=0?'↑ +':'↓ '}{Math.abs(s.change)}%</td>
                  <td style={{padding:'12px 16px',fontSize:12,color:'#5A6E8A'}}>{s.vol}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{background:'#fff',borderRadius:16,border:'1px solid #E2E8F0',padding:24}}>
          <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,marginBottom:16}}>{t.integration}</div>
          {[{t:'API NGX Officielle',s:'Abonnement professionnel',c:'https://api.ngxgroup.com/v1/equities',b:'Officiel'},{t:'RapidAPI (Recommandé)',s:'~$10/mois · Temps réel',c:'rapidapi.com → "Nigerian Stock Exchange"',b:'⭐'},{t:'Alpha Vantage',s:'Gratuit 25 req/jour',c:'alphavantage.co · Clé gratuite',b:'Gratuit'}].map(o=>(
            <div key={o.t} style={{background:'#F8FAFC',borderRadius:10,padding:12,marginBottom:10,border:'1px solid #E2E8F0'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span style={{fontWeight:700,fontSize:13}}>{o.t}</span><span style={{fontSize:10,padding:'2px 8px',borderRadius:999,background:'#DBEAFE',color:'#1E40AF',fontWeight:700}}>{o.b}</span></div>
              <div style={{fontSize:12,color:'#5A6E8A',marginBottom:6}}>{o.s}</div>
              <code style={{fontSize:11,color:'#1B3A6B',fontFamily:'monospace',background:'#EFF6FF',padding:'3px 6px',borderRadius:4,display:'block'}}>{o.c}</code>
            </div>
          ))}
          <button style={{width:'100%',padding:'11px',borderRadius:10,border:'none',background:'#1B3A6B',color:'#fff',cursor:'pointer',fontWeight:700,marginTop:6}}>📧 Guide d'intégration</button>
        </div>
      </div>
    </div>
  );
}
