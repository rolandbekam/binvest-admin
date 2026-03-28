'use client';
import { useEffect, useState } from 'react';
import { getLang, T, type Lang } from '@/lib/i18n';
import toast from 'react-hot-toast';

export default function DocumentsPage() {
  const [lang, setL] = useState<Lang>('fr');
  useEffect(() => {
    setL(getLang());
    const h = () => setL(getLang());
    window.addEventListener('lang-change', h);
    return () => window.removeEventListener('lang-change', h);
  }, []);

  const t = T[lang].docs;
  const [downloading, setDownloading] = useState<string | null>(null);

  // Ouvre le document dans un nouvel onglet (imprimable en PDF via Ctrl+P)
  const download = async (type: string) => {
    setDownloading(type);
    try {
      const url = `/api/admin/documents/dia?type=${type}&lang=${lang}`;
      // Vérifier que la route répond
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error();
      // Ouvrir dans un nouvel onglet pour impression PDF
      window.open(url, '_blank');
      toast.success(lang === 'fr'
        ? '✅ Document ouvert — utilisez Ctrl+P pour sauvegarder en PDF'
        : '✅ Document opened — use Ctrl+P to save as PDF');
    } catch {
      toast.error(lang === 'fr' ? 'Erreur lors de la génération' : 'Generation error');
    }
    setDownloading(null);
  };

  type DocDef = {
    icon: string; color: string; bg: string; type: string;
    titleFr: string; titleEn: string;
    subFr: string; subEn: string;
    hasPdf: boolean;
  };

  const docs: DocDef[] = [
    {
      icon:'📄', color:'#1B3A6B', bg:'#EFF6FF', type:'dia',
      titleFr:'Contrat DIA', titleEn:'DIA Contract',
      subFr:'Direct Investment Account · 3 sections\nAgence · Holding · Séquestre',
      subEn:'Direct Investment Account · 3 sections\nAgency · Holding · Escrow',
      hasPdf: true,
    },
    {
      icon:'🧾', color:'#E63946', bg:'#FFF1F2', type:'ack',
      titleFr:'Accusé de réception', titleEn:'Payment Acknowledgement',
      subFr:'Confirmation de paiement\nB-Invest Limited',
      subEn:'Payment Confirmation\nB-Invest Limited',
      hasPdf: true,
    },
    {
      icon:'📋', color:'#16a34a', bg:'#F0FDF4', type:'pic',
      titleFr:'Constitution PIC', titleEn:'PIC Constitution',
      subFr:'Private Investment Circle\n19 articles · Gouvernance',
      subEn:'Private Investment Circle\n19 articles · Governance',
      hasPdf: false,
    },
    {
      icon:'🤝', color:'#C9963A', bg:'#FEFCE8', type:'joiner',
      titleFr:'Accord d\'adhésion', titleEn:'Investor Joiner Agreement',
      subFr:'Accord d\'adhésion investisseur\nB-Invest Limited',
      subEn:'Investor Joinder Agreement\nB-Invest Limited',
      hasPdf: false,
    },
    {
      icon:'🔗', color:'#7C3AED', bg:'#F5F3FF', type:'referral',
      titleFr:'Accord de parrainage', titleEn:'Referral Agreement',
      subFr:'Partenaire référent · 10% commission',
      subEn:'Referral Partner · 10% commission',
      hasPdf: false,
    },
  ];

  const flagEmoji = lang === 'fr' ? '🇫🇷' : '🇬🇧';
  const btnLabel  = (d: DocDef) => lang === 'fr'
    ? `🖨️ Ouvrir & imprimer en PDF`
    : `🖨️ Open & print as PDF`;
  const comingSoon = lang === 'fr' ? 'Bientôt disponible' : 'Coming soon';

  return (
    <div style={{ fontFamily:'Outfit,sans-serif' }}>

      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:24, fontWeight:800, color:'#0F1E35', margin:0 }}>
          {t.title}
        </h2>
        <p style={{ color:'#5A6E8A', fontSize:14, marginTop:4 }}>{t.subtitle}</p>
      </div>

      {/* Bandeau langue active */}
      <div style={{ background: lang === 'fr' ? '#EFF6FF' : '#F0FDF4', border:`1px solid ${lang==='fr'?'#BFDBFE':'#86EFAC'}`, borderRadius:12, padding:'12px 18px', marginBottom:24, display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ fontSize:24 }}>{flagEmoji}</span>
        <div>
          <div style={{ fontWeight:700, color: lang==='fr'?'#1E40AF':'#166534', fontSize:14 }}>
            {lang === 'fr'
              ? 'Les documents seront générés en français'
              : 'Documents will be generated in English'}
          </div>
          <div style={{ color: lang==='fr'?'#3B82F6':'#22C55E', fontSize:13, marginTop:2 }}>
            {lang === 'fr'
              ? 'Changez la langue dans le menu latéral pour basculer en anglais.'
              : 'Change the language in the sidebar to switch to French.'}
          </div>
        </div>
        <div style={{ marginLeft:'auto', fontSize:11, padding:'4px 12px', borderRadius:999, background: lang==='fr'?'#DBEAFE':'#DCFCE7', color: lang==='fr'?'#1E40AF':'#166534', fontWeight:700 }}>
          {lang === 'fr' ? 'Langue active : Français' : 'Active language: English'}
        </div>
      </div>

      {/* Grille documents */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20 }}>
        {docs.map(d => {
          const isDownloading = downloading === d.type;
          return (
            <div key={d.type}
              style={{ background:'#fff', borderRadius:16, border:'1px solid #E2E8F0', overflow:'hidden', boxShadow:'0 2px 8px rgba(27,58,107,0.05)', transition:'transform 0.2s, box-shadow 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(27,58,107,0.1)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(27,58,107,0.05)'; }}
            >
              {/* Top color bar */}
              <div style={{ height:4, background:`linear-gradient(90deg,${d.color},${d.color}88)` }} />

              <div style={{ padding:22 }}>
                {/* Icône + titre */}
                <div style={{ display:'flex', alignItems:'flex-start', gap:14, marginBottom:14 }}>
                  <div style={{ width:54, height:54, borderRadius:14, background:d.bg, display:'flex', alignItems:'center', justifyContent:'center', border:`2px solid ${d.color}22`, flexShrink:0 }}>
                    <span style={{ fontSize:26 }}>{d.icon}</span>
                  </div>
                  <div>
                    <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:15, color:'#0F1E35', marginBottom:4 }}>
                      {lang === 'fr' ? d.titleFr : d.titleEn}
                    </div>
                    <div style={{ fontSize:11, color:'#5A6E8A', lineHeight:1.6, whiteSpace:'pre-line' }}>
                      {lang === 'fr' ? d.subFr : d.subEn}
                    </div>
                  </div>
                </div>

                {/* Badge PDF / à venir */}
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:14 }}>
                  {d.hasPdf ? (
                    <span style={{ fontSize:11, padding:'3px 10px', borderRadius:999, background:`${d.color}15`, color:d.color, fontWeight:700, border:`1px solid ${d.color}30` }}>
                      ✅ PDF disponible
                    </span>
                  ) : (
                    <span style={{ fontSize:11, padding:'3px 10px', borderRadius:999, background:'#F1F5F9', color:'#94A3B8', fontWeight:600 }}>
                      🚧 PDF bientôt disponible
                    </span>
                  )}
                  <span style={{ fontSize:11, padding:'3px 10px', borderRadius:999, background: lang==='fr'?'#DBEAFE':'#DCFCE7', color: lang==='fr'?'#1E40AF':'#166534', fontWeight:600 }}>
                    {flagEmoji}
                  </span>
                </div>

                {/* Bouton téléchargement unique */}
                {d.hasPdf ? (
                  <button
                    onClick={() => download(d.type)}
                    disabled={isDownloading}
                    style={{
                      width:'100%', padding:'11px 14px', borderRadius:10,
                      border:`2px solid ${isDownloading ? '#E2E8F0' : d.color}`,
                      background: isDownloading ? '#F8FAFC' : d.bg,
                      color: isDownloading ? '#94A3B8' : d.color,
                      cursor: isDownloading ? 'not-allowed' : 'pointer',
                      fontWeight:700, fontSize:13,
                      display:'flex', alignItems:'center', gap:8,
                      transition:'all 0.2s',
                    }}>
                    <span>{isDownloading ? '⏳' : flagEmoji}</span>
                    <span style={{ flex:1, textAlign:'left' }}>
                      {isDownloading
                        ? (lang === 'fr' ? 'Génération en cours...' : 'Generating...')
                        : btnLabel(d)
                      }
                    </span>
                    <span style={{ fontSize:11, opacity:0.6, fontWeight:400 }}>PDF</span>
                  </button>
                ) : (
                  <button
                    onClick={() => toast.success(lang === 'fr' ? 'Disponible dans la prochaine version !' : 'Available in the next version!')}
                    style={{ width:'100%', padding:'11px 14px', borderRadius:10, border:'1px solid #E2E8F0', background:'#F8FAFC', color:'#94A3B8', cursor:'pointer', fontWeight:600, fontSize:13, display:'flex', alignItems:'center', gap:8 }}>
                    <span>🚧</span>
                    <span>{comingSoon}</span>
                    <span style={{ marginLeft:'auto', fontSize:10, padding:'2px 8px', borderRadius:999, background:'#E2E8F0', color:'#64748B' }}>v2</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Nouveau template */}
        <div
          style={{ background:'#fff', borderRadius:16, border:'2px dashed #E2E8F0', padding:22, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, minHeight:200, cursor:'pointer' }}
          onClick={() => toast.success(lang === 'fr' ? 'Fonctionnalité bientôt disponible' : 'Coming soon')}>
          <span style={{ fontSize:36 }}>➕</span>
          <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, color:'#94A3B8', textAlign:'center' }}>{t.add_new}</div>
          <div style={{ fontSize:12, color:'#CBD5E1', textAlign:'center' }}>
            {lang === 'fr' ? 'Ajouter un modèle de document' : 'Add a document template'}
          </div>
        </div>
      </div>
    </div>
  );
}
