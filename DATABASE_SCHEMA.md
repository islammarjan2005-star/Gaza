# Database Schema Documentation

## Overview

PostgreSQL database schema for Ecosia-for-Gaza application. Designed for:
- High-performance search analytics
- Accurate revenue tracking
- Transparent charity disbursement records
- Privacy-compliant data storage

## Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  search_sessions│───────│  ad_impressions │───────│   ad_clicks     │
└─────────────────┘       └─────────────────┘       └─────────────────┘
         │                         │                        │
         │                         │                        │
         ▼                         ▼                        ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  daily_metrics  │       │  revenue_records│       │ charity_partners│
└─────────────────┘       └─────────────────┘       └─────────────────┘
                                   │                        │
                                   │                        │
                                   ▼                        ▼
                          ┌─────────────────┐       ┌─────────────────┐
                          │  disbursements  │───────│donation_receipts│
                          └─────────────────┘       └─────────────────┘
```

## Tables

### 1. search_sessions
Tracks anonymized search sessions (no user identification).

```sql
CREATE TABLE search_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token VARCHAR(64) NOT NULL,
    query_hash VARCHAR(64) NOT NULL,  -- SHA-256 hash of query (privacy)
    query_category VARCHAR(100),
    result_count INTEGER NOT NULL DEFAULT 0,
    ad_count INTEGER NOT NULL DEFAULT 0,
    response_time_ms INTEGER,
    device_type VARCHAR(20),  -- 'ios', 'android'
    country_code CHAR(2),
    safe_search_level VARCHAR(20) DEFAULT 'moderate',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Indexes for analytics
    INDEX idx_sessions_created_at (created_at),
    INDEX idx_sessions_country (country_code),
    INDEX idx_sessions_device (device_type)
);

-- Partition by month for performance
CREATE TABLE search_sessions_y2024m01 PARTITION OF search_sessions
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### 2. ad_impressions
Records when ads are displayed to users.

```sql
CREATE TABLE ad_impressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES search_sessions(id),
    ad_id VARCHAR(100) NOT NULL,
    ad_position INTEGER NOT NULL,
    ad_type VARCHAR(50) NOT NULL,  -- 'sponsored_link', 'sidebar', 'mainline'
    advertiser_domain VARCHAR(255),
    estimated_cpm DECIMAL(10, 6),
    is_brand_safe BOOLEAN DEFAULT true,
    content_category VARCHAR(100),
    impression_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    INDEX idx_impressions_session (session_id),
    INDEX idx_impressions_timestamp (impression_timestamp),
    INDEX idx_impressions_advertiser (advertiser_domain)
);
```

### 3. ad_clicks
Records ad click events for revenue tracking.

```sql
CREATE TABLE ad_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    impression_id UUID NOT NULL REFERENCES ad_impressions(id),
    session_id UUID NOT NULL REFERENCES search_sessions(id),
    click_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    click_position INTEGER,
    estimated_cpc DECIMAL(10, 6),
    actual_revenue DECIMAL(10, 6),  -- Updated from Microsoft reports
    revenue_confirmed BOOLEAN DEFAULT false,
    confirmation_date TIMESTAMP WITH TIME ZONE,

    INDEX idx_clicks_impression (impression_id),
    INDEX idx_clicks_session (session_id),
    INDEX idx_clicks_timestamp (click_timestamp),
    INDEX idx_clicks_confirmed (revenue_confirmed)
);
```

### 4. daily_metrics
Aggregated daily metrics for dashboard display.

```sql
CREATE TABLE daily_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_date DATE NOT NULL UNIQUE,
    total_searches BIGINT NOT NULL DEFAULT 0,
    total_impressions BIGINT NOT NULL DEFAULT 0,
    total_clicks BIGINT NOT NULL DEFAULT 0,
    estimated_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0,
    confirmed_revenue DECIMAL(12, 2) DEFAULT 0,
    unique_devices BIGINT DEFAULT 0,
    avg_response_time_ms INTEGER,
    top_categories JSONB,
    country_breakdown JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    INDEX idx_metrics_date (metric_date DESC)
);
```

### 5. revenue_records
Detailed revenue records from Microsoft Ads Reporting API.

```sql
CREATE TABLE revenue_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date DATE NOT NULL,
    report_type VARCHAR(50) NOT NULL,  -- 'daily', 'weekly', 'monthly'
    microsoft_report_id VARCHAR(100),
    gross_revenue DECIMAL(12, 4) NOT NULL,
    microsoft_share DECIMAL(12, 4) NOT NULL,
    our_share DECIMAL(12, 4) NOT NULL,  -- This goes to charity
    click_count INTEGER NOT NULL,
    impression_count INTEGER NOT NULL,
    average_cpc DECIMAL(10, 6),
    average_cpm DECIMAL(10, 6),
    currency VARCHAR(3) DEFAULT 'USD',
    raw_report_data JSONB,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by VARCHAR(100),

    UNIQUE(report_date, report_type),
    INDEX idx_revenue_date (report_date DESC),
    INDEX idx_revenue_verified (verified)
);
```

### 6. charity_partners
Vetted charity organizations eligible for donations.

```sql
CREATE TABLE charity_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255) NOT NULL,
    registration_number VARCHAR(100),
    country VARCHAR(100) NOT NULL,
    description TEXT,
    website_url VARCHAR(500),
    logo_url VARCHAR(500),

    -- Vetting information
    vetting_status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'approved', 'suspended', 'rejected'
    vetting_date DATE,
    vetting_notes TEXT,
    watchlist_check_date DATE,
    watchlist_clear BOOLEAN DEFAULT false,

    -- Banking details (encrypted at rest)
    bank_name VARCHAR(255),
    bank_account_encrypted BYTEA,
    bank_routing_encrypted BYTEA,
    swift_code VARCHAR(20),

    -- Allocation
    allocation_percentage DECIMAL(5, 2) DEFAULT 0,  -- Sum of all active must = 100
    is_active BOOLEAN DEFAULT true,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    INDEX idx_charity_status (vetting_status),
    INDEX idx_charity_active (is_active),
    CONSTRAINT check_allocation CHECK (allocation_percentage >= 0 AND allocation_percentage <= 100)
);
```

### 7. disbursements
Monthly charity payment records.

```sql
CREATE TABLE disbursements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    charity_id UUID NOT NULL REFERENCES charity_partners(id),
    disbursement_period VARCHAR(7) NOT NULL,  -- 'YYYY-MM' format

    -- Amounts
    gross_revenue DECIMAL(12, 2) NOT NULL,
    allocation_percentage DECIMAL(5, 2) NOT NULL,
    calculated_amount DECIMAL(12, 2) NOT NULL,
    fees_deducted DECIMAL(10, 2) DEFAULT 0,  -- Wire transfer fees etc.
    net_amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',

    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'approved', 'processing', 'sent', 'confirmed', 'failed'
    approved_by VARCHAR(100),
    approved_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    confirmed_at TIMESTAMP WITH TIME ZONE,

    -- Transfer details
    transfer_reference VARCHAR(100),
    transfer_method VARCHAR(50),  -- 'wire', 'ach', 'paypal'

    -- Metadata
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(charity_id, disbursement_period),
    INDEX idx_disbursement_period (disbursement_period DESC),
    INDEX idx_disbursement_status (status),
    INDEX idx_disbursement_charity (charity_id)
);
```

### 8. donation_receipts
Uploaded receipts/confirmations from charities.

```sql
CREATE TABLE donation_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disbursement_id UUID NOT NULL REFERENCES disbursements(id),

    -- Receipt details
    receipt_number VARCHAR(100),
    receipt_date DATE,
    received_amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',

    -- File storage
    file_url VARCHAR(500) NOT NULL,
    file_hash VARCHAR(64) NOT NULL,  -- SHA-256 for integrity
    file_type VARCHAR(50),
    file_size_bytes INTEGER,

    -- Verification
    verified BOOLEAN DEFAULT false,
    verified_by VARCHAR(100),
    verified_at TIMESTAMP WITH TIME ZONE,
    verification_notes TEXT,

    -- Metadata
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    INDEX idx_receipt_disbursement (disbursement_id),
    INDEX idx_receipt_verified (verified)
);
```

### 9. blocked_advertisers
Advertisers blocked for brand safety or policy reasons.

```sql
CREATE TABLE blocked_advertisers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL UNIQUE,
    reason VARCHAR(100) NOT NULL,  -- 'political', 'adult', 'gambling', 'weapons', 'other'
    description TEXT,
    blocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    blocked_by VARCHAR(100),
    is_active BOOLEAN DEFAULT true,

    INDEX idx_blocked_domain (domain),
    INDEX idx_blocked_active (is_active)
);
```

### 10. content_categories_blocked
Categories to filter from search results and ads.

```sql
CREATE TABLE content_categories_blocked (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_code VARCHAR(50) NOT NULL UNIQUE,
    category_name VARCHAR(255) NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    INDEX idx_category_code (category_code)
);

-- Pre-populate blocked categories
INSERT INTO content_categories_blocked (category_code, category_name, reason) VALUES
    ('POL_ADV', 'Political Advertising', 'Avoid political content flags'),
    ('POL_ORG', 'Political Organizations', 'Maintain neutrality'),
    ('WEAPONS', 'Weapons & Ammunition', 'Brand safety'),
    ('GAMBLING', 'Gambling', 'Brand safety'),
    ('ADULT', 'Adult Content', 'Brand safety'),
    ('TOBACCO', 'Tobacco Products', 'Brand safety'),
    ('CRYPTO', 'Cryptocurrency', 'Risk management');
```

### 11. audit_logs
Comprehensive audit trail for compliance.

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    actor VARCHAR(100),  -- Admin user or 'system'
    action VARCHAR(50) NOT NULL,  -- 'create', 'update', 'delete', 'approve', etc.
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    INDEX idx_audit_event (event_type),
    INDEX idx_audit_entity (entity_type, entity_id),
    INDEX idx_audit_created (created_at DESC)
);
```

### 12. api_keys
API key management for partner access.

```sql
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 hash
    key_prefix VARCHAR(10) NOT NULL,  -- First 10 chars for identification
    name VARCHAR(255) NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]',
    rate_limit_per_minute INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    INDEX idx_apikey_hash (key_hash),
    INDEX idx_apikey_active (is_active)
);
```

## Views

### revenue_summary_view
```sql
CREATE VIEW revenue_summary_view AS
SELECT
    DATE_TRUNC('month', report_date) AS month,
    SUM(gross_revenue) AS total_gross,
    SUM(our_share) AS total_to_charity,
    SUM(click_count) AS total_clicks,
    SUM(impression_count) AS total_impressions,
    AVG(average_cpc) AS avg_cpc,
    COUNT(*) AS report_count
FROM revenue_records
WHERE verified = true
GROUP BY DATE_TRUNC('month', report_date)
ORDER BY month DESC;
```

### charity_totals_view
```sql
CREATE VIEW charity_totals_view AS
SELECT
    cp.id,
    cp.name,
    cp.logo_url,
    COUNT(d.id) AS disbursement_count,
    COALESCE(SUM(d.net_amount), 0) AS total_donated,
    MAX(d.confirmed_at) AS last_donation_date
FROM charity_partners cp
LEFT JOIN disbursements d ON d.charity_id = cp.id AND d.status = 'confirmed'
WHERE cp.is_active = true
GROUP BY cp.id, cp.name, cp.logo_url
ORDER BY total_donated DESC;
```

## Functions

### calculate_daily_metrics()
```sql
CREATE OR REPLACE FUNCTION calculate_daily_metrics(target_date DATE)
RETURNS void AS $$
BEGIN
    INSERT INTO daily_metrics (
        metric_date,
        total_searches,
        total_impressions,
        total_clicks,
        estimated_revenue,
        unique_devices,
        avg_response_time_ms
    )
    SELECT
        target_date,
        COUNT(DISTINCT ss.id),
        COUNT(ai.id),
        COUNT(ac.id),
        COALESCE(SUM(ac.estimated_cpc), 0),
        COUNT(DISTINCT ss.session_token),
        AVG(ss.response_time_ms)
    FROM search_sessions ss
    LEFT JOIN ad_impressions ai ON ai.session_id = ss.id
    LEFT JOIN ad_clicks ac ON ac.session_id = ss.id
    WHERE DATE(ss.created_at) = target_date
    ON CONFLICT (metric_date) DO UPDATE SET
        total_searches = EXCLUDED.total_searches,
        total_impressions = EXCLUDED.total_impressions,
        total_clicks = EXCLUDED.total_clicks,
        estimated_revenue = EXCLUDED.estimated_revenue,
        unique_devices = EXCLUDED.unique_devices,
        avg_response_time_ms = EXCLUDED.avg_response_time_ms,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
```

## Migrations

All migrations are stored in `/backend/src/migrations/` and run in order:

1. `001_initial_schema.sql` - Core tables
2. `002_add_indexes.sql` - Performance indexes
3. `003_add_partitioning.sql` - Table partitioning
4. `004_seed_blocked_categories.sql` - Initial blocked content
5. `005_add_views.sql` - Reporting views
6. `006_add_functions.sql` - Stored procedures
