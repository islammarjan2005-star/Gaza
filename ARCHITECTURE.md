# Ecosia-for-Gaza: Complete Architecture Documentation

## Overview

Ecosia-for-Gaza is a privacy-first mobile search engine that donates 100% of its ad revenue share to vetted Gaza humanitarian organizations. Users perform web searches powered by Bing Search API, view relevant ads through the Microsoft Ads Partner Program, and can track exactly how their searches contribute to humanitarian aid.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MOBILE APPLICATION                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Search UI   │  │ Results     │  │ Transparency│  │ Settings/Privacy    │ │
│  │ Component   │  │ Display     │  │ Dashboard   │  │ Controls            │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
└─────────┼────────────────┼────────────────┼────────────────────┼────────────┘
          │                │                │                    │
          ▼                ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY                                      │
│                    (Rate Limiting, Auth, Request Routing)                     │
└─────────────────────────────────────────────────────────────────────────────┘
          │                │                │                    │
          ▼                ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND SERVICES                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Search      │  │ Ad Revenue  │  │ Charity     │  │ Analytics           │ │
│  │ Service     │  │ Tracker     │  │ Disbursement│  │ Service             │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                │                    │            │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐                          │
│  │ Content     │  │ Privacy     │  │ Compliance  │                          │
│  │ Filter      │  │ Engine      │  │ Service     │                          │
│  └─────────────┘  └─────────────┘  └─────────────┘                          │
└─────────────────────────────────────────────────────────────────────────────┘
          │                │                │                    │
          ▼                ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DATA LAYER                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ PostgreSQL  │  │ Redis       │  │ S3/Cloud    │  │ Elasticsearch       │ │
│  │ (Primary DB)│  │ (Cache)     │  │ Storage     │  │ (Search Analytics)  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
          │                                              │
          ▼                                              ▼
┌─────────────────────────────────┐    ┌─────────────────────────────────────┐
│      EXTERNAL SERVICES          │    │       CHARITY PARTNERS              │
│  ┌─────────────────────────┐   │    │  ┌─────────────────────────────────┐│
│  │ Bing Web Search API     │   │    │  │ UNRWA                           ││
│  └─────────────────────────┘   │    │  │ Medical Aid for Palestinians    ││
│  ┌─────────────────────────┐   │    │  │ PCRF                            ││
│  │ Microsoft Ads API       │   │    │  │ Islamic Relief                  ││
│  └─────────────────────────┘   │    │  │ Other vetted organizations      ││
│  ┌─────────────────────────┐   │    │  └─────────────────────────────────┘│
│  │ Microsoft Ads Reporting │   │    └─────────────────────────────────────┘
│  └─────────────────────────┘   │
└─────────────────────────────────┘
```

## Core Components

### 1. Search Service
- Integrates with Bing Web Search API v7
- Handles query processing, result formatting
- Implements safe search and content filtering
- Caches popular queries for performance

### 2. Ad Revenue Tracker
- Tracks ad impressions and clicks
- Integrates with Microsoft Ads Reporting API
- Calculates real-time revenue metrics
- Stores detailed revenue breakdown

### 3. Charity Disbursement System
- Manages monthly donation cycles
- Handles bank transfers to vetted charities
- Stores and verifies donation receipts
- Provides audit trail for transparency

### 4. Content Filter
- Blocks politically sensitive ad categories
- Filters brand-unsafe content
- Maintains blocklist of problematic advertisers
- Ensures family-safe search results

### 5. Privacy Engine
- Anonymizes user queries
- Implements differential privacy
- No user tracking or profiling
- GDPR/CCPA compliant data handling

## Technology Stack

### Backend
- **Runtime**: Node.js 20 LTS
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Queue**: Bull (Redis-based)
- **API Documentation**: OpenAPI 3.0

### Mobile App
- **Framework**: React Native 0.73+
- **State Management**: Zustand
- **Navigation**: React Navigation 6
- **HTTP Client**: Axios
- **UI Components**: Custom + React Native Paper

### Infrastructure
- **Cloud**: AWS/GCP (configurable)
- **CDN**: CloudFront/Cloud CDN
- **Secrets**: AWS Secrets Manager/HashiCorp Vault
- **Monitoring**: Prometheus + Grafana
- **Logging**: ELK Stack

## Security Model

### Authentication
- Device-based anonymous tokens
- No user accounts required for search
- Optional accounts for donation tracking

### Data Protection
- All data encrypted at rest (AES-256)
- TLS 1.3 for all communications
- No PII stored without explicit consent
- Automatic data purging (30-day retention)

### API Security
- Rate limiting per device
- Request signing
- API key rotation
- DDoS protection via CDN

## Revenue Flow

```
User Search → Bing API → Results + Ads
                              ↓
                     User Views/Clicks Ad
                              ↓
                Microsoft Ads Tracks Revenue
                              ↓
                 Daily Revenue Report Pull
                              ↓
              Backend Records to Database
                              ↓
              Monthly Aggregation + Audit
                              ↓
           Wire Transfer to Charity Partners
                              ↓
         Receipt Upload + Transparency Update
```

## Compliance Requirements

### Advertising Compliance
- Microsoft Advertising Partner Program Terms
- No incentivized clicks
- Clear "Ad" labeling
- Brand safety guidelines

### Privacy Regulations
- GDPR (EU users)
- CCPA (California users)
- COPPA (no data from children under 13)

### Financial Compliance
- Charitable donation tracking
- Tax documentation for 501(c)(3) equivalents
- Anti-money laundering checks
- Audit-ready records

## Charity Vetting Criteria

1. **Legitimacy**: Registered nonprofit with verifiable history
2. **Focus**: Direct humanitarian aid to Gaza civilians
3. **Transparency**: Published financial statements
4. **Efficiency**: >80% of funds to direct aid
5. **Non-political**: Humanitarian-only mission
6. **Compliance**: No terror-financing watchlist presence
