import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, auditLog, getAdminFromHeaders } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();
    if (error) throw error;
    return NextResponse.json({ project: data });
  } catch { return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 }); }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  try {
    const { id } = await context.params;
    const body = await request.json();
    const supabase = createAdminClient();
    const { data, error } = await supabase.from('projects').update(body).eq('id', id).select().single();
    if (error) throw error;
    await auditLog({ adminId: admin.id, adminEmail: admin.email, action: 'project.update', resourceType: 'project', resourceId: id, oldValues: {}, newValues: body, ipAddress: admin.ip, severity: 'info' });
    return NextResponse.json({ project: data });
  } catch { return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 }); }
}