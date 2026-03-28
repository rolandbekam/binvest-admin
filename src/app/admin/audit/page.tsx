'use client';
// src/app/admin/audit/page.tsx — Audit Trail complet

import { useEffect, useState } from 'react';
import { getLang, T, type Lang } from '@/lib/i18n';

interface AuditLog {
  id: string;
  admin_email: string;
  action: string;
  resource_type: string;
  resource_id: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string;
  severity: 'info' | 'warning' | 'critical';
  created_at: string;
}

const SEVERITY_STYLE = {
  info:     { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', label: 'Info' },
  warning:  { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A', label: 'Avertissement' },
  critical: { bg: '#FFF1F2', text: '#9F1239', border: '#FECDD3', label: '🚨 Critique' },
};

const ACTION_ICONS: Record<string, string> = {
  'auth.login.success': '✅',
  'auth.login.failed': '❌',
  'project.create': '🌍',
  'project.update': '✏️',
  'project.delete': '🗑️',
  'payment.record': '💰',
  'subscription.create': '📋',
  'investor.create': '👤',
};

export default function AuditPage() {
  const [lang, setL] = useState<Lang>('fr');
  useEffect(() => { setL(getLang()); const h = () => setL(getLang()); window.addEventListener('lang-change', h); return () => window.removeEventListener('lang-change', h); }, []);
  const t = T[lang].audit;

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ severity: '', action: '', search: '' });

  useEffect(() => {
    fetch('/api/admin/audit', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.logs) setLogs(d.logs); })
      .catch(() => setLogs(DEMO_LOGS))
      .finally(() => setLoading(false));
  }, []);

  const filtered = logs.filter(log => {
    if (filter.severity && log.severity !== filter.severity) return false;
    if (filter.action && !log.action.includes(filter.action)) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      return log.admin_email?.toLowerCase().includes(q) ||
             log.action?.toLowerCase().includes(q) ||
             log.resource_type?.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Syne, sans-serif' }}>
            {t.title}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {t.subtitle}
          </p>
        </div>
        <button
          onClick={() => {
            const csv = [
              ['Date', 'Admin', 'Action', 'Ressource', 'IP', 'Sévérité'],
              ...filtered.map(l => [l.created_at, l.admin_email, l.action, l.resource_type, l.ip_address, l.severity]),
            ].map(r => r.join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `audit-${Date.now()}.csv`; a.click();
          }}
          className="px-4 py-2 text-sm font-semibold rounded-xl border hover:bg-gray-50 transition-all"
          style={{ borderColor: '#E2E8F0', color: '#374151' }}
        >
          {t.export}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 flex gap-3" style={{ borderColor: '#E2E8F0' }}>
        <input
          placeholder={`🔍 ${lang==='fr'?'Rechercher...':'Search...'}`}
          value={filter.search}
          onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
          className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2"
          style={{ borderColor: '#E2E8F0' }}
        />
        <select
          value={filter.severity}
          onChange={e => setFilter(f => ({ ...f, severity: e.target.value }))}
          className="border rounded-lg px-3 py-2 text-sm outline-none"
          style={{ borderColor: '#E2E8F0' }}
        >
          <option value="">{t.all_severity}</option>
          <option value="info">{t.info}</option>
          <option value="warning">{t.warning}</option>
          <option value="critical">{lang==='fr'?'Critique':'Critical'}</option>
        </select>
        <select
          value={filter.action}
          onChange={e => setFilter(f => ({ ...f, action: e.target.value }))}
          className="border rounded-lg px-3 py-2 text-sm outline-none"
          style={{ borderColor: '#E2E8F0' }}
        >
          <option value="">{t.all_actions}</option>
          <option value="auth">{t.auth}</option>
          <option value="project">{t.project_action}</option>
          <option value="payment">{t.payment_action}</option>
          <option value="subscription">{t.sub_action}</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total logs', value: logs.length, color: '#1B3A6B' },
          { label: `⚠️ ${t.warning}`, value: logs.filter(l => l.severity === 'warning').length, color: '#D97706' },
          { label: `🚨 ${lang==='fr'?'Critiques (paiements)':'Critical (payments)'}`, value: logs.filter(l => l.severity === 'critical').length, color: '#E63946' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border p-4" style={{ borderColor: '#E2E8F0' }}>
            <div className="text-xs text-gray-400 mb-1">{s.label}</div>
            <div className="text-2xl font-bold" style={{ color: s.color, fontFamily: 'Syne, sans-serif' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Log table */}
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E2E8F0' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {[t.timestamp, t.admin, t.action, t.resource, t.ip, t.severity, t.details].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wide font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">{T[lang].common.loading}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">{t.no_logs}</td></tr>
              ) : (
                filtered.map(log => {
                  const sev = SEVERITY_STYLE[log.severity];
                  return (
                    <tr key={log.id} className="border-b hover:bg-gray-50 transition-colors"
                      style={{ borderColor: '#F1F5F9' }}>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-700 font-medium">{log.admin_email}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          <span>{ACTION_ICONS[log.action] ?? '•'}</span>
                          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                            {log.action}
                          </code>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{log.resource_type}</td>
                      <td className="px-4 py-3 text-xs font-mono text-gray-400">{log.ip_address}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{ backgroundColor: sev.bg, color: sev.text, border: `1px solid ${sev.border}` }}>
                          {log.severity === 'info' ? t.info : log.severity === 'warning' ? t.warning : t.critical}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {log.new_values && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-blue-600 hover:underline">{lang==='fr'?'Voir détails':'View details'}</summary>
                            <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-auto max-w-xs max-h-32">
                              {JSON.stringify(log.new_values, null, 2)}
                            </pre>
                          </details>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Données démo
const DEMO_LOGS: AuditLog[] = [
  { id:'1', admin_email:'raissa@binvest.ng', action:'auth.login.success', resource_type:'admin_session', resource_id:'', old_values:null, new_values:null, ip_address:'41.202.207.15', severity:'info', created_at:new Date().toISOString() },
  { id:'2', admin_email:'raissa@binvest.ng', action:'project.create', resource_type:'project', resource_id:'P001', old_values:null, new_values:{name:'Palmeraie Ogun',type:'agriculture_palmier',target:50000000}, ip_address:'41.202.207.15', severity:'info', created_at:new Date(Date.now()-3600000).toISOString() },
  { id:'3', admin_email:'raissa@binvest.ng', action:'payment.record', resource_type:'payment_tranche', resource_id:'T001', old_values:{status:'pending'}, new_values:{status:'received',amount:1000000,method:'bank_transfer',investor:'Jean Paul Mbarga'}, ip_address:'41.202.207.15', severity:'critical', created_at:new Date(Date.now()-7200000).toISOString() },
  { id:'4', admin_email:'admin@binvest.ng', action:'auth.login.failed', resource_type:'admin_user', resource_id:'', old_values:null, new_values:{reason:'wrong_password',attempts:2}, ip_address:'197.210.65.88', severity:'warning', created_at:new Date(Date.now()-86400000).toISOString() },
];
