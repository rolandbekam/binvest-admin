import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, auditLog, getAdminFromHeaders } from '@/lib/supabase';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const body = await request.json();
    const supabase = createAdminClient();
    const { data: old } = await supabase.from('projects').select('*').eq('id', params.id).single();
    const { data, error } = await supabase.from('projects').update(body).eq('id', params.id).select().single();
    if (error) throw error;

    await auditLog({
      adminId: admin.id, adminEmail: admin.email,
      action: 'project.update', resourceType: 'project', resourceId: params.id,
      oldValues: { name: (old as any)?.name, status: (old as any)?.status },
      newValues: body, ipAddress: admin.ip, severity: 'info',
    });

    return NextResponse.json({ project: data });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
