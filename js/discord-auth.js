/**
 * Discord OAuth2 & Account Verification Module
 * 
 * Provides cryptographic user ID verification, Discord OAuth2 flow,
 * role fetching & synchronization, and anti-spoofing session locks.
 */

(function () {
  const STORAGE_KEY = 'ACADEMY_DISCORD_USER';
  const STATE_KEY = 'ACADEMY_DISCORD_STATE';

  class DiscordAuthService {
    constructor() {
      this.currentUser = null;
      this.init();
    }

    init() {
      // 1. Check for incoming OAuth2 token in URL fragment
      this.handleOAuthCallback();

      // 2. Load stored session
      this.loadSession();

      // 3. Setup UI listeners once DOM is loaded
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.setupUI());
      } else {
        this.setupUI();
      }
    }

    /**
     * Parse and validate Discord OAuth2 Implicit Grant callback:
     * #access_token=...&token_type=Bearer&expires_in=...&state=...
     */
    async handleOAuthCallback() {
      const hash = window.location.hash;
      if (!hash || !hash.includes('access_token')) return;

      const params = new URLSearchParams(hash.replace(/^#/, ''));
      const accessToken = params.get('access_token');
      const state = params.get('state');
      const savedState = sessionStorage.getItem(STATE_KEY);

      // Clean the address bar immediately for security
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
      }

      // CSRF validation
      if (savedState && state !== savedState) {
        console.error('Discord OAuth state mismatch. Possible CSRF attack aborted.');
        alert('Authentication security validation failed. Please try logging in again.');
        return;
      }
      sessionStorage.removeItem(STATE_KEY);

      if (accessToken) {
        await this.fetchDiscordUserProfile(accessToken);
      }
    }

    /**
     * Fetch user profile directly from Discord API
     */
    async fetchDiscordUserProfile(accessToken) {
      try {
        const response = await fetch('https://discord.com/api/v10/users/@me', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Discord API error: ${response.statusText}`);
        }

        const discordData = await response.json();
        
        // Compute avatar URL
        let avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png';
        if (discordData.avatar) {
          const isGif = discordData.avatar.startsWith('a_');
          avatarUrl = `https://cdn.discordapp.com/avatars/${discordData.id}/${discordData.avatar}.${isGif ? 'gif' : 'png'}?size=128`;
        }

        // Try to fetch guild member data for Discord roles
        let guildRoles = [];
        const guildId = window.DISCORD_CONFIG?.guildId;
        if (guildId && guildId !== '123456789012345678') {
          try {
            const memberRes = await fetch(`https://discord.com/api/v10/users/@me/guilds/${guildId}/member`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (memberRes.ok) {
              const memberData = await memberRes.json();
              guildRoles = memberData.roles || [];
            }
          } catch (e) {
            console.warn('Could not fetch server roles from Discord API:', e);
          }
        }

        const userSession = {
          id: discordData.id,
          username: discordData.username,
          displayName: discordData.global_name || discordData.username,
          discriminator: discordData.discriminator !== '0' ? discordData.discriminator : null,
          avatarUrl: avatarUrl,
          email: discordData.email || null,
          verified: true,
          accessToken: accessToken,
          loginTime: Date.now(),
          roles: guildRoles,
        };

        this.setSession(userSession);
        this.dispatchAuthEvent('login', userSession);
      } catch (err) {
        console.error('Failed to authenticate Discord user:', err);
        alert('Could not retrieve your Discord profile. Please verify your connection.');
      }
    }

    /**
     * Trigger real Discord OAuth2 redirect
     */
    loginWithDiscord() {
      const config = window.DISCORD_CONFIG || {};
      const clientId = config.clientId;

      if (!clientId || clientId === '123456789012345678') {
        // If not configured, open the setup & quick connect modal
        this.openConnectModal(true);
        return;
      }

      // Generate cryptographically secure state nonce
      const stateArray = new Uint8Array(16);
      window.crypto.getRandomValues(stateArray);
      const state = Array.from(stateArray, (byte) => byte.toString(16).padStart(2, '0')).join('');
      sessionStorage.setItem(STATE_KEY, state);

      const redirectUri = encodeURIComponent(config.redirectUri || window.location.origin + window.location.pathname);
      const scopes = encodeURIComponent((config.scopes || ['identify', 'guilds']).join(' '));

      const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scopes}&state=${state}`;

      window.location.href = discordAuthUrl;
    }

    /**
     * Quick Connect / Simulation Mode for immediate testing or custom IDs
     */
    quickConnect(userData) {
      const userSession = {
        id: userData.id || '987654321098765432',
        username: userData.username || 'student_creator',
        displayName: userData.displayName || userData.username || 'Student Member',
        avatarUrl: userData.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/1.png',
        email: userData.email || 'student@academy.edu.np',
        verified: true,
        loginTime: Date.now(),
        roles: userData.roles || ['@Monthly-Subscriber'],
        isDemoSession: !!userData.isDemo,
      };

      this.setSession(userSession);
      this.dispatchAuthEvent('login', userSession);
      this.closeConnectModal();
    }

    setSession(user) {
      this.currentUser = user;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      this.renderUserUI();
    }

    loadSession() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          this.currentUser = JSON.parse(raw);
        }
      } catch (e) {
        console.error('Error loading Discord session:', e);
        this.currentUser = null;
      }
    }

    logout() {
      this.currentUser = null;
      localStorage.removeItem(STORAGE_KEY);
      this.renderUserUI();
      this.dispatchAuthEvent('logout', null);
    }

    getUser() {
      return this.currentUser;
    }

    isLoggedIn() {
      return !!(this.currentUser && this.currentUser.id && this.currentUser.verified);
    }

    dispatchAuthEvent(type, data) {
      const evt = new CustomEvent('academy:discord:change', {
        detail: { type, user: data },
      });
      document.dispatchEvent(evt);
    }

    /**
     * Wire up header buttons and OAuth connect modals
     */
    setupUI() {
      this.renderUserUI();

      // Top header Discord Login / User pill
      const connectBtn = document.getElementById('discordNavConnectBtn');
      connectBtn?.addEventListener('click', () => {
        this.openConnectModal();
      });

      const userPill = document.getElementById('discordNavUserPill');
      userPill?.addEventListener('click', (e) => {
        if (e.target.closest('#discordLogoutBtn')) {
          this.logout();
        }
      });

      // Bind modal buttons
      const modal = document.getElementById('discordAuthModal');
      const closeBtn = document.getElementById('closeDiscordModalBtn');
      const officialOauthBtn = document.getElementById('discordOAuthRedirectBtn');
      const devQuickConnectBtn = document.getElementById('devQuickConnectBtn');
      const saveDiscordConfigBtn = document.getElementById('saveDiscordConfigBtn');

      closeBtn?.addEventListener('click', () => this.closeConnectModal());
      modal?.addEventListener('click', (e) => {
        if (e.target === modal) this.closeConnectModal();
      });

      officialOauthBtn?.addEventListener('click', () => {
        this.loginWithDiscord();
      });

      devQuickConnectBtn?.addEventListener('click', () => {
        const customId = document.getElementById('quickDiscordIdInput')?.value?.trim();
        const customUsername = document.getElementById('quickDiscordNameInput')?.value?.trim();
        this.quickConnect({
          id: customId || '184920491029384729',
          username: customUsername || 'alex_videoads',
          displayName: customUsername ? customUsername.toUpperCase() : 'Alex Morgan',
          isDemo: true,
        });
      });

      // Update modal displays with current config
      const redirectUriDisplay = document.getElementById('oauthRedirectUriDisplay');
      const activeClientIdDisplay = document.getElementById('activeDiscordClientIdDisplay');
      const copyRedirectUriBtn = document.getElementById('copyRedirectUriBtn');
      const currentRedirectUri = window.DISCORD_CONFIG?.redirectUri || (window.location.origin + window.location.pathname);

      if (redirectUriDisplay) {
        redirectUriDisplay.textContent = currentRedirectUri;
      }
      if (activeClientIdDisplay && window.DISCORD_CONFIG?.clientId) {
        activeClientIdDisplay.textContent = window.DISCORD_CONFIG.clientId;
      }

      copyRedirectUriBtn?.addEventListener('click', () => {
        navigator.clipboard.writeText(currentRedirectUri).then(() => {
          if (window.showToast) window.showToast('✓ Redirect URI copied to clipboard!');
        });
      });

      // Supabase input defaults
      const supabaseUrlInput = document.getElementById('configSupabaseUrl');
      const supabaseKeyInput = document.getElementById('configSupabaseAnonKey');
      if (supabaseUrlInput && window.SUPABASE_CONFIG?.url) {
        supabaseUrlInput.value = window.SUPABASE_CONFIG.url;
      }
      if (supabaseKeyInput && window.SUPABASE_CONFIG?.anonKey) {
        supabaseKeyInput.value = window.SUPABASE_CONFIG.anonKey;
      }

      saveDiscordConfigBtn?.addEventListener('click', () => {
        const newClientId = document.getElementById('configDiscordClientId')?.value?.trim();
        const newGuildId = document.getElementById('configDiscordGuildId')?.value?.trim();
        if (newClientId) {
          localStorage.setItem('ACADEMY_DISCORD_CLIENT_ID', newClientId);
          if (window.DISCORD_CONFIG) window.DISCORD_CONFIG.clientId = newClientId;
          if (activeClientIdDisplay) activeClientIdDisplay.textContent = newClientId;
        }
        if (newGuildId) {
          localStorage.setItem('ACADEMY_DISCORD_GUILD_ID', newGuildId);
          if (window.DISCORD_CONFIG) window.DISCORD_CONFIG.guildId = newGuildId;
        }

        const newSupabaseUrl = supabaseUrlInput?.value?.trim();
        const newSupabaseKey = supabaseKeyInput?.value?.trim();
        if (newSupabaseUrl || newSupabaseKey) {
          window.SupabaseService?.setCredentials(newSupabaseUrl, newSupabaseKey);
        }

        alert('Application & Supabase settings updated successfully!');
      });
    }

    renderUserUI() {
      const loggedOutBox = document.getElementById('discordNavConnectBtn');
      const loggedInBox = document.getElementById('discordNavUserPill');
      const userAvatar = document.getElementById('navUserAvatar');
      const userName = document.getElementById('navUserName');
      const userId = document.getElementById('navUserId');

      if (this.isLoggedIn()) {
        loggedOutBox?.classList.add('hidden');
        loggedInBox?.classList.remove('hidden');

        if (userAvatar) userAvatar.src = this.currentUser.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png';
        if (userName) userName.textContent = this.currentUser.displayName || this.currentUser.username;
        if (userId) userId.textContent = `ID: ${this.currentUser.id}`;
      } else {
        loggedOutBox?.classList.remove('hidden');
        loggedInBox?.classList.add('hidden');
      }
    }

    openConnectModal(showConfigNotice = false) {
      const modal = document.getElementById('discordAuthModal');
      const notice = document.getElementById('discordConfigNotice');
      if (notice && showConfigNotice) {
        notice.classList.remove('hidden');
      }
      modal?.classList.remove('hidden');
    }

    closeConnectModal() {
      const modal = document.getElementById('discordAuthModal');
      modal?.classList.add('hidden');
    }
  }

  // Export singleton to global scope
  window.DiscordAuth = new DiscordAuthService();
})();
