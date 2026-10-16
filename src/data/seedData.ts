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
  },
  {
    id: 'D8',
    title: 'Employee Handbook §4.2: Purchase Approvals',
    date: '2025-06-01',
    author: 'Lena Ortiz, HR Director',
    type: 'policy',
    content: `Brightwell Logistics Employee Handbook (2025 edition)
Section 4.2: Purchase Approvals
Issued by: Human Resources, June 1, 2025

Purchase requests up to $50,000 are approved within 3 business days of submission.
Managers may plan supplier orders and replacement carriers on this 3-day approval window.
Requests above $50,000 follow the executive approval process.`,
    snippet: 'Purchase requests up to $50,000 are approved within 3 business days of submission.'
  },
  {
    id: 'D9',
    title: 'Finance Procurement Policy FIN-PROC-07',
    date: '2025-09-15',
    author: 'Priya Nair, Finance & Legal Lead',
    type: 'policy',
    content: `Policy FIN-PROC-07: Purchase Request Review
Date: September 15, 2025
Issued by: Finance & Legal Compliance

All purchase requests, regardless of amount, require Finance review before approval.
The approval window is 5 business days from submission, including the Finance review.
Teams must not commit spend to a supplier before the 5-day review is complete.`,
    snippet: 'All purchase requests require Finance review; the approval window is 5 business days.'
  },
  {
    id: 'D10',
    title: 'Escalation: Replacement Carrier Orders Delayed',
    date: '2026-08-12',
    author: 'Daniel Cruz, Ops Director',
    type: 'email',
    content: `From: Daniel Cruz <d.cruz@brightwell.com>
To: Priya Nair <p.nair@brightwell.com>, Lena Ortiz <l.ortiz@brightwell.com>
Date: August 12, 2026, 08:05 EST
Subject: Escalation: replacement carrier orders stuck in approval

Priya, Lena,
Two urgent replacement-carrier orders for the Northern hub sat in approval for 5 business days.
Ops planned on the 3-day approval window in the Employee Handbook, but Finance applied the 5-day window in FIN-PROC-07.
Buffer stock at the Northern hub ran out on August 10 while Vendor B shipments were already running late.
We need one approval rule that everyone follows.`,
    snippet: 'Two urgent replacement-carrier orders sat in approval for 5 business days; Ops planned on 3 days. Buffer stock ran out.'
  },
  {
    id: 'D11',
    title: 'Exit Interview: Maria Tan, Procurement Lead',
    date: '2026-09-20',
    author: 'Lena Ortiz, HR Director (interviewer)',
    type: 'interview',
    content: `Exit Interview Transcript
Employee: Maria Tan, Procurement Lead (2019-2026)
Interviewer: Lena Ortiz, HR Director
Date: September 20, 2026

Q: How did you handle supplier delays?
A: My rule was to act once a carrier was late for two weeks in a row. I asked the carrier for a written recovery plan within 48 hours, and I tracked it every week at the Monday ops sync.

Q: What did you do with urgent orders during a delay?
A: I split them. Urgent Tier-1 orders went to our backup carrier, which was Vendor A, even at a higher rate, and bulk orders stayed with the main carrier. That kept customers whole while we fixed the main contract.

Q: How did you evaluate new carriers?
A: Never sign without a paid trial first. A 90-day trial is how we caught Vendor C's 7% damage rate in 2023.

Q: What should your successor do about Vendor B?
A: Re-bid the contract. Vendor B won in 2024 on price and speed, so check both against today's numbers. If they no longer hold, the original reason for choosing Vendor B is gone.

Q: Anything you didn't get to?
A: The approval rules. HR says 3 days and Finance says 5, and that gap has delayed urgent orders. Someone needs to merge them into one rule.`,
    snippet: 'Act after two weeks of delays: ask for a written recovery plan within 48 hours, split urgent orders to the backup carrier, re-bid Vendor B.'
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

// Example for "Capture a decision": a decision email Mnemo has not seen yet
export const CAPTURE_EXAMPLE_TEXT = `From: Daniel Cruz <d.cruz@brightwell.com>
To: Ops Leads <ops-leads@brightwell.com>
Date: May 6, 2025
Subject: Decision: weekend dispatch moves to Hub North

Team,
After comparing both sites, we are moving all weekend dispatch to Hub North from 1 June.
Hub North has 24/7 security staff on site, so we no longer need to pay weekend guards at Hub South.
Its lease is $3,000 per month cheaper than Hub South ($9,000 vs $12,000).
We considered keeping weekends at Hub South, but the overtime security cost made it the more expensive option.

Daniel Cruz, Ops Director`;

// Second sample upload: contradicts both assumptions of the captured Hub North decision
export const SAMPLE_LEASE_NOTICE = {
  fileName: 'Hub_North_Lease_Renewal_Notice.txt',
  textRepresentation: `Hub North Lease Renewal Notice
From: Northgate Property Management
To: Brightwell Logistics, Operations
Date: October 1, 2026

Your lease for Hub North renews on 1 November 2026.
From 1 November 2026, Hub North rent is $13,500 per month.
The on-site 24/7 security contract ends on 31 October 2026. Weekend security will then be billed separately at $1,800 per month.

For comparison, your broker reports: Hub South has quoted $12,200 per month for the same term, including weekend security.`
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
        originalReason: 'Monday 09:30 AM sync sets dispatch quotas and validates carrier availability before shift handovers (D6).',
        latestEvidence: 'No contradicting evidence in company records since D6 (2025-01-10).',
        lastCheckedDate: '2026-09-28'
      }
    ],
    options: [
      {
        name: 'Monday 09:30 AM Cadence',
        accepted: true,
        details: 'Weekly cross-department alignment meeting'
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
        text: 'SOC2 audits require contracts in one encrypted, access-logged drive',
        status: 'Valid',
        sourceDocId: 'D7',
        originalReason: 'SOC2 Type II requires executed agreements in the encrypted Corporate Shared Drive; access logs audited monthly (D7).',
        latestEvidence: 'No contradicting evidence in company records since D7 (2024-11-05).',
        lastCheckedDate: '2026-09-28'
      }
    ],
    options: [
      {
        name: 'Encrypted Corporate Shared Drive',
        accepted: true,
        details: '/Legal/Executed_Agreements with monthly access-log audits'
      },
      {
        name: 'Local storage or email attachments',
        accepted: false,
        details: 'Contracts kept on local machines or in email',
        rejectionReason: 'Strictly prohibited by policy D7 (SOC2 Type II).'
      }
    ],
    sourceDocIds: ['D7']
  }
];
