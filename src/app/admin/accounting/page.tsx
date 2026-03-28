// @ts-nocheck
'use client';
// src/app/admin/accounting/page.tsx
// Comptabilité B-Invest — CA temps réel et par période

import { useEffect, useState } from 'react';
import { getLang, T, type Lang } from '@/lib/i18n';

function fmt(n: number, currency = '₦') {
  if (!n) return `${currency}0`;
  if (n >= 1_000_000_000) return `${currency}${(n/1_000_000_000).toFixed(2)}Mrd`;
  if (n >= 1_000_000) return `${currency}${(n/1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${currency}${(n/1_000).toFixed(0)}K`;
  return `${currency}${n.toLocaleString()}`;
}

const MONTHS_FR = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CURRENT_YEAR = new Date().getFullYear();

export default function AccountingPage() {
  const [lang, setL] = useState<Lang>('fr');
  useEffect(() => { setL(getLang()); const h = () => setL(getLang()); window.addEventListener('lang-change', h); return () => window.removeEventListener('lang-change', h); }, []);
  const t = T[lang].accounting;
  const MONTHS = lang === 'fr' ? MONTHS_FR : MONTHS_EN;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'month'|'quarter'|'year'|'custom'>('year');
  const [year, setYear] = useState(CURRENT_YEAR);
  const [activeTab, setActiveTab] = useState<'overview'|'revenues'|'projets'|'transactions'>('overview');

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/accounting?period=${period}&year=${year}`, { credentials:'include' });
      const d = await r.json();
      setData(d);
    } catch {
      setData(DEMO_DATA);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [period, year]);

  const d = data ?? DEMO_DATA;
  const maxBar = Math.max(...(d.monthly ?? []).map((m: any) => Math.max(m.total_received, m.facilitation_fees)), 1);

  const TABS = [
    { key:'overview', label: t.overview },
    { key:'revenues', label: t.revenues },
    { key:'projets', label: t.by_project },
    { key:'transactions', label: t.transactions },
  ];

  return (
    <div style={{ fontFamily:'Outfit,sans-serif' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:24, fontWeight:800, color:'#0F1E35', margin:0 }}>
            {t.title}
          </h2>
          <p style={{ color:'#5A6E8A', fontSize:14, marginTop:4 }}>{t.subtitle}</p>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <div style={{ display:'flex', gap:4, background:'#F1F5F9', padding:4, borderRadius:10 }}>
            {(['month','quarter','year'] as const).map(p => (
              <button key={p} onClick={()=>setPeriod(p)}
                style={{ padding:'7px 14px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
                  background:period===p?'#fff':'transparent', color:period===p?'#0F1E35':'#5A6E8A',
                  boxShadow:period===p?'0 2px 6px rgba(27,58,107,0.08)':'none' }}>
                {p==='month'?t.this_month:p==='quarter'?t.quarter:t.year}
              </button>
            ))}
          </div>
          <select value={year} onChange={e=>setYear(Number(e.target.value))}
            style={{ padding:'8px 12px', borderRadius:10, border:'1px solid #E2E8F0', fontSize:14, outline:'none' }}>
            {[2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={load} style={{ padding:'8px 16px', borderRadius:10, border:'1px solid #E2E8F0', background:'#fff', cursor:'pointer', fontSize:13, fontWeight:600, color:'#1B3A6B' }}>
            {T[lang].common.refresh}
          </button>
        </div>
      </div>

      {/* KPIs principaux */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
        {[
          { label: t.total_received, value: fmt(d.total_received), sub:`+${d.growth_pct??0}% vs ${lang==='fr'?'période préc.':'prev. period'}`, color:'#1B3A6B', icon:'💰', trend:'up' },
          { label: t.facilitation, value: fmt(d.facilitation_fees), sub:`${d.subs_count??0} ${lang==='fr'?'souscriptions':'subscriptions'}`, color:'#E63946', icon:'💼', trend:'up' },
          { label: t.management, value: fmt(d.management_fees), sub:`${d.active_projects??0} ${lang==='fr'?'projets actifs':'active projects'}`, color:'#C9963A', icon:'🏗️', trend:'up' },
          { label: t.pic_fees, value: fmt(d.pic_fees), sub:`${d.pic_members??0} ${lang==='fr'?'membres × 50K XAF':'members × 50K XAF'}`, color:'#7C3AED', icon:'🤝', trend:'up' },
        ].map(k => (
          <div key={k.label} style={{ background:'#fff', borderRadius:16, padding:'20px 22px', border:'1px solid #E2E8F0', boxShadow:'0 2px 12px rgba(27,58,107,0.06)', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', bottom:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${k.color},${k.color}60)` }} />
            <div style={{ fontSize:22, marginBottom:10 }}>{k.icon}</div>
            <div style={{ fontSize:11, color:'#94A3B8', textTransform:'uppercase', fontWeight:700, marginBottom:4, letterSpacing:'0.5px' }}>{k.label}</div>
            <div style={{ fontSize:26, fontWeight:800, color:k.color, fontFamily:'Syne,sans-serif', letterSpacing:'-0.5px' }}>{k.value}</div>
            <div style={{ fontSize:12, color:'#94A3B8', marginTop:4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Revenu total consolidé */}
      <div style={{ background:`linear-gradient(135deg, #1B3A6B, #0D2347)`, borderRadius:20, padding:28, marginBottom:24, color:'#fff' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:13, opacity:0.7, marginBottom:4 }}>{t.total_revenue} {period==='year'?`${year}`:period==='month'?(lang==='fr'?'ce mois':'this month'):(lang==='fr'?'ce trimestre':'this quarter')}</div>
            <div style={{ fontSize:42, fontWeight:900, fontFamily:'Syne,sans-serif', letterSpacing:'-1px' }}>
              {fmt((d.total_received||0) + (d.management_fees||0) + (d.pic_fees||0))}
            </div>
            <div style={{ fontSize:13, opacity:0.6, marginTop:4 }}>Paiements reçus + Frais gestion + Adhésions PIC</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:13, opacity:0.6, marginBottom:4 }}>{t.recovery_rate}</div>
            <div style={{ fontSize:36, fontWeight:800, fontFamily:'Syne,sans-serif', color:'#4ADE80' }}>{d.recovery_rate??0}%</div>
            <div style={{ fontSize:12, opacity:0.5 }}>{d.paid_tranches??0}/{d.total_tranches??0} {t.tranches_paid}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, background:'#F1F5F9', padding:4, borderRadius:12, marginBottom:24 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={()=>setActiveTab(t.key as any)}
            style={{ flex:1, padding:'9px 14px', borderRadius:10, border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
              background:activeTab===t.key?'#fff':'transparent', color:activeTab===t.key?'#0F1E35':'#5A6E8A',
              boxShadow:activeTab===t.key?'0 2px 8px rgba(27,58,107,0.08)':'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:20 }}>
          {/* Graphique mensuel */}
          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E2E8F0', padding:24 }}>
            <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, marginBottom:20, fontSize:16 }}>
              {t.monthly_chart} {year}
            </div>
            <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:180 }}>
              {(d.monthly ?? []).map((m: any, i: number) => (
                <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6, height:'100%', justifyContent:'flex-end' }}>
                  <div style={{ fontSize:10, color:'#94A3B8', fontWeight:600, marginBottom:2 }}>{fmt(m.total_received,'')}</div>
                  <div style={{ width:'100%', display:'flex', gap:2, alignItems:'flex-end', height:140 }}>
                    <div style={{ flex:1, borderRadius:'3px 3px 0 0', background:'#1B3A6B', height:`${Math.max((m.total_received/maxBar)*140,4)}px`, minHeight:4 }} title={`Reçu: ${fmt(m.total_received)}`} />
                    <div style={{ flex:1, borderRadius:'3px 3px 0 0', background:'#E63946', height:`${Math.max((m.facilitation_fees/maxBar)*140,4)}px`, minHeight:4 }} title={`Frais: ${fmt(m.facilitation_fees)}`} />
                  </div>
                  <div style={{ fontSize:10, color:'#94A3B8', textTransform:'capitalize' }}>{MONTHS_FR[m.month-1]}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:16, justifyContent:'center', marginTop:12 }}>
              {[['#1B3A6B', lang==='fr'?'Paiements reçus':'Payments received'],['#E63946', lang==='fr'?'Frais facilitation':'Facilitation fees']].map(([c,l])=>(
                <div key={l} style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:10,height:10,borderRadius:2,background:c }} />
                  <span style={{ fontSize:12,color:'#5A6E8A' }}>{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Répartition revenus */}
          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E2E8F0', padding:24 }}>
            <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, marginBottom:20, fontSize:16 }}>
              {t.revenue_breakdown}
            </div>
            {[
              { label: t.facilitation, amount: d.facilitation_fees??0, color:'#E63946', pct: d.facilitation_pct??45 },
              { label: lang==='fr'?'Paiements bruts':'Gross Payments', amount: d.total_received??0, color:'#1B3A6B', pct: d.received_pct??35 },
              { label: t.management, amount: d.management_fees??0, color:'#C9963A', pct: d.management_pct??12 },
              { label: t.pic_fees, amount: d.pic_fees??0, color:'#7C3AED', pct: d.pic_pct??8 },
            ].map(item => (
              <div key={item.label} style={{ marginBottom:16 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ fontSize:13, fontWeight:500, color:'#374151' }}>{item.label}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:'#0F1E35' }}>{fmt(item.amount)}</span>
                </div>
                <div style={{ height:7, background:'#F1F5F9', borderRadius:4, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${item.pct}%`, background:item.color, borderRadius:4 }} />
                </div>
                <div style={{ fontSize:11, color:'#94A3B8', marginTop:2 }}>{item.pct}% du total</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── REVENUS ── */}
      {activeTab === 'revenues' && (
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E2E8F0', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#F8FAFC' }}>
                {[t.period, t.total_received, t.facilitation, t.management, t.pic_fees, lang==='fr'?'Total période':'Period Total', t.cumul].map(h=>(
                  <th key={h} style={{ textAlign:'left', padding:'11px 16px', fontSize:11, color:'#94A3B8', textTransform:'uppercase', fontWeight:700, borderBottom:'1px solid #E2E8F0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(d.monthly ?? []).map((m: any, i: number) => {
                const total = (m.total_received||0) + (m.facilitation_fees||0) + (m.management_fees||0) + (m.pic_fees||0);
                const cumul = (d.monthly??[]).slice(0,i+1).reduce((s:number,x:any)=>s+(x.total_received||0)+(x.facilitation_fees||0),0);
                return (
                  <tr key={i} style={{ borderBottom:'1px solid #F1F5F9', background:i%2===0?'#fff':'#FAFBFC' }}>
                    <td style={{ padding:'13px 16px', fontWeight:700, color:'#0F1E35', fontSize:14 }}>{MONTHS_FR[m.month-1]} {year}</td>
                    <td style={{ padding:'13px 16px', color:'#1B3A6B', fontWeight:600 }}>{fmt(m.total_received||0)}</td>
                    <td style={{ padding:'13px 16px', color:'#E63946', fontWeight:600 }}>{fmt(m.facilitation_fees||0)}</td>
                    <td style={{ padding:'13px 16px', color:'#C9963A', fontWeight:600 }}>{fmt(m.management_fees||0)}</td>
                    <td style={{ padding:'13px 16px', color:'#7C3AED', fontWeight:600 }}>{fmt(m.pic_fees||0)}</td>
                    <td style={{ padding:'13px 16px', fontWeight:800, color:'#0F1E35', fontSize:15, fontFamily:'Syne,sans-serif' }}>{fmt(total)}</td>
                    <td style={{ padding:'13px 16px', color:'#5A6E8A', fontSize:13 }}>{fmt(cumul)}</td>
                  </tr>
                );
              })}
              {/* Total */}
              <tr style={{ background:'#1B3A6B', color:'#fff' }}>
                <td style={{ padding:'14px 16px', fontWeight:800, fontFamily:'Syne,sans-serif' }}>TOTAL {year}</td>
                <td style={{ padding:'14px 16px', fontWeight:800 }}>{fmt(d.total_received||0)}</td>
                <td style={{ padding:'14px 16px', fontWeight:800 }}>{fmt(d.facilitation_fees||0)}</td>
                <td style={{ padding:'14px 16px', fontWeight:800 }}>{fmt(d.management_fees||0)}</td>
                <td style={{ padding:'14px 16px', fontWeight:800 }}>{fmt(d.pic_fees||0)}</td>
                <td style={{ padding:'14px 16px', fontWeight:800, fontSize:16 }}>
                  {fmt((d.total_received||0)+(d.facilitation_fees||0)+(d.management_fees||0)+(d.pic_fees||0))}
                </td>
                <td style={{ padding:'14px 16px' }}>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ── PAR PROJET ── */}
      {activeTab === 'projets' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {(d.by_project ?? []).map((p: any) => {
            const pct = p.target > 0 ? Math.round(p.raised * 100 / p.target) : 0;
            return (
              <div key={p.id} style={{ background:'#fff', borderRadius:16, border:'1px solid #E2E8F0', padding:24 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                  <div>
                    <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:18, color:'#0F1E35' }}>{p.name}</div>
                    <div style={{ color:'#5A6E8A', fontSize:13, marginTop:2 }}>{p.investors} {lang==='fr'?'investisseur(s)':'investor(s)'} · {p.subscriptions} {lang==='fr'?'souscription(s)':'subscription(s)'}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:22, fontWeight:800, fontFamily:'Syne,sans-serif', color:'#1B3A6B' }}>{fmt(p.raised)}</div>
                    <div style={{ fontSize:12, color:'#94A3B8' }}>/ {fmt(p.target)} ({pct}%)</div>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:14 }}>
                  {[
                    [t.facilitation, fmt(p.facilitation_fees), '#E63946'],
                    [lang==='fr'?'Frais gestion estimés':'Est. Management Fees', fmt(p.management_fees_annual), '#C9963A'],
                    [lang==='fr'?'Commission revente':'Resale Commission', `${p.resale_pct}%`, '#7C3AED'],
                    [lang==='fr'?'Tranches reçues':'Instalments received', `${p.paid_tranches}/${p.total_tranches}`, '#16a34a'],
                  ].map(([l,v,c])=>(
                    <div key={l} style={{ background:'#F8FAFC', borderRadius:10, padding:12, borderLeft:`3px solid ${c}` }}>
                      <div style={{ fontSize:11, color:'#94A3B8', marginBottom:4 }}>{l}</div>
                      <div style={{ fontSize:16, fontWeight:700, color:'#0F1E35' }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ height:7, background:'#F1F5F9', borderRadius:4, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${pct}%`, background:'#1B3A6B', borderRadius:4, transition:'width 0.5s' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TRANSACTIONS ── */}
      {activeTab === 'transactions' && (
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E2E8F0', overflow:'hidden' }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:16 }}>{lang==='fr'?'Toutes les transactions':'All Transactions'}</span>
            <button style={{ padding:'7px 14px', borderRadius:8, border:'1px solid #E2E8F0', background:'#fff', cursor:'pointer', fontSize:12, fontWeight:600, color:'#1B3A6B' }}>
              {t.export_csv}
            </button>
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#F8FAFC' }}>
                {[T[lang].common.date, lang==='fr'?'Investisseur':'Investor', lang==='fr'?'Projet':'Project', lang==='fr'?'Tranche':'Instalment', T[lang].common.amount, lang==='fr'?'Méthode':'Method', lang==='fr'?'Référence':'Reference', T[lang].common.status].map(h=>(
                  <th key={h} style={{ textAlign:'left', padding:'10px 16px', fontSize:11, color:'#94A3B8', textTransform:'uppercase', fontWeight:700, borderBottom:'1px solid #E2E8F0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(d.transactions ?? []).map((t: any, i: number) => (
                <tr key={i} style={{ borderBottom:'1px solid #F1F5F9' }}>
                  <td style={{ padding:'12px 16px', fontSize:12, color:'#5A6E8A', fontFamily:'monospace' }}>{t.date ? new Date(t.date).toLocaleDateString('fr-FR') : '—'}</td>
                  <td style={{ padding:'12px 16px', fontSize:13, fontWeight:600, color:'#0F1E35' }}>{t.investor_name}</td>
                  <td style={{ padding:'12px 16px', fontSize:13, color:'#5A6E8A' }}>{t.project_name}</td>
                  <td style={{ padding:'12px 16px', fontSize:12 }}>#{t.tranche_number}</td>
                  <td style={{ padding:'12px 16px', fontSize:14, fontWeight:700, color:'#16a34a' }}>{fmt(t.amount)}</td>
                  <td style={{ padding:'12px 16px', fontSize:12, color:'#5A6E8A' }}>{t.method?.replace(/_/g,' ')}</td>
                  <td style={{ padding:'12px 16px', fontSize:11, fontFamily:'monospace', color:'#94A3B8' }}>{t.reference}</td>
                  <td style={{ padding:'12px 16px' }}>
                    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:'#DCFCE7', color:'#166534', fontWeight:600 }}>✓ {lang==='fr'?'Reçu':'Received'}</span>
                  </td>
                </tr>
              ))}
              {(d.transactions ?? []).length === 0 && (
                <tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:'#94A3B8' }}>{lang==='fr'?'Aucune transaction sur cette période':'No transactions for this period'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Données démo
const DEMO_DATA = {
  total_received: 48500000, facilitation_fees: 4850000,
  management_fees: 1455000, pic_fees: 1850000,
  growth_pct: 12, subs_count: 18, active_projects: 4,
  pic_members: 37, recovery_rate: 87,
  paid_tranches: 23, total_tranches: 31,
  facilitation_pct: 45, received_pct: 35, management_pct: 12, pic_pct: 8,
  monthly: [
    { month:1, total_received:8200000, facilitation_fees:820000, management_fees:245000, pic_fees:300000 },
    { month:2, total_received:9500000, facilitation_fees:950000, management_fees:285000, pic_fees:150000 },
    { month:3, total_received:12000000, facilitation_fees:1200000, management_fees:360000, pic_fees:200000 },
    { month:4, total_received:7800000, facilitation_fees:780000, management_fees:234000, pic_fees:100000 },
    { month:5, total_received:11000000, facilitation_fees:1100000, management_fees:330000, pic_fees:250000 },
    { month:6, total_received:0, facilitation_fees:0, management_fees:0, pic_fees:0 },
    { month:7, total_received:0, facilitation_fees:0, management_fees:0, pic_fees:0 },
    { month:8, total_received:0, facilitation_fees:0, management_fees:0, pic_fees:0 },
    { month:9, total_received:0, facilitation_fees:0, management_fees:0, pic_fees:0 },
    { month:10, total_received:0, facilitation_fees:0, management_fees:0, pic_fees:0 },
    { month:11, total_received:0, facilitation_fees:0, management_fees:0, pic_fees:0 },
    { month:12, total_received:0, facilitation_fees:0, management_fees:0, pic_fees:0 },
  ],
  by_project: [
    { id:'p1', name:'Palmeraie Ogun State', target:50000000, raised:32000000, investors:8, subscriptions:8, facilitation_fees:3200000, management_fees_annual:960000, resale_pct:15, paid_tranches:12, total_tranches:18 },
    { id:'p2', name:'Land Banking Lagos North', target:80000000, raised:64000000, investors:12, subscriptions:12, facilitation_fees:6400000, management_fees_annual:1920000, resale_pct:15, paid_tranches:8, total_tranches:10 },
    { id:'p3', name:'Champ de Manioc Oyo', target:20000000, raised:12000000, investors:6, subscriptions:6, facilitation_fees:1200000, management_fees_annual:360000, resale_pct:15, paid_tranches:3, total_tranches:6 },
  ],
  transactions: [
    { date:'2026-03-18', investor_name:'Jean Paul Mbarga', project_name:'Land Banking Lagos North', tranche_number:1, amount:2000000, method:'bank_transfer', reference:'TRF2026031801' },
    { date:'2026-03-15', investor_name:'Adaora Okafor', project_name:'Land Banking Lagos North', tranche_number:1, amount:2500000, method:'bank_transfer', reference:'TRF2026031502' },
    { date:'2026-03-12', investor_name:'Kofi Asante', project_name:'Palmeraie Ogun State', tranche_number:1, amount:1000000, method:'mobile_money', reference:'MTN2026031201' },
    { date:'2026-03-05', investor_name:'Marie Ongono', project_name:'Palmeraie Ogun State', tranche_number:1, amount:500000, method:'bank_transfer', reference:'TRF2026030501' },
  ],
};
