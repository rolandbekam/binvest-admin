// @ts-nocheck
// src/app/api/admin/documents/dia/route.ts
// Génère les documents B-Invest en HTML (imprimable en PDF via Ctrl+P)
// Remplace l'ancien système Python qui ne fonctionne pas en serverless

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromHeaders, createAdminClient } from '@/lib/supabase';

function generateDIAContractHtml(data: Record<string, any>, lang: 'fr' | 'en'): string {
  const isFr = lang === 'fr';
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<title>B-Invest — ${isFr ? 'Contrat DIA' : 'DIA Contract'} ${data.dia_reference}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Georgia, serif; color: #1a1a2e; background:#fff; padding:40px; font-size:12px; line-height:1.7; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #1B3A6B; padding-bottom:20px; margin-bottom:28px; }
  .company-name { font-size:22px; font-weight:bold; color:#1B3A6B; letter-spacing:1px; }
  .company-sub { font-size:11px; color:#C9963A; font-style:italic; margin-top:4px; }
  .doc-title { font-size:16px; font-weight:bold; color:#1B3A6B; text-align:right; }
  .doc-ref { font-size:11px; color:#666; background:#f5f5f5; padding:4px 10px; border-radius:4px; margin-top:6px; display:inline-block; }
  .kente { display:flex; height:5px; margin-bottom:28px; }
  .kente div { flex:1; }
  h2 { font-size:13px; color:#1B3A6B; border-bottom:1px solid #e0e0e0; padding-bottom:6px; margin:24px 0 14px; text-transform:uppercase; letter-spacing:0.5px; }
  .field-row { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px; }
  .field { padding:8px 12px; background:#f8f9fc; border-left:3px solid #1B3A6B; border-radius:0 4px 4px 0; }
  .field-label { font-size:10px; color:#888; text-transform:uppercase; margin-bottom:2px; }
  .field-value { font-size:12px; font-weight:bold; }
  .amount-box { background:linear-gradient(135deg,#1B3A6B,#0D2347); color:#fff; padding:18px 22px; border-radius:8px; margin:20px 0; display:flex; justify-content:space-between; align-items:center; }
  .amount-label { font-size:11px; opacity:0.8; margin-bottom:3px; }
  .amount-value { font-size:26px; font-weight:bold; color:#C9963A; }
  .section-text { font-size:12px; color:#333; margin-bottom:12px; line-height:1.8; text-align:justify; }
  .article { margin-bottom:16px; }
  .article-title { font-weight:bold; color:#1B3A6B; margin-bottom:6px; font-size:12px; }
  .signatures { display:grid; grid-template-columns:1fr 1fr; gap:40px; margin-top:40px; padding-top:20px; border-top:1px solid #e0e0e0; }
  .sig-box { text-align:center; }
  .sig-line { border-top:1px solid #333; margin:30px 0 8px; }
  .sig-name { font-size:12px; font-weight:bold; }
  .sig-role { font-size:10px; color:#666; }
  .footer { margin-top:30px; padding-top:14px; border-top:1px solid #e0e0e0; display:flex; justify-content:space-between; font-size:10px; color:#999; }
  @media print { body { padding:20px; } .no-print { display:none !important; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-name">B-INVEST LIMITED</div>
      <div class="company-sub">${isFr ? 'Facilitation Immobilière Transfrontalière — Nigeria' : 'Cross-Border Real Estate Facilitation — Nigeria'}</div>
    </div>
    <div>
      <div class="doc-title">${isFr ? 'CONTRAT DIA' : 'DIA CONTRACT'}</div>
      <div class="doc-ref">${data.dia_reference}</div>
      <div style="font-size:11px;color:#666;margin-top:4px;text-align:right">${data.date}</div>
    </div>
  </div>

  <div class="kente">
    <div style="background:#1B3A6B"></div><div style="background:#E63946"></div>
    <div style="background:#C9963A"></div><div style="background:#0D2347"></div>
    <div style="background:#1B3A6B"></div><div style="background:#E63946"></div>
    <div style="background:#C9963A"></div><div style="background:#0D2347"></div>
  </div>

  <div class="amount-box">
    <div>
      <div class="amount-label">${isFr ? 'Montant de la souscription' : 'Subscription Amount'}</div>
      <div class="amount-value">₦${data.amount_ngn}</div>
      <div style="font-size:11px;opacity:0.7;margin-top:3px">${isFr ? `${data.tranches} tranche(s)` : `${data.tranches} instalment(s)`}</div>
    </div>
    <div style="text-align:right">
      <div class="amount-label">${isFr ? 'Total avec frais (10%)' : 'Total incl. fees (10%)'}</div>
      <div style="font-size:18px;font-weight:bold;color:#fff">₦${data.total_ngn}</div>
      <div style="font-size:11px;opacity:0.7;margin-top:3px">${isFr ? 'Rendement estimé' : 'Estimated yield'}: ${data.yield_est} · ${data.horizon}</div>
    </div>
  </div>

  <h2>${isFr ? 'Parties au contrat' : 'Contract Parties'}</h2>
  <div class="field-row">
    <div class="field"><div class="field-label">${isFr ? 'Investisseur' : 'Investor'}</div><div class="field-value">${data.investor}</div></div>
    <div class="field"><div class="field-label">${isFr ? 'Adresse' : 'Address'}</div><div class="field-value">${data.investor_address}</div></div>
    <div class="field"><div class="field-label">${isFr ? 'Facilitateur' : 'Facilitator'}</div><div class="field-value">B-Invest Limited</div></div>
    <div class="field"><div class="field-label">${isFr ? 'Projet' : 'Project'}</div><div class="field-value">${data.project} (${data.type_projet})</div></div>
  </div>

  <h2>${isFr ? 'Section 1 — Accord d\'Agence' : 'Section 1 — Agency Agreement'}</h2>
  <div class="article">
    <div class="article-title">${isFr ? 'Article 1.1 — Mandat de facilitation' : 'Article 1.1 — Facilitation Mandate'}</div>
    <p class="section-text">${isFr
      ? `L'Investisseur mandate irrévocablement B-Invest Limited en qualité d'Agent de Facilitation pour identifier, négocier et finaliser l'acquisition ou l'investissement dans le Projet mentionné ci-dessus, conformément aux termes du présent Contrat DIA (Direct Investment Account). B-Invest Limited agit en tant qu'intermédiaire agréé et s'engage à œuvrer dans le meilleur intérêt de l'Investisseur.`
      : `The Investor irrevocably mandates B-Invest Limited as Facilitation Agent to identify, negotiate and finalise the acquisition or investment in the above-mentioned Project, in accordance with the terms of this DIA Contract (Direct Investment Account). B-Invest Limited acts as an authorised intermediary and commits to acting in the best interest of the Investor.`
    }</p>
  </div>
  <div class="article">
    <div class="article-title">${isFr ? 'Article 1.2 — Frais de facilitation' : 'Article 1.2 — Facilitation Fees'}</div>
    <p class="section-text">${isFr
      ? `En contrepartie des services de facilitation, l'Investisseur accepte de verser à B-Invest Limited des frais de facilitation de 10% (dix pour cent) du montant total de la souscription, soit ₦${data.facilitation_fee_ngn}. Ces frais sont inclus dans le montant total de la souscription et couvrent les services d'identification du projet, de due diligence, de négociation et de suivi administratif.`
      : `In consideration of the facilitation services, the Investor agrees to pay B-Invest Limited facilitation fees of 10% (ten percent) of the total subscription amount, i.e. ₦${data.facilitation_fee_ngn}. These fees are included in the total subscription amount and cover project identification, due diligence, negotiation and administrative follow-up services.`
    }</p>
  </div>

  <h2>${isFr ? 'Section 2 — Accord de Holding' : 'Section 2 — Holding Agreement'}</h2>
  <div class="article">
    <div class="article-title">${isFr ? 'Article 2.1 — Conservation des fonds' : 'Article 2.1 — Fund Custody'}</div>
    <p class="section-text">${isFr
      ? `B-Invest Limited s'engage à conserver les fonds reçus dans un compte dédié séparé de ses fonds propres, en qualité de fiduciaire. Les fonds seront maintenus en holding jusqu'à la finalisation de la transaction selon l'échéancier convenu de ${data.tranches} tranche(s).`
      : `B-Invest Limited commits to holding the received funds in a dedicated account separate from its own funds, as trustee. The funds will be maintained in holding until the completion of the transaction according to the agreed schedule of ${data.tranches} instalment(s).`
    }</p>
  </div>

  <h2>${isFr ? 'Section 3 — Accord de Séquestre' : 'Section 3 — Escrow Agreement'}</h2>
  <div class="article">
    <div class="article-title">${isFr ? 'Article 3.1 — Conditions de libération' : 'Article 3.1 — Release Conditions'}</div>
    <p class="section-text">${isFr
      ? `Les fonds séquestrés seront libérés au vendeur désigné uniquement après: (i) vérification complète de la documentation légale du bien ou de l'investissement; (ii) confirmation de la réception de l'intégralité des tranches prévues; (iii) approbation écrite de B-Invest Limited. En cas de non-réalisation de la transaction dans les délais convenus, les fonds seront restitués à l'Investisseur dans un délai de 30 jours ouvrables.`
      : `The escrowed funds will be released to the designated vendor only after: (i) complete verification of the legal documentation of the property or investment; (ii) confirmation of receipt of all scheduled instalments; (iii) written approval from B-Invest Limited. In case of non-completion of the transaction within the agreed timeframe, funds will be returned to the Investor within 30 business days.`
    }</p>
  </div>

  <div class="signatures">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-name">Raissa Bekamba</div>
      <div class="sig-role">${isFr ? 'Fondatrice & CEO — B-Invest Limited' : 'Founder & CEO — B-Invest Limited'}</div>
      <div style="font-size:10px;color:#999;margin-top:4px">${data.date}</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-name">${data.investor}</div>
      <div class="sig-role">${isFr ? 'L\'Investisseur' : 'The Investor'}</div>
      <div style="font-size:10px;color:#999;margin-top:4px">${isFr ? 'Date : _______________' : 'Date: _______________'}</div>
    </div>
  </div>

  <div class="footer">
    <span>B-Invest Limited · ${data.dia_reference} · ${isFr ? 'Document confidentiel' : 'Confidential Document'}</span>
    <span>${new Date().getFullYear()}</span>
  </div>

  <div class="no-print" style="margin-top:28px;text-align:center">
    <button onclick="window.print()" style="padding:12px 28px;background:#1B3A6B;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:sans-serif">
      🖨️ ${isFr ? 'Imprimer / Sauvegarder en PDF' : 'Print / Save as PDF'}
    </button>
  </div>
</body>
</html>`;
}

function generateAcknowledgementHtml(data: Record<string, any>, lang: 'fr' | 'en'): string {
  const isFr = lang === 'fr';
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<title>B-Invest — ${isFr ? 'Accusé de réception' : 'Payment Acknowledgement'} ${data.dia_reference}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Georgia, serif; color: #1a1a2e; background:#fff; padding:40px; font-size:12px; line-height:1.6; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #1B3A6B; padding-bottom:20px; margin-bottom:28px; }
  .company-name { font-size:22px; font-weight:bold; color:#1B3A6B; }
  .doc-title { font-size:16px; font-weight:bold; color:#1B3A6B; text-align:right; }
  .kente { display:flex; height:5px; margin-bottom:28px; }
  .kente div { flex:1; }
  .amount-box { background:linear-gradient(135deg,#1B3A6B,#0D2347); color:#fff; padding:20px 24px; border-radius:8px; margin:20px 0; display:flex; justify-content:space-between; align-items:center; }
  .amount-value { font-size:28px; font-weight:bold; color:#C9963A; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px; }
  .field { padding:9px 12px; background:#f8f9fc; border-left:3px solid #1B3A6B; border-radius:0 4px 4px 0; }
  .field-label { font-size:10px; color:#888; text-transform:uppercase; margin-bottom:2px; }
  .field-value { font-size:12px; font-weight:bold; }
  .notice { background:#f0f7ff; border:1px solid #bfdbfe; border-radius:6px; padding:14px 18px; margin:20px 0; font-size:11px; color:#1e40af; line-height:1.6; }
  .signatures { display:grid; grid-template-columns:1fr 1fr; gap:40px; margin-top:36px; padding-top:20px; border-top:1px solid #e0e0e0; }
  .sig-line { border-top:1px solid #333; margin-bottom:8px; }
  .footer { margin-top:30px; padding-top:14px; border-top:1px solid #e0e0e0; display:flex; justify-content:space-between; font-size:10px; color:#999; }
  @media print { body { padding:20px; } .no-print { display:none !important; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-name">B-INVEST LIMITED</div>
      <div style="font-size:11px;color:#C9963A;font-style:italic;margin-top:4px">${isFr ? 'Facilitation Immobilière Transfrontalière' : 'Cross-Border Real Estate Facilitation'}</div>
    </div>
    <div>
      <div class="doc-title">${isFr ? 'ACCUSÉ DE RÉCEPTION' : 'PAYMENT ACKNOWLEDGEMENT'}</div>
      <div style="font-size:11px;color:#666;background:#f5f5f5;padding:4px 10px;border-radius:4px;margin-top:6px;display:inline-block">${data.dia_reference}</div>
      <div style="font-size:11px;color:#666;margin-top:4px;text-align:right">${data.date}</div>
    </div>
  </div>
  <div class="kente">
    <div style="background:#1B3A6B"></div><div style="background:#E63946"></div>
    <div style="background:#C9963A"></div><div style="background:#0D2347"></div>
    <div style="background:#1B3A6B"></div><div style="background:#E63946"></div>
    <div style="background:#C9963A"></div><div style="background:#0D2347"></div>
  </div>
  <div class="amount-box">
    <div>
      <div style="font-size:12px;opacity:0.8;margin-bottom:4px">${isFr ? 'Montant reçu' : 'Amount received'}</div>
      <div class="amount-value">₦${data.amount_ngn}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:11px;opacity:0.8;margin-bottom:3px">${isFr ? 'Frais facilitation (10%)' : 'Facilitation fee (10%)'}</div>
      <div style="font-size:16px;font-weight:bold;color:#fff">₦${data.facilitation_fee_ngn}</div>
    </div>
  </div>
  <div class="grid">
    <div class="field"><div class="field-label">${isFr ? 'Investisseur' : 'Investor'}</div><div class="field-value">${data.investor}</div></div>
    <div class="field"><div class="field-label">${isFr ? 'Projet' : 'Project'}</div><div class="field-value">${data.project}</div></div>
    <div class="field"><div class="field-label">${isFr ? 'Référence DIA' : 'DIA Reference'}</div><div class="field-value">${data.dia_reference}</div></div>
    <div class="field"><div class="field-label">${isFr ? 'Date' : 'Date'}</div><div class="field-value">${data.date}</div></div>
  </div>
  <div class="notice">
    ${isFr
      ? 'B-Invest Limited confirme la réception du montant indiqué en relation avec la transaction référencée. Les fonds seront traités conformément aux termes convenus dans le Contrat DIA, incluant la vérification, la diligence raisonnable et le transfert ultérieur au vendeur désigné.'
      : 'B-Invest Limited hereby confirms receipt of the above-stated amount in relation to the referenced transaction. The funds shall be processed in accordance with the agreed terms of the DIA Contract, including verification, due diligence, and subsequent transfer to the designated vendor.'
    }
  </div>
  <div class="signatures">
    <div style="text-align:center">
      <div class="sig-line"></div>
      <div style="font-size:12px;font-weight:bold">Raissa Bekamba</div>
      <div style="font-size:10px;color:#666">${isFr ? 'Fondatrice & CEO' : 'Founder & CEO'} — B-Invest Limited</div>
    </div>
    <div style="text-align:center">
      <div class="sig-line"></div>
      <div style="font-size:12px;font-weight:bold">${data.investor}</div>
      <div style="font-size:10px;color:#666">${isFr ? 'L\'Investisseur' : 'The Investor'}</div>
    </div>
  </div>
  <div class="footer">
    <span>B-Invest Limited · ${isFr ? 'Document officiel confidentiel' : 'Official Confidential Document'}</span>
    <span>${data.dia_reference} · ${new Date().getFullYear()}</span>
  </div>
  <div class="no-print" style="margin-top:24px;text-align:center">
    <button onclick="window.print()" style="padding:12px 28px;background:#1B3A6B;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:sans-serif">
      🖨️ ${isFr ? 'Imprimer / Sauvegarder en PDF' : 'Print / Save as PDF'}
    </button>
  </div>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const lang = (searchParams.get('lang') ?? 'fr') as 'fr' | 'en';
  const docType = searchParams.get('type') ?? 'dia';
  const subscriptionId = searchParams.get('subscription_id');

  const defaultData: Record<string, any> = {
    investor: lang === 'fr' ? 'Investisseur' : 'Investor',
    investor_address: lang === 'fr' ? 'Yaoundé, Cameroun' : 'Yaoundé, Cameroon',
    project: lang === 'fr' ? 'Projet B-Invest' : 'B-Invest Project',
    type_projet: lang === 'fr' ? 'Non défini' : 'Undefined',
    amount_ngn: '0',
    facilitation_fee_ngn: '0',
    total_ngn: '0',
    tranches: 1,
    dia_reference: `DIA-${new Date().getFullYear()}-TEMPLATE`,
    yield_est: '—',
    horizon: lang === 'fr' ? '— ans' : '— years',
    date: new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    }),
  };

  let data = { ...defaultData };

  if (subscriptionId) {
    try {
      const supabase = createAdminClient();
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*, investor:investors(full_name, address, country), project:projects(name, type, yield_min_pct, yield_max_pct, horizon_years)')
        .eq('id', subscriptionId)
        .single();

      if (sub) {
        const fmtNGN = (n: number) => (n ?? 0).toLocaleString('en-NG');
        data = {
          investor: sub.investor?.full_name || defaultData.investor,
          investor_address: [sub.investor?.address, sub.investor?.country].filter(Boolean).join(', ') || defaultData.investor_address,
          project: sub.project?.name || defaultData.project,
          type_projet: sub.project?.type?.replace(/_/g, ' ') || defaultData.type_projet,
          amount_ngn: fmtNGN(sub.amount_ngn || 0),
          facilitation_fee_ngn: fmtNGN(sub.facilitation_fee_ngn || 0),
          total_ngn: fmtNGN(sub.total_amount_ngn || 0),
          tranches: sub.tranches_count || 1,
          dia_reference: sub.dia_reference || `DIA-${Date.now()}`,
          yield_est: sub.project?.yield_min_pct ? `${sub.project.yield_min_pct}-${sub.project.yield_max_pct}%` : '—',
          horizon: sub.project?.horizon_years ? `${sub.project.horizon_years} ${lang === 'fr' ? 'ans' : 'years'}` : '—',
          date: new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
            day: 'numeric', month: 'long', year: 'numeric',
          }),
        };
      }
    } catch (err) {
      console.error('[DOC] Supabase error:', err);
    }
  }

  const html = docType === 'ack'
    ? generateAcknowledgementHtml(data, lang)
    : generateDIAContractHtml(data, lang);

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': 'inline',
    },
  });
}
