/**
 * Academy Client API & Discord OAuth Configuration
 * 
 * Configures Discord OAuth2 credentials, Bot Backend API endpoints,
 * NPR Currency and Tier definitions, and Nepali Payment Methods.
 */
(function () {
  const metaApiUrl = document.querySelector('meta[name="backend-api-url"]')?.getAttribute('content');
  const storedApiUrl = window.localStorage?.getItem('ACADEMY_BACKEND_URL');
  
  // Backend API Base URL
  window.API_BASE = (
    window.BACKEND_API_URL ||
    metaApiUrl ||
    storedApiUrl ||
    window.location.origin
  ).replace(/\/+$/, '');

  // Discord OAuth2 Configuration
  const metaDiscordClientId = document.querySelector('meta[name="discord-client-id"]')?.getAttribute('content');
  const storedDiscordClientId = window.localStorage?.getItem('ACADEMY_DISCORD_CLIENT_ID');
  const metaDiscordGuildId = document.querySelector('meta[name="discord-guild-id"]')?.getAttribute('content');
  const storedDiscordGuildId = window.localStorage?.getItem('ACADEMY_DISCORD_GUILD_ID');

  window.DISCORD_CONFIG = {
    // Discord Application Client ID
    clientId: window.DISCORD_CLIENT_ID || metaDiscordClientId || storedDiscordClientId || '1545687507725979768',
    // Discord Guild (Server) ID for role verification
    guildId: window.DISCORD_GUILD_ID || metaDiscordGuildId || storedDiscordGuildId || '',
    // OAuth2 Redirect URI (matches Discord Developer Portal)
    redirectUri: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? (window.location.origin + window.location.pathname).replace(/\/index\.html$/, '/').replace(/\/+$/, '/')
      : 'https://academic-student-portal.vercel.app/',
    // Scopes: identity (ID, avatar, username), email, guilds
    scopes: ['identify', 'email', 'guilds'],
  };

  // Currency Definition
  window.ACADEMY_CURRENCY = {
    code: 'NPR',
    symbol: 'रु ',
    name: 'Nepalese Rupee',
    displayFormat: (amount) => `रु ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
  };

  // Subscription Tiers Configuration (Priced in NPR 1,000)
  window.ACADEMY_TIERS = {
    monthly: {
      id: 'monthly',
      tierNumber: 1,
      name: 'Monthly All-Access Subscription',
      badge: 'Recurring Pass',
      badgeClass: 'popular',
      price: 1000,
      currency: 'NPR',
      periodText: '/ 30 days',
      roleName: '@Monthly-Subscriber',
      roleColor: '#5865F2',
      features: [
        'Full Access to All Academy Courses & Modules',
        'Interactive Assignments, Quizzes & XP System',
        'Weekly Live Q&A Voice Sessions with Mentors',
        'Discord @Monthly-Subscriber Role Activation',
        '24/7 Access to Student Community & Voice Lounges'
      ],
      description: 'The standard monthly subscription giving unlimited access to all academy materials and live sessions.'
    },
    tier3: {
      id: 'tier3',
      tierNumber: 3,
      name: '3-Tier All-Access Pass',
      badge: 'Complete Bundle',
      badgeClass: 'master',
      price: 1000,
      currency: 'NPR',
      periodText: 'All 3 Tiers Unlocked',
      roleName: '@Tier-3 Master',
      roleColor: '#f59e0b',
      features: [
        'Unlocks Tier 1 (Foundation) + Tier 2 (Practitioner) + Tier 3 (Master VIP)',
        'Direct 1-on-1 Portfolio & Code Audits from Instructors',
        'Discord @Tier-3 Master & Verified Scholar Roles',
        'VIP Alumni Networking & Resource Vault',
        'Fast-Track Graduate Certificate of Completion'
      ],
      description: 'Comprehensive 3-tier access package delivering complete mastery from foundation to executive VIP mentorship.'
    }
  };

  // Default Nepali Payment Methods (eSewa, Khalti, Fonepay Bank Transfer)
  window.DEFAULT_PAYMENT_METHODS = [
    {
      id: 'esewa',
      title: 'eSewa Mobile Wallet',
      badge: 'Instant Transfer',
      brandColor: '#60bb46',
      iconEmoji: '🟢',
      accountName: 'The Elite Circle Academy',
      accountNumber: '9801234567',
      qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=esewa://payment?id=9801234567&amount=1000&name=Academy',
      instructions: '1. Scan QR with eSewa app or send to 9801234567.\n2. In Remarks, put your Discord Username or Discord ID.\n3. Take a screenshot of the completed payment receipt.'
    },
    {
      id: 'khalti',
      title: 'Khalti Digital Wallet',
      badge: 'Instant Transfer',
      brandColor: '#5c2d91',
      iconEmoji: '🟣',
      accountName: 'The Elite Circle Academy',
      accountNumber: '9801234567',
      qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=khalti://pay?to=9801234567&amount=1000&name=Academy',
      instructions: '1. Open Khalti and send to 9801234567 or scan the QR code.\n2. Add your Discord Tag in Remarks.\n3. Save transaction receipt screenshot for upload.'
    },
    {
      id: 'fonepay',
      title: 'Fonepay / Bank Direct QR',
      badge: 'Any Mobile Banking',
      brandColor: '#e21b22',
      iconEmoji: '🔴',
      accountName: 'The Elite Circle Academy',
      accountNumber: '01201017500123 (Nabil Bank)',
      branch: 'Kathmandu Main Branch',
      qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=fonepay://qr?acc=01201017500123&bank=NABIL&amount=1000',
      instructions: '1. Open any Nepali Mobile Banking app (Nabil, NIC Asia, Global IME, etc.).\n2. Scan Fonepay QR or transfer to Account: 01201017500123.\n3. Save the payment receipt with the Transaction ID.'
    }
  ];
})();
