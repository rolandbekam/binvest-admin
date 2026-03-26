#!/usr/bin/env python3
"""
Génère le contrat DIA B-Invest en PDF (FR + EN)
Usage: python generate_dia_pdf.py <lang> <output_file> [json_data]
"""

import sys
import json
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether, PageBreak
)
from reportlab.platypus.flowables import HRFlowable
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ── Couleurs B-Invest ────────────────────────────────────────────
NAVY    = colors.HexColor('#1B3A6B')
GOLD    = colors.HexColor('#C9963A')
RED     = colors.HexColor('#E63946')
LIGHT   = colors.HexColor('#EEF2FF')
GRAY    = colors.HexColor('#5A6E8A')
LGRAY   = colors.HexColor('#F4F6FA')
WHITE   = colors.white
BLACK   = colors.HexColor('#0F1E35')

W, H = A4  # 595 x 842

# ── Styles ────────────────────────────────────────────────────────
def make_styles():
    s = {}
    base = ParagraphStyle
    s['title']   = base('title',   fontName='Helvetica-Bold',   fontSize=20, textColor=NAVY,  alignment=TA_CENTER, spaceAfter=4)
    s['sub']     = base('sub',     fontName='Helvetica-Bold',   fontSize=13, textColor=GOLD,  alignment=TA_CENTER, spaceAfter=2)
    s['ref']     = base('ref',     fontName='Helvetica',        fontSize=10, textColor=GRAY,  alignment=TA_CENTER, spaceAfter=14)
    s['h1']      = base('h1',      fontName='Helvetica-Bold',   fontSize=12, textColor=NAVY,  spaceBefore=14, spaceAfter=4)
    s['h2']      = base('h2',      fontName='Helvetica-Bold',   fontSize=10, textColor=BLACK, spaceBefore=8,  spaceAfter=3)
    s['body']    = base('body',    fontName='Helvetica',        fontSize=9,  textColor=BLACK, spaceBefore=2, spaceAfter=4, leading=13, alignment=TA_JUSTIFY)
    s['small']   = base('small',   fontName='Helvetica',        fontSize=8,  textColor=GRAY,  spaceAfter=2)
    s['italic']  = base('italic',  fontName='Helvetica-Oblique',fontSize=8.5,textColor=GRAY, spaceAfter=4)
    s['center']  = base('center',  fontName='Helvetica',        fontSize=9,  textColor=BLACK, alignment=TA_CENTER)
    s['bold_c']  = base('bold_c',  fontName='Helvetica-Bold',   fontSize=10, textColor=NAVY,  alignment=TA_CENTER)
    s['cell_h']  = base('cell_h',  fontName='Helvetica-Bold',   fontSize=9,  textColor=WHITE)
    s['cell']    = base('cell',    fontName='Helvetica',        fontSize=9,  textColor=BLACK)
    s['cell_b']  = base('cell_b',  fontName='Helvetica-Bold',   fontSize=9,  textColor=NAVY)
    s['footer']  = base('footer',  fontName='Helvetica',        fontSize=7,  textColor=GRAY,  alignment=TA_CENTER)
    s['header_l']= base('header_l',fontName='Helvetica-Bold',   fontSize=11, textColor=NAVY)
    s['header_s']= base('header_s',fontName='Helvetica',        fontSize=7,  textColor=GRAY)
    s['header_r']= base('header_r',fontName='Helvetica-Bold',   fontSize=8,  textColor=GOLD, alignment=TA_RIGHT)
    return s

# ── Textes FR / EN ─────────────────────────────────────────────────
TEXTS = {
    'fr': {
        'doc_title': 'DIRECT INVESTMENT ACCOUNT',
        'doc_sub': 'DIA — Contrat d\'Investissement Direct',
        'ref_label': 'Numéro de référence',
        'fees_title': 'TABLEAU RÉCAPITULATIF DES FRAIS',
        'fees_note': 'Veuillez lire attentivement avant de signer.',
        'fee_type': 'Type de frais', 'fee_rate': 'Taux', 'fee_base': 'Base de calcul',
        'fee_rows': [
            ['Frais de facilitation (Agent)', '10%', 'Valeur totale de la transaction'],
            ['Frais de gestion annuels (Holding)', '3% / an', 'Valeur du bien par année'],
            ['Commission de revente (Holding)', '15%', 'Prix de vente net'],
        ],
        'sec_a': 'SECTION A — CONTRAT D\'AGENCE (Facilitation Transfrontalière)',
        'sec_a_parties': 'Le présent accord est conclu entre B INVEST LIMITED, société enregistrée au Nigeria, ci-après dénommé « l\'Agent » ; ET {investor}, de {address}, ci-après dénommé « le Client / Investisseur ».',
        'art2_title': 'Article 2 — Rôle de l\'Agent',
        'art2': 'L\'Agent agit strictement en qualité de facilitateur et de coordinateur de la Transaction. Il ne représente pas le vendeur et ne détient pas les fonds à titre de propriétaire, mais sert d\'intermédiaire professionnel.',
        'art6_title': 'Article 6 — Honoraires et Compensation',
        'art6': 'L\'Investisseur s\'engage à verser à l\'Agent des frais de facilitation de 10% (dix pour cent) de la valeur totale de la Transaction, soit {fee} NGN pour un investissement de {amount} NGN, payables à la signature ou à la confirmation d\'engagement.',
        'art10_title': 'Article 10 — Droit Applicable et Résolution des Litiges',
        'art10': 'Le présent accord est régi par les lois de la République fédérale du Nigeria. Tout différend sera soumis à l\'arbitrage sous les règles de la Lagos Court of Arbitration (LCA).',
        'sig_agent': 'L\'Agent — B INVEST LIMITED',
        'sig_client': 'Le Client / Investisseur',
        'sig_ceo': 'Fondatrice & CEO',
        'sig_investor': 'Investisseur',
        'sig_name': 'Nom :',
        'sig_title': 'Titre :',
        'sig_sig': 'Signature :',
        'sig_date': 'Date :',
        'sig_line': '________________________________',
        'sec_b': 'SECTION B — ACCORD DE HOLDING (Propriété Nominale et Gestion d\'Actifs)',
        'sec_b_intro': 'B INVEST LIMITED détient le titre légal du bien en qualité de mandataire. L\'investisseur {investor} conserve la pleine propriété économique du bien à tout moment. La participation en capital de la société est fixée à zéro pour cent (0%).',
        'project_details': 'Détails du projet',
        'project': 'Projet',
        'type': 'Type',
        'location': 'Localisation',
        'amount': 'Montant investi',
        'fee': 'Frais de facilitation (10%)',
        'total': 'TOTAL À PAYER',
        'yield': 'Rendement estimé',
        'horizon': 'Horizon d\'investissement',
        'tranches': 'Nombre de tranches',
        'art6b_title': 'Article 6 — Frais de Gestion',
        'art6b': 'L\'investisseur s\'engage à payer des frais de gestion annuels de 3% (trois pour cent) de la valeur du bien.',
        'art9_title': 'Article 9 — Vente ou Transfert',
        'art9': 'Le bien ne peut être vendu ou transféré sans le consentement écrit préalable de l\'investisseur. À la vente, la société percevra une commission de revente de 15% (quinze pour cent) du prix de vente net.',
        'sig_company': 'La Société — B INVEST LIMITED',
        'sig_owner': 'Le Propriétaire Bénéficiaire',
        'sec_c': 'SECTION C — GESTION DES FONDS ET PROTECTION (Style Séquestre)',
        'sec_c_intro': 'Tous les paiements du Client seront effectués exclusivement à B INVEST LIMITED. Les fonds seront conservés et ne seront libérés qu\'après vérification complète, confirmation des termes et documentation en règle.',
        'bank_title': 'Coordonnées Bancaires B INVEST LIMITED',
        'bank': 'Banque',
        'account': 'Numéro de compte',
        'swift': 'IBAN / SWIFT',
        'wire_ref': 'Référence de virement',
        'art5c_title': 'Article 5 — Accusé de Réception',
        'art5c': 'À chaque réception de fonds, B INVEST LIMITED émettra un accusé de réception formel précisant le montant reçu, la devise, la date, la référence de transaction et le taux de change applicable.',
        'end': '— Fin du Document DIA — B INVEST LIMITED — Document Officiel Confidentiel —',
        'confidential': 'B INVEST LIMITED — Document Confidentiel Officiel',
        'footer': 'B INVEST LIMITED · Cross-Border Real Estate Facilitation · Nigeria · Document Confidentiel',
    },
    'en': {
        'doc_title': 'DIRECT INVESTMENT ACCOUNT',
        'doc_sub': 'DIA — Direct Investment Contract',
        'ref_label': 'Reference Number',
        'fees_title': 'FEE SUMMARY TABLE',
        'fees_note': 'Please read carefully before signing.',
        'fee_type': 'Fee Type', 'fee_rate': 'Rate', 'fee_base': 'Basis',
        'fee_rows': [
            ['Facilitation Fee (Agent)', '10%', 'Total transaction value'],
            ['Annual Management Fee (Holding)', '3% / yr', 'Property value per year'],
            ['Resale Commission (Holding)', '15%', 'Net sale price'],
        ],
        'sec_a': 'SECTION A — AGENCY AGREEMENT (Cross-Border Real Estate Facilitation)',
        'sec_a_parties': 'This Agreement is made between B INVEST LIMITED, a company incorporated under the laws of Nigeria, hereinafter referred to as "the Agent"; AND {investor}, of {address}, hereinafter referred to as "the Client / Investor".',
        'art2_title': 'Article 2 — Role of the Agent',
        'art2': 'The Agent acts strictly as a facilitator and coordinator of the Transaction. The Agent does not act as the owner, seller, or legal representative of the Property but serves as a professional intermediary.',
        'art6_title': 'Article 6 — Fees and Compensation',
        'art6': 'The Investor agrees to pay the Agent a facilitation fee of 10% (ten per cent) of the total Transaction value, being {fee} NGN on an investment of {amount} NGN, payable upon execution of the purchase agreement or confirmation of commitment.',
        'art10_title': 'Article 10 — Governing Law and Dispute Resolution',
        'art10': 'This Agreement is governed by the laws of the Federal Republic of Nigeria. Any dispute shall be referred to arbitration under the Lagos Court of Arbitration (LCA) rules.',
        'sig_agent': 'The Agent — B INVEST LIMITED',
        'sig_client': 'The Client / Investor',
        'sig_ceo': 'Founder & CEO',
        'sig_investor': 'Investor',
        'sig_name': 'Name:',
        'sig_title': 'Title:',
        'sig_sig': 'Signature:',
        'sig_date': 'Date:',
        'sig_line': '________________________________',
        'sec_b': 'SECTION B — HOLDING COMPANY AGREEMENT (Nominee Ownership and Asset Management)',
        'sec_b_intro': 'B INVEST LIMITED holds legal title to the Property as nominee. The investor {investor} retains full beneficial ownership of the Property at all times. The Company\'s equity participation is fixed at zero per cent (0%).',
        'project_details': 'Project Details',
        'project': 'Project',
        'type': 'Type',
        'location': 'Location',
        'amount': 'Investment Amount',
        'fee': 'Facilitation Fee (10%)',
        'total': 'TOTAL DUE',
        'yield': 'Estimated Yield',
        'horizon': 'Investment Horizon',
        'tranches': 'Number of Instalments',
        'art6b_title': 'Article 6 — Management Fees',
        'art6b': 'The Investor agrees to pay an annual management fee of 3% (three per cent) of the Property value.',
        'art9_title': 'Article 9 — Sale or Transfer',
        'art9': 'The Property shall not be sold or transferred without the prior written consent of the Beneficial Owner. Upon sale, the Company shall be entitled to a resale commission of 15% (fifteen per cent) of the net sale price.',
        'sig_company': 'The Company — B INVEST LIMITED',
        'sig_owner': 'The Beneficial Owner',
        'sec_c': 'SECTION C — ESCROW-STYLE FUNDS HANDLING AND PROTECTION',
        'sec_c_intro': 'All payments from the Client shall be made exclusively to B INVEST LIMITED. Funds shall be held and shall not be released until complete due diligence, confirmation of terms, and all required documentation is in place.',
        'bank_title': 'B INVEST LIMITED Bank Details',
        'bank': 'Bank',
        'account': 'Account Number',
        'swift': 'IBAN / SWIFT',
        'wire_ref': 'Wire Reference',
        'art5c_title': 'Article 5 — Payment Acknowledgement',
        'art5c': 'Upon receipt of funds, B INVEST LIMITED shall issue a formal acknowledgement specifying the amount received, currency, date, transaction reference, and exchange rate applied.',
        'end': '— End of DIA Document — B INVEST LIMITED — Official Confidential Document —',
        'confidential': 'B INVEST LIMITED — Official Confidential Document',
        'footer': 'B INVEST LIMITED · Cross-Border Real Estate Facilitation · Nigeria · Confidential',
    }
}

ACK_TEXTS = {
    'fr': {
        'title': 'ACCUSÉ DE RÉCEPTION',
        'sub': 'PAYMENT ACKNOWLEDGEMENT',
        'from': 'Reçu de :', 'country': 'Pays de résidence :', 'amount': 'Montant reçu :',
        'currency': 'Devise :', 'purpose': 'Objet du paiement :', 'project': 'Projet / Propriété :',
        'dia': 'Référence contrat DIA :', 'date': 'Date de réception :',
        'method_title': 'Méthode de paiement :',
        'body': 'Nous confirmons par la présente la réception du montant susmentionné en relation avec la transaction référencée. Les fonds seront traités conformément à la structure de transaction convenue et aux conditions applicables, incluant la vérification, la diligence raisonnable et le transfert ultérieur au vendeur désigné. Le vendeur émettra un reçu officiel au nom du Client à l\'issue du processus de paiement.',
        'sig1': 'Signataire 1', 'sig2': 'Signataire 2',
        'footer': 'B INVEST LIMITED — Document Confidentiel Officiel',
    },
    'en': {
        'title': 'PAYMENT ACKNOWLEDGEMENT',
        'sub': 'ACCUSÉ DE RÉCEPTION',
        'from': 'Received From:', 'country': 'Country of Residence:', 'amount': 'Amount Received:',
        'currency': 'Currency:', 'purpose': 'Purpose of Payment:', 'project': 'Property / Project:',
        'dia': 'DIA Contract Reference:', 'date': 'Date of Receipt:',
        'method_title': 'Payment Method:',
        'body': 'We hereby confirm receipt of the above-stated amount in relation to the referenced transaction. The funds shall be processed in accordance with the agreed transaction structure and applicable terms, including verification, due diligence, and subsequent transfer to the designated vendor. The vendor shall issue an official receipt in the name of the Client upon completion of the payment process.',
        'sig1': 'Signatory 1', 'sig2': 'Signatory 2',
        'footer': 'B INVEST LIMITED — Official Confidential Document',
    }
}

def hr_gold():
    return HRFlowable(width='100%', thickness=2, color=GOLD, spaceAfter=6, spaceBefore=6)

def hr_light():
    return HRFlowable(width='100%', thickness=0.5, color=LIGHT, spaceAfter=4, spaceBefore=4)

def header_footer(canvas, doc, data, lang, doc_type):
    T = TEXTS[lang] if doc_type == 'dia' else ACK_TEXTS[lang]
    canvas.saveState()
    # Header
    canvas.setFillColor(NAVY)
    canvas.setFont('Helvetica-Bold', 12)
    canvas.drawString(20*mm, H - 18*mm, 'B-INVEST LIMITED')
    canvas.setFont('Helvetica', 7)
    canvas.setFillColor(GRAY)
    canvas.drawString(20*mm, H - 23*mm, 'Cross-Border Real Estate Facilitation — Nigeria')
    # Gold line header
    canvas.setStrokeColor(GOLD)
    canvas.setLineWidth(2)
    canvas.line(20*mm, H - 26*mm, W - 20*mm, H - 26*mm)
    # Ref + date right
    canvas.setFont('Helvetica-Bold', 8)
    canvas.setFillColor(GOLD)
    canvas.drawRightString(W - 20*mm, H - 18*mm, f'Réf: {data.get("dia_reference","—")}')
    canvas.setFont('Helvetica', 7)
    canvas.setFillColor(GRAY)
    canvas.drawRightString(W - 20*mm, H - 23*mm, data.get('date',''))
    # Footer
    canvas.setStrokeColor(LIGHT)
    canvas.setLineWidth(0.5)
    canvas.line(20*mm, 18*mm, W - 20*mm, 18*mm)
    canvas.setFont('Helvetica', 7)
    canvas.setFillColor(GRAY)
    footer_text = T.get('footer', T.get('confidential',''))
    canvas.drawCentredString(W / 2, 12*mm, f'{footer_text}  ·  {data.get("dia_reference","")}')
    canvas.drawRightString(W - 20*mm, 12*mm, f'Page {doc.page}')
    canvas.restoreState()

def make_sig_table(styles, T, left_title, left_name, right_title, right_name=None):
    line = '________________________________'
    def sig_cell(title, name):
        return [
            Paragraph(f'<b>{title}</b>', styles['cell_b']),
            Spacer(1, 6),
            Paragraph(f'{T["sig_name"]} {name or line}', styles['cell']),
            Paragraph(f'{T["sig_title"]} {T["sig_ceo"] if "Agent" in title or "Company" in title or "Société" in title else T["sig_investor"]}', styles['cell']),
            Paragraph(f'{T["sig_sig"]} {line}', styles['cell']),
            Paragraph(f'{T["sig_date"]} {line}', styles['cell']),
        ]
    t = Table(
        [[sig_cell(left_title, left_name), sig_cell(right_title, right_name)]],
        colWidths=[82*mm, 82*mm],
    )
    t.setStyle(TableStyle([
        ('BOX',      (0,0),(0,0), 0.5, LIGHT),
        ('BOX',      (1,0),(1,0), 0.5, colors.HexColor('#E2E8F0')),
        ('BACKGROUND',(0,0),(0,0), LIGHT),
        ('VALIGN',   (0,0),(-1,-1), 'TOP'),
        ('TOPPADDING',(0,0),(-1,-1), 8),
        ('BOTTOMPADDING',(0,0),(-1,-1), 16),
        ('LEFTPADDING',(0,0),(-1,-1), 10),
        ('RIGHTPADDING',(0,0),(-1,-1), 10),
    ]))
    return t

def gen_dia(data, lang, out_path):
    T = TEXTS[lang]
    styles = make_styles()
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
        topMargin=30*mm, bottomMargin=25*mm,
        leftMargin=20*mm, rightMargin=20*mm)

    def build_header_footer(canvas, doc_obj):
        header_footer(canvas, doc_obj, data, lang, 'dia')

    story = []

    # ── TITRE ──
    story += [
        Spacer(1, 4),
        Paragraph(T['doc_title'], styles['title']),
        Paragraph(T['doc_sub'], styles['sub']),
        Paragraph(f'{T["ref_label"]} : {data["dia_reference"]}', styles['ref']),
        hr_gold(),
    ]

    # ── TABLEAU FRAIS ──
    story += [
        Paragraph(T['fees_title'], styles['h1']),
        Paragraph(T['fees_note'], styles['italic']),
        Spacer(1, 4),
    ]
    fee_data = [[T['fee_type'], T['fee_rate'], T['fee_base']]] + T['fee_rows']
    fee_table = Table(fee_data, colWidths=[80*mm, 25*mm, 60*mm])
    fee_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0),(-1,0), NAVY),
        ('TEXTCOLOR',  (0,0),(-1,0), WHITE),
        ('FONTNAME',   (0,0),(-1,0), 'Helvetica-Bold'),
        ('FONTSIZE',   (0,0),(-1,-1), 9),
        ('ROWBACKGROUNDS', (0,1),(-1,-1), [WHITE, LGRAY]),
        ('GRID', (0,0),(-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('LEFTPADDING',  (0,0),(-1,-1), 8),
        ('RIGHTPADDING', (0,0),(-1,-1), 8),
        ('TOPPADDING',   (0,0),(-1,-1), 6),
        ('BOTTOMPADDING',(0,0),(-1,-1), 6),
    ]))
    story += [fee_table, Spacer(1, 10)]

    # ── SECTION A ──
    story += [
        hr_gold(),
        Paragraph(T['sec_a'], styles['h1']),
        Paragraph(T['sec_a_parties'].format(investor=data['investor'], address=data['investor_address']), styles['body']),
        Spacer(1, 4),
        Paragraph(T['art2_title'], styles['h2']),
        Paragraph(T['art2'], styles['body']),
        Paragraph(T['art6_title'], styles['h2']),
        Paragraph(T['art6'].format(fee=data['facilitation_fee_ngn'], amount=data['amount_ngn']), styles['body']),
        Paragraph(T['art10_title'], styles['h2']),
        Paragraph(T['art10'], styles['body']),
        Spacer(1, 6),
        make_sig_table(styles, T, T['sig_agent'], 'Raissa Bekamba', T['sig_client'], data['investor']),
        Spacer(1, 8),
    ]

    # ── SECTION B ──
    story += [
        hr_gold(),
        Paragraph(T['sec_b'], styles['h1']),
        Paragraph(T['sec_b_intro'].format(investor=data['investor']), styles['body']),
        Spacer(1, 4),
        Paragraph(T['project_details'], styles['h2']),
    ]
    proj_rows = [
        [T['project'],  data['project']],
        [T['type'],     data['type_projet']],
        [T['location'], 'Nigeria'],
        [T['amount'],   f'₦{data["amount_ngn"]}'],
        [T['fee'],      f'₦{data["facilitation_fee_ngn"]} (10%)'],
        [T['total'],    f'₦{data["total_ngn"]}'],
        [T['yield'],    data['yield_est']],
        [T['horizon'],  data['horizon']],
        [T['tranches'], str(data['tranches'])],
    ]
    proj_table = Table(proj_rows, colWidths=[65*mm, 100*mm])
    proj_table.setStyle(TableStyle([
        ('FONTNAME',  (0,0),(0,-1), 'Helvetica-Bold'),
        ('FONTNAME',  (1,0),(1,-1), 'Helvetica'),
        ('FONTSIZE',  (0,0),(-1,-1), 9),
        ('TEXTCOLOR', (0,0),(0,-1), NAVY),
        ('ROWBACKGROUNDS', (0,0),(-1,-1), [WHITE, LGRAY]),
        ('GRID', (0,0),(-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('LEFTPADDING',  (0,0),(-1,-1), 8),
        ('RIGHTPADDING', (0,0),(-1,-1), 8),
        ('TOPPADDING',   (0,0),(-1,-1), 5),
        ('BOTTOMPADDING',(0,0),(-1,-1), 5),
        ('FONTNAME',  (0,4),(1,4), 'Helvetica-Bold'),
        ('TEXTCOLOR', (1,4),(1,4), RED),
        ('FONTSIZE',  (0,4),(1,4), 10),
    ]))
    story += [
        proj_table, Spacer(1, 6),
        Paragraph(T['art6b_title'], styles['h2']),
        Paragraph(T['art6b'], styles['body']),
        Paragraph(T['art9_title'], styles['h2']),
        Paragraph(T['art9'], styles['body']),
        Spacer(1, 6),
        make_sig_table(styles, T, T['sig_company'], 'Raissa Bekamba', T['sig_owner'], data['investor']),
        Spacer(1, 8),
    ]

    # ── SECTION C ──
    story += [
        hr_gold(),
        Paragraph(T['sec_c'], styles['h1']),
        Paragraph(T['sec_c_intro'], styles['body']),
        Spacer(1, 4),
        Paragraph(T['bank_title'], styles['h2']),
    ]
    bank_rows = [
        [T['bank'],     '________________________________'],
        [T['account'],  '________________________________'],
        [T['swift'],    '________________________________'],
        [T['wire_ref'], data['dia_reference']],
    ]
    bank_table = Table(bank_rows, colWidths=[65*mm, 100*mm])
    bank_table.setStyle(TableStyle([
        ('FONTNAME',  (0,0),(0,-1), 'Helvetica-Bold'),
        ('FONTNAME',  (1,0),(1,-1), 'Helvetica'),
        ('FONTSIZE',  (0,0),(-1,-1), 9),
        ('TEXTCOLOR', (0,0),(0,-1), NAVY),
        ('ROWBACKGROUNDS', (0,0),(-1,-1), [WHITE, LGRAY]),
        ('GRID', (0,0),(-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('LEFTPADDING',  (0,0),(-1,-1), 8),
        ('RIGHTPADDING', (0,0),(-1,-1), 8),
        ('TOPPADDING',   (0,0),(-1,-1), 5),
        ('BOTTOMPADDING',(0,0),(-1,-1), 5),
    ]))
    story += [
        bank_table, Spacer(1, 6),
        Paragraph(T['art5c_title'], styles['h2']),
        Paragraph(T['art5c'], styles['body']),
        Spacer(1, 6),
        make_sig_table(styles, T, T['sig_company'], 'Raissa Bekamba', T['sig_client'], data['investor']),
        Spacer(1, 12),
        hr_gold(),
        Paragraph(T['end'], styles['italic']),
    ]

    doc.build(story, onFirstPage=build_header_footer, onLaterPages=build_header_footer)
    with open(out_path, 'wb') as f:
        f.write(buf.getvalue())

def gen_ack(data, lang, out_path):
    T = ACK_TEXTS[lang]
    styles = make_styles()
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
        topMargin=30*mm, bottomMargin=25*mm,
        leftMargin=20*mm, rightMargin=20*mm)

    def build_hf(canvas, doc_obj):
        header_footer(canvas, doc_obj, data, lang, 'ack')

    story = [
        Spacer(1, 4),
        Paragraph(T['title'], styles['title']),
        Paragraph(T['sub'],   styles['sub']),
        Paragraph(f'Réf: {data["dia_reference"]}', styles['ref']),
        hr_gold(),
        Spacer(1, 8),
    ]

    rows = [
        [T['from'],    data['investor']],
        [T['country'], data['investor_address']],
        [T['amount'],  f'₦{data["amount_ngn"]}'],
        [T['currency'],'NGN — Nigerian Naira'],
        [T['purpose'], 'Real Estate / Agricultural Investment'],
        [T['project'], data['project']],
        [T['dia'],     data['dia_reference']],
        [T['date'],    data['date']],
    ]
    t = Table(rows, colWidths=[70*mm, 95*mm])
    t.setStyle(TableStyle([
        ('FONTNAME',  (0,0),(0,-1), 'Helvetica-Bold'),
        ('FONTNAME',  (1,0),(1,-1), 'Helvetica'),
        ('FONTSIZE',  (0,0),(-1,-1), 9),
        ('TEXTCOLOR', (0,0),(0,-1), NAVY),
        ('ROWBACKGROUNDS', (0,0),(-1,-1), [WHITE, LGRAY]),
        ('GRID', (0,0),(-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('LEFTPADDING',  (0,0),(-1,-1), 8),
        ('RIGHTPADDING', (0,0),(-1,-1), 8),
        ('TOPPADDING',   (0,0),(-1,-1), 6),
        ('BOTTOMPADDING',(0,0),(-1,-1), 6),
    ]))
    story += [t, Spacer(1, 14)]
    story += [
        Paragraph(T['body'], styles['body']),
        Spacer(1, 16),
        make_sig_table(styles, TEXTS[lang], T['sig1'], 'Raissa Bekamba', T['sig2']),
        Spacer(1, 12),
        hr_gold(),
        Paragraph(T['footer'], styles['italic']),
    ]
    doc.build(story, onFirstPage=build_hf, onLaterPages=build_hf)
    with open(out_path, 'wb') as f:
        f.write(buf.getvalue())

if __name__ == '__main__':
    lang = sys.argv[1] if len(sys.argv) > 1 else 'fr'
    out  = sys.argv[2] if len(sys.argv) > 2 else f'/tmp/DIA-{lang}.pdf'
    doc_type = sys.argv[3] if len(sys.argv) > 3 else 'dia'
    data = json.loads(sys.argv[4]) if len(sys.argv) > 4 else {}

    defaults = {
        'investor': 'Investisseur',
        'investor_address': 'Yaoundé, Cameroun',
        'project': 'Palmeraie Ogun State',
        'type_projet': 'Agriculture / Palmeraie',
        'amount_ngn': '1,000,000',
        'facilitation_fee_ngn': '100,000',
        'total_ngn': '1,100,000',
        'tranches': 3,
        'dia_reference': 'DIA-2026-TEMPLATE',
        'yield_est': '30-35%',
        'horizon': '5 ans' if lang == 'fr' else '5 years',
        'date': '25 mars 2026' if lang == 'fr' else 'March 25, 2026',
    }
    defaults.update(data)

    if doc_type == 'ack':
        gen_ack(defaults, lang, out)
    else:
        gen_dia(defaults, lang, out)

    print(f'OK:{out}')
