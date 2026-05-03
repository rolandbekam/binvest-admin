// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getLang, T, type Lang } from '@/lib/i18n';

const ROLES = [
  { value: 'super_admin', label: 'Super Admin', desc: 'Accès complet — gestion des admins, paramètres, suppressions', color: '#7c2d12', bg: '#FFEDD5' },
  { value: 'admin',       label: 'Admin',       desc: 'Lecture + écriture (validation KYC, paiements, projets)', color: '#1e40af', bg: '#DBEAFE' },
  { value: 'viewer',      label: 'Viewer',      desc: 'Lecture seule (dashboard, exports)', color: '#166534', bg: '#DCFCE7' },
] as const;

export default function AdminUsersPage() {
  const [lang, setLangState] = useState<Lang>('fr');
  useEffect(() => {
    setLangState(getLang());
    const h = () => setLangState(getLang());
    window.addEventListener('lang-change', h);
    return () => window.removeEventListener('lang-change', h);
  }, []);

  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ email: '', full_name: '', role: 'viewer', password: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/admin-users', { credentials: 'include' });
      const d = await r.json();
      setAdmins(d.admins ?? []);
    } catch { setAdmins([]); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!newAdmin.email || !newAdmin.full_name || !newAdmin.password) {
      toast.error(lang === 'fr' ? 'Tous les champs sont obligatoires' : 'All fields required');
      return;
    }
    if (newAdmin.password.length < 8) {
      toast.error(lang === 'fr' ? 'Mot de passe : 8 caractères minimum' : 'Password: 8 characters min');
      return;
    }
    setSaving(true);
    try {
      const r = await fetch('/api/admin/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newAdmin),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error ?? 'Erreur'); setSaving(false); return; }
      toast.success(lang === 'fr' ? '✅ Admin créé' : '✅ Admin created');
      setShowAdd(false);
      setNewAdmin({ email: '', full_name: '', role: 'viewer', password: '' });
      load();
    } catch (e: any) { toast.error(e.message ?? 'Erreur'); }
    setSaving(false);
  };

  const updateRole = async (id: string, newRole: string) => {
    if (!confirm(lang === 'fr' ? `Changer le rôle vers ${newRole} ?` : `Change role to ${newRole}?`)) return;
    try {
      const r = await fetch(`/api/admin/admin-users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: newRole }),
      });
      if (r.ok) { toast.success(lang === 'fr' ? '✅ Rôle mis à jour' : '✅ Role updated'); load(); }
      else toast.error(lang === 'fr' ? 'Échec' : 'Failed');
    } catch (e: any) { toast.error(e.message); }
  };

  const remove = async (id: string, email: string) => {
    if (!confirm(lang === 'fr' ? `Supprimer l'admin ${email} ?` : `Delete admin ${email}?`)) return;
    try {
      const r = await fetch(`/api/admin/admin-users/${id}`, { method: 'DELETE', credentials: 'include' });
      if (r.ok) { toast.success(lang === 'fr' ? '✅ Supprimé' : '✅ Deleted'); load(); }
      else toast.error(lang === 'fr' ? 'Échec' : 'Failed');
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div style={{ fontFamily: 'Outfit,sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: 'Syne,sans-serif', fontSize: 24, fontWeight: 800, color: '#0F1E35', margin: 0 }}>
            🔐 {lang === 'fr' ? 'Gestion des administrateurs' : 'Admin Users'}
          </h2>
          <p style={{ color: '#5A6E8A', fontSize: 14, marginTop: 4 }}>
            {lang === 'fr' ? `${admins.length} compte(s) admin · Réservé aux Super Admin` : `${admins.length} admin account(s) · Super Admin only`}
          </p>
        </div>
        <button onClick={() => setShowAdd(true)}
          style={{ background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
          + {lang === 'fr' ? 'Nouvel admin' : 'New admin'}
        </button>
      </div>

      {/* Légende des rôles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {ROLES.map(r => (
          <div key={r.value} style={{ background: '#fff', borderRadius: 12, border: `1px solid ${r.bg}`, padding: 14 }}>
            <div style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, background: r.bg, color: r.color, fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
              {r.label.toUpperCase()}
            </div>
            <div style={{ fontSize: 12, color: '#5A6E8A', lineHeight: 1.5 }}>{r.desc}</div>
          </div>
        ))}
      </div>

      {/* Table admins */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 2px 12px rgba(27,58,107,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              {[lang === 'fr' ? 'Nom' : 'Name', 'Email', lang === 'fr' ? 'Rôle' : 'Role', lang === 'fr' ? 'Créé le' : 'Created', 'Actions'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '11px 16px', fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700, borderBottom: '1px solid #E2E8F0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Chargement...</td></tr>
            ) : admins.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>
                {lang === 'fr' ? 'Aucun admin enregistré' : 'No admins yet'}
              </td></tr>
            ) : admins.map((a, i) => {
              const role = ROLES.find(r => r.value === a.role) ?? ROLES[2];
              return (
                <tr key={a.id} style={{ borderBottom: i < admins.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                  <td style={{ padding: '13px 16px', fontSize: 14, fontWeight: 600, color: '#0F1E35' }}>{a.full_name ?? '—'}</td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: '#5A6E8A' }}>{a.email}</td>
                  <td style={{ padding: '13px 16px' }}>
                    <select value={a.role} onChange={e => updateRole(a.id, e.target.value)}
                      style={{ padding: '4px 10px', borderRadius: 999, background: role.bg, color: role.color, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label.toUpperCase()}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 12, color: '#94A3B8' }}>
                    {a.created_at ? new Date(a.created_at).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <button onClick={() => remove(a.id, a.email)}
                      style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #FECACA', background: '#fff', color: '#991B1B', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      🗑️ {lang === 'fr' ? 'Supprimer' : 'Delete'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal création */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: 28, width: 480, maxWidth: '100%' }}>
            <h3 style={{ fontFamily: 'Syne,sans-serif', fontSize: 20, fontWeight: 800, color: '#0F1E35', margin: '0 0 18px' }}>
              👤 {lang === 'fr' ? 'Nouvel administrateur' : 'New administrator'}
            </h3>
            {[
              { key: 'full_name', label: lang === 'fr' ? 'Nom complet' : 'Full name', type: 'text' },
              { key: 'email', label: 'Email', type: 'email' },
              { key: 'password', label: lang === 'fr' ? 'Mot de passe (8+ car.)' : 'Password (8+ chars)', type: 'password' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>{f.label}</label>
                <input type={f.type} value={(newAdmin as any)[f.key]}
                  onChange={e => setNewAdmin({ ...newAdmin, [f.key]: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 14, fontFamily: 'Outfit,sans-serif', outline: 'none' }}
                />
              </div>
            ))}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
                {lang === 'fr' ? 'Rôle' : 'Role'}
              </label>
              <select value={newAdmin.role} onChange={e => setNewAdmin({ ...newAdmin, role: e.target.value })}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 14, fontFamily: 'Outfit,sans-serif', outline: 'none' }}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAdd(false)}
                style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', color: '#5A6E8A', cursor: 'pointer', fontWeight: 600 }}>
                {lang === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button onClick={save} disabled={saving}
                style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: saving ? '#94A3B8' : '#1B3A6B', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700 }}>
                {saving ? '...' : `✅ ${lang === 'fr' ? 'Créer' : 'Create'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
