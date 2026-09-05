# 🧾 Student Payment & Proof Verification Portal

The public-facing **Student Payment & Proof Portal** for **Premium AI Video Ads Academy**. This repository is fully decoupled from the bot backend and admin tools — it contains zero admin links or references.

Students use this portal to:

- View official payment methods (bank transfer / e-wallet QR codes)
- Submit payment proof: full name, phone, email, Discord username, transaction ID, and receipt link
- Get instant submission feedback while staff are alerted on Discord for manual verification

> **Backend:** This portal talks to the Academy Bot's Express API (`/api/...`).
> Point it at your deployed backend by setting the `backend-api-url` meta tag in `index.html`:

```html
<meta name="backend-api-url" content="https://your-bot-backend.railway.app">
```

If left empty, it connects to the same origin.

---

## 🚀 Deploy to Vercel

### Option 1: Vercel Web Dashboard
1. Go to [vercel.com/new](https://vercel.com/new).
2. Import this repository.
3. **Framework Preset**: `Other` — leave build and output settings empty.
4. Click **Deploy**.

### Option 2: Vercel CLI
```bash
npm i -g vercel
vercel --prod
```

### Routes
Clean URLs are enabled via `vercel.json`:
- `/` → checkout page
- `/pay`, `/checkout`, `/submit-proof` → same page

---

## 📁 Structure

```
├── index.html      # Portal page (QR checkout + proof submission form)
├── css/proof.css   # Dark-mode glassmorphism styles
├── js/config.js    # Backend URL resolution + shared config
├── js/proof.js     # Form logic, validation, and submission
└── vercel.json     # Vercel rewrites + security headers
```

---

## 🔗 Related Repositories

| Repository | Purpose |
|---|---|
| `academic-bot` | Discord bot, Express API, Prisma database (the backend) |
| `academic-admin-panel` | Private staff dashboard for payment verification |

## 📄 License

MIT
