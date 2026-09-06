# 🧾 Student Payment & Discord Verification Portal

The public-facing **Student Payment & Discord Verification Portal** for **The Elite Circle Academy**. This portal allows students in Nepal and worldwide to securely verify their Discord accounts, enroll in subscriptions in Nepalese Rupees (NPR रु), pay via eSewa, Khalti, or Fonepay QR, check their membership status & remaining days, and renew their subscriptions with automated Discord role synchronization.

---

## ✨ Features

- **Discord OAuth2 Identity Verification**: Cryptographically verifies student Discord User IDs (Snowflake IDs) and Discord usernames to eliminate manual spoofing and impersonation.
- **Student Membership Dashboard**:
  - Live membership status (`Active`, `Pending Verification`, `Expired`)
  - Expiry date with live days-remaining countdown
  - Assigned Discord roles display (e.g. `@Monthly-Subscriber`, `@Tier-3 Master`)
  - Real-time Discord role synchronization button
  - 1-Click "Renew Subscription" workflow
  - Payment proof submission & receipt history tracking
- **NPR 1,000 Subscription Tiers**:
  - **Monthly All-Access Subscription**: रु 1,000 / 30 days (Discord `@Monthly-Subscriber` role)
  - **3-Tier All-Access Pass**: रु 1,000 (Complete Tier 1 + Tier 2 + Tier 3 bundle with Discord `@Tier-3 Master` VIP role)
  - **Custom Amount**: For custom student invoices or institutional packages
- **Nepali Digital Wallets & Mobile Banking**:
  - **eSewa Mobile Wallet** (Instant transfer + QR zoom)
  - **Khalti Digital Wallet** (Instant transfer + QR zoom)
  - **Fonepay / Direct Bank QR** (Nabil / NIC Asia / Any Mobile Banking app)
- **Security Hardening**: Strict Content-Security-Policy (CSP), anti-clickjacking headers, CSRF state verification, and anti-tampering locked identity fields.

---

## ⚙️ Configuration

Set your Backend API URL and Discord Application credentials in `index.html` meta tags, `js/config.js`, or on-screen in the portal:

```html
<!-- Backend Bot API -->
<meta name="backend-api-url" content="https://your-bot-backend.railway.app">

<!-- Discord Application Credentials (from discord.com/developers) -->
<meta name="discord-client-id" content="1545687507725979768">
<meta name="discord-guild-id" content="YOUR_DISCORD_GUILD_ID">

<!-- Supabase Database & Storage Credentials (from supabase.com) -->
<meta name="supabase-url" content="https://your-project.supabase.co">
<meta name="supabase-anon-key" content="YOUR_SUPABASE_ANON_KEY">
```

### 🗄️ Supabase Setup (Database & Screenshot Storage)
1. Go to your Supabase project dashboard at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** tab.
3. Copy and run the contents of [`supabase_schema.sql`](./supabase_schema.sql).
   - Creates the `payment_verifications` table.
   - Creates the `payment-proofs` public storage bucket for receipt screenshots.
   - Configures public insert & read policies.
4. Copy your **Project URL** and **Anon Key** from **Project Settings ➔ API** and paste them into `index.html` meta tags or `js/config.js`.

### Discord OAuth2 Setup
1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Select your application (`1545687507725979768`).
3. Under **OAuth2 ➔ General**:
   - Add your redirect URL: `https://academic-student-portal.vercel.app/` (or `http://localhost:5173/`)
4. Save changes.

---

## 🚀 Deploy to Vercel

```bash
npm i -g vercel
vercel --prod
```

### Routes
Clean URLs are configured via `vercel.json`:
- `/` ➔ Checkout & Enrollment page
- `/dashboard` or `/my-plan` ➔ Student Membership Dashboard
- `/pay`, `/checkout`, `/submit-proof` ➔ Enrollment page

---

## 📁 File Structure

```
├── index.html          # Dual-view portal (Checkout Stepper + Student Dashboard)
├── css/proof.css       # Modern dark-mode glassmorphic design system
├── js/config.js        # Discord OAuth, NPR currency, tier & payment configurations
├── js/discord-auth.js  # Discord OAuth2 handler, token validation & session manager
├── js/dashboard.js     # User plan inspection, role sync & payment history tracker
├── js/proof.js         # Stepper logic, QR renderer, file drag-and-drop & form submission
└── vercel.json         # Security headers (CSP, XSS, Frame-Options) & clean routing
```

---

## 📄 License

MIT
