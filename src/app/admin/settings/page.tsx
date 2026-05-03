// @ts-nocheck
'use client';
import { useEffect, useState } from 'react';
import { getLang, setLang, T, type Lang } from '@/lib/i18n';
import toast from 'react-hot-toast';

const COMPANY_KEY = 'binvest_admin_company';
const FEES_KEY = 'binvest_admin_fees';

export default function SettingsPage() {
  const [lang,setLangState]=useState<Lang>('fr');
  useEffect(()=>{ setLangState(getLang()); const h=()=>setLangState(getLang()); window.addEventListener('lang-change',h); return()=>window.removeEventListener('lang-change',h); },[]);
  const t=T[lang].settings;

  const [company,setCompany]=useState({name:'B INVEST LIMITED',ceo:'Raissa Bekamba',email:'contact@binvest.ng',country:'Nigeria'});
  const [fees,setFees]=useState({facilitation:'10',management:'3',resale:'15',exit:'30',pic:'50000'});

  // Charge les valeurs depuis localStorage au montage (persistance basique)
  useEffect(() => {
    try {
      const c = localStorage.getItem(COMPANY_KEY); if (c) setCompany(JSON.parse(c));
      const f = localStorage.getItem(FEES_KEY); if (f) setFees(JSON.parse(f));
    } catch {}
  }, []);

  const saveCompany = () => {
    try { localStorage.setItem(COMPANY_KEY, JSON.stringify(company)); } catch {}
    toast.success(t.saved);
  };
  const saveFees = () => {
    try { localStorage.setItem(FEES_KEY, JSON.stringify(fees)); } catch {}
    toast.success(t.saved);
  };

  // Export audit trail réel (CSV depuis l'API existante)
  const exportAudit = async () => {
    const id = toast.loading(lang === 'fr' ? 'Export en cours...' : 'Exporting...');
    try {
      const r = await fetch('/api/admin/audit?limit=1000', { credentials: 'include' });
      const d = await r.json();
      const rows = d.audit_logs ?? d.logs ?? [];
      const headers = ['id','admin_email','action','resource_type','resource_id','severity','ip_address','created_at'];
      const csv = [
        headers.join(','),
        ...rows.map((row: any) =>
          headers.map(h => {
            const v = row[h] ?? '';
            const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
          }).join(','),
        ),
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `audit-trail-${new Date().toISOString().slice(0,10)}.csv`;
      a.click(); URL.revokeObjectURL(url);
      toast.success(lang === 'fr' ? 'Export terminé' : 'Export complete', { id });
    } catch (e: any) {
      toast.error(e.message ?? 'Erreur', { id });
    }
  };

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
          <button onClick={saveCompany} style={{padding:'10px 20px',borderRadius:10,border:'none',background:'#1B3A6B',color:'#fff',cursor:'pointer',fontWeight:700,fontSize:14}}>{T[lang].common.save}</button>
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
          <button onClick={saveFees} style={{padding:'10px 20px',borderRadius:10,border:'none',background:'#1B3A6B',color:'#fff',cursor:'pointer',fontWeight:700,fontSize:14}}>{T[lang].common.save}</button>
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
            <button onClick={exportAudit} style={{padding:'12px 16px',borderRadius:10,border:'1px solid #E2E8F0',background:'#F8FAFC',cursor:'pointer',fontWeight:600,fontSize:14,textAlign:'left',color:'#374151'}}>📥 {lang === 'fr' ? 'Exporter l\'audit trail (CSV)' : 'Export audit trail (CSV)'}</button>
          </div>
        </div>

        {/* Exports Excel */}
        <div style={{background:'#fff',borderRadius:16,border:'1px solid #E2E8F0',padding:24}}>
          <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,marginBottom:6,fontSize:15}}>📊 {lang === 'fr' ? 'Exports Excel' : 'Excel Exports'}</div>
          <div style={{color:'#5A6E8A',fontSize:12,marginBottom:16}}>
            {lang === 'fr' ? 'Téléchargez les données au format Excel (.xls).' : 'Download data in Excel (.xls) format.'}
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {([
              ['investors', '👥', lang === 'fr' ? 'Investisseurs' : 'Investors'],
              ['subscriptions', '🏦', lang === 'fr' ? 'Souscriptions' : 'Subscriptions'],
              ['payments', '💳', lang === 'fr' ? 'Paiements' : 'Payments'],
            ] as const).map(([type, icon, label]) => (
              <a key={type}
                 href={`/api/admin/export?type=${type}`}
                 onClick={() => toast.success(lang === 'fr' ? 'Téléchargement...' : 'Downloading...')}
                 style={{padding:'12px 16px',borderRadius:10,border:'1px solid #E2E8F0',background:'#F8FAFC',fontWeight:600,fontSize:14,textAlign:'left',color:'#374151',textDecoration:'none',display:'block'}}>
                {icon} {lang === 'fr' ? `Exporter les ${label.toLowerCase()}` : `Export ${label.toLowerCase()}`} (.xls)
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
