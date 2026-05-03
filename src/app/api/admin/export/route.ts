// @ts-nocheck
// src/app/api/admin/export/route.ts
// Export Excel (XML SpreadsheetML 2003) — investors / payments / subscriptions
// GET /api/admin/export?type=investors|payments|subscriptions

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, getAdminFromHeaders, auditLog } from '@/lib/supabase';

const xmlEscape = (v: any) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

function buildSheet(name: string, headers: string[], rows: any[][]): string {
  const headerRow = `<Row>${headers
    .map(h => `<Cell ss:StyleID="hdr"><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`)
    .join('')}</Row>`;

  const dataRows = rows
    .map(row =>
      `<Row>${row
        .map(v => {
          const isNum = typeof v === 'number' && Number.isFinite(v);
          return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${xmlEscape(v)}</Data></Cell>`;
        })
        .join('')}</Row>`,
    )
    .join('');

  return `
  <Worksheet ss:Name="${xmlEscape(name).slice(0, 31)}">
    <Table>
      ${headerRow}
      ${dataRows}
    </Table>
  </Worksheet>`;
}

function wrapWorkbook(sheets: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="hdr"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1B3A6B" ss:Pattern="Solid"/></Style>
  </Styles>
  ${sheets}
</Workbook>`;
}

export async function GET(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get('type') ?? 'investors';
  const supabase = createAdminClient();

  let xml = '';
  let filename = '';

  try {
    if (type === 'investors') {
      const { data, error } = await supabase
        .from('investors')
        .select('id, full_name, email, phone, country, nationality, kyc_status, pic_member, dia_signed, niu, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const rows = (data ?? []).map((inv: any) => [
        inv.full_name ?? '',
        inv.email ?? '',
        inv.phone ?? '',
        inv.country ?? '',
        inv.nationality ?? '',
        inv.kyc_status ?? 'pending',
        inv.pic_member ? 'Oui' : 'Non',
        inv.dia_signed ? 'Oui' : 'Non',
        inv.niu ?? '',
        inv.created_at ? new Date(inv.created_at).toISOString().slice(0, 10) : '',
      ]);

      xml = wrapWorkbook(
        buildSheet(
          'Investisseurs',
          ['Nom', 'Email', 'Téléphone', 'Pays', 'Nationalité', 'Statut KYC', 'PIC', 'DIA signé', 'NIU', 'Date inscription'],
          rows,
        ),
      );
      filename = `binvest-investors-${new Date().toISOString().slice(0, 10)}.xls`;
    } else if (type === 'subscriptions') {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('id, user_id, project_name, total_amount, fee_amount, payment_plan, tranches_paid, tranches_total, status, next_due_date, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const rows = (data ?? []).map((s: any) => [
        s.user_id ?? '',
        s.project_name ?? '',
        s.total_amount ?? 0,
        s.fee_amount ?? 0,
        s.payment_plan ?? 1,
        `${s.tranches_paid ?? 0}/${s.tranches_total ?? 1}`,
        s.status ?? 'pending',
        s.next_due_date ?? '',
        s.created_at ? new Date(s.created_at).toISOString().slice(0, 10) : '',
      ]);

      xml = wrapWorkbook(
        buildSheet(
          'Souscriptions',
          ['User ID', 'Projet', 'Montant total', 'Frais', 'Plan', 'Tranches', 'Statut', 'Prochaine échéance', 'Date'],
          rows,
        ),
      );
      filename = `binvest-subscriptions-${new Date().toISOString().slice(0, 10)}.xls`;
    } else if (type === 'payments') {
      // Tente les deux noms de table connus (`payments` ou `subscription_payments`)
      let { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        const fallback = await supabase
          .from('subscription_payments')
          .select('*')
          .order('created_at', { ascending: false });
        data = fallback.data;
        error = fallback.error;
      }
      if (error) throw error;

      const rows = (data ?? []).map((p: any) => [
        p.subscription_id ?? p.id ?? '',
        p.tranche_number ?? p.tranche ?? '',
        p.amount ?? 0,
        p.payment_method ?? p.method ?? '',
        p.reference ?? '',
        p.status ?? 'pending',
        p.paid_at ?? p.created_at ? new Date(p.paid_at ?? p.created_at).toISOString().slice(0, 10) : '',
      ]);

      xml = wrapWorkbook(
        buildSheet(
          'Paiements',
          ['Souscription', 'Tranche', 'Montant', 'Méthode', 'Référence', 'Statut', 'Date'],
          rows,
        ),
      );
      filename = `binvest-payments-${new Date().toISOString().slice(0, 10)}.xls`;
    } else {
      return NextResponse.json({ error: `type "${type}" inconnu — utiliser investors|subscriptions|payments` }, { status: 400 });
    }

    // Audit trail (best-effort)
    auditLog({
      adminId: admin.id, adminEmail: admin.email,
      action: `export.${type}`,
      resourceType: 'export', resourceId: type,
      ipAddress: admin.ip, severity: 'info',
    }).catch(() => {});

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('[EXPORT]', err);
    return NextResponse.json({ error: err.message ?? 'Erreur export' }, { status: 500 });
  }
}
