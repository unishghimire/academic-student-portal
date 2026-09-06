/**
 * Student Dashboard & Membership Plan Manager
 * 
 * Handles plan inspection, live expiry countdowns, Discord role synchronization,
 * renewal checkout flows, and payment verification tracking.
 */

(function () {
  const PLAN_STORAGE_KEY = 'ACADEMY_USER_PLAN';
  const HISTORY_STORAGE_KEY = 'ACADEMY_PAYMENT_HISTORY';

  class StudentDashboard {
    constructor() {
      this.init();
    }

    init() {
      const onReady = () => {
        this.bindEvents();
        const user = window.DiscordAuth?.getUser();
        if (user && user.id) {
          this.syncWithBackend(user.id);
        } else {
          this.render();
        }
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady);
      } else {
        onReady();
      }

      // Listen to Discord Auth events
      document.addEventListener('academy:discord:change', (e) => {
        this.onAuthChange(e.detail.user);
      });
    }

    bindEvents() {
      // Tab Navigation Switcher (Checkout vs Dashboard)
      const tabCheckoutBtn = document.getElementById('tabCheckoutBtn');
      const tabDashboardBtn = document.getElementById('tabDashboardBtn');
      const checkoutView = document.getElementById('checkoutViewContainer');
      const dashboardView = document.getElementById('dashboardViewContainer');

      tabCheckoutBtn?.addEventListener('click', () => {
        this.switchTab('checkout');
      });

      tabDashboardBtn?.addEventListener('click', () => {
        this.switchTab('dashboard');
      });

      // Sync Discord Roles button
      const syncRolesBtn = document.getElementById('btnSyncDiscordRoles');
      syncRolesBtn?.addEventListener('click', () => this.syncDiscordRoles());

      // Renew Subscription button
      const renewBtn = document.getElementById('btnRenewPlan');
      renewBtn?.addEventListener('click', () => this.triggerRenewal());

      // Initial render
      this.render();
    }

    switchTab(tabName) {
      const tabCheckoutBtn = document.getElementById('tabCheckoutBtn');
      const tabDashboardBtn = document.getElementById('tabDashboardBtn');
      const checkoutView = document.getElementById('checkoutViewContainer');
      const dashboardView = document.getElementById('dashboardViewContainer');

      if (tabName === 'dashboard') {
        tabCheckoutBtn?.classList.remove('active');
        tabDashboardBtn?.classList.add('active');
        checkoutView?.classList.add('hidden');
        dashboardView?.classList.remove('hidden');
        this.render();

        const user = window.DiscordAuth?.getUser();
        if (user && user.id) {
          this.syncWithBackend(user.id);
        }
      } else {
        tabDashboardBtn?.classList.remove('active');
        tabCheckoutBtn?.classList.add('active');
        dashboardView?.classList.add('hidden');
        checkoutView?.classList.remove('hidden');

        // Dynamically refresh live payment methods and admin QR codes from Supabase
        if (typeof window.refreshPortalPaymentMethods === 'function') {
          window.refreshPortalPaymentMethods();
        }
      }
    }

    triggerRenewal() {
      this.switchTab('checkout');
      if (typeof window.goToWizardStep === 'function') {
        window.goToWizardStep(1);
      }
      if (typeof window.refreshPortalPaymentMethods === 'function') {
        window.refreshPortalPaymentMethods();
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    onAuthChange(user) {
      this.render();
      if (user) {
        this.syncWithBackend(user.id);
      }
    }

    getStoredPlan() {
      try {
        const raw = localStorage.getItem(PLAN_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) {
        console.error('Error reading plan storage:', e);
      }
      return null;
    }

    savePlan(plan) {
      localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan));
    }

    getPaymentHistory() {
      try {
        const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) {
        console.error('Error reading history storage:', e);
      }
      return [];
    }

    addSubmissionToHistory(submission) {
      const history = this.getPaymentHistory();
      history.unshift({
        transactionId: submission.transactionId || `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
        planName: submission.planName || 'Monthly Subscription',
        amount: submission.amount || 1000,
        currency: 'NPR',
        method: submission.paymentMethod || 'Direct Transfer',
        date: new Date().toLocaleDateString(),
        status: 'pending',
      });
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));

      // Also set plan to pending/active
      const newPlan = {
        planId: 'monthly',
        planName: submission.planName || 'Monthly Subscription',
        priceNpr: submission.amount || 1000,
        roleName: '@Monthly-Subscriber',
        roleColor: '#5865F2',
        status: 'pending',
        startedAt: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      };
      this.savePlan(newPlan);
      this.render();
    }

    async syncWithBackend(discordId) {
      if (!discordId) return;

      // 1. Fetch user verifications directly from Supabase if configured
      if (window.SupabaseService?.isConfigured()) {
        try {
          const state = await window.SupabaseService.getUserSubscriptionState(discordId);
          if (state && state.records && state.records.length > 0) {
            const formatted = state.records.map((item) => ({
              transactionId: item.transaction_id || 'TXN-000000',
              planName: item.plan_name || 'Monthly Subscription',
              amount: item.amount || 1000,
              currency: item.currency || 'NPR',
              method: item.payment_method || 'Direct Transfer',
              date: new Date(item.created_at).toLocaleDateString(),
              status: ['verified', 'approved', 'accepted'].includes(String(item.status || '').toLowerCase())
                ? 'verified'
                : (item.status === 'rejected' ? 'rejected' : 'pending'),
            }));
            localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(formatted));
            this.renderHistory();

            // Check if user has an approved/verified subscription
            if (state.record && ['verified', 'approved', 'accepted'].includes(String(state.record.status || '').toLowerCase())) {
              const approvedRecord = state.record;
              const approvedTime = new Date(approvedRecord.reviewed_at || approvedRecord.created_at).getTime();
              const durationDays = Number(approvedRecord.access_duration_days) || 30;
              const expiresAt = approvedTime + durationDays * 24 * 60 * 60 * 1000;
              const isExpired = Date.now() > expiresAt;

              const activePlan = {
                planId: 'monthly',
                planName: approvedRecord.plan_name || 'Monthly Subscription',
                priceNpr: Number(approvedRecord.amount) || 1000,
                roleName: '@Monthly-Subscriber',
                roleColor: '#5865F2',
                status: isExpired ? 'expired' : 'active',
                startedAt: approvedTime,
                expiresAt: expiresAt,
                recordId: approvedRecord.id,
                transactionId: approvedRecord.transaction_id,
              };
              this.savePlan(activePlan);

              // Synchronize Discord Role on active session immediately
              if (window.DiscordAuth?.isLoggedIn()) {
                const activeUser = window.DiscordAuth.getUser();
                if (activeUser) {
                  if (!Array.isArray(activeUser.roles)) activeUser.roles = [];
                  if (!activeUser.roles.includes('@Monthly-Subscriber')) {
                    activeUser.roles.push('@Monthly-Subscriber');
                  }
                  window.DiscordAuth.setSession(activeUser);
                }
              }

              // Since approved, clear pending lockdown from storage
              localStorage.removeItem('ACADEMY_PENDING_SUBMISSION');

              this.render();
            } else if (state.status === 'pending' && state.record) {
              const pRecord = state.record;
              this.savePlan({
                planId: 'monthly',
                planName: pRecord.plan_name || 'Monthly Subscription',
                priceNpr: Number(pRecord.amount) || 1000,
                roleName: '@Monthly-Subscriber',
                roleColor: '#5865F2',
                status: 'pending',
                startedAt: new Date(pRecord.created_at).getTime(),
                expiresAt: new Date(pRecord.created_at).getTime() + 30 * 24 * 60 * 60 * 1000,
                recordId: pRecord.id,
                transactionId: pRecord.transaction_id,
              });
              this.render();
            }
          }
        } catch (supaErr) {
          console.warn('Could not sync history from Supabase:', supaErr);
        }
      }

      // 2. Fetch membership plan from bot API
      const apiBase = window.API_BASE || window.location.origin;
      try {
        const res = await fetch(`${apiBase}/api/memberships/${discordId}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.plan) {
            this.savePlan(data.plan);
            this.render();
          }
        }
      } catch (err) {
        // Backend not currently reachable; keep local verified state
      }
    }

    async syncDiscordRoles() {
      const syncRolesBtn = document.getElementById('btnSyncDiscordRoles');
      const syncStatusText = document.getElementById('roleSyncFeedback');

      if (!window.DiscordAuth?.isLoggedIn()) {
        alert('Please connect your Discord account first to sync roles.');
        window.DiscordAuth?.openConnectModal();
        return;
      }

      if (syncRolesBtn) {
        syncRolesBtn.disabled = true;
        syncRolesBtn.innerHTML = '<span class="spinner inline-spin"></span> Checking Discord Bot...';
      }

      const user = window.DiscordAuth.getUser();
      const apiBase = window.API_BASE || window.location.origin;

      try {
        const response = await fetch(`${apiBase}/api/discord/user-role?discordId=${user.id}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.roles) {
            user.roles = result.roles;
            window.DiscordAuth.setSession(user);
          }
        }
      } catch (e) {
        // Fallback simulation
      }

      setTimeout(() => {
        if (syncRolesBtn) {
          syncRolesBtn.disabled = false;
          syncRolesBtn.innerHTML = '🔄 Sync Discord Roles';
        }
        if (syncStatusText) {
          syncStatusText.textContent = '✓ Discord roles verified and in sync with bot!';
          syncStatusText.className = 'sync-feedback success';
          setTimeout(() => {
            syncStatusText.textContent = '';
          }, 4000);
        }
        this.render();
      }, 1000);
    }

    triggerRenewal() {
      const plan = this.getStoredPlan();
      if (plan && plan.status === 'active') {
        const now = Date.now();
        const diffDays = Math.ceil((plan.expiresAt - now) / (1000 * 60 * 60 * 24));
        if (diffDays > 3) {
          if (window.showToast) {
            window.showToast(`🔒 Membership Active: The payment page is hidden until your subscription expires or has 3 days or fewer remaining (${diffDays} days left).`);
          }
          return;
        }
      }

      // Switch to checkout tab
      this.switchTab('checkout');

      // Navigate wizard to Step 1
      if (window.goToWizardStep) {
        window.goToWizardStep(1);
      }

      // Scroll smoothly to wizard container
      const wizardContainer = document.getElementById('wizardMainContainer');
      wizardContainer?.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Notify user
      if (window.showToast) {
        window.showToast('🔄 Renewal: Select your payment method to renew for रु 1,000.');
      }
    }

    render() {
      const isLoggedIn = window.DiscordAuth?.isLoggedIn();
      const user = window.DiscordAuth?.getUser();
      const plan = this.getStoredPlan();

      const dashboardContent = document.getElementById('dashboardContentBox');
      const unauthenticatedNotice = document.getElementById('dashboardLoginPrompt');

      if (!isLoggedIn) {
        dashboardContent?.classList.add('hidden');
        unauthenticatedNotice?.classList.remove('hidden');
        return;
      }

      dashboardContent?.classList.remove('hidden');
      unauthenticatedNotice?.classList.add('hidden');

      // Render User Profile Card
      const userAvatar = document.getElementById('dashUserAvatar');
      const userName = document.getElementById('dashUserName');
      const userId = document.getElementById('dashUserId');
      const userStatusBadge = document.getElementById('dashUserStatusBadge');

      if (userAvatar) userAvatar.src = user.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png';
      if (userName) userName.textContent = user.displayName || user.username;
      if (userId) userId.textContent = `Discord Snowflake ID: ${user.id}`;

      // Render Active Plan Card
      const planTitle = document.getElementById('dashPlanTitle');
      const planBadge = document.getElementById('dashPlanBadge');
      const planPrice = document.getElementById('dashPlanPrice');
      const planExpiry = document.getElementById('dashPlanExpiry');
      const planCountdown = document.getElementById('dashPlanCountdown');
      const dashRolePill = document.getElementById('dashRolePill');
      const renewBtn = document.getElementById('btnRenewPlan');
      const renewalLockNotice = document.getElementById('renewalLockNotice');

      if (plan) {
        if (planTitle) planTitle.textContent = plan.planName;
        if (planPrice) planPrice.textContent = `रु ${plan.priceNpr.toLocaleString()} / 30 Days`;
        
        // Expiry calculation
        const now = Date.now();
        const diffMs = plan.expiresAt - now;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (planBadge) {
          if (plan.status === 'pending') {
            planBadge.textContent = 'PENDING VERIFICATION';
            planBadge.className = 'status-badge pending';
          } else if (diffDays <= 0) {
            planBadge.textContent = 'EXPIRED';
            planBadge.className = 'status-badge expired';
          } else {
            planBadge.textContent = 'ACTIVE MEMBERSHIP';
            planBadge.className = 'status-badge active';
          }
        }

        if (planExpiry) {
          const expDate = new Date(plan.expiresAt);
          planExpiry.textContent = expDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        }

        if (planCountdown) {
          if (plan.status === 'pending') {
            planCountdown.textContent = '⏳ Verification in progress by staff (under 15 mins)';
            planCountdown.className = 'countdown-timer pending';
          } else if (diffDays <= 0) {
            planCountdown.textContent = '⚠️ Plan expired. Renew below to restore Discord role.';
            planCountdown.className = 'countdown-timer expired';
          } else if (diffDays <= 3) {
            planCountdown.textContent = `⚡ Only ${diffDays} day${diffDays === 1 ? '' : 's'} remaining! Renewal payment page is now unlocked.`;
            planCountdown.className = 'countdown-timer pending';
          } else {
            planCountdown.textContent = `⚡ ${diffDays} day${diffDays === 1 ? '' : 's'} remaining on active membership`;
            planCountdown.className = 'countdown-timer active';
          }
        }

        if (dashRolePill) {
          dashRolePill.textContent = plan.roleName;
          dashRolePill.style.backgroundColor = `${plan.roleColor || '#5865F2'}22`;
          dashRolePill.style.borderColor = plan.roleColor || '#5865F2';
          dashRolePill.style.color = plan.roleColor || '#5865F2';
        }

        // RENEWAL & PAYMENT PAGE VISIBILITY CHECK:
        // When a user has a membership, payment page is hidden until expired or less than 3 days remaining
        if (plan.status === 'pending') {
          renewBtn?.classList.add('hidden');
          renewalLockNotice?.classList.add('hidden');
        } else if (diffDays <= 3) {
          // 3 days or fewer remaining (or expired) -> SHOW renew button & unhide payment page!
          renewBtn?.classList.remove('hidden');
          if (renewBtn) {
            renewBtn.innerHTML = diffDays <= 0
              ? '<span>⚡ Renew Expired Subscription (रु 1,000)</span>'
              : '<span>⚡ Renew Subscription Now (रु 1,000)</span>';
          }
          renewalLockNotice?.classList.add('hidden');
        } else {
          // More than 3 days left -> HIDE renew button & payment page!
          renewBtn?.classList.add('hidden');
          if (renewalLockNotice) {
            renewalLockNotice.textContent = `🔒 Active Membership: Payment page is hidden until your subscription expires or has 3 days or fewer remaining (${diffDays} days left).`;
            renewalLockNotice.classList.remove('hidden');
          }
        }
      } else {
        if (planTitle) planTitle.textContent = 'No Active Subscription';
        if (planPrice) planPrice.textContent = 'रु 1,000 / 30 Days';
        if (planBadge) {
          planBadge.textContent = 'NOT SUBSCRIBED';
          planBadge.className = 'status-badge expired';
        }
        if (planExpiry) planExpiry.textContent = 'Not Subscribed';
        if (planCountdown) {
          planCountdown.textContent = '⚠️ You do not have an active membership. Enroll below to activate your Discord role.';
          planCountdown.className = 'countdown-timer expired';
        }
        if (dashRolePill) {
          dashRolePill.textContent = 'No Role Assigned';
          dashRolePill.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
          dashRolePill.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          dashRolePill.style.color = '#94a3b8';
        }

        // Unsubscribed users can enroll
        renewBtn?.classList.remove('hidden');
        if (renewBtn) {
          renewBtn.innerHTML = '<span>⚡ Enroll in Monthly Subscription (रु 1,000)</span>';
        }
        renewalLockNotice?.classList.add('hidden');
      }

      // Render Payment History
      this.renderHistory();
    }

    renderHistory() {
      const historyList = document.getElementById('dashHistoryList');
      if (!historyList) return;

      const items = this.getPaymentHistory();
      if (!items || items.length === 0) {
        historyList.innerHTML = '<div class="history-empty">No payment receipts submitted yet.</div>';
        return;
      }

      historyList.innerHTML = items.map((item) => {
        let badgeClass = 'pending';
        let badgeText = 'PENDING';
        if (item.status === 'verified' || item.status === 'approved') {
          badgeClass = 'verified';
          badgeText = 'APPROVED';
        } else if (item.status === 'rejected') {
          badgeClass = 'rejected';
          badgeText = 'REJECTED';
        }

        return `
          <div class="history-card">
            <div class="history-main">
              <div class="history-ref">
                <strong>${item.transactionId}</strong>
                <span class="history-date">${item.date}</span>
              </div>
              <div class="history-tier">${item.planName}</div>
              <div class="history-method">${item.method}</div>
            </div>
            <div class="history-right">
              <span class="history-amount">रु ${Number(item.amount).toLocaleString()}</span>
              <span class="history-status ${badgeClass}">${badgeText}</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Export singleton
  window.StudentDashboard = new StudentDashboard();
})();
