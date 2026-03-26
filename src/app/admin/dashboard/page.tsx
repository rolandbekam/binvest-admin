'use client';
import { useEffect, useState, useCallback } from 'react';
import { getLang, T, type Lang } from '@/lib/i18n';
import toast from 'react-hot-toast';

const fmt = (n: number) => n >= 1e9 ? `₦${(n/1e9).toFixed(1)}Mrd` : n >= 1e6 ? `₦${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `₦${(n/1e3).toFixed(0)}K` : `₦${n||0}`;
const MONTHS_FR = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Graphique barres SVG intégré
function BarChart({ data, color='#1B3A6B', color2='#C9963A', height=140 }: { data: {label:string;v1:number;v2:number}[]; color?:string; color2?:string; height?:number }) {
  const max = Math.max(...data.map(d => Math.max(d.v1, d.v2)), 1);
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:6, height, paddingTop:16 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, height:'100%', justifyContent:'flex-end' }}>
          <div style={{ display:'flex', gap:2, alignItems:'flex-end', width:'100%', height: height - 20 }}>
            <div style={{ flex:1, borderRadius:'3px 3px 0 0', background:color, height:`${Math.max(d.v1/max*100,3)}%`, minHeight:3, transition:'height 0.5s ease' }} />
            <div style={{ flex:1, borderRadius:'3px 3px 0 0', background:color2, height:`${Math.max(d.v2/max*100,3)}%`, minHeight:3, transition:'height 0.5s ease' }} />
          </div>
          <div style={{ fontSize:10, color:'#94A3B8', textAlign:'center' }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

// Graphique donut SVG
function DonutChart({ segments, size=120 }: { segments: {value:number;color:string;label:string}[]; size?:number }) {
  const total = segments.reduce((s,x) => s + x.value, 0) || 1;
  const r = 40; const cx = size/2; const cy = size/2;
  let cumAngle = -Math.PI / 2;
  const paths = segments.map(seg => {
    const angle = (seg.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(cumAngle);
    const y1 = cy + r * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + r * Math.cos(cumAngle);
    const y2 = cy + r * Math.sin(cumAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    return { d:`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`, color:seg.color, label:seg.label, value:seg.value };
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {paths.map((p, i) => <path key={i} d={p.d} fill={p.color} opacity={0.85} stroke="#fff" strokeWidth={1} />)}
      <circle cx={cx} cy={cy} r={26} fill="#fff" />
    </svg>
  );
}

// Mini sparkline SVG
function Sparkline({ values, color='#1B3A6B', height=40, width=120 }: { values:number[]; color?:string; height?:number; width?:number }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ display:'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={`0,${height} ${pts} ${width},${height}`} fill={color} fillOpacity={0.08} stroke="none" />
    </svg>
  );
}

const DEMO_STATS = {
  total_raised_ngn: 130000000, active_projects: 4, total_investors: 37,
  pending_payments: 6, late_payments: 1, total_subscriptions: 18, monthly_received: 8200000,
};
const MONTHS_DATA = [
  {v1:8200000,v2:820000},{v1:9500000,v2:950000},{v1:12000000,v2:1200000},
  {v1:7800000,v2:780000},{v1:11000000,v2:1100000},{v1:0,v2:0},
  {v1:0,v2:0},{v1:0,v2:0},{v1:0,v2:0},{v1:0,v2:0},{v1:0,v2:0},{v1:0,v2:0},
];
const COUNTRIES = [{value:18,color:'#1B3A6B',label:'CM'},{value:10,color:'#E63946',label:'NG'},{value:5,color:'#C9963A',label:'GH'},{value:4,color:'#16a34a',label:'SN'}];
const PROJECTS_DATA = [
  {name:'Land Banking Lagos',raised:64000000,target:80000000,color:'#1B3A6B'},
  {name:'Palmeraie Ogun',raised:32000000,target:50000000,color:'#16a34a'},
  {name:'Capital Markets',raised:22000000,target:30000000,color:'#E63946'},
  {name:'Manioc Oyo',raised:12000000,target:20000000,color:'#65a30d'},
];
const RECENT_SUBS = [
  {investor:'Jean Paul Mbarga',project:'Land Banking Lagos',amount:2000000,status:'complete'},
  {investor:'Marie Ongono',project:'Palmeraie Ogun',amount:1000000,status:'partial'},
  {investor:'Adaora Okafor',project:'Land Banking Lagos',amount:5000000,status:'partial'},
  {investor:'Rose Bella',project:'Capital Markets',amount:550000,status:'complete'},
];
const SPARKLINES = {raised:[80,90,110,105,130], investors:[28,30,32,35,37]};

export default function DashboardPage() {
  const [lang, setL] = useState<Lang>('fr');
  const [stats, setStats] = useState(DEMO_STATS);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    setL(getLang());
    const h = () => setL(getLang());
    window.addEventListener('lang-change', h);
    return () => window.removeEventListener('lang-change', h);
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/stats', { credentials:'include' });
      const d = await r.json();
      if (d.stats) { setStats(d.stats); setLastUpdate(new Date()); }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStats();
    // Realtime: rafraîchissement toutes les 30 secondes
    const interval = setInterval(() => { loadStats(); }, 30000);
    return () => clearInterval(interval);
  }, [loadStats]);

  const t = T[lang];
  const MONTHS = lang === 'fr' ? MONTHS_FR : MONTHS_EN;
  const chartData = MONTHS_DATA.map((m, i) => ({ label: MONTHS[i], v1: m.v1, v2: m.v2 }));

  const STATUS_STYLE: Record<string,{bg:string;text:string}> = {
    complete:{bg:'#DCFCE7',text:'#166534'}, partial:{bg:'#FEF9C3',text:'#854D0E'},
    pending:{bg:'#F1F5F9',text:'#64748B'}, active:{bg:'#DBEAFE',text:'#1E40AF'},
  };
  const STATUS_LABEL_FR: Record<string,string> = { complete:'Complet', partial:'Partiel', pending:'En attente', active:'Actif' };
  const STATUS_LABEL_EN: Record<string,string> = { complete:'Complete', partial:'Partial', pending:'Pending', active:'Active' };

  return (
    <div style={{ fontFamily:'Outfit,sans-serif' }}>
      {/* Header + realtime indicator */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:24, fontWeight:800, color:'#0F1E35', margin:0 }}>{t.dashboard.title}</h2>
          <p style={{ color:'#5A6E8A', fontSize:13, marginTop:4 }}>
            {new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
          </p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#16a34a', background:'#DCFCE7', padding:'6px 12px', borderRadius:999 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:'#16a34a', animation:'pulse 2s infinite' }} />
            {lang === 'fr' ? 'En direct' : 'Live'} · {lastUpdate.toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-GB', { hour:'2-digit', minute:'2-digit' })}
          </div>
          <button onClick={loadStats} style={{ padding:'7px 14px', borderRadius:10, border:'1px solid #E2E8F0', background:'#fff', cursor:'pointer', fontSize:13, fontWeight:600, color:'#1B3A6B' }}>
            {t.common.refresh}
          </button>
        </div>
      </div>

      {/* Kente stripe */}
      <div style={{ display:'flex', height:4, borderRadius:2, overflow:'hidden', marginBottom:24 }}>
        {['#1B3A6B','#E63946','#C9963A','#0D2347','#1B3A6B','#E63946','#C9963A','#0D2347','#1B3A6B','#E63946'].map((c,i) => (
          <div key={i} style={{ flex:1, background:c }} />
        ))}
      </div>

      {/* KPI Cards avec sparkline */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
        {[
          { label:t.dashboard.total_raised, value:fmt(stats.total_raised_ngn), color:'#1B3A6B', icon:'💼', sparkline:SPARKLINES.raised, sparkColor:'#1B3A6B', sub:'+12% vs T4 2025' },
          { label:t.dashboard.active_projects, value:String(stats.active_projects), color:'#E63946', icon:'🌍', sparkline:[3,3,4,4,4], sparkColor:'#E63946', sub:'Land Banking · Agri · PIC' },
          { label:t.dashboard.active_investors, value:String(stats.total_investors), color:'#C9963A', icon:'👥', sparkline:SPARKLINES.investors, sparkColor:'#C9963A', sub:`${stats.pending_payments} paiements en attente` },
          { label:t.dashboard.received_month, value:fmt(stats.monthly_received), color:'#16a34a', icon:'✅', sparkline:[4,7,5,9,8], sparkColor:'#16a34a', sub:lang==='fr'?'Ce mois':'This month' },
        ].map((card) => (
          <div key={card.label} style={{ background:'#fff', borderRadius:16, padding:'18px 20px', border:'1px solid #E2E8F0', boxShadow:'0 2px 12px rgba(27,58,107,0.06)', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', bottom:0, left:0, right:0, height:3, background:`linear-gradient(90deg, ${card.color}, ${card.color}66)` }} />
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
              <div>
                <div style={{ fontSize:22 }}>{card.icon}</div>
              </div>
              <Sparkline values={card.sparkline} color={card.sparkColor} height={32} width={70} />
            </div>
            <div style={{ fontSize:11, color:'#94A3B8', textTransform:'uppercase', fontWeight:700, letterSpacing:'0.5px', marginBottom:4 }}>{card.label}</div>
            <div style={{ fontSize:28, fontWeight:800, color:card.color, fontFamily:'Syne,sans-serif', letterSpacing:'-0.5px', marginBottom:4 }}>{card.value}</div>
            <div style={{ fontSize:12, color:'#94A3B8' }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Alertes */}
      {(stats.late_payments > 0 || stats.pending_payments > 3) && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:24 }}>
          {stats.late_payments > 0 && (
            <div style={{ background:'#FFF1F2', border:'1px solid #FECDD3', borderRadius:12, padding:'14px 18px', display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:22 }}>🚨</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, color:'#9F1239', fontSize:14 }}>{stats.late_payments} {t.dashboard.late_alert}</div>
                <div style={{ color:'#E11D48', fontSize:12, marginTop:2 }}>{t.dashboard.action_required}</div>
              </div>
              <a href="/admin/payments?status=late" style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #F43F5E', background:'#fff', color:'#E11D48', cursor:'pointer', fontWeight:700, fontSize:12, textDecoration:'none' }}>
                {t.common.view} →
              </a>
            </div>
          )}
          {stats.pending_payments > 0 && (
            <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:12, padding:'14px 18px', display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:22 }}>⏳</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, color:'#92400E', fontSize:14 }}>{stats.pending_payments} {t.dashboard.pending_alert}</div>
                <div style={{ color:'#D97706', fontSize:12, marginTop:2 }}>{t.dashboard.follow_up}</div>
              </div>
              <a href="/admin/payments?status=pending" style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #F59E0B', background:'#fff', color:'#D97706', cursor:'pointer', fontWeight:700, fontSize:12, textDecoration:'none' }}>
                {t.common.view} →
              </a>
            </div>
          )}
        </div>
      )}

      {/* Graphiques */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:20, marginBottom:20 }}>

        {/* Graphique revenus mensuel */}
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E2E8F0', padding:24, boxShadow:'0 2px 8px rgba(27,58,107,0.05)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
            <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:15, color:'#0F1E35' }}>{t.dashboard.monthly_chart}</div>
            <div style={{ fontSize:11, color:'#94A3B8' }}>2026</div>
          </div>
          <BarChart data={chartData} color='#1B3A6B' color2='#C9963A' height={160} />
          <div style={{ display:'flex', gap:16, justifyContent:'center', marginTop:8 }}>
            {[['#1B3A6B', lang==='fr'?'Paiements reçus':'Payments received'],['#C9963A', lang==='fr'?'Frais facilitation':'Facilitation fees']].map(([c,l]) => (
              <div key={String(l)} style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:10, height:10, borderRadius:2, background:String(c) }} />
                <span style={{ fontSize:12, color:'#5A6E8A' }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Donut investisseurs par pays */}
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E2E8F0', padding:24, boxShadow:'0 2px 8px rgba(27,58,107,0.05)' }}>
          <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:15, color:'#0F1E35', marginBottom:16 }}>{t.dashboard.investors_chart}</div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
            <DonutChart segments={COUNTRIES} size={130} />
            <div style={{ width:'100%' }}>
              {COUNTRIES.map(c => (
                <div key={c.label} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', borderBottom:'1px solid #F1F5F9' }}>
                  <div style={{ width:10, height:10, borderRadius:2, background:c.color, flexShrink:0 }} />
                  <span style={{ flex:1, fontSize:13, color:'#374151' }}>🌍 {c.label}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:c.color }}>{c.value}</span>
                  <span style={{ fontSize:11, color:'#94A3B8' }}>{Math.round(c.value/37*100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>

        {/* Graphique capital par projet */}
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E2E8F0', padding:24, boxShadow:'0 2px 8px rgba(27,58,107,0.05)' }}>
          <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:15, color:'#0F1E35', marginBottom:16 }}>{t.dashboard.projects_chart}</div>
          {PROJECTS_DATA.map(p => {
            const pct = Math.round(p.raised / p.target * 100);
            return (
              <div key={p.name} style={{ marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:5 }}>
                  <span style={{ color:'#374151', fontWeight:500 }}>{p.name}</span>
                  <span style={{ fontWeight:700, color:p.color }}>{fmt(p.raised)} <span style={{ color:'#94A3B8', fontWeight:400 }}>/ {fmt(p.target)}</span></span>
                </div>
                <div style={{ height:8, background:'#F1F5F9', borderRadius:4, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${pct}%`, background:p.color, borderRadius:4, transition:'width 0.6s ease' }} />
                </div>
                <div style={{ fontSize:11, color:'#94A3B8', marginTop:3 }}>{pct}%</div>
              </div>
            );
          })}
        </div>

        {/* Souscriptions récentes */}
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E2E8F0', boxShadow:'0 2px 8px rgba(27,58,107,0.05)', overflow:'hidden' }}>
          <div style={{ padding:'18px 20px', borderBottom:'1px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:15, color:'#0F1E35' }}>{t.dashboard.recent_subs}</div>
            <a href="/admin/subscriptions" style={{ fontSize:12, color:'#E63946', fontWeight:700, textDecoration:'none' }}>{t.common.view} →</a>
          </div>
          {RECENT_SUBS.map((sub, i) => {
            const st = STATUS_STYLE[sub.status] ?? STATUS_STYLE.pending;
            const stLabel = lang === 'fr' ? STATUS_LABEL_FR[sub.status] : STATUS_LABEL_EN[sub.status];
            const initials = sub.investor.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 20px', borderBottom: i < RECENT_SUBS.length-1 ? '1px solid #F1F5F9' : 'none' }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background:'#1B3A6B', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:11, fontWeight:700, flexShrink:0 }}>{initials}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#0F1E35', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{sub.investor}</div>
                  <div style={{ fontSize:11, color:'#94A3B8', marginTop:1 }}>{sub.project}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#1B3A6B' }}>{fmt(sub.amount)}</div>
                  <span style={{ fontSize:10, padding:'2px 8px', borderRadius:999, background:st.bg, color:st.text, fontWeight:700 }}>{stLabel}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions rapides */}
      <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E2E8F0', padding:20, boxShadow:'0 2px 8px rgba(27,58,107,0.05)' }}>
        <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:15, color:'#0F1E35', marginBottom:14 }}>{t.dashboard.quick_actions}</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
          {[
            { icon:'🌍', label:t.dashboard.new_project, href:'/admin/projects', color:'#1B3A6B' },
            { icon:'💰', label:t.dashboard.record_payment, href:'/admin/payments', color:'#E63946' },
            { icon:'👤', label:t.dashboard.add_investor, href:'/admin/investors', color:'#C9963A' },
            { icon:'🔍', label:t.dashboard.audit_trail, href:'/admin/audit', color:'#16a34a' },
          ].map(action => (
            <a key={action.label} href={action.href} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'16px 12px', borderRadius:12, border:'1px solid #E2E8F0', textDecoration:'none', transition:'all 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = action.color; (e.currentTarget as HTMLElement).style.background = `${action.color}08`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E2E8F0'; (e.currentTarget as HTMLElement).style.background = ''; }}>
              <div style={{ width:44, height:44, borderRadius:12, background:`${action.color}12`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>{action.icon}</div>
              <span style={{ fontSize:12, fontWeight:600, color:'#374151', textAlign:'center', lineHeight:1.3 }}>{action.label}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Security notice */}
      <div style={{ marginTop:20, padding:'12px 18px', borderRadius:12, background:'rgba(27,58,107,0.05)', border:'1px solid rgba(27,58,107,0.1)', display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontSize:18 }}>🔒</span>
        <div style={{ fontSize:13, color:'#5A6E8A' }}><strong>{t.dashboard.security_reminder}</strong> — {t.dashboard.security_text}</div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}
