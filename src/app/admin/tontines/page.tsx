'use client';
import { useEffect, useState } from 'react';
import { getLang, T, type Lang } from '@/lib/i18n';
import toast from 'react-hot-toast';

const fmtAmount = (n: number) =>
  n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(0)}K` : String(n || 0);

export default function TontinesPage() {
  const [lang, setL] = useState<Lang>('fr');
  const [tontines, setTontines] = useState<any[]>([]);
  const [stats, setStats] = useState({ total_active: 0, total_tontines: 0, total_managed: 0, total_members: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all'|'active'|'inactive'>('all');
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    setL(getLang());
    const h = () => setL(getLang());
    window.addEventListener('lang-change', h);
    return () => window.removeEventListener('lang-change', h);
  }, []);

  useEffect(() => {
    fetch('/api/admin/tontines', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setTontines(d.tontines ?? []);
        if (d.stats) setStats(d.stats);
      })
      .catch(() => toast.error(lang === 'fr' ? 'Erreur de chargement' : 'Load error'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t = T[lang].tontines;

  const filtered = tontines.filter(ton => {
    const matchSearch = !search || ton.name?.toLowerCase().includes(search.toLowerCase()) ||
      ton.creator?.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' ||
      (filterStatus === 'active' && ton.is_active) ||
      (filterStatus === 'inactive' && !ton.is_active);
    return matchSearch && matchStatus;
  });

  const kpis = [
    { label: t.total_active,   value: String(stats.total_active),                            icon: '🤝', color: '#1B3A6B' },
    { label: t.total_managed,  value: `${fmtAmount(stats.total_managed)} XAF`,               icon: '💰', color: '#C9963A' },
    { label: t.total_members,  value: String(stats.total_members),                           icon: '👥', color: '#16a34a' },
    { label: lang === 'fr' ? 'Total tontines' : 'Total tontines', value: String(stats.total_tontines), icon: '📋', color: '#E63946' },
  ];

  return (
    <div style={{ fontFamily: 'Outfit,sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'Syne,sans-serif', fontSize: 24, fontWeight: 800, color: '#0F1E35', margin: 0 }}>{t.title}</h2>
        <p style={{ color: '#5A6E8A', fontSize: 14, marginTop: 4 }}>{t.subtitle}</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(27,58,107,0.06)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: k.color }} />
            <div style={{ fontSize: 22, marginBottom: 8 }}>{k.icon}</div>
            <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: k.color, fontFamily: 'Syne,sans-serif' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={lang === 'fr' ? '🔍 Rechercher une tontine ou un créateur…' : '🔍 Search tontine or creator…'}
          style={{ flex: 1, padding: '8px 12px', borderRadius: 9, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none', fontFamily: 'Outfit,sans-serif' }}
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
          style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none', fontFamily: 'Outfit,sans-serif', background: '#fff' }}>
          <option value="all">{lang === 'fr' ? 'Tous statuts' : 'All statuses'}</option>
          <option value="active">{t.active}</option>
          <option value="inactive">{t.inactive}</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              {[t.name, t.creator, t.members, t.contribution, t.frequency, t.next_date, t.status, t.actions].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700, borderBottom: '1px solid #E2E8F0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>{t.loading}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>{t.no_tontines}</td></tr>
            ) : filtered.map((ton, i) => {
              const members: any[] = Array.isArray(ton.members) ? ton.members : [];
              const pct = ton.total_members > 0 ? Math.round(ton.current_turn / ton.total_members * 100) : 0;
              return (
                <tr key={ton.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#0F1E35' }}>{ton.name}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                      {lang === 'fr' ? 'Tour' : 'Turn'} {ton.current_turn}/{ton.total_members}
                    </div>
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: '#374151' }}>
                    <div style={{ fontWeight: 600 }}>{ton.creator?.full_name ?? '—'}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{ton.creator?.country ?? ''}</div>
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1B3A6B' }}>{ton.total_members}</span>
                      <div style={{ flex: 1, height: 4, background: '#F1F5F9', borderRadius: 2, minWidth: 40 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: '#1B3A6B', borderRadius: 2 }} />
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 700, color: '#C9963A' }}>
                    {fmtAmount(ton.contribution_amount)} XAF
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, background: ton.frequency === 'weekly' ? '#EDE9FE' : '#DBEAFE', color: ton.frequency === 'weekly' ? '#7C3AED' : '#1E40AF', fontWeight: 600 }}>
                      {ton.frequency === 'weekly' ? t.weekly : t.monthly}
                    </span>
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: '#374151' }}>
                    {ton.next_payment_date ? new Date(ton.next_payment_date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB') : '—'}
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, fontWeight: 700, background: ton.is_active ? '#DCFCE7' : '#F1F5F9', color: ton.is_active ? '#166534' : '#64748B' }}>
                      ● {ton.is_active ? t.active : t.inactive}
                    </span>
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <button onClick={() => setSelected(selected?.id === ton.id ? null : ton)}
                      style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#1B3A6B' }}>
                      {t.detail} {selected?.id === ton.id ? '▲' : '▼'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{ marginTop: 16, background: '#fff', borderRadius: 16, border: '1px solid #1B3A6B', padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 16, color: '#0F1E35' }}>
              🤝 {selected.name}
            </div>
            <button onClick={() => setSelected(null)}
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94A3B8' }}>✕</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
            {/* Infos */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#5A6E8A', textTransform: 'uppercase', marginBottom: 12 }}>
                {lang === 'fr' ? 'Informations' : 'Information'}
              </div>
              {[
                [t.creator,     selected.creator?.full_name ?? '—'],
                [t.contribution, `${fmtAmount(selected.contribution_amount)} XAF`],
                [t.frequency,   selected.frequency === 'weekly' ? t.weekly : t.monthly],
                [t.current_turn, `${selected.current_turn} / ${selected.total_members}`],
                [t.my_turn,     String(selected.my_turn_number)],
                [t.next_date,   selected.next_payment_date ? new Date(selected.next_payment_date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB') : '—'],
                [t.status,      selected.is_active ? t.active : t.inactive],
              ].map(([l, v]) => (
                <div key={String(l)} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #F1F5F9', fontSize: 13 }}>
                  <span style={{ color: '#5A6E8A' }}>{l}</span>
                  <span style={{ fontWeight: 600, color: '#0F1E35' }}>{v}</span>
                </div>
              ))}
              {selected.notes && (
                <div style={{ marginTop: 12, padding: 10, background: '#F8FAFC', borderRadius: 8, fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
                  📝 {selected.notes}
                </div>
              )}
            </div>

            {/* Progression */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#5A6E8A', textTransform: 'uppercase', marginBottom: 12 }}>
                {t.turn_info}
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: '#5A6E8A' }}>{lang === 'fr' ? 'Tour actuel' : 'Current turn'}</span>
                  <span style={{ fontWeight: 800, color: '#1B3A6B' }}>
                    {Math.round(selected.current_turn / Math.max(selected.total_members, 1) * 100)}%
                  </span>
                </div>
                <div style={{ height: 10, background: '#F1F5F9', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round(selected.current_turn / Math.max(selected.total_members, 1) * 100)}%`, background: 'linear-gradient(90deg,#1B3A6B,#C9963A)', borderRadius: 5 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                  <span>{lang === 'fr' ? 'Tour' : 'Turn'} {selected.current_turn}</span>
                  <span>{lang === 'fr' ? 'sur' : 'of'} {selected.total_members}</span>
                </div>
              </div>
              <div style={{ padding: 14, background: 'linear-gradient(135deg,#1B3A6B,#0D2347)', borderRadius: 12, color: '#fff' }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>
                  {lang === 'fr' ? 'Cagnotte totale' : 'Total pot'}
                </div>
                <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 24, fontWeight: 900 }}>
                  {fmtAmount(selected.contribution_amount * selected.total_members)} XAF
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                  {selected.contribution_amount?.toLocaleString()} × {selected.total_members} {lang === 'fr' ? 'membres' : 'members'}
                </div>
              </div>
            </div>

            {/* Members list */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#5A6E8A', textTransform: 'uppercase', marginBottom: 12 }}>
                {t.members_list} ({Array.isArray(selected.members) ? selected.members.length : 0})
              </div>
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {!Array.isArray(selected.members) || selected.members.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24, color: '#94A3B8', fontSize: 13 }}>
                    {lang === 'fr' ? 'Aucun membre renseigné' : 'No members listed'}
                  </div>
                ) : selected.members.map((m: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1B3A6B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0F1E35' }}>
                        {typeof m === 'string' ? m : (m.name ?? m.full_name ?? `${lang === 'fr' ? 'Membre' : 'Member'} ${i + 1}`)}
                      </div>
                      {typeof m === 'object' && m.phone && (
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>{m.phone}</div>
                      )}
                    </div>
                    {selected.my_turn_number === i + 1 && (
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: '#C9963A20', color: '#C9963A', fontWeight: 700 }}>
                        ★
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
