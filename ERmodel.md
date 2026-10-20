# BuildSupply Hub ER Model

RFQ and Organization settings model from Page-2 of `BuildSupply Hub Sitemap.drawio`.

This view shows the main relationships. Actor foreign keys remain listed even where their connectors are omitted.

```mermaid
erDiagram
    direction LR
    %% Simplified view: actor FK fields remain; only primary AppUser relationships are drawn.
    Organization ||..o{ Project : owns
    Project ||..o{ Jobsite : contains
    Jobsite ||..o{ RFQ : receives_requests
    AppUser ||..o{ RFQ : creates
    RFQ ||..o{ RFQItem : contains
    Unit o|..o{ RFQItem : measures
    RFQ ||..o{ RFQEvent : records
    AppUser o|..o{ RFQEvent : performs
    RFQ o|..o{ RFQ : replaces
    RFQ ||..o{ Invitation : invites_through
    Supplier ||..o{ Invitation : receives
    Invitation ||..o{ InvitationToken : issues
    Invitation ||..o| Quote : receives
    Quote ||..o{ QuoteVersion : versions
    QuoteVersion ||..o{ QuoteLine : prices
    RFQItem ||..o{ QuoteLine : quoted_for
    Unit ||..o{ QuoteLine : measures
    QuoteVersion ||..o{ QuoteCharge : adds
    RFQ ||..o| RFQSelection : selects
    QuoteVersion ||..o| RFQSelection : chosen_version

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
    }
    InvitationToken {
        int token_id PK
        int invitation_id FK
        string token_hash UK
        datetime issued_at
        datetime expires_at
        datetime revoked_at "optional"
    }
    Quote {
        int quote_id PK
        int invitation_id FK, UK
        datetime created_at
    }
    QuoteVersion {
        int quote_version_id PK
        int quote_id FK
        int version_no
        int recorded_by_user_id FK
        int confirmed_by_user_id FK "optional until confirmed"
        string source_kind
        string source_ref "FULL: external quote evidence"
        string currency_code
        string terms_text
        string tax_basis_text
        datetime valid_until
        datetime promised_delivery_start
        datetime promised_delivery_end
        datetime submitted_at
        datetime confirmed_at
        datetime withdrawn_at "optional"
    }
    QuoteLine {
        int quote_line_id PK
        int quote_version_id FK
        int rfq_item_id FK
        string offered_specification
        decimal quoted_quantity
        int unit_id FK
        decimal unit_price
        decimal discount_amount
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

    %% Organization settings: membership, explicit roles and scoped access.
    Organization ||..o{ Membership : has_members
    AppUser ||..o{ Membership : joins
    Organization ||..o{ MemberInvitation : invites
    Membership ||..o{ MembershipEvent : records
    Membership ||..o{ OrganizationRoleAssignment : receives
    Role ||..o{ OrganizationRoleAssignment : assigned_as
    Role ||--o{ RolePermission : grants
    Permission ||--o{ RolePermission : included_in
    Membership ||..o{ ProjectRoleAssignment : receives
    Project ||..o{ ProjectRoleAssignment : scopes
    Role ||..o{ ProjectRoleAssignment : assigned_as
    Membership ||..o{ JobsiteRoleAssignment : receives
    Jobsite ||..o{ JobsiteRoleAssignment : scopes
    Role ||..o{ JobsiteRoleAssignment : assigned_as

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
    Permission {
        int permission_id PK
        string permission_code UK
    }
    RolePermission {
        int role_id PK, FK
        int permission_id PK, FK
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
        datetime valid_from
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
        datetime valid_from
        datetime valid_until "optional"
        int revoked_by_user_id FK "optional"
        datetime revoked_at "optional"
    }

    %% UNIQUE Membership(organization_id,user_id).
    %% Each scoped assignment must belong to its membership organization.
    %% Organization admin does not automatically authorize purchases or PO approval.
    %% Project grants cover child jobsites; jobsite grants cover only that site.
    %% Evaluate active membership, effective unrevoked grants and permission on every action.
    %% Preserve grant history; prevent overlapping duplicate member/role/scope grants.
    %% Protect the last active organization admin; rejoining does not restore revoked grants.
    %% Prepared Project/Jobsite data support MVP US01; self-service creation remains outside P0.
```
