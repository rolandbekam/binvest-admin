'use client';
import { useEffect, useState } from 'react';
import { getLang, setLang, T, type Lang } from '@/lib/i18n';
import toast from 'react-hot-toast';
export default function SettingsPage() {
  const [lang,setLangState]=useState<Lang>('fr');
  useEffect(()=>{ setLangState(getLang()); const h=()=>setLangState(getLang()); window.addEventListener('lang-change',h); return()=>window.removeEventListener('lang-change',h); },[]);
  const t=T[lang].settings;

  const [company,setCompany]=useState({name:'B INVEST LIMITED',ceo:'Raissa Bekamba',email:'contact@binvest.ng',country:'Nigeria'});
  const [fees,setFees]=useState({facilitation:'10',management:'3',resale:'15',exit:'30',pic:'50000'});

  const changeLang=(l:Lang)=>{ setLang(l); setLangState(l); toast.success(l==='fr'?'Langue : Français 🇫🇷':'Language: English 🇬🇧'); };

  return (
    <div style={{fontFamily:'Outfit,sans-serif'}}>
      <div style={{marginBottom:24}}><h2 style={{fontFamily:'Syne,sans-serif',fontSize:24,fontWeight:800,color:'#0F1E35',margin:0}}>{t.title}</h2></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>

        {/* Infos société */}
        <div style={{background:'#fff',borderRadius:16,border:'1px solid #E2E8F0',padding:24}}>
          <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,marginBottom:20,fontSize:15}}>{t.company}</div>
          {([['name',t.company_name],['ceo',t.ceo],['email',t.email],['country',t.country]] as const).map(([k,l])=>(
            <div key={k} style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:5}}>{l}</label>
              <input value={company[k]} onChange={e=>setCompany({...company,[k]:e.target.value})} style={{width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid #E2E8F0',fontSize:14,outline:'none',fontFamily:'Outfit,sans-serif'}}/>
            </div>
          ))}
          <button onClick={()=>toast.success(t.saved)} style={{padding:'10px 20px',borderRadius:10,border:'none',background:'#1B3A6B',color:'#fff',cursor:'pointer',fontWeight:700,fontSize:14}}>{t.save}</button>
        </div>

        {/* Frais */}
        <div style={{background:'#fff',borderRadius:16,border:'1px solid #E2E8F0',padding:24}}>
          <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,marginBottom:20,fontSize:15}}>{t.fees}</div>
          {([['facilitation',t.fee_f],['management',t.fee_m],['resale',t.fee_r],['exit',t.fee_exit],['pic',t.fee_pic]] as const).map(([k,l])=>(
            <div key={k} style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:5}}>{l}</label>
              <input type="number" value={fees[k]} onChange={e=>setFees({...fees,[k]:e.target.value})} style={{width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid #E2E8F0',fontSize:14,outline:'none',fontFamily:'Outfit,sans-serif'}}/>
            </div>
          ))}
          <button onClick={()=>toast.success(t.saved)} style={{padding:'10px 20px',borderRadius:10,border:'none',background:'#1B3A6B',color:'#fff',cursor:'pointer',fontWeight:700,fontSize:14}}>{t.save}</button>
        </div>

        {/* Langue */}
        <div style={{background:'#fff',borderRadius:16,border:'1px solid #E2E8F0',padding:24}}>
          <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,marginBottom:20,fontSize:15}}>{t.lang_label}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            {([['fr','🇫🇷 Français'] as const,['en','🇬🇧 English'] as const]).map(([l,label])=>(
              <button key={l} onClick={()=>changeLang(l)}
                style={{padding:'16px',borderRadius:12,border:`2px solid ${lang===l?'#1B3A6B':'#E2E8F0'}`,background:lang===l?'#1B3A6B':'#fff',cursor:'pointer',fontWeight:700,fontSize:15,color:lang===l?'#fff':'#374151',transition:'all 0.2s'}}>
                {label}
              </button>
            ))}
          </div>
          <div style={{marginTop:14,padding:12,background:'#F8FAFC',borderRadius:10,fontSize:13,color:'#5A6E8A'}}>
            {lang==='fr'?'Le panel s\'affichera en français sur tous les écrans.':'The panel will display in English on all screens.'}
          </div>
        </div>

        {/* Sécurité */}
        <div style={{background:'#fff',borderRadius:16,border:'1px solid #E2E8F0',padding:24}}>
          <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,marginBottom:20,fontSize:15}}>{t.security}</div>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <button onClick={()=>toast.success('Fonctionnalité bientôt disponible')} style={{padding:'12px 16px',borderRadius:10,border:'1px solid #E2E8F0',background:'#F8FAFC',cursor:'pointer',fontWeight:600,fontSize:14,textAlign:'left',color:'#374151'}}>🔑 {t.change_pwd}</button>
            <button onClick={()=>toast.success('Fonctionnalité bientôt disponible')} style={{padding:'12px 16px',borderRadius:10,border:'1px solid #E2E8F0',background:'#F8FAFC',cursor:'pointer',fontWeight:600,fontSize:14,textAlign:'left',color:'#374151'}}>📱 2FA Authentication</button>
            <button onClick={()=>toast.success('Export en cours...')} style={{padding:'12px 16px',borderRadius:10,border:'1px solid #E2E8F0',background:'#F8FAFC',cursor:'pointer',fontWeight:600,fontSize:14,textAlign:'left',color:'#374151'}}>📥 Exporter l'audit trail complet</button>
          </div>
        </div>
      </div>
    </div>
  );
}
