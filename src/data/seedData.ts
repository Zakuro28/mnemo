import { LoreDocument, Decision } from '../types/lore';

export const SEED_DOCUMENTS: LoreDocument[] = [
  {
    id: 'D1',
    title: 'Vendor C Trial Review & Post-Mortem',
    date: '2023-08-14',
    author: 'Maria Tan, Procurement Lead',
    type: 'email',
    content: `From: Maria Tan <m.tan@brightwell.com>
To: Daniel Cruz <d.cruz@brightwell.com>, Priya Nair <p.nair@brightwell.com>
Date: August 14, 2023, 14:15 EST
Subject: RE: 90-Day Freight Trial: Vendor C Results

Team,
We have concluded the 90-day trial with Vendor C across our Eastern routes.
Final audit results are unacceptable: exactly 7% of shipments experienced documented cargo damage during transit (our strict company tolerance is < 0.8%).
Customer operations filed 14 replacement claims in July alone.

Procurement has formally terminated the trial and dropped Vendor C from our eligible vendor roster. We will not proceed with a master service agreement with Vendor C under any circumstances until their cold-chain and handling protocols are overhauled.`,
    snippet: 'Trial of Vendor C ended. 7% of shipments had damaged goods; procurement dropped Vendor C.'
  },
  {
    id: 'D2',
    title: 'Supplier Selection & RFP Final Review',
    date: '2024-03-12',
    author: 'Maria Tan, Procurement Lead',
    type: 'meeting_notes',
    content: `Brightwell Logistics — Executive Procurement Meeting
Date: March 12, 2024 | Location: Boardroom B & Video
Attendees: Maria Tan (Procurement Lead), Daniel Cruz (Ops Director), Priya Nair (Finance Director)

Agenda: Primary Regional Freight Carrier Selection for 2024-2026.

Options Evaluated:
1. Vendor A:
   - Price: $12.50 per unit
   - Guaranteed SLA: 4-day delivery turnaround
   - Established regional hubs, strong reputation.
2. Vendor B:
   - Price: $10.00 per unit (20% cheaper than Vendor A)
   - Guaranteed SLA: 2-day delivery turnaround
   - Modern dispatch tracking, dedicated fleet capacity.
3. Vendor C:
   - Evaluated briefly, but rejected immediately due to 7% damage rate recorded during the August 2023 pilot (see D1).

DECISION:
Unanimously select Vendor B as our primary carrier.
Key decision drivers:
- 20% lower unit rate ($10.00 vs $12.50) saving ~$20,000/month at 8k volume.
- Fast 2-day delivery turnaround to protect customer satisfaction.`,
    snippet: 'Vendor selection meeting. Options: Vendor A ($12.50/unit, 4-day), Vendor B ($10.00/unit, 2-day), Vendor C (rejected, see D1). Decision: choose Vendor B. Reasons: 20% cheaper, 2-day delivery.'
  },
  {
    id: 'D3',
    title: 'Vendor B Contract Execution Notice',
    date: '2024-03-15',
    author: 'Daniel Cruz, Ops Director',
    type: 'email',
    content: `From: Daniel Cruz <d.cruz@brightwell.com>
To: Maria Tan <m.tan@brightwell.com>, Executive Team <exec@brightwell.com>
Date: March 15, 2024, 09:42 EST
Subject: Executed Agreement: Vendor B Freight Services

Maria,
Approved. Vendor B contract signed, 8,000 units/month commitment beginning April 1st, 2024.
Base pricing locked at $10.00/unit subject to quarterly volume compliance and standard 2-day transit SLA.

Routing systems will default all Tier-1 dispatch batches through Vendor B starting Monday.`,
    snippet: 'Approved. Vendor B contract signed, 8,000 units/month at $10.00/unit with 2-day SLA.'
  },
  {
    id: 'D4',
    title: 'Operations Carrier SLA & Delivery Audit Report',
    date: '2026-07-30',
    author: 'Operations Quality & Telematics Team',
    type: 'report',
    content: `Brightwell Logistics Carrier Performance Audit — Q2 2026
Published: July 30, 2026
Author: Central Ops Dispatch & Logistics Audit

Executive Summary:
Carrier performance monitoring indicates persistent transit slippage for primary supplier Vendor B.
- Original target SLA: 2.0 calendar days.
- Current observed metric: Vendor B average delivery time is now 5.1 days across regional distribution routes over the trailing 60 days.
- Impact: Regional hubs are holding buffer stock 48 hours longer to avoid fulfillment backorders.

Ops Director Note: We recommend flagging this contract for executive review if transit times fail to recover.`,
    snippet: 'Vendor B average delivery time is now 5 days (target was 2 days), causing buffer stock build-up.'
  },
  {
    id: 'D5',
    title: 'Quote from Vendor A',
    date: '2026-09-02',
    author: 'Vendor A Enterprise Logistics',
    type: 'quote',
    content: `Quote from Vendor A, 2026-09-02:
$12.80/unit, 3-day delivery.`,
    snippet: 'Quote from Vendor A: $12.80/unit, 3-day delivery.'
  },
  {
    id: 'D6',
    title: 'Operations Cadence & Synchronization Guideline',
    date: '2025-01-10',
    author: 'Daniel Cruz, Ops Director',
    type: 'memo',
    content: `Memo: Standard Operating Cadence
Date: January 10, 2025
Author: Daniel Cruz, Ops Director

To eliminate weekend fulfillment lag and align warehouse lead handoffs, all cross-functional ops syncs are scheduled every Monday morning at 09:30 AM EST.
Attendees: Warehouse Leads, Regional Dispatch, Procurement, and Customer Escalations.
Outcomes: Sets dispatch quotas, reviews maintenance windows, and validates carrier availability before shift handovers.`,
    snippet: 'Weekly ops sync scheduled Mondays at 09:30 AM to coordinate fleet dispatch before shift rotations.'
  },
  {
    id: 'D7',
    title: 'Information Governance & SOC2 Contract Storage Policy',
    date: '2024-11-05',
    author: 'Priya Nair, Finance & Legal Lead',
    type: 'policy',
    content: `Policy DOC-SEC-2024-4: Vendor Contract Centralization
Date: November 5, 2024
Issued by: Finance & Legal Compliance

To satisfy SOC2 Type II audit standards and corporate legal retention mandates:
- All executed master service agreements, rate cards, and addenda must be deposited in the encrypted Corporate Shared Drive (/Legal/Executed_Agreements).
- Local storage or unmonitored email attachments of contracts are strictly prohibited.
- Access logs are audited on the 1st of every month.`,
    snippet: 'All executed vendor agreements must be archived in the encrypted Corporate Shared Drive for SOC2 compliance.'
  }
];

export const SAMPLE_INVOICE_DATA = {
  fileName: 'Vendor_B_Invoice_INV-2026-0912.pdf',
  invoiceNumber: 'INV-2026-0912',
  date: '2026-09-28',
  vendorName: 'Vendor B Logistics Ltd.',
  billedTo: 'Brightwell Logistics Inc.',
  units: 8000,
  unitPrice: 13.40,
  totalAmount: 107200.00,
  notes: 'Quarterly freight reconciliation. Base rate $10.00 + mandatory fuel surcharge adjustment index ($3.40/unit). Total unit rate: $13.40.',
  textRepresentation: `=====================================================
INVOICE: INV-2026-0912
VENDOR: Vendor B Logistics Ltd.
DATE: September 28, 2026
BILLED TO: Brightwell Logistics Inc.
PO REF: BL-2024-0315 (Contract D3)
-----------------------------------------------------
Line Item: Regional Freight Handling (September 2026)
Quantity: 8,000 units
Rate: $13.40 / unit
-----------------------------------------------------
Subtotal: $107,200.00
Tax: $0.00 (B2B Exempt)
TOTAL AMOUNT DUE: $107,200.00
Payment Terms: Net 30
Notes: Price adjustment includes escalated regional fuel surcharge index.
=====================================================`
};

export const INITIAL_DECISIONS: Decision[] = [
  {
    id: 'dec-vendor-b',
    title: 'Use Vendor B as primary supplier',
    date: '2024-03-12',
    lead: 'Maria Tan, Procurement Lead',
    summary: 'Selected Vendor B over Vendor A and Vendor C for primary logistics handling based on 20% lower unit rate ($10.00 vs $12.50) and 2-day delivery SLA commitment.',
    status: 'Watch',
    reasons: [
      {
        text: '20% cheaper than alternative supplier Vendor A ($10.00 vs $12.50 per unit in 2024)',
        sourceDocId: 'D2',
        sourceSnippet: 'Reasons: 20% cheaper ($10.00 vs $12.50), 2-day delivery.'
      },
      {
        text: 'Fast 2-day regional delivery SLA to protect customer fulfillment',
        sourceDocId: 'D2',
        sourceSnippet: 'Vendor B ($10.00/unit, 2-day delivery) chosen to protect turnaround.'
      },
      {
        text: 'Volume contract authorized for 8,000 units/month',
        sourceDocId: 'D3',
        sourceSnippet: 'Approved. Vendor B contract signed, 8,000 units/month.'
      }
    ],
    assumptions: [
      {
        id: 'a1',
        decisionId: 'dec-vendor-b',
        text: 'Vendor B is cheaper than Vendor A',
        status: 'Valid',
        sourceDocId: 'D2',
        originalReason: 'Vendor B price was $10.00/unit vs Vendor A at $12.50/unit in 2024 RFP.',
        latestEvidence: 'Quote from Vendor A (D5): $12.80/unit, 3-day delivery.',
        lastCheckedDate: '2026-09-02'
      },
      {
        id: 'a2',
        decisionId: 'dec-vendor-b',
        text: 'Vendor B delivers in about 2 days',
        status: 'Watch',
        sourceDocId: 'D4',
        originalReason: '2-day delivery turnaround guaranteed in 2024 contract (D2, D3).',
        latestEvidence: 'D4 (2026-07-30): Ops delivery report shows average delivery time has deteriorated to 5 days.',
        lastCheckedDate: '2026-07-30'
      }
    ],
    options: [
      {
        name: 'Vendor B',
        accepted: true,
        details: '$10.00/unit, 2-day delivery SLA, 8,000 units/month capacity'
      },
      {
        name: 'Vendor A',
        accepted: false,
        details: '$12.50/unit, 4-day delivery turnaround',
        rejectionReason: '20% more expensive than Vendor B with 2 days longer delivery SLA in 2024.'
      },
      {
        name: 'Vendor C',
        accepted: false,
        details: 'Evaluated in 2023 trial',
        rejectionReason: 'Rejected, see D1 (7% of shipments had damaged goods).'
      }
    ],
    sourceDocIds: ['D1', 'D2', 'D3', 'D4', 'D5']
  },
  {
    id: 'dec-ops-sync',
    title: 'Weekly ops sync on Mondays',
    date: '2025-01-10',
    lead: 'Daniel Cruz, Ops Director',
    summary: 'Established an executive synchronization cadence every Monday morning at 09:30 AM to coordinate fleet dispatch before shift rotations.',
    status: 'Valid',
    reasons: [
      {
        text: 'Eliminates weekend dispatch backlog before shift rotations begin',
        sourceDocId: 'D6',
        sourceSnippet: 'Sets dispatch quotas, reviews maintenance windows, and validates carrier availability before shift handovers.'
      },
      {
        text: 'Aligns Warehouse Leads, Dispatch, Procurement and Escalations into a single weekly window',
        sourceDocId: 'D6',
        sourceSnippet: 'All cross-functional ops syncs are scheduled every Monday morning at 09:30 AM EST.'
      }
    ],
    assumptions: [
      {
        id: 'a3',
        decisionId: 'dec-ops-sync',
        text: 'Monday 9:30 AM avoids shift changeover conflicts and enables full dispatch sync',
        status: 'Valid',
        sourceDocId: 'D6',
        originalReason: 'Morning schedule allows same-day implementation of routing adjustments.',
        latestEvidence: 'No schedule conflicts logged. 94% department attendance verified across trailing quarters.',
        lastCheckedDate: '2026-08-15'
      }
    ],
    options: [
      {
        name: 'Monday 09:30 AM Cadence',
        accepted: true,
        details: 'Weekly cross-department alignment meeting'
      },
      {
        name: 'Daily Standups',
        accepted: false,
        details: '15-minute daily meetings',
        rejectionReason: 'Caused shift interruption during morning warehouse loading spikes.'
      },
      {
        name: 'Friday Retrospectives',
        accepted: false,
        details: 'End-of-week review',
        rejectionReason: 'Too late to fix weekend transit blockages.'
      }
    ],
    sourceDocIds: ['D6']
  },
  {
    id: 'dec-shared-drive',
    title: 'Use shared drive for contracts',
    date: '2024-11-05',
    lead: 'Priya Nair, Finance & Legal Lead',
    summary: 'Standardized centralized encrypted storage on Corporate Shared Drive (/Legal/Executed_Agreements) to satisfy SOC2 Type II compliance audit criteria.',
    status: 'Valid',
    reasons: [
      {
        text: 'Fulfills SOC2 Type II mandatory compliance for immutable access logging',
        sourceDocId: 'D7',
        sourceSnippet: 'All executed vendor agreements and addenda must be deposited in encrypted Corporate Shared Drive to satisfy SOC2 audit.'
      },
      {
        text: 'Eliminates unmonitored local document storage and lost contract amendments',
        sourceDocId: 'D7',
        sourceSnippet: 'Local storage or unmonitored email attachments of contracts are strictly prohibited.'
      }
    ],
    assumptions: [
      {
        id: 'a4',
        decisionId: 'dec-shared-drive',
        text: 'SOC2 compliance requires centralized immutable access logging on Google Drive',
        status: 'Valid',
        sourceDocId: 'D7',
        originalReason: 'External SOC2 auditors mandate encrypted repository with access history.',
        latestEvidence: 'SOC2 Type II interim surveillance audit passed with zero vendor documentation findings in July 2026.',
        lastCheckedDate: '2026-07-15'
      }
    ],
    options: [
      {
        name: 'Encrypted Corporate Shared Drive',
        accepted: true,
        details: '/Legal/Executed_Agreements with audit logging enabled'
      },
      {
        name: 'Local Department Servers',
        accepted: false,
        details: 'Department-managed network shares',
        rejectionReason: 'Lacked granular access logging required by SOC2 Type II.'
      }
    ],
    sourceDocIds: ['D7']
  }
];
