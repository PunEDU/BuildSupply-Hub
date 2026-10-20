# BuildSupply Hub ER Model

This ER model covers the main data used by the Contractor menu: RFQs and quotes, purchase orders, deliveries and inspections, payments and returns, supplier history, and organization settings. The Supplier menu is being developed. RFQ invitations and Invited RFQ detail use `SupplierMembership` for supplier representation; Quote editor uses draft and submitted `QuoteVersion` records with `created_at`, immutable submitted contents, and explicit supplier confirmation.

```mermaid
erDiagram
    direction LR
    %% Simplified view: actor FK fields remain; only primary AppUser relationships are drawn.
    Organization ||--o{ Project : owns
    Project ||--o{ Jobsite : contains
    Jobsite ||--o{ RFQ : receives_requests
    AppUser ||--o{ RFQ : creates
    RFQ ||--o{ RFQItem : contains
    Unit o|--o{ RFQItem : measures
    RFQ ||--o{ RFQEvent : records
    AppUser o|--o{ RFQEvent : performs
    RFQ o|--o{ RFQ : replaces
    RFQ ||--o{ Invitation : invites_through
    Supplier ||--o{ Invitation : receives
    Invitation ||--o{ InvitationToken : issues
    Invitation ||--o{ QuoteVersion : receives_versions
    QuoteVersion ||--o{ QuoteLine : prices
    RFQItem ||--o{ QuoteLine : quoted_for
    Unit ||--o{ QuoteLine : measures
    QuoteVersion ||--o{ QuoteCharge : adds
    RFQ ||--o| RFQSelection : selects
    QuoteVersion ||--o| RFQSelection : chosen_version

    Organization {
        int organization_id PK
        string organization_name
    }
    AppUser {
        int user_id PK
        string display_name
        string email UK
        datetime email_verified_at
    }
    Jobsite {
        int jobsite_id PK
        int project_id FK
        string site_name
        string current_address
        string status
    }
    Unit {
        int unit_id PK
        string unit_code UK
    }
    RFQ {
        int rfq_id PK
        string rfq_number UK
        int jobsite_id FK
        int created_by_user_id FK
        int replaces_rfq_id FK "optional; prior RFQ"
        string delivery_address_text
        datetime requested_delivery_start "nullable in draft"
        datetime requested_delivery_end "nullable in draft"
        string status
        int lock_version
        datetime created_at
    }
    RFQItem {
        int rfq_item_id PK
        int rfq_id FK
        int line_no
        string material_name
        string specification_text
        decimal requested_quantity "nullable in draft"
        int unit_id FK "nullable in draft"
    }
    RFQEvent {
        int event_id PK
        int rfq_id FK
        int actor_user_id FK "nullable for system event"
        string event_type
        string reason_text
        datetime occurred_at
    }
    Supplier {
        int supplier_id PK
        string supplier_name
    }
    Invitation {
        int invitation_id PK
        int rfq_id FK
        int supplier_id FK
        int sent_by_user_id FK
        datetime first_sent_at
        datetime declined_at "optional"
        datetime quote_started_at "optional; first quote version created"
    }
    InvitationToken {
        int token_id PK
        int invitation_id FK
        string token_hash UK
        datetime issued_at
        datetime expires_at
        datetime revoked_at "optional"
    }
    QuoteVersion {
        int quote_version_id PK
        int invitation_id FK
        int version_no
        datetime created_at
        int recorded_by_user_id FK
        int confirmed_by_user_id FK "optional until confirmed"
        string source_kind
        string source_ref "FULL: external quote evidence"
        string currency_code "nullable in draft"
        string terms_text "nullable in draft"
        string tax_basis_text "unknown or draft; flag if missing"
        datetime valid_until "unknown or draft; flag if missing"
        datetime promised_delivery_start "nullable in draft"
        datetime promised_delivery_end "nullable in draft"
        datetime submitted_at "nullable in draft"
        datetime confirmed_at "optional until supplier confirmation"
        datetime withdrawn_at "optional"
    }
    QuoteLine {
        int quote_line_id PK
        int quote_version_id FK
        int rfq_item_id FK
        string offered_specification "nullable in draft"
        decimal quoted_quantity "nullable in draft"
        int unit_id FK "nullable in draft"
        decimal unit_price "nullable in draft"
        decimal discount_amount "nullable in draft"
    }
    QuoteCharge {
        int charge_id PK
        int quote_version_id FK
        string charge_type
        string charge_label
        string treatment
        decimal amount "nullable when unknown"
    }
    RFQSelection {
        int rfq_id PK, FK
        int quote_version_id FK, UK
        int selected_by_user_id FK
        string selection_reason
        datetime selected_at
    }

    %% Quote family identity is the Invitation; zero versions means no quote has been started.
    %% UNIQUE QuoteVersion(invitation_id,version_no).
    %% quote_started_at is set with the first saved version and retains the former Quote.created_at meaning.
    %% Preserve quote_started_at as a lifecycle timestamp; it is not recomputed from submitted_at.
    %% Resends use the existing invitation and token lifecycle, not another quote family.

    %% Organization settings: membership, explicit roles and scoped access.
    Organization ||--o{ Membership : has_members
    AppUser ||--o{ Membership : joins
    Organization ||--o{ MemberInvitation : invites
    Membership ||--o{ MembershipEvent : records
    Membership ||--o{ OrganizationRoleAssignment : receives
    Role ||--o{ OrganizationRoleAssignment : assigned_as
    Membership ||--o{ ProjectRoleAssignment : receives
    Project ||--o{ ProjectRoleAssignment : scopes
    Role ||--o{ ProjectRoleAssignment : assigned_as
    Membership ||--o{ JobsiteRoleAssignment : receives
    Jobsite ||--o{ JobsiteRoleAssignment : scopes
    Role ||--o{ JobsiteRoleAssignment : assigned_as

    Membership {
        int membership_id PK
        int organization_id FK
        int user_id FK
        string status
        datetime joined_at
    }
    MemberInvitation {
        int member_invitation_id PK
        int organization_id FK
        string invited_email
        string token_hash UK
        int invited_by_user_id FK
        datetime created_at
        datetime expires_at
        int accepted_by_user_id FK "optional"
        datetime accepted_at "optional"
        datetime revoked_at "optional"
    }
    MembershipEvent {
        int membership_event_id PK
        int membership_id FK
        int actor_user_id FK "optional for system"
        string event_type
        string reason_text
        datetime occurred_at
    }
    Role {
        int role_id PK
        string role_code UK
        string role_scope
    }
    OrganizationRoleAssignment {
        int org_role_assignment_id PK
        int membership_id FK
        int role_id FK
        int granted_by_user_id FK
        datetime granted_at
        int revoked_by_user_id FK "optional"
        datetime revoked_at "optional"
    }
    Project {
        int project_id PK
        int organization_id FK
        string project_name
        string status
    }
    ProjectRoleAssignment {
        int project_role_assignment_id PK
        int membership_id FK
        int project_id FK
        int role_id FK
        int granted_by_user_id FK
        datetime granted_at
        datetime valid_until "optional"
        int revoked_by_user_id FK "optional"
        datetime revoked_at "optional"
    }
    JobsiteRoleAssignment {
        int jobsite_role_assignment_id PK
        int membership_id FK
        int jobsite_id FK
        int role_id FK
        int granted_by_user_id FK
        datetime granted_at
        datetime valid_until "optional"
        int revoked_by_user_id FK "optional"
        datetime revoked_at "optional"
    }

    %% UNIQUE Membership(organization_id,user_id).
    %% Each scoped assignment must belong to its membership organization.
    %% Organization admin does not automatically authorize purchases or PO approval.
    %% Project grants cover child jobsites; jobsite grants cover only that site.
    %% Roles use a fixed action matrix in application policy; no custom-role or permission-matrix editor.
    %% Evaluate active membership, fixed role actions, scope and unexpired unrevoked grants on every action.
    %% Project/jobsite grants start at granted_at; valid_until retains access expiry required by TC19.
    %% Preserve grant history; prevent overlapping duplicate member/role/scope grants.
    %% Protect the last active organization admin; rejoining does not restore revoked grants.
    %% Prepared Project/Jobsite data support MVP US01; self-service creation remains outside P0.

    %% Payments and returns: proposed full detail for US17-US18, with shared fee support.
    %% Actor FKs are retained as attributes; their extra AppUser lines are intentionally omitted.
    Jobsite ||--o{ PurchaseOrder : scopes
    Supplier ||--o{ PurchaseOrder : supplies
    PurchaseOrder ||--o{ POLine : contains
    POLine ||--o{ GoodsPortion : apportioned_as
    ProviderPaymentAttempt ||--o{ PaymentAttemptAllocation : intends
    GoodsPortion ||--o{ PaymentAttemptAllocation : requested_for
    ProviderPaymentAttempt ||--o{ ProviderTransaction : confirmed_transactions
    ProviderTransaction ||--o{ PaymentAllocation : allocates
    GoodsPortion ||--o{ PaymentAllocation : paid_for
    PurchaseOrder ||--o{ GoodsReturn : returned_under
    GoodsReturn ||--o{ GoodsReturnLine : contains
    PaymentAllocation ||--o{ GoodsReturnLine : returned_from
    ProviderTransaction ||--o{ Refund : refunded_by
    Refund ||--o{ RefundAllocation : allocates
    GoodsReturnLine ||--o{ RefundAllocation : refunded_for
    PaymentProviderAccount ||--o{ ProviderEvent : emits
    ProviderEvent ||--o{ ProviderTransaction : confirms
    ProviderEvent o|--o{ Refund : confirms_when_successful
    PaymentAllocation o|--o| CommissionEntry : charge_entry
    RefundAllocation o|--o| CommissionEntry : reversal_entry

    PurchaseOrder {
        int po_id PK
        string po_number UK
        int rfq_id FK, UK
        int jobsite_id FK
        int supplier_id FK
        int created_by_user_id FK
        datetime created_at
    }
    POLine {
        int po_line_id PK
        int po_id FK
        int line_no
        int rfq_item_id FK
        int origin_po_line_id FK "optional; unreceived remainder"
    }
    GoodsPortion {
        int goods_portion_id PK
        int po_line_id FK
    }
    ProviderPaymentAttempt {
        int payment_attempt_id PK
        int po_issue_id FK
        int initiated_by_user_id FK
        string request_key UK
        decimal requested_gross_amount
        string currency_code
        string status
        datetime created_at
        datetime last_checked_at "optional"
        string failure_reason "optional"
    }
    PaymentAttemptAllocation {
        int attempt_allocation_id PK
        int payment_attempt_id FK
        int goods_portion_id FK
        decimal quantity
        decimal net_goods_amount
        decimal tax_amount
        decimal freight_amount
        decimal other_charge_amount
    }
    ProviderTransaction {
        int transaction_id PK
        int payment_attempt_id FK
        string provider_transaction_key UK "provider/account scoped"
        decimal gross_amount
        string currency_code
        datetime confirmed_at
        int confirmation_event_id FK
        string reconciliation_status
    }
    PaymentAllocation {
        int payment_allocation_id PK
        int transaction_id FK
        int goods_portion_id FK
        decimal paid_quantity
        decimal net_goods_amount
        decimal tax_amount
        decimal freight_amount
        decimal other_charge_amount
    }
    GoodsReturn {
        int return_id PK
        int po_id FK
        int created_by_user_id FK
        string workflow_status
        datetime created_at
    }
    GoodsReturnLine {
        int return_line_id PK
        int return_id FK
        int payment_allocation_id FK
        int receipt_portion_id FK
        decimal quantity
        string reason_text
        string return_status
        datetime returned_at "optional until confirmed"
    }
    Refund {
        int refund_id PK
        int transaction_id FK
        int requested_by_user_id FK
        string request_key UK
        string provider_refund_key UK "optional; provider/account scoped"
        decimal requested_gross_amount
        decimal confirmed_gross_amount "optional until confirmed"
        string status
        datetime requested_at
        datetime confirmed_at "optional until confirmed"
        int confirmation_event_id FK "optional until confirmed"
    }
    RefundAllocation {
        int refund_allocation_id PK
        int refund_id FK
        int return_line_id FK
        decimal quantity
        decimal net_goods_amount
        decimal tax_amount
        decimal freight_amount
        decimal other_charge_amount
    }
    PaymentProviderAccount {
        int provider_account_id PK
        string provider_code
        string account_reference
        string status
    }
    ProviderEvent {
        int event_id PK
        int provider_account_id FK
        string provider_event_key UK "provider/account scoped"
        string event_type
        string provider_object_key
        datetime occurred_at
        datetime received_at
        string verification_status
        datetime processed_at "optional until applied"
        string payload_reference
    }
    CommissionEntry {
        int commission_entry_id PK
        int payment_allocation_id FK, UK "optional; CHARGE only"
        int refund_allocation_id FK, UK "optional; REVERSAL only"
        string entry_type
        decimal rate_used
        decimal posted_amount "signed ledger amount"
        datetime created_at
    }

    %% PO revision, approval and promise details are defined in the Purchase orders section below.
    %% UNIQUE PaymentAttemptAllocation(payment_attempt_id,goods_portion_id).
    %% UNIQUE PaymentAllocation(transaction_id,goods_portion_id).
    %% UNIQUE RefundAllocation(refund_id,return_line_id).
    %% UNIQUE PaymentProviderAccount(provider_code,account_reference).
    %% CommissionEntry: exactly one allocation FK; CHARGE uses payment, REVERSAL uses refund.
    %% ProviderTransaction records only verified successful charges; unmatched charges remain reconciliation exceptions.
    %% All allocations must agree on PO, goods portion, original payment, provider account and currency.
    %% Reserve eligible unpaid portions for live attempts; UNKNOWN/PENDING must be reconciled before retry.
    %% Requested/confirmed returns cannot exceed eligible remaining paid quantity.
    %% Pending and confirmed refunds reserve only the remaining refundable quantity and amount.
    %% Refund success requires verified provider evidence matching the original charge and account.
    %% Enforce aggregate caps with transaction locking, not FK checks alone.
    %% Dedupe both provider event keys and provider transaction/refund keys.
    %% Attempt statuses: CREATED/PENDING/SUCCEEDED/FAILED/UNKNOWN.
    %% Return workflow: DRAFT/SUBMITTED/CANCELLED; return lines: REQUESTED/CONFIRMED/CANCELLED.
    %% Refund statuses: REQUESTED/PENDING/SUCCEEDED/FAILED/CANCELLED.
    %% Only confirmed refunds create fee reversals; original charges and fee entries remain immutable.
    %% Fee base excludes tax, freight and other charges; rate and provider terms remain unset.
    %% Final full refund reverses the remaining original fee including rounding residue.
    %% Store money as exact DECIMAL; no card credentials; actor permissions use existing scoped assignments.
    %% This extension does not complete supplier payout/processing-charge models or full-product coverage.

%% Deliveries and inspections; replacement handling is excluded by the current scope decision.
    %% Actor FKs remain listed without adding more AppUser connectors.
    Delivery ||--|{ DeliveryRevision : preserves_versions
    DeliveryRevision o|--o| DeliveryRevision : superseded_by
    Delivery ||--|{ ReceiptPortion : contains
    GoodsPortion ||--o{ ReceiptPortion : received_as
    ReceiptPortion ||--|{ ReceiptPortionRevision : preserves_quantities
    ReceiptPortionRevision o|--o| ReceiptPortionRevision : superseded_by
    Delivery ||--o{ Inspection : inspected_in
    Inspection ||--|{ AcceptanceDecision : records
    ReceiptPortionRevision ||--o{ AcceptanceDecision : evaluated_by
    AcceptanceDecision o|--o| AcceptanceDecision : superseded_by
    DeliveryRevision o|--o{ EvidenceAttachment : arrival_evidence
    Inspection o|--o{ EvidenceAttachment : inspection_evidence
    ReceiptPortion ||--o{ GoodsReturnLine : physically_returned_from

    Delivery {
        int delivery_id PK
        int po_issue_id FK
        string request_key UK
        int created_by_user_id FK
        datetime created_at
    }
    DeliveryRevision {
        int delivery_revision_id PK
        int delivery_id FK
        int version_no
        datetime actual_arrived_at
        string delivery_note_ref "optional"
        int recorded_by_user_id FK
        datetime recorded_at
        int supersedes_revision_id FK, UK "optional; prior arrival version"
        string correction_reason "required after first version"
    }
    ReceiptPortion {
        int receipt_portion_id PK
        int delivery_id FK
        int goods_portion_id FK
        int line_no
    }
    ReceiptPortionRevision {
        int receipt_revision_id PK
        int receipt_portion_id FK
        int version_no
        decimal received_quantity
        int recorded_by_user_id FK
        datetime recorded_at
        int supersedes_revision_id FK, UK "optional; prior quantity version"
        string correction_reason "required after first version"
    }
    Inspection {
        int inspection_id PK
        int delivery_id FK
        int inspected_by_user_id FK
        datetime inspected_at
        datetime recorded_at
        string request_key UK
        string notes "optional"
    }
    AcceptanceDecision {
        int decision_id PK
        int inspection_id FK
        int receipt_revision_id FK
        decimal accepted_quantity
        decimal rejected_quantity
        string reason_text "required for rejection or correction"
        int supersedes_decision_id FK, UK "optional; prior full decision"
    }
    EvidenceAttachment {
        int attachment_id PK
        int delivery_revision_id FK "optional; arrival owner"
        int inspection_id FK "optional; inspection owner"
        string storage_key UK
        string original_filename
        string mime_type
        string sha256
        int uploaded_by_user_id FK
        datetime uploaded_at
    }

    %% GoodsPortion is a stable economic part of a PO line; it is no longer a reference-only entity.
    %% UNIQUE DeliveryRevision(delivery_id,version_no).
    %% UNIQUE ReceiptPortion(delivery_id,line_no).
    %% UNIQUE ReceiptPortionRevision(receipt_portion_id,version_no).
    %% UNIQUE AcceptanceDecision(inspection_id,receipt_revision_id).
    %% Nullable predecessor keys are unique when present; prevent cycles and branching.
    %% Delivery and quantity predecessors must have the same stable owner.
    %% A decision predecessor must concern the same stable ReceiptPortion, including across corrected versions.
    %% Each saved arrival has a first arrival version and at least one receipt line/version, created atomically.
    %% Each saved inspection has at least one complete decision; all lines must belong to its Delivery.
    %% Receipt and decision quantities are nonnegative; accepted+rejected cannot exceed the referenced received quantity.
    %% Decisions are full snapshots, not additive deltas; pending=received-accepted-rejected.
    %% No inspection means all received quantity is pending, never implicitly accepted.
    %% Resolve current arrival/quantity/decision versions through the validated unbranched history.
    %% Publishing a quantity correction and corresponding current decision must be atomic.
    %% Preserve established classifications when still valid; otherwise explicitly record changed classifications and reason.
    %% Never reduce support below paid/returned/reserved amounts by silently replacing a version.
    %% After payment, material physical changes use linked return/refund records, not rewritten original facts.
    %% GoodsReturnLine receipt_portion_id must share the GoodsPortion of its PaymentAllocation.
    %% Count a confirmed physical return once; do not also subtract it through a duplicate inspection reduction.
    %% Accepted retained quantity uses only effective decisions and confirmed physical returns.
    %% Effective GoodsPortionAuthorization quantities must fit the acknowledged PO revision line, including across multiple portions.
    %% Payability also checks net paid allocations, confirmed refunds, and live payment reservations under transactional locks.
    %% EvidenceAttachment must have exactly one owner FK; uploads do not certify material quality.
    %% Expected arrivals come from effective PO commitments; supplier declarations do not prove physical receipt.
    %% Historical physical arrivals, accepted/rejected/pending quantities, and remaining obligations are separate views.
    %% PurchaseOrder and POLine are detailed below; no replacement entity or workflow is added.

%% Purchase orders: revision-specific approval, issue, acknowledgement and immutable commitments.
    %% Additional actor FKs are shown as attributes, preserving only primary AppUser relationships.
    RFQ ||--o| PurchaseOrder : produces
    RFQItem ||--o{ POLine : originates
    POLine o|--o{ POLine : split_from
    PurchaseOrder ||--|{ PORevision : versions
    PORevision o|--o{ PORevision : based_on
    QuoteVersion ||--o{ PORevision : quoted_basis
    PORevision ||--|{ PORevisionLine : contains
    POLine ||--o{ PORevisionLine : appears_in
    QuoteLine ||--o{ PORevisionLine : sourced_from
    Unit ||--o{ PORevisionLine : measures
    PORevision ||--o{ PORevisionCharge : charges
    QuoteCharge o|--o{ PORevisionCharge : sourced_from
    PORevision ||--o| POApproval : reviewed_by
    PORevision ||--o| POIssue : issued_as
    PaymentProviderAccount ||--o{ ProviderOrderLimit : limit_versions
    ProviderOrderLimit ||--o{ POIssue : checked_against
    PORevisionLine ||--o{ GoodsPortionAuthorization : authorizes
    GoodsPortion ||--o{ GoodsPortionAuthorization : scoped_by
    PORevision ||--o{ ShipmentDeclaration : supplier_updates
    ShipmentDeclaration o|--o{ ShipmentDeclaration : corrects
    POIssue ||--o{ Delivery : received_under
    POIssue ||--o{ ProviderPaymentAttempt : paid_under

    PORevision {
        int po_revision_id PK
        int po_id FK
        int revision_no
        int based_on_revision_id FK "optional; same PO"
        int quote_version_id FK
        string buyer_name_snapshot
        string supplier_name_snapshot
        string delivery_address_text
        string currency_code
        string terms_text
        string tax_basis_text
        datetime promised_delivery_start
        datetime promised_delivery_end
        string change_reason "required after first revision"
        int created_by_user_id FK
        datetime created_at
        datetime frozen_at "optional until submission"
    }
    PORevisionLine {
        int po_revision_line_id PK
        int po_revision_id FK
        int po_line_id FK
        int source_quote_line_id FK
        string material_name
        string specification_text
        decimal quantity
        int unit_id FK
        decimal net_unit_price
        decimal discount_amount
    }
    PORevisionCharge {
        int po_revision_charge_id PK
        int po_revision_id FK
        int source_quote_charge_id FK "optional"
        string charge_type
        string charge_label
        decimal amount "nullable while incomplete"
    }
    POApproval {
        int po_approval_id PK
        int po_revision_id FK, UK
        int approver_user_id FK
        int requested_by_user_id FK
        datetime requested_at
        string decision
        datetime decided_at "optional while pending"
        string reason_text
    }
    POIssue {
        int po_issue_id PK
        int po_revision_id FK, UK
        int provider_limit_id FK
        int issued_by_user_id FK
        datetime issued_at
        int responded_by_user_id FK "optional until supplier response"
        string response_decision "optional; ACCEPTED or DECLINED"
        datetime responded_at "optional until supplier response"
        string response_reason "optional; supplier response reason"
    }
    ProviderOrderLimit {
        int provider_limit_id PK
        int provider_account_id FK
        string currency_code
        decimal gross_order_limit
        datetime valid_from
        datetime valid_until "optional"
        datetime confirmed_at
        string evidence_reference
        datetime revoked_at "optional"
    }
    GoodsPortionAuthorization {
        int portion_authorization_id PK
        int goods_portion_id FK
        int po_revision_line_id FK
        decimal authorized_quantity
    }
    ShipmentDeclaration {
        int declaration_id PK
        int po_revision_id FK
        int declared_by_user_id FK
        string declaration_type
        string statement_text
        datetime occurred_at
        datetime recorded_at
        datetime estimated_arrival_start "optional; supplier estimate"
        datetime estimated_arrival_end "optional; supplier estimate"
        int corrects_declaration_id FK "optional; prior statement"
        string request_key UK
    }

    %% PurchaseOrder and POLine now have defined roles; no reference-only marker remains on them.
    %% UNIQUE POLine(po_id,line_no); source RFQ items may repeat only for a validated remaining-scope split.
    %% UNIQUE PORevision(po_id,revision_no).
    %% UNIQUE PORevisionLine(po_revision_id,po_line_id).
    %% UNIQUE GoodsPortionAuthorization(goods_portion_id,po_revision_line_id).
    %% Each PO keeps one supplier and jobsite; require RFQSelection before preparation and enforce one PO per RFQ.
    %% Revision, line, quote version and quote line must agree on PO/RFQ, supplier, jobsite and source item.
    %% Based-on revisions and origin lines must belong to the same PO; prohibit cycles.
    %% Drafts may be incomplete; require at least one complete positive line before issue.
    %% Freeze revision content and cost components before approval; never alter frozen contents.
    %% Proposed MVP: one assigned approver and one final approval outcome per revision.
    %% Approval decisions: PENDING/APPROVED/REJECTED; final decisions remain immutable.
    %% Approval and issue require current scoped authority; organization-admin status grants neither automatically.
    %% Issue only an approved exact revision with complete compatible terms and validated costs.
    %% New purchase offers must be supplier-confirmed and current at issue; an old accepted PO is not erased by later quote expiry.
    %% Net goods=sum(quantity*net_unit_price-discount_amount); discount cannot exceed that line value.
    %% PO charge types: TAX/FREIGHT/OTHER. Normalize quoted included costs into verified components and count once.
    %% Never assume a universal tax rate or turn unknown charges into zero; money is exact DECIMAL.
    %% At issue, compare full gross total and currency with confirmed, effective, unrevoked provider limit evidence.
    %% Keep ProviderOrderLimit evidence versions used by prior issues; do not overwrite historical caps.
    %% Re-sending the same issue does not create another obligation or acknowledgement.
    %% POIssue response fields record a separate supplier fact: issued does not mean accepted.
    %% Before response all response fields are NULL; afterwards decision, actor and time are required, reason is optional.
    %% Response decisions: ACCEPTED/DECLINED; one final response per issue, immutable once recorded.
    %% Supplier responses may be recorded only after issue; retries cannot change the final response.
    %% Supplier actor must have active SupplierMembership for this PO supplier; action authority follows fixed supplier policy.
    %% One issued candidate may await a response per PO; serialize acceptance and effective-revision changes.
    %% A successor becomes effective only after exact approval, issue and supplier acceptance; a declined successor leaves its predecessor intact.
    %% Preserve the first acknowledged promise for history; a later promise never rewrites original lateness.
    %% Acknowledged revision authorization quantities must cover its line quantities without duplicate economic ownership.
    %% Never reduce authorization below protected receipts, net paid goods, confirmed returns or live reservations.
    %% Do not reprice or rewrite specifications/units of portions with receiving/payment evidence; split only the unreceived remainder.
    %% Material amendments repeat approval and acknowledgement; fuller amendment/cancellation UI remains outside P0.
    %% Deliveries preserve their source issue. Current payability also checks the effective agreed obligation and prior allocations.
    %% Payment attempts derive provider/account from the source issue limit; event/account/currency must match it.
    %% Shipment declaration types: PREPARING/DISPATCHED/DELAYED; scope to an acknowledged PO revision, without requiring Delivery.
    %% Supplier estimates do not amend contractual promises or establish physical arrival/inspection.
    %% Declaration corrections preserve prior statements and must stay within the same PO.
    %% Goods receipt, acceptance, payment, refund and payout remain separate facts; replacement handling remains excluded.

    %% Supplier history: private outcome facts. Summaries below are computed views, not stored entity tables.
    POOutcome {
        int po_outcome_id PK
        int po_id FK, UK
        datetime closed_at
        string closure_kind
        int confirmed_by_user_id FK
        datetime recorded_at
        string reason_text
        string request_key UK
    }
    PurchaseOrder ||--o| POOutcome : finalized_by

    %% POOutcome confirms a final delivery/inspection outcome, not settlement, waiver or authority to cancel.
    %% closure_kind: COMPLETED/CLOSED_SHORT/CANCELLED. Cancellation requires actual agreement evidence.
    %% One main final outcome per PO. Never overwrite agreed quantities, erase payments or infer supplier payout from closure.
    %% No separate reviewer, confirmation status or source fingerprint is required to enter history.
    %% Derive evidence completeness and eligibility from authoritative source facts; expose exclusion reasons.
    %% Source corrections retain their original versions/reasons and trigger recomputation, not manual reconfirmation.
    %% Full US16 dispute evidence and US23 historical restatement/audit remain unfinished full-scope requirements.
    %% Do not infer no dispute from the absence of a dispute model; unavailable evidence remains explicitly unknown.
    %% SupplierHistorySummary and SupplierOrderOutcome are computed views, not persistent summary entities.
    %% Derive supplier from PO and organization through PO->Jobsite->Project->Organization. Apply scoped permissions before aggregation.
    %% History sources: supplier-acknowledged PORevision/lines and GoodsPortionAuthorization, DeliveryRevision arrival,
    %% ReceiptPortionRevision quantities, effective AcceptanceDecision and confirmed GoodsReturnLine.
    %% Preserve the first supplier-accepted promise as original baseline; display later accepted promises separately.
    %% D17 history window: previous 12 months. Proposed cohort anchor is POOutcome.closed_at relative to report as-of date.
    %% Show actual date bounds and recency. One PO counts once; overlapping exclusion-reason counts are not an additive denominator.
    %% Eligibility uses supplier acknowledgement, known original deadline, final outcome,
    %% comparable line quantities/units and complete inspection evidence, plus explicit dispute/exclusion facts when modeled.
    %% Incomplete dispute coverage must be shown as a limitation, not silently treated as a clean result.
    %% CLOSED_SHORT with complete evidence remains a failure; no manual history-approval gate is required.
    %% Display open/overdue, cancelled/partly cancelled, disputed, incomplete and noncomparable orders separately from eligible metrics.
    %% Proposed on-time rule: inspection-accepted goods physically arrived in full for every original line by its original deadline.
    %% Use actual arrival times of accepted quantities, not inspection completion times; compare each line/unit without mixing units.
    %% Use effective versions and latest decision snapshots, never add multiple revisions of the same quantity or decision.
    %% Quantity/specification/unit changes without a validated comparable mapping are shown separately; revised deadlines do not erase lateness.
    %% Show returns and inspection outcomes separately; refund/payment/payout success neither establishes nor erases physical delivery history.
    %% Zero eligible orders: N/A. One to four: counts and Insufficient history, no percentage. Five or more: descriptive percentage.
    %% Always show numerator, denominator, recency and authorized PO drilldown. Never store manually edited history scores.
    %% US22 P0 private supplier history supports US08; MVP does not include full US23 historical restatement tooling.

    %% RFQ invitations: supplier representation and invitation-scoped access.
    Supplier ||--o{ SupplierMembership : has_representatives
    AppUser ||--o{ SupplierMembership : represents_through
    SupplierMembership {
        int supplier_membership_id PK
        int supplier_id FK
        int user_id FK
        datetime joined_at
        datetime revoked_at "optional"
    }

    %% Proposed MVP: one fixed Supplier representative action policy; no additional sales/finance roles or permission tables.
    %% SupplierMembership records one membership period. Active means joined_at<=now and revoked_at IS NULL.
    %% revoked_at must not precede joined_at. Prevent overlapping periods and duplicate active (supplier_id,user_id) pairs.
    %% Rejoining creates a new membership period; preserve old revocation dates and prior business actor references.
    %% Only an authorized supplier-access manager may establish or revoke representation; users cannot claim arbitrary supplier IDs.
    %% Membership establishes representation, not access to every RFQ or to contractor organization-private data.
    %% Supplier RFQ reads/actions require active membership matching Invitation.supplier_id and the owning Invitation/RFQ.
    %% Existing InvitationToken expiry/revocation governs invitation-link access; validate the exact presented token, never a different live token.
    %% Proposed menu access: a supplier-owned invitation is active while it has an unexpired unrevoked issued token.
    %% Whole-invitation revocation invalidates all live tokens; resends retain Invitation identity and preserve token history.
    %% Expired/revoked entries may expose only minimal authorized list metadata, never the RFQ basket or protected attachments/exports.
    %% Check membership and invitation scope on every read, action, direct link, attachment and export, including after revocation.
    %% Invited RFQ detail exposes only the invited need and this supplier's QuoteVersions; never competitor quotes or buyer-private history.
    %% Decline uses Invitation.declined_at; quote_started_at and own QuoteVersions support derived response/list progress.
    %% RFQ invitations and Invited RFQ detail are views over existing records, not new entity tables.
    %% Preserve quotes, POs and recorded actors after membership revocation; revocation removes access without deleting business history.

    %% Quote editor: US06 supplier drafts, immutable submitted versions and explicit confirmation.
    %% QuoteVersion.created_at records this version's first save; Invitation.quote_started_at remains the first family start.
    %% Draft means submitted_at IS NULL. Drafts may have zero lines or incomplete business fields and are private to their authorized supplier.
    %% An authorized buyer recording an external quote may access its own indicative record under existing buyer scope.
    %% Saving a draft updates that draft and its lines/charges; submitted contents, prices, terms and promises are immutable.
    %% A correction after submission creates the next version under the same Invitation, copying lines/charges with new row IDs.
    %% Allocate version_no atomically under UNIQUE(invitation_id,version_no); repeated save/submit of the same draft must not create another submission.
    %% QuoteLine.rfq_item_id must belong to the Invitation's RFQ; keep offered specifications separate from the buyer's requested RFQItem.
    %% Present the whole invited basket; missing or noncomparable items, quantities, units and specifications remain explicit exceptions.
    %% Supplier submission records submitted_at, confirmed_by_user_id and confirmed_at together for the exact submitted version.
    %% Recheck active SupplierMembership and invitation authority before each edit, submit or confirmation.
    %% Buyer-entered external quotes retain source_kind, source_ref and recorder; remain indicative until that supplier confirms the exact contents.
    %% Supplier confirmation does not repair missing fields or make an expired or mismatched offer suitable.
    %% Unknown price, discount, freight, tax basis or expiry remains NULL/explicitly unknown; never coerce unknown values to zero or free delivery.
    %% Explicit zero means a known zero charge or discount. Validate nonnegative monetary values, positive offered quantities and valid time windows.
    %% Enforce completeness for suitable comparison, selection and PO issue; incomplete visible submissions carry named exceptions.
    %% Quoted delivered cost derives from line quantities/prices/discounts and charge treatment; do not store an editable total or double-count included charges.
    %% Tax basis and quoted tax must be explicit; never assume one universal tax rate. Use exact DECIMAL monetary values.
    %% Draft, submitted, confirmed, expired and withdrawn labels derive from timestamps and current time; no redundant quote-status column is added.
    %% A newer submitted quote does not silently replace RFQSelection, PORevision snapshots or an already acknowledged obligation.
    %% Expiry/withdrawal affects future offer eligibility without rewriting an existing PO's preserved terms.
    %% After submission return to the owning Invited RFQ detail, showing only this supplier's authorized version history.
```
