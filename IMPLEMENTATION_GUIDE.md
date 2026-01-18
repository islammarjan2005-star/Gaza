# Ecosia-for-Gaza: Complete Implementation Guide

This guide provides step-by-step instructions to deploy the Ecosia-for-Gaza search engine app from development to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Backend Setup](#backend-setup)
3. [Database Setup](#database-setup)
4. [Microsoft Ads Integration](#microsoft-ads-integration)
5. [Mobile App Setup](#mobile-app-setup)
6. [Revenue Pipeline Configuration](#revenue-pipeline-configuration)
7. [Security Configuration](#security-configuration)
8. [Deployment](#deployment)
9. [Monitoring & Operations](#monitoring--operations)
10. [Charity Onboarding](#charity-onboarding)

---

## Prerequisites

### Required Accounts & Access

1. **Microsoft Advertising Partner Account**
   - Apply at: https://about.ads.microsoft.com/en-us/resources/partner-program
   - Required for: Bing Search API, ad serving, revenue reports
   - Approval time: 2-4 weeks

2. **Microsoft Azure Account**
   - Create Bing Search resource in Azure Portal
   - Obtain API key for Bing Web Search API v7

3. **Cloud Infrastructure**
   - AWS, GCP, or Azure account
   - PostgreSQL database (RDS, Cloud SQL, or self-managed)
   - Redis cluster (ElastiCache, Memorystore, or self-managed)
   - S3/Cloud Storage for receipt uploads

4. **Apple Developer Account** ($99/year)
   - Required for iOS App Store distribution

5. **Google Play Developer Account** ($25 one-time)
   - Required for Android distribution

### Development Tools

```bash
# Required versions
node --version  # v20.x or higher
npm --version   # v10.x or higher

# Install Expo CLI globally
npm install -g expo-cli

# Install PostgreSQL client
brew install postgresql  # macOS
# or
sudo apt install postgresql-client  # Ubuntu
```

---

## Backend Setup

### 1. Clone and Install Dependencies

```bash
cd Gaza/backend
npm install
```

### 2. Configure Environment Variables

```bash
# Copy example config
cp .env.example .env

# Edit with your values
nano .env
```

**Critical environment variables:**

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/ecosia_gaza

# Redis
REDIS_URL=redis://localhost:6379

# Bing Search API (from Azure Portal)
BING_SEARCH_API_KEY=your_32_character_api_key
BING_SEARCH_ENDPOINT=https://api.bing.microsoft.com/v7.0/search

# Microsoft Ads (from Partner Portal)
MICROSOFT_ADS_CLIENT_ID=your_client_id
MICROSOFT_ADS_CLIENT_SECRET=your_client_secret
MICROSOFT_ADS_DEVELOPER_TOKEN=your_dev_token
MICROSOFT_ADS_REFRESH_TOKEN=your_refresh_token
MICROSOFT_ADS_CUSTOMER_ID=your_customer_id
MICROSOFT_ADS_ACCOUNT_ID=your_account_id

# Security (generate strong random values)
JWT_SECRET=$(openssl rand -hex 32)
API_KEY_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 16)  # Must be exactly 32 chars
```

### 3. Run Development Server

```bash
npm run dev
```

Server starts at `http://localhost:3000`

---

## Database Setup

### 1. Create Database

```sql
CREATE DATABASE ecosia_gaza;
CREATE USER ecosia_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE ecosia_gaza TO ecosia_user;
```

### 2. Run Migrations

```bash
# Run initial schema
psql $DATABASE_URL -f src/migrations/001_initial_schema.sql
```

### 3. Verify Setup

```bash
# Test connection
psql $DATABASE_URL -c "SELECT COUNT(*) FROM charity_partners;"
```

Expected output: 3 rows (seeded charity partners)

---

## Microsoft Ads Integration

### Step 1: Apply for Partner Program

1. Visit https://about.ads.microsoft.com/en-us/resources/partner-program
2. Complete application form
3. Provide business documentation
4. Wait for approval (2-4 weeks)

### Step 2: Create Azure Bing Search Resource

1. Log into Azure Portal
2. Create "Bing Search v7" resource
3. Copy API key from Keys section
4. Set endpoint in environment variables

### Step 3: Configure Ads API Access

1. Log into Microsoft Advertising Portal
2. Navigate to Developer Tools
3. Create OAuth 2.0 application
4. Generate refresh token using authorization flow
5. Copy all credentials to .env file

### Step 4: Set Up Revenue Reporting

1. In Partner Portal, enable Reporting API access
2. Configure account-level reporting permissions
3. Verify API access with test request

```bash
# Test API access
curl -X POST "https://reporting.api.bingads.microsoft.com/Api/Advertiser/V13/Reporting/SubmitGenerateReport" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "DeveloperToken: YOUR_DEV_TOKEN"
```

---

## Mobile App Setup

### 1. Install Dependencies

```bash
cd Gaza/mobile
npm install
```

### 2. Configure API Endpoint

Edit `src/services/api.ts`:

```typescript
const API_BASE_URL = __DEV__
  ? 'http://localhost:3000/api/v1'      // Development
  : 'https://api.ecosia-for-gaza.org/api/v1';  // Production
```

### 3. Run Development Build

```bash
# Start Expo development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android
```

### 4. Build for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure EAS
eas login
eas build:configure

# Build iOS
eas build --platform ios

# Build Android
eas build --platform android
```

---

## Revenue Pipeline Configuration

### Automatic Revenue Sync Jobs

The backend includes scheduled jobs for revenue synchronization:

| Job | Schedule | Purpose |
|-----|----------|---------|
| Daily Revenue Sync | 6 AM UTC | Fetch previous day's revenue |
| Weekly Summary | Mondays 7 AM UTC | Aggregate weekly data |
| Monthly Summary | 2nd of month 8 AM UTC | Calculate monthly totals |
| Metrics Calculation | 1 AM UTC | Aggregate search/click data |
| Data Retention | Sundays 3 AM UTC | Purge old data |

### Manual Revenue Fetch

```bash
# Run daily sync manually
npm run jobs:revenue

# Calculate metrics for specific date
npm run jobs:metrics -- 2024-01-15
```

### Revenue Verification Workflow

1. Daily jobs fetch Microsoft reports
2. Revenue records stored with `verified = false`
3. Admin reviews and verifies records
4. Verified revenue becomes available for disbursement

---

## Security Configuration

### SSL/TLS Setup

```nginx
# nginx configuration
server {
    listen 443 ssl http2;
    server_name api.ecosia-for-gaza.org;

    ssl_certificate /etc/letsencrypt/live/api.ecosia-for-gaza.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.ecosia-for-gaza.org/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Rate Limiting

Default limits (configurable in .env):

| Endpoint | Limit | Window |
|----------|-------|--------|
| General API | 100 requests | 1 minute |
| Search | 30 requests | 1 minute |
| Ad Clicks | 10 clicks | 1 minute |
| Admin | 100 requests | 1 minute |

### Data Encryption

- All database connections use SSL
- Sensitive fields (bank accounts) encrypted with AES-256-GCM
- Passwords hashed with bcrypt (cost factor 12)
- API keys hashed with SHA-256

---

## Deployment

### Docker Deployment

```dockerfile
# Dockerfile for backend
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  api:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/ecosia_gaza
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:15
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=ecosia_gaza
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass

  redis:
    image: redis:7-alpine

volumes:
  pgdata:
```

### Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ecosia-gaza-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ecosia-gaza-api
  template:
    metadata:
      labels:
        app: ecosia-gaza-api
    spec:
      containers:
      - name: api
        image: ecosia-gaza/api:latest
        ports:
        - containerPort: 3000
        envFrom:
        - secretRef:
            name: ecosia-gaza-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

---

## Monitoring & Operations

### Health Checks

```bash
# API health
curl https://api.ecosia-for-gaza.org/api/v1/health

# Readiness (includes DB/Redis)
curl https://api.ecosia-for-gaza.org/api/v1/ready
```

### Key Metrics to Monitor

| Metric | Alert Threshold | Action |
|--------|-----------------|--------|
| API Response Time | > 500ms p95 | Scale horizontally |
| Error Rate | > 1% | Investigate logs |
| Search Volume | < 50% baseline | Check Bing API |
| Revenue Sync | Failed 2+ days | Manual intervention |
| Database Connections | > 80% pool | Increase pool size |

### Log Analysis

```bash
# View structured logs
docker logs ecosia-gaza-api | jq

# Search for errors
docker logs ecosia-gaza-api | jq 'select(.level == "error")'
```

---

## Charity Onboarding

### Vetting Process

1. **Initial Review**
   - Verify registration documents
   - Check charity watchlists
   - Review financial statements

2. **Due Diligence Checklist**
   - [ ] Valid nonprofit registration
   - [ ] Published annual reports
   - [ ] No watchlist presence
   - [ ] >80% program spending ratio
   - [ ] Active Gaza humanitarian programs

3. **Bank Verification**
   - Collect bank details securely
   - Verify account ownership
   - Test with small transfer

### Adding New Charity

```bash
# Via API
curl -X POST https://api.ecosia-for-gaza.org/api/v1/charities \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Charity Name",
    "legalName": "New Charity Legal Name Inc.",
    "country": "United States",
    "registrationNumber": "12-3456789",
    "websiteUrl": "https://newcharity.org",
    "description": "Provides humanitarian aid..."
  }'
```

### Updating Allocations

```bash
# Allocations must sum to 100%
curl -X PUT https://api.ecosia-for-gaza.org/api/v1/charities/allocations \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "allocations": [
      {"charityId": "uuid-1", "percentage": 35},
      {"charityId": "uuid-2", "percentage": 35},
      {"charityId": "uuid-3", "percentage": 30}
    ]
  }'
```

---

## Monthly Disbursement Process

### Step 1: Verify Revenue (Day 2-5 of month)

```bash
# Check previous month's revenue is verified
curl https://api.ecosia-for-gaza.org/api/v1/transparency/report/2024-01 \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Step 2: Create Disbursements (Day 5)

```bash
curl -X POST https://api.ecosia-for-gaza.org/api/v1/charities/disbursements \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"period": "2024-01"}'
```

### Step 3: Approve Disbursements (Day 5-7)

```bash
curl -X POST https://api.ecosia-for-gaza.org/api/v1/charities/disbursements/UUID/approve \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Step 4: Execute Wire Transfers (Day 7-10)

Manual process via banking portal

### Step 5: Mark as Sent & Upload Receipts

```bash
# Mark sent
curl -X POST https://api.ecosia-for-gaza.org/api/v1/charities/disbursements/UUID/sent \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"transferReference": "WIRE123456", "transferMethod": "wire"}'

# Upload receipt (after charity confirms)
curl -X POST https://api.ecosia-for-gaza.org/api/v1/charities/disbursements/UUID/receipt \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "receiptNumber": "RCP-2024-001",
    "receiptDate": "2024-01-15",
    "receivedAmount": 1500.00,
    "fileUrl": "https://s3.../receipt.pdf",
    "fileHash": "sha256hash..."
  }'
```

---

## MVP Launch Checklist

### Pre-Launch

- [ ] Microsoft Advertising Partner approval received
- [ ] Bing Search API tested and working
- [ ] Database deployed and migrated
- [ ] At least 2 charity partners vetted and onboarded
- [ ] SSL certificates configured
- [ ] Mobile apps built and tested

### Launch Day

- [ ] Deploy backend to production
- [ ] Submit iOS app to App Store review
- [ ] Submit Android app to Play Store review
- [ ] Monitor error rates and performance
- [ ] Announce on social media

### Post-Launch (Week 1)

- [ ] Monitor search volume and revenue
- [ ] Address any reported bugs
- [ ] Verify revenue sync is working
- [ ] First transparency update posted

---

## Support & Resources

- **Technical Issues**: Create GitHub issue
- **Partner Program**: Microsoft Advertising support
- **Charity Questions**: admin@ecosia-for-gaza.org
- **Security Concerns**: security@ecosia-for-gaza.org

---

*Last updated: January 2024*
