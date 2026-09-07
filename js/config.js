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

  // Supabase Configuration
  const metaSupabaseUrl = document.querySelector('meta[name="supabase-url"]')?.getAttribute('content');
  const storedSupabaseUrl = window.localStorage?.getItem('ACADEMY_SUPABASE_URL');
  const metaSupabaseAnonKey = document.querySelector('meta[name="supabase-anon-key"]')?.getAttribute('content');
  const storedSupabaseAnonKey = window.localStorage?.getItem('ACADEMY_SUPABASE_ANON_KEY');

  window.SUPABASE_CONFIG = {
    url: window.SUPABASE_URL || metaSupabaseUrl || storedSupabaseUrl || 'https://snuunauwtuqyibmcajzh.supabase.co',
    anonKey: window.SUPABASE_ANON_KEY || metaSupabaseAnonKey || storedSupabaseAnonKey || 'sb_publishable_r_4B33JNzqJuZnmfYd_Yrg_rFVqoj_4',
    bucket: 'payment-proofs',
    tableName: 'payment_verifications',
  };

  // Currency Definition
  window.ACADEMY_CURRENCY = {
    code: 'NPR',
    symbol: 'रु ',
    name: 'Nepalese Rupee',
    displayFormat: (amount) => `रु ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
  };

  // Single Monthly Subscription Plan (Recurring 30 Days, रु 1,000)
  window.ACADEMY_TIERS = {
    monthly: {
      id: 'monthly',
      tierNumber: 1,
      name: 'Monthly Subscription',
      badge: 'Recurring 30 Days',
      badgeClass: 'popular',
      price: 1000,
      currency: 'NPR',
      periodText: '/ 30 days',
      roleName: '@Monthly-Subscriber',
      roleColor: '#5865F2',
      features: [
        'Full Access to All Academy Courses',
        'Live Weekly Voice Q&A & Mentorship Sessions',
        'Interactive Quizzes, Assignments & XP Points',
        'Discord Private Voice Lounges & Networking',
        'Live Countdown & Instant 1-Click Renewal'
      ],
      description: 'Single monthly membership plan providing full access to all academy courses and Discord community channels.'
    }
  };

  // Payment methods are strictly loaded from the Supabase database (public.payment_methods)
  // Mock fallbacks are disabled so the portal only displays available methods configured in the database
  window.DEFAULT_PAYMENT_METHODS = [];
})();
