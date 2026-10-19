# ⚡ RevX Core — Open-Source Revenue Management & Native eSign Suite

> The modern, open-source operating system for **Quote-to-Cash (Q2C), CPQ, Billing, and Cryptographic e-Signatures** — built to run **100% standalone without Salesforce**.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)]()
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC.svg)]()

---

## 🌟 Why RevX Open Source?

Traditional enterprise revenue platforms (Salesforce Revenue Cloud, Conga, Zuora) cost tens of thousands of dollars, lock your data in proprietary silos, and require expensive per-user licenses.

**RevX Core** gives you enterprise-grade revenue management out-of-the-box for **$0**:
- **100% Standalone**: Runs completely offline, in Docker, or on your own VPS. No Salesforce license required.
- **Native Digital eSign Suite**: Zero DocuSign/AdobeSign fees. Features smooth drawing/typing pads, real-time client-side **SHA-256 cryptographic digest sealing**, and legally binding **Certificates of Completion** (compliant with US ESIGN, UETA, and Indian IT Act 2000).
- **Interactive CPQ & Quote 360**: Bundle configuration, tiered volume discounts, COGS margin modeling, and AI Deal Advisor governance.
- **Invoices 360 & India GST**: Automated CGST/SGST/IGST breakdown, HSN/SAC code mapping, and simulated **64-character e-Invoice IRN & QR code generation**.
- **ASC 606 & IFRS 15 Rev Rec**: Multi-element contract carving, Standalone Selling Price (SSP) allocation, and 12-month amortization waterfall schedules.
- **Optional Salesforce 2-Way Sync**: For enterprises that still want central CRM storage, RevX includes an optional bi-directional REST sync connector.

---

## 🚀 Quick Start (Local Development)

### 1. Clone & Install Dependencies
```bash
cd "C:\Users\Admin\Downloads\revx-open-source"
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Build for Production
```bash
npm run build
npm run preview
```

---

## 🏗️ Architecture & Technology Stack

| Layer | Standalone Technology | Role |
| :--- | :--- | :--- |
| **Frontend** | React 18, TypeScript, Tailwind CSS, Lucide | High-performance, responsive dark-mode SaaS UI |
| **Crypto Engine** | Web Crypto API (`window.crypto.subtle`) | Instant SHA-256 digital document integrity sealing |
| **eSign Engine** | HTML5 Canvas + SVG | Smooth vector signature capture & PDF certificate rendering |
| **Tax & Billing** | Indian GST (e-Invoice IRN), Stripe, Razorpay | Real-time tax computation & webhook settlement |
| **Database** | PostgreSQL / SQLite (Prisma Schema Ready) | Quotes, Contracts, Invoices, Subscriptions & Audit Trails |
| **CRM Connector** | Salesforce REST API v68.0 (OAuth2 JWT) | Optional 2-way sync without vendor lock-in |

---

## 📁 Project Structure

```
revx-open-source/
├── src/
│   ├── components/
│   │   ├── WarRoom/          # Executive revenue dashboard & KPI charts
│   │   ├── CPQ/              # Quote 360 studio, bundles & margin modeling
│   │   ├── ESign/            # Native signature pad & Certificate of Completion
│   │   ├── Billing/          # Invoices 360, GST & e-Invoice IRN simulator
│   │   ├── RevRec/           # ASC 606 / IFRS 15 SSP & Waterfall schedules
│   │   ├── Connectors/       # Standalone vs Salesforce sync settings
│   │   ├── Header.tsx        # Search, currency switcher (USD/INR/EUR/GBP)
│   │   └── Sidebar.tsx       # Navigation bar
│   ├── data/                 # Enterprise sample catalog & quotes data
│   ├── types/                # Complete TypeScript type definitions
│   ├── utils/                # Crypto SHA-256 and currency formatters
│   ├── App.tsx               # Main application orchestration
│   ├── index.css             # Tailwind & Glassmorphism styles
│   └── main.tsx              # React DOM mounting
├── public/                   # Static assets & branding
├── tailwind.config.js        # Premium dark SaaS theme configuration
├── package.json              # Dependencies & npm scripts
└── README.md                 # Documentation
```

---

## 📜 Compliance & Legal Enforceability

The digital signatures captured in RevX generate an immutable cryptographic audit trail with:
1. Signer Full Name, Email, and Title
2. UTC Timestamp down to the millisecond
3. IP Address / Originating Relay
4. 64-character SHA-256 Hash Digest
5. Formatted Certificate of Completion PDF

This complies with:
- **US Electronic Signatures in Global and National Commerce Act (ESIGN)** (15 U.S.C. § 7001)
- **Uniform Electronic Transactions Act (UETA)**
- **Section 10A of the Indian Information Technology Act (IT Act 2000)**

---

## 📄 License

This project is licensed under the **MIT License** — you are free to use, modify, distribute, and self-host for personal or commercial projects.
