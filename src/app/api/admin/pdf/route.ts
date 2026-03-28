// src/app/api/admin/pdf/route.ts
// Génération PDF accusé de réception DIA (HTML → PDF via CSS print)

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromHeaders } from '@/lib/supabase';

function generateDIAHtml(data: {
  reference: string; investor_name: string; investor_country: string;
  project_name: string; amount_ngn: number; facilitation_fee: number;
  tranche_number: number; tranches_total: number;
  received_date: string; payment_method: string; bank_reference?: string;
  lang: 'fr' | 'en';
}) {
  const fmt = (n: number) => n >= 1e6 ? `₦${(n/1e6).toFixed(2)}M` : `₦${n.toLocaleString()}`;
  const isFr = data.lang === 'fr';

  return `<!DOCTYPE html>
<html lang="${data.lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>B-Invest — ${isFr ? 'Accusé de réception' : 'Payment Acknowledgement'} ${data.reference}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Georgia', serif; color: #1a1a2e; background: #fff; padding: 40px; font-size: 12px; line-height: 1.6; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 3px solid #1B3A6B; padding-bottom:20px; margin-bottom:28px; }
  .logo-area { display:flex; flex-direction:column; gap:4px; }
  .company-name { font-size:24px; font-weight:bold; color:#1B3A6B; letter-spacing:1px; }
  .company-sub { font-size:11px; color:#C9963A; font-style:italic; }
  .doc-info { text-align:right; }
  .doc-title { font-size:16px; font-weight:bold; color:#1B3A6B; margin-bottom:4px; }
  .doc-ref { font-size:11px; color:#666; background:#f5f5f5; padding:4px 10px; border-radius:4px; }
  .doc-date { font-size:11px; color:#666; margin-top:4px; }
  .kente { display:flex; height:5px; margin-bottom:28px; }
  .kente div { flex:1; }
  h2 { font-size:14px; color:#1B3A6B; border-bottom:1px solid #e0e0e0; padding-bottom:8px; margin-bottom:16px; text-transform:uppercase; letter-spacing:0.5px; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:24px; }
  .field { padding:10px 14px; background:#f8f9fc; border-left:3px solid #1B3A6B; border-radius:0 4px 4px 0; }
  .field-label { font-size:10px; color:#888; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px; }
  .field-value { font-size:13px; font-weight:bold; color:#1a1a2e; }
  .amount-box { background:linear-gradient(135deg, #1B3A6B, #0D2347); color:#fff; padding:20px 24px; border-radius:8px; margin:20px 0; display:flex; justify-content:space-between; align-items:center; }
  .amount-label { font-size:12px; opacity:0.8; margin-bottom:4px; }
  .amount-value { font-size:28px; font-weight:bold; color:#C9963A; }
  .amount-sub { font-size:11px; opacity:0.6; margin-top:4px; }
  .notice { background:#f0f7ff; border:1px solid #bfdbfe; border-radius:6px; padding:14px 18px; margin:20px 0; font-size:11px; color:#1e40af; line-height:1.6; }
  .signatures { display:grid; grid-template-columns:1fr 1fr; gap:40px; margin-top:40px; padding-top:20px; border-top:1px solid #e0e0e0; }
  .sig-box { text-align:center; }
  .sig-title { font-size:11px; color:#666; margin-bottom:30px; }
  .sig-line { border-top:1px solid #333; margin-bottom:8px; }
  .sig-name { font-size:12px; font-weight:bold; }
  .sig-role { font-size:10px; color:#666; }
  .footer { margin-top:30px; padding-top:16px; border-top:1px solid #e0e0e0; display:flex; justify-content:space-between; font-size:10px; color:#999; }
  .stamp { width:80px; height:80px; border:2px solid #1B3A6B; border-radius:50%; display:flex; align-items:center; justify-content:center; text-align:center; font-size:9px; color:#1B3A6B; font-weight:bold; margin:0 auto 10px; padding:10px; }
  @media print {
    body { padding:20px; }
    .no-print { display:none !important; }
  }
</style>
</head>
<body>
  <!-- HEADER -->
  <div class="header">
    <div class="logo-area">
      <div class="company-name">B-INVEST LIMITED</div>
      <div class="company-sub">${isFr ? 'Facilitation Immobilière Transfrontalière — Nigeria' : 'Cross-Border Real Estate Facilitation — Nigeria'}</div>
    </div>
    <div class="doc-info">
      <div class="doc-title">${isFr ? 'ACCUSÉ DE RÉCEPTION' : 'PAYMENT ACKNOWLEDGEMENT'}</div>
      <div class="doc-ref">${data.reference}</div>
      <div class="doc-date">${isFr ? 'Émis le' : 'Issued on'}: ${new Date(data.received_date).toLocaleDateString(isFr ? 'fr-FR' : 'en-GB', { day:'numeric', month:'long', year:'numeric' })}</div>
    </div>
  </div>

  <!-- KENTE -->
  <div class="kente">
    <div style="background:#1B3A6B"></div><div style="background:#E63946"></div>
    <div style="background:#C9963A"></div><div style="background:#0D2347"></div>
    <div style="background:#1B3A6B"></div><div style="background:#E63946"></div>
    <div style="background:#C9963A"></div><div style="background:#0D2347"></div>
  </div>

  <!-- MONTANT PRINCIPAL -->
  <div class="amount-box">
    <div>
      <div class="amount-label">${isFr ? 'Montant reçu' : 'Amount received'}</div>
      <div class="amount-value">${fmt(data.amount_ngn)}</div>
      <div class="amount-sub">${isFr ? `Tranche ${data.tranche_number}/${data.tranches_total}` : `Instalment ${data.tranche_number}/${data.tranches_total}`}</div>
    </div>
    <div style="text-align:right">
      <div class="amount-label">${isFr ? 'Frais de facilitation (10%)' : 'Facilitation fee (10%)'}</div>
      <div style="font-size:18px; font-weight:bold; color:#fff">${fmt(data.facilitation_fee)}</div>
      <div class="amount-sub">${isFr ? 'Inclus dans le montant' : 'Included in amount'}</div>
    </div>
  </div>

  <!-- INFOS INVESTISSEUR & PROJET -->
  <h2>${isFr ? 'Informations de la transaction' : 'Transaction Information'}</h2>
  <div class="grid">
    <div class="field"><div class="field-label">${isFr ? 'Investisseur' : 'Investor'}</div><div class="field-value">${data.investor_name}</div></div>
    <div class="field"><div class="field-label">${isFr ? 'Pays de résidence' : 'Country of residence'}</div><div class="field-value">${data.investor_country}</div></div>
    <div class="field"><div class="field-label">${isFr ? 'Projet' : 'Project'}</div><div class="field-value">${data.project_name}</div></div>
    <div class="field"><div class="field-label">${isFr ? 'Référence DIA' : 'DIA Reference'}</div><div class="field-value">${data.reference}</div></div>
    <div class="field"><div class="field-label">${isFr ? 'Date de réception' : 'Date received'}</div><div class="field-value">${new Date(data.received_date).toLocaleDateString(isFr ? 'fr-FR' : 'en-GB')}</div></div>
    <div class="field"><div class="field-label">${isFr ? 'Méthode de paiement' : 'Payment method'}</div><div class="field-value">${data.payment_method}</div></div>
    ${data.bank_reference ? `<div class="field" style="grid-column:span 2"><div class="field-label">${isFr ? 'Référence bancaire' : 'Bank reference'}</div><div class="field-value">${data.bank_reference}</div></div>` : ''}
  </div>

  <!-- NOTICE LÉGALE -->
  <div class="notice">
    ${isFr
      ? `B-Invest Limited confirme la réception du montant indiqué en relation avec la transaction référencée. Les fonds seront traités conformément aux termes convenus dans le Contrat DIA, incluant la vérification, la diligence raisonnable et le transfert ultérieur au vendeur désigné. Cet accusé de réception confirme les fonds reçus et ne constitue pas en lui-même la clôture de la transaction.`
      : `B-Invest Limited hereby confirms receipt of the above-stated amount in relation to the referenced transaction. The funds shall be processed in accordance with the agreed terms of the DIA Contract, including verification, due diligence, and subsequent transfer to the designated vendor. This acknowledgement serves as confirmation of funds received and does not in itself constitute completion of the transaction.`
    }
  </div>

  <!-- SIGNATURES -->
  <div class="signatures">
    <div class="sig-box">
      <div class="stamp">B-INVEST LIMITED<br>OFFICIAL<br>SEAL</div>
      <div class="sig-title">${isFr ? 'Signataire autorisé 1' : 'Authorised Signatory 1'}</div>
      <div class="sig-line"></div>
      <div class="sig-name">Raissa Bekamba</div>
      <div class="sig-role">${isFr ? 'Fondatrice & CEO' : 'Founder & CEO'}</div>
    </div>
    <div class="sig-box">
      <div style="height:80px;margin-bottom:10px;border:1px dashed #ccc;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#ccc;font-size:11px">${isFr ? 'Signature investisseur' : 'Investor signature'}</div>
      <div class="sig-title">${isFr ? 'L\'Investisseur' : 'The Investor'}</div>
      <div class="sig-line"></div>
      <div class="sig-name">${data.investor_name}</div>
      <div class="sig-role">${isFr ? 'Bénéficiaire' : 'Beneficial Owner'}</div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <span>B-Invest Limited — ${isFr ? 'Document officiel confidentiel' : 'Official Confidential Document'}</span>
    <span>${data.reference} · ${new Date().getFullYear()}</span>
  </div>

  <!-- Bouton impression (caché à l'impression) -->
  <div class="no-print" style="margin-top:24px;text-align:center">
    <button onclick="window.print()" style="padding:12px 28px;background:#1B3A6B;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:sans-serif">
      🖨️ ${isFr ? 'Imprimer / Sauvegarder en PDF' : 'Print / Save as PDF'}
    </button>
  </div>
</body>
</html>`;
}

export async function POST(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const body = await request.json();
    const html = generateDIAHtml(body);

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="DIA-${body.reference}.html"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur génération PDF' }, { status: 500 });
  }
}

// GET pour prévisualiser ou générer depuis subscription_id + tranche
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lang = (searchParams.get('lang') ?? 'fr') as 'fr' | 'en';
  const subscriptionId = searchParams.get('subscription_id');
  const trancheNumber = parseInt(searchParams.get('tranche') ?? '1');

  // Si subscription_id fourni, chercher les données réelles
  if (subscriptionId) {
    try {
      const { createAdminClient } = await import('@/lib/supabase');
      const supabase = createAdminClient();
      const { data: tranche } = await supabase
        .from('payment_tranches')
        .select('*, subscription:subscriptions(dia_reference, tranches_count, investor:investors(full_name, country), project:projects(name, tranches_count, fee_facilitation_pct))')
        .eq('subscription_id', subscriptionId)
        .eq('tranche_number', trancheNumber)
        .single();

      if (tranche) {
        const sub = (tranche as any).subscription;
        const facilPct = sub?.project?.fee_facilitation_pct ?? 10;
        const amount = tranche.received_amount_ngn ?? tranche.amount_ngn ?? 0;
        const realData = {
          reference: sub?.dia_reference ?? `DIA-${subscriptionId.slice(0, 8).toUpperCase()}`,
          investor_name: sub?.investor?.full_name ?? 'Investisseur',
          investor_country: sub?.investor?.country ?? '—',
          project_name: sub?.project?.name ?? 'Projet',
          amount_ngn: amount,
          facilitation_fee: Math.round(amount * facilPct / 110),
          tranche_number: trancheNumber,
          tranches_total: sub?.tranches_count ?? sub?.project?.tranches_count ?? 1,
          received_date: tranche.received_date ?? new Date().toISOString().slice(0, 10),
          payment_method: tranche.payment_method ?? (lang === 'fr' ? 'Virement bancaire' : 'Bank Transfer'),
          bank_reference: tranche.bank_reference ?? '',
          lang,
        };
        const html = generateDIAHtml(realData);
        return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    } catch (err) {
      console.error('[PDF GET]', err);
    }
  }

  // Données de démonstration (fallback)
  const demoData = {
    reference: 'DIA-2026-DEMO001',
    investor_name: 'Jean Paul Mbarga',
    investor_country: 'Cameroun (CM)',
    project_name: 'Land Banking Lagos North',
    amount_ngn: 2000000,
    facilitation_fee: 200000,
    tranche_number: 1,
    tranches_total: 2,
    received_date: new Date().toISOString().slice(0, 10),
    payment_method: lang === 'fr' ? 'Virement bancaire' : 'Bank Transfer',
    bank_reference: 'TRF2026031801',
    lang,
  };

  const html = generateDIAHtml(demoData);
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
