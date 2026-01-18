-- Ecosia-for-Gaza Initial Database Schema
-- Version: 1.0.0
-- Date: 2024

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- SEARCH & TRACKING TABLES
-- ============================================================================

-- Search sessions table (anonymized)
CREATE TABLE search_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token VARCHAR(64) NOT NULL,
    query_hash VARCHAR(64) NOT NULL,
    query_category VARCHAR(100),
    result_count INTEGER NOT NULL DEFAULT 0,
    ad_count INTEGER NOT NULL DEFAULT 0,
    response_time_ms INTEGER,
    device_type VARCHAR(20) CHECK (device_type IN ('ios', 'android', 'web')),
    country_code CHAR(2),
    safe_search_level VARCHAR(20) DEFAULT 'moderate',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for search_sessions
CREATE INDEX idx_sessions_created_at ON search_sessions(created_at DESC);
CREATE INDEX idx_sessions_session_token ON search_sessions(session_token);
CREATE INDEX idx_sessions_country ON search_sessions(country_code);
CREATE INDEX idx_sessions_device ON search_sessions(device_type);

-- Ad impressions table
CREATE TABLE ad_impressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES search_sessions(id) ON DELETE CASCADE,
    ad_id VARCHAR(100) NOT NULL,
    ad_position INTEGER NOT NULL,
    ad_type VARCHAR(50) NOT NULL CHECK (ad_type IN ('sponsored_link', 'sidebar', 'mainline')),
    advertiser_domain VARCHAR(255),
    estimated_cpm DECIMAL(10, 6),
    is_brand_safe BOOLEAN DEFAULT true,
    content_category VARCHAR(100),
    impression_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for ad_impressions
CREATE INDEX idx_impressions_session ON ad_impressions(session_id);
CREATE INDEX idx_impressions_timestamp ON ad_impressions(impression_timestamp DESC);
CREATE INDEX idx_impressions_advertiser ON ad_impressions(advertiser_domain);

-- Ad clicks table
CREATE TABLE ad_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    impression_id UUID NOT NULL REFERENCES ad_impressions(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES search_sessions(id) ON DELETE CASCADE,
    click_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    click_position INTEGER,
    estimated_cpc DECIMAL(10, 6),
    actual_revenue DECIMAL(10, 6),
    revenue_confirmed BOOLEAN DEFAULT false,
    confirmation_date TIMESTAMP WITH TIME ZONE
);

-- Indexes for ad_clicks
CREATE INDEX idx_clicks_impression ON ad_clicks(impression_id);
CREATE INDEX idx_clicks_session ON ad_clicks(session_id);
CREATE INDEX idx_clicks_timestamp ON ad_clicks(click_timestamp DESC);
CREATE INDEX idx_clicks_confirmed ON ad_clicks(revenue_confirmed);

-- ============================================================================
-- METRICS & REVENUE TABLES
-- ============================================================================

-- Daily aggregated metrics
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_metrics_date ON daily_metrics(metric_date DESC);

-- Revenue records from Microsoft Ads
CREATE TABLE revenue_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date DATE NOT NULL,
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly')),
    microsoft_report_id VARCHAR(100),
    gross_revenue DECIMAL(12, 4) NOT NULL,
    microsoft_share DECIMAL(12, 4) NOT NULL,
    our_share DECIMAL(12, 4) NOT NULL,
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

    UNIQUE(report_date, report_type)
);

CREATE INDEX idx_revenue_date ON revenue_records(report_date DESC);
CREATE INDEX idx_revenue_verified ON revenue_records(verified);

-- ============================================================================
-- CHARITY & DISBURSEMENT TABLES
-- ============================================================================

-- Charity partners
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
    vetting_status VARCHAR(50) DEFAULT 'pending'
        CHECK (vetting_status IN ('pending', 'approved', 'suspended', 'rejected')),
    vetting_date DATE,
    vetting_notes TEXT,
    watchlist_check_date DATE,
    watchlist_clear BOOLEAN DEFAULT false,

    -- Banking details (encrypted)
    bank_name VARCHAR(255),
    bank_account_encrypted BYTEA,
    bank_routing_encrypted BYTEA,
    swift_code VARCHAR(20),

    -- Allocation
    allocation_percentage DECIMAL(5, 2) DEFAULT 0
        CHECK (allocation_percentage >= 0 AND allocation_percentage <= 100),
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_charity_status ON charity_partners(vetting_status);
CREATE INDEX idx_charity_active ON charity_partners(is_active);

-- Disbursements
CREATE TABLE disbursements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    charity_id UUID NOT NULL REFERENCES charity_partners(id),
    disbursement_period VARCHAR(7) NOT NULL,  -- 'YYYY-MM' format

    -- Amounts
    gross_revenue DECIMAL(12, 2) NOT NULL,
    allocation_percentage DECIMAL(5, 2) NOT NULL,
    calculated_amount DECIMAL(12, 2) NOT NULL,
    fees_deducted DECIMAL(10, 2) DEFAULT 0,
    net_amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',

    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'processing', 'sent', 'confirmed', 'failed')),
    approved_by VARCHAR(100),
    approved_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    confirmed_at TIMESTAMP WITH TIME ZONE,

    -- Transfer details
    transfer_reference VARCHAR(100),
    transfer_method VARCHAR(50) CHECK (transfer_method IN ('wire', 'ach', 'paypal')),

    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(charity_id, disbursement_period)
);

CREATE INDEX idx_disbursement_period ON disbursements(disbursement_period DESC);
CREATE INDEX idx_disbursement_status ON disbursements(status);
CREATE INDEX idx_disbursement_charity ON disbursements(charity_id);

-- Donation receipts
CREATE TABLE donation_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disbursement_id UUID NOT NULL REFERENCES disbursements(id),

    receipt_number VARCHAR(100),
    receipt_date DATE,
    received_amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',

    -- File storage
    file_url VARCHAR(500) NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    file_type VARCHAR(50),
    file_size_bytes INTEGER,

    -- Verification
    verified BOOLEAN DEFAULT false,
    verified_by VARCHAR(100),
    verified_at TIMESTAMP WITH TIME ZONE,
    verification_notes TEXT,

    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_receipt_disbursement ON donation_receipts(disbursement_id);
CREATE INDEX idx_receipt_verified ON donation_receipts(verified);

-- ============================================================================
-- CONTENT FILTERING TABLES
-- ============================================================================

-- Blocked advertisers
CREATE TABLE blocked_advertisers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL UNIQUE,
    reason VARCHAR(100) NOT NULL
        CHECK (reason IN ('political', 'adult', 'gambling', 'weapons', 'other')),
    description TEXT,
    blocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    blocked_by VARCHAR(100),
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_blocked_domain ON blocked_advertisers(domain);
CREATE INDEX idx_blocked_active ON blocked_advertisers(is_active);

-- Blocked content categories
CREATE TABLE content_categories_blocked (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_code VARCHAR(50) NOT NULL UNIQUE,
    category_name VARCHAR(255) NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_category_code ON content_categories_blocked(category_code);

-- ============================================================================
-- AUTHENTICATION & AUDIT TABLES
-- ============================================================================

-- API keys
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    key_prefix VARCHAR(10) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]',
    rate_limit_per_minute INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_apikey_hash ON api_keys(key_hash);
CREATE INDEX idx_apikey_active ON api_keys(is_active);

-- Audit logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    actor VARCHAR(100),
    action VARCHAR(50) NOT NULL
        CHECK (action IN ('create', 'update', 'delete', 'approve', 'reject', 'send', 'verify')),
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_event ON audit_logs(event_type);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert blocked content categories
INSERT INTO content_categories_blocked (category_code, category_name, reason) VALUES
    ('POL_ADV', 'Political Advertising', 'Avoid political content flags'),
    ('POL_ORG', 'Political Organizations', 'Maintain neutrality'),
    ('WEAPONS', 'Weapons & Ammunition', 'Brand safety'),
    ('GAMBLING', 'Gambling', 'Brand safety'),
    ('ADULT', 'Adult Content', 'Brand safety'),
    ('TOBACCO', 'Tobacco Products', 'Brand safety'),
    ('CRYPTO', 'Cryptocurrency', 'Risk management');

-- Insert sample charity partners (to be replaced with real vetted organizations)
INSERT INTO charity_partners (
    name, legal_name, country, description, website_url,
    vetting_status, allocation_percentage, is_active
) VALUES
    (
        'Medical Aid for Palestinians',
        'Medical Aid for Palestinians UK',
        'United Kingdom',
        'Delivers health and medical care to those affected by conflict, occupation and displacement.',
        'https://www.map.org.uk',
        'approved',
        35.00,
        true
    ),
    (
        'Palestine Children''s Relief Fund',
        'Palestine Children''s Relief Fund Inc.',
        'United States',
        'Provides free medical care to thousands of injured and sick children yearly.',
        'https://www.pcrf.net',
        'approved',
        35.00,
        true
    ),
    (
        'Islamic Relief',
        'Islamic Relief Worldwide',
        'United Kingdom',
        'Provides emergency relief and long-term development programs.',
        'https://www.islamic-relief.org',
        'approved',
        30.00,
        true
    );
