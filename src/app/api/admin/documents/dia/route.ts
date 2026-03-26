// @ts-nocheck
// src/app/api/admin/documents/dia/route.ts
// Génère les documents B-Invest en PDF (FR + EN)

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromHeaders, createAdminClient } from '@/lib/supabase';
import { execSync } from 'child_process';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

export async function GET(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const lang = (searchParams.get('lang') ?? 'fr') as 'fr' | 'en';
  const docType = searchParams.get('type') ?? 'dia';          // dia | ack | pic
  const subscriptionId = searchParams.get('subscription_id');

  // Données par défaut (template vierge)
  let data: Record<string, any> = {
    investor: lang === 'fr' ? 'Investisseur' : 'Investor',
    investor_address: lang === 'fr' ? 'Yaoundé, Cameroun' : 'Yaoundé, Cameroon',
    project: lang === 'fr' ? 'Projet' : 'Project',
    type_projet: lang === 'fr' ? 'Non défini' : 'Undefined',
    amount_ngn: '0',
    facilitation_fee_ngn: '0',
    total_ngn: '0',
    tranches: 1,
    dia_reference: `DIA-${new Date().getFullYear()}-TEMPLATE`,
    yield_est: '—',
    horizon: lang === 'fr' ? '— ans' : '— years',
    date: new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    }),
  };

  // Si subscription_id fourni → pré-remplir avec les données réelles
  if (subscriptionId) {
    try {
      const supabase = createAdminClient();
      const { data: sub } = await supabase
        .from('subscriptions')
        .select(`
          *, 
          investor:investors(full_name, address, country),
          project:projects(name, type, yield_min_pct, yield_max_pct, horizon_years, location)
        `)
        .eq('id', subscriptionId)
        .single();

      if (sub) {
        const fmtNGN = (n: number) => n.toLocaleString('en-NG');
        data = {
          investor: sub.investor?.full_name || data.investor,
          investor_address: [sub.investor?.address, sub.investor?.country].filter(Boolean).join(', ') || data.investor_address,
          project: sub.project?.name || data.project,
          type_projet: sub.project?.type?.replace(/_/g, ' ') || data.type_projet,
          amount_ngn: fmtNGN(sub.amount_ngn || 0),
          facilitation_fee_ngn: fmtNGN(sub.facilitation_fee_ngn || 0),
          total_ngn: fmtNGN(sub.total_amount_ngn || 0),
          tranches: sub.tranches_count || 1,
          dia_reference: sub.dia_reference || `DIA-${Date.now()}`,
          yield_est: sub.project?.yield_min_pct
            ? `${sub.project.yield_min_pct}-${sub.project.yield_max_pct}%`
            : '—',
          horizon: sub.project?.horizon_years
            ? `${sub.project.horizon_years} ${lang === 'fr' ? 'ans' : 'years'}`
            : '—',
          date: new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
            day: 'numeric', month: 'long', year: 'numeric'
          }),
        };
      }
    } catch (err) {
      console.error('[DOC] Erreur Supabase:', err);
    }
  }

  try {
    const tmpOut = `/tmp/${docType}-${lang}-${Date.now()}.pdf`;
    const scriptPath = join(process.cwd(), 'scripts', 'generate_dia_pdf.py');
    const dataJson = JSON.stringify(data).replace(/'/g, "\\'");

    execSync(
      `python3 "${scriptPath}" ${lang} "${tmpOut}" ${docType} '${dataJson}'`,
      { timeout: 30000 }
    );

    if (!existsSync(tmpOut)) throw new Error('PDF non généré');

    const pdfBuffer = readFileSync(tmpOut);
    try { unlinkSync(tmpOut); } catch {}

    // Nom du fichier selon langue et type
    const fileNames: Record<string, Record<string, string>> = {
      fr: {
        dia: `Contrat-DIA-${data.dia_reference}.pdf`,
        ack: `Accuse-Reception-${data.dia_reference}.pdf`,
        pic: `Constitution-PIC-BInvest.pdf`,
        joiner: `Accord-Adhesion-Investisseur.pdf`,
        referral: `Accord-Parrainage-BInvest.pdf`,
      },
      en: {
        dia: `DIA-Contract-${data.dia_reference}.pdf`,
        ack: `Payment-Acknowledgement-${data.dia_reference}.pdf`,
        pic: `PIC-Constitution-BInvest.pdf`,
        joiner: `Investor-Joiner-Agreement.pdf`,
        referral: `Referral-Partner-Agreement.pdf`,
      }
    };

    const filename = fileNames[lang]?.[docType] ?? `BInvest-${docType}-${lang}.pdf`;

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });

  } catch (err) {
    console.error('[PDF GENERATE]', err);
    return NextResponse.json({ error: 'Erreur génération PDF' }, { status: 500 });
  }
}
