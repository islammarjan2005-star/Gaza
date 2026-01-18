# Ecosia for Gaza

A privacy-first mobile search engine that donates 100% of its ad revenue share to vetted Gaza humanitarian organizations.

## Overview

Ecosia for Gaza works like any search engine - users search the web, see relevant ads, and the revenue generated goes directly to humanitarian relief efforts in Gaza. Every search makes a difference.

### How It Works

1. **You Search** - Use the app just like any search engine
2. **Ads Generate Revenue** - Bing-powered ads generate income
3. **We Donate 100%** - All ad revenue share goes to verified charities
4. **Transparent Tracking** - See exactly where every dollar goes

## Features

- **Full-Featured Search** - Powered by Bing Web Search API
- **Privacy-First** - No tracking, no user profiles, no data selling
- **Real-Time Transparency** - Daily/weekly/monthly revenue dashboards
- **Verified Charities** - Only vetted humanitarian organizations
- **Impact Tracking** - See how your searches help
- **Brand-Safe Ads** - Automatic filtering of political/sensitive content

## Project Structure

```
Gaza/
├── backend/                 # Node.js/Express API server
│   ├── src/
│   │   ├── config/         # Configuration files
│   │   ├── controllers/    # Request handlers
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Express middleware
│   │   ├── routes/         # API routes
│   │   ├── jobs/           # Background jobs
│   │   ├── migrations/     # Database migrations
│   │   └── types/          # TypeScript types
│   └── package.json
│
├── mobile/                  # React Native mobile app
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── screens/        # App screens
│   │   ├── services/       # API client
│   │   ├── store/          # State management
│   │   └── utils/          # Utilities
│   └── package.json
│
├── docs/                    # Additional documentation
├── ARCHITECTURE.md          # System architecture
├── DATABASE_SCHEMA.md       # Database design
├── IMPLEMENTATION_GUIDE.md  # Step-by-step deployment guide
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Microsoft Advertising Partner Account
- Bing Search API Key

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials
npm run dev
```

### Mobile App Setup

```bash
cd mobile
npm install
npm start
```

## API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/search` | Perform web search |
| GET | `/api/v1/transparency` | Get donation stats |
| GET | `/api/v1/charities` | List charity partners |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/charities` | Add new charity |
| POST | `/api/v1/charities/disbursements` | Create monthly disbursements |
| PATCH | `/api/v1/charities/:id/vetting` | Update charity status |

## Charity Partners

Currently supporting:

- **Medical Aid for Palestinians** (35%) - Healthcare and medical supplies
- **Palestine Children's Relief Fund** (35%) - Medical care for children
- **Islamic Relief** (30%) - Emergency relief and development

## Technology Stack

### Backend
- Node.js + Express + TypeScript
- PostgreSQL + Redis
- Bing Web Search API
- Microsoft Ads Reporting API

### Mobile
- React Native + Expo
- Zustand (state management)
- React Navigation

## Privacy Commitment

- **No User Tracking** - We don't store your identity
- **Query Anonymization** - Only hashed queries stored
- **No Profiling** - No personal data collection
- **GDPR/CCPA Compliant** - Full privacy regulation support
- **Data Portability** - Export your data anytime
- **Right to Erasure** - Delete your data completely

## Revenue Model

```
User Search → Bing API → Results + Ads
                              ↓
                Microsoft Ads Revenue
                              ↓
                 ~30% Publisher Share
                              ↓
              100% → Charity Partners
```

## Contributing

We welcome contributions! Please see our contributing guidelines.

### Development

```bash
# Run tests
npm test

# Lint code
npm run lint

# Type check
npm run type-check
```

## License

This project is licensed under the MIT License - see LICENSE file for details.

## Acknowledgments

- [Ecosia](https://www.ecosia.org/) for inspiration
- [Microsoft Advertising](https://ads.microsoft.com/) for partnership program
- All humanitarian organizations working in Gaza

---

**Every search helps. Start searching for Gaza today.**
