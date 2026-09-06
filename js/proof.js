/**
 * Academy Student Portal - 4-Step Payment Wizard & Supabase Verification
 * 
 * Flow:
 * Step 1: Choose Payment Method (eSewa, Khalti, Fonepay/Bank)
 * Step 2: Prominent QR Code Pop-up & Transfer Details (with Copy buttons)
 * Step 3: Student Details with Discord OAuth Auto-Fill & Locked Verified ID
 * Step 4: Upload Receipt Screenshot Proof & Review Summary
 * 
 * Post-Submission:
 * Immediate lockdown until approved or rejected by Academy staff in Supabase.
 */

document.addEventListener('DOMContentLoaded', () => {
  const API_URL = window.API_BASE || window.location.origin;

  // Plan Constants (Single Monthly Subscription Plan)
  const PLAN_NAME = 'Monthly Subscription';
  const PLAN_PRICE = 1000;
  const PLAN_TIER = 1;
  const PLAN_CURRENCY = 'NPR';
  const PENDING_STORAGE_KEY = 'ACADEMY_PENDING_SUBMISSION';

  // Wizard State
  let currentWizardStep = 1;
  let selectedMethod = null;
  let uploadedReceiptBase64 = null;
  let methodsData = [];

  // Stepper Elements
  const stepIndicators = [
    document.getElementById('stepIndicator1'),
    document.getElementById('stepIndicator2'),
    document.getElementById('stepIndicator3'),
    document.getElementById('stepIndicator4')
  ];

  // Wizard Panels
  const wizardPanels = [
    document.getElementById('wizardStep1'),
    document.getElementById('wizardStep2'),
    document.getElementById('wizardStep3'),
    document.getElementById('wizardStep4')
  ];

  const wizardMainContainer = document.getElementById('wizardMainContainer');
  const pendingLockdownCard = document.getElementById('pendingLockdownCard');
  const activeMembershipCard = document.getElementById('activeMembershipCard');
  const activeCardExpiry = document.getElementById('activeCardExpiry');
  const activeCardDaysLeft = document.getElementById('activeCardDaysLeft');
  const btnRefreshActiveStatus = document.getElementById('btnRefreshActiveStatus');
  const lockdownTxId = document.getElementById('lockdownTxId');
  const lockdownMethod = document.getElementById('lockdownMethod');
  const lockdownProofWrapper = document.getElementById('lockdownProofWrapper');
  const lockdownProofImg = document.getElementById('lockdownProofImg');
  const lockdownRejectionNotice = document.getElementById('lockdownRejectionNotice');
  const btnCheckLockdownStatus = document.getElementById('btnCheckLockdownStatus');

  // Step 1 Elements
  const methodsContainer = document.getElementById('methodsContainer');
  const btnStep1Next = document.getElementById('btnStep1Next');

  // Step 2 Elements
  const btnStep2Back = document.getElementById('btnStep2Back');
  const btnStep2Next = document.getElementById('btnStep2Next');
  const step2QrImg = document.getElementById('step2QrImg');
  const step2QrClickZone = document.getElementById('step2QrClickZone');
  const step2MethodEmoji = document.getElementById('step2MethodEmoji');
  const step2MethodTitle = document.getElementById('step2MethodTitle');
  const step2AccName = document.getElementById('step2AccName');
  const step2CopyNameBtn = document.getElementById('step2CopyNameBtn');
  const step2AccNumber = document.getElementById('step2AccNumber');
  const step2CopyNumberBtn = document.getElementById('step2CopyNumberBtn');
  const step2Instructions = document.getElementById('step2Instructions');

  // Step 3 Elements
  const btnStep3Back = document.getElementById('btnStep3Back');
  const btnStep3Next = document.getElementById('btnStep3Next');
  const studentNameInput = document.getElementById('studentName');
  const phoneNumberInput = document.getElementById('phoneNumber');
  const emailInput = document.getElementById('email');
  const discordIdInput = document.getElementById('discordId');
  const discordVerifiedBadge = document.getElementById('discordVerifiedBadge');
  const transactionIdInput = document.getElementById('transactionId');
  const step3Alert = document.getElementById('step3Alert');
  const discordFormBanner = document.getElementById('discordFormBanner');
  const discordBannerTitle = document.getElementById('discordBannerTitle');
  const discordBannerDesc = document.getElementById('discordBannerDesc');
  const btnConnectInForm = document.getElementById('btnConnectInForm');

  // Step 4 Elements
  const btnStep4Back = document.getElementById('btnStep4Back');
  const form = document.getElementById('paymentProofForm');
  const submitBtn = document.getElementById('submitBtn');
  const statusAlert = document.getElementById('statusAlert');
  const summaryTierName = document.getElementById('summaryTierName');
  const summaryMethodName = document.getElementById('summaryMethodName');
  const summaryAmount = document.getElementById('summaryAmount');
  const summaryDiscordId = document.getElementById('summaryDiscordId');
  const paymentMethodHidden = document.getElementById('paymentMethod');
  const amountHidden = document.getElementById('amount');

  // File Upload Elements
  const dropZone = document.getElementById('dropZone');
  const receiptFileInput = document.getElementById('receiptFileInput');
  const dropZoneContent = document.getElementById('dropZoneContent');
  const receiptPreviewContainer = document.getElementById('receiptPreviewContainer');
  const receiptPreviewImg = document.getElementById('receiptPreviewImg');
  const previewFileName = document.getElementById('previewFileName');
  const previewFileSize = document.getElementById('previewFileSize');
  const removeReceiptBtn = document.getElementById('removeReceiptBtn');
  const proofUrlInput = document.getElementById('proofUrl');

  // Modals & Notifications
  const qrZoomModal = document.getElementById('qrZoomModal');
  const zoomTitle = document.getElementById('zoomTitle');
  const zoomImage = document.getElementById('zoomImage');
  const downloadQrBtn = document.getElementById('downloadQrBtn');
  const closeZoomBtn = document.getElementById('closeZoomBtn');
  const toast = document.getElementById('toast');

  // Initialize
  initWizardNavigation();
  loadPaymentMethods();
  initDiscordFormSync();
  initFileUpload();
  initClipboardPaste();
  initModals();
  initFormSubmit();
  initLockdownCheck();

  /* ==========================================================================
     1. WIZARD STEP NAVIGATION
     ========================================================================== */
  function initWizardNavigation() {
    // Step 1 -> 2
    btnStep1Next?.addEventListener('click', () => {
      if (!selectedMethod && methodsData.length > 0) {
        selectMethod(methodsData[0]);
      }
      if (!selectedMethod) {
        alert('Please select a payment method to continue.');
        return;
      }
      populateStep2(selectedMethod);
      goToWizardStep(2);
    });

    // Step 2 Back & Next
    btnStep2Back?.addEventListener('click', () => {
      goToWizardStep(1);
    });

    btnStep2Next?.addEventListener('click', () => {
      goToWizardStep(3);
    });

    // Step 3 Back & Next
    btnStep3Back?.addEventListener('click', () => {
      goToWizardStep(2);
    });

    btnStep3Next?.addEventListener('click', () => {
      if (validateStep3()) {
        updateStep4Summary();
        goToWizardStep(4);
      }
    });

    // Step 4 Back
    btnStep4Back?.addEventListener('click', () => {
      goToWizardStep(3);
    });
  }

  function goToWizardStep(stepNumber) {
    if (stepNumber < 1 || stepNumber > 4) return;
    currentWizardStep = stepNumber;

    // Update Stepper Indicators
    stepIndicators.forEach((indicator, idx) => {
      if (!indicator) return;
      const num = idx + 1;
      indicator.classList.remove('active', 'completed');
      if (num < stepNumber) {
        indicator.classList.add('completed');
      } else if (num === stepNumber) {
        indicator.classList.add('active');
      }
    });

    // Update Wizard Panels
    wizardPanels.forEach((panel, idx) => {
      if (!panel) return;
      const num = idx + 1;
      if (num === stepNumber) {
        panel.classList.remove('hidden');
        panel.classList.add('active');
      } else {
        panel.classList.add('hidden');
        panel.classList.remove('active');
      }
    });

    // Smooth scroll to top of wizard
    if (wizardMainContainer && window.scrollY > 250) {
      wizardMainContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  window.goToWizardStep = goToWizardStep;

  /* ==========================================================================
     2. PAYMENT METHODS & NEPALI QR DISPLAY
     ========================================================================== */
  async function loadPaymentMethods() {
    try {
      const res = await fetch(`${API_URL}/api/payments/methods`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
          methodsData = json.data;
        } else {
          methodsData = window.DEFAULT_PAYMENT_METHODS || [];
        }
      } else {
        methodsData = window.DEFAULT_PAYMENT_METHODS || [];
      }
    } catch (err) {
      methodsData = window.DEFAULT_PAYMENT_METHODS || [];
    }

    renderMethods(methodsData);

    // Default to first method (eSewa)
    if (methodsData.length > 0) {
      selectMethod(methodsData[0]);
    }
  }

  function renderMethods(methods) {
    if (!methodsContainer) return;
    methodsContainer.innerHTML = '';

    methods.forEach((m, idx) => {
      const card = document.createElement('div');
      card.className = `method-card ${idx === 0 ? 'selected' : ''}`;
      card.dataset.methodId = m.id;

      const badgeHtml = m.badge
        ? `<span class="method-badge-pill">${escapeHtml(m.badge)}</span>`
        : '';

      const qrThumbHtml = m.qrCodeUrl
        ? `<div class="method-qr-container">
             <img src="${m.qrCodeUrl}" alt="${m.title} QR" class="method-qr-img">
           </div>`
        : '';

      card.innerHTML = `
        <div class="method-header-row">
          <div class="method-title-badge">
            <span class="method-emoji">${m.iconEmoji || '💳'}</span>
            <strong>${escapeHtml(m.title)}</strong>
          </div>
          ${badgeHtml}
        </div>
        ${qrThumbHtml}
        <div class="method-details">
          <div class="detail-item">
            <div class="detail-label">Account Holder</div>
            <span class="account-val">${escapeHtml(m.accountName || 'The Elite Circle Academy')}</span>
          </div>
          <div class="detail-item">
            <div class="detail-label">Account / ID Number</div>
            <span class="account-val">${escapeHtml(m.accountNumber || '')}</span>
          </div>
        </div>
        <button type="button" class="btn-select-method">Select & Scan QR ➔</button>
      `;

      card.addEventListener('click', () => {
        selectMethod(m);
        // Automatically progress to Step 2 for an effortless experience
        populateStep2(m);
        goToWizardStep(2);
      });

      methodsContainer.appendChild(card);
    });

    initCopyButtons();
  }

  function selectMethod(method) {
    selectedMethod = method;
    document.querySelectorAll('.method-card').forEach((c) => {
      if (c.dataset.methodId === method.id) {
        c.classList.add('selected');
      } else {
        c.classList.remove('selected');
      }
    });

    if (paymentMethodHidden) paymentMethodHidden.value = method.title;
    if (summaryMethodName) summaryMethodName.textContent = method.title;
  }

  function populateStep2(method) {
    if (!method) return;

    if (step2QrImg) step2QrImg.src = method.qrCodeUrl || '';
    if (step2MethodEmoji) step2MethodEmoji.textContent = method.iconEmoji || '💳';
    if (step2MethodTitle) step2MethodTitle.textContent = method.title;
    
    if (step2AccName) step2AccName.textContent = method.accountName || 'The Elite Circle Academy';
    if (step2CopyNameBtn) step2CopyNameBtn.dataset.copy = method.accountName || 'The Elite Circle Academy';
    
    if (step2AccNumber) step2AccNumber.textContent = method.accountNumber || '';
    if (step2CopyNumberBtn) step2CopyNumberBtn.dataset.copy = method.accountNumber || '';

    if (step2Instructions) {
      step2Instructions.innerHTML = `💡 <strong>Important:</strong> Enter your <strong>Discord Username</strong> in the transfer remarks. Save/take a screenshot of the completed payment receipt!`;
    }

    // Bind click zone for QR zoom modal
    if (step2QrClickZone) {
      step2QrClickZone.onclick = () => openQrZoom(method.qrCodeUrl, method.title);
    }
  }

  /* ==========================================================================
     3. DISCORD IDENTITY SYNC & STEP 3 VALIDATION
     ========================================================================== */
  function initDiscordFormSync() {
    btnConnectInForm?.addEventListener('click', () => {
      window.DiscordAuth?.openConnectModal();
    });

    document.addEventListener('academy:discord:change', (e) => {
      applyDiscordUserState(e.detail.user);
    });

    if (window.DiscordAuth?.isLoggedIn()) {
      applyDiscordUserState(window.DiscordAuth.getUser());
    }
  }

  function applyDiscordUserState(user) {
    if (user && user.id) {
      if (discordIdInput) {
        discordIdInput.value = user.id;
        discordIdInput.readOnly = true;
        discordIdInput.classList.add('input-locked');
      }
      if (discordVerifiedBadge) {
        discordVerifiedBadge.textContent = `✓ Locked: @${user.username} (${user.id})`;
        discordVerifiedBadge.classList.remove('hidden');
      }
      if (discordFormBanner) {
        discordFormBanner.classList.add('verified-banner');
        if (discordBannerTitle) discordBannerTitle.textContent = `✓ Discord Identity Verified: @${user.username}`;
        if (discordBannerDesc) discordBannerDesc.textContent = `Snowflake ID ${user.id} is verified. Role @Monthly-Subscriber will be assigned to this account upon payment approval.`;
        if (btnConnectInForm) btnConnectInForm.textContent = 'Switch Account';
      }
      if (emailInput && !emailInput.value && user.email) {
        emailInput.value = user.email;
      }
      if (studentNameInput && !studentNameInput.value) {
        studentNameInput.value = user.displayName || user.username || '';
      }

      // Check if user has an active pending verification in Supabase
      checkPendingLockdown(user.id);
    } else {
      if (discordIdInput) {
        discordIdInput.readOnly = false;
        discordIdInput.classList.remove('input-locked');
      }
      if (discordVerifiedBadge) {
        discordVerifiedBadge.classList.add('hidden');
      }
      if (discordFormBanner) {
        discordFormBanner.classList.remove('verified-banner');
        if (discordBannerTitle) discordBannerTitle.textContent = '🔒 Secure Discord ID Verification';
        if (discordBannerDesc) discordBannerDesc.textContent = 'Connect your Discord account to auto-fill your profile and lock in your verified Discord Snowflake ID.';
        if (btnConnectInForm) btnConnectInForm.textContent = 'Connect Account';
      }

      // Guest / Logged out state: ALWAYS exit lockdown mode
      exitLockdownMode();
    }
  }

  function validateStep3() {
    if (step3Alert) {
      step3Alert.classList.add('hidden');
      step3Alert.textContent = '';
    }

    const name = studentNameInput?.value.trim();
    const phone = phoneNumberInput?.value.trim();
    const email = emailInput?.value.trim();
    const discordId = discordIdInput?.value.trim();
    const txn = transactionIdInput?.value.trim();

    if (!name) {
      showStep3Error('Please enter your full student name.', studentNameInput);
      return false;
    }
    if (!phone || phone.length < 8) {
      showStep3Error('Please enter a valid mobile / WhatsApp number (at least 8 digits).', phoneNumberInput);
      return false;
    }
    if (!email || !email.includes('@') || !email.includes('.')) {
      showStep3Error('Please enter a valid email address.', emailInput);
      return false;
    }
    if (!discordId) {
      showStep3Error('Please provide your Discord Username or connect via Discord OAuth above.', discordIdInput);
      return false;
    }
    if (!txn || txn.length < 4) {
      showStep3Error('Please enter the Transaction Reference / ID from your payment confirmation.', transactionIdInput);
      return false;
    }

    return true;
  }

  function showStep3Error(msg, focusEl) {
    if (step3Alert) {
      step3Alert.classList.remove('hidden');
      step3Alert.className = 'alert error';
      step3Alert.textContent = `⚠️ ${msg}`;
    }
    focusEl?.focus();
  }

  function updateStep4Summary() {
    if (summaryTierName) summaryTierName.textContent = PLAN_NAME;
    if (summaryMethodName) summaryMethodName.textContent = selectedMethod ? selectedMethod.title : 'Direct Transfer';
    if (summaryAmount) summaryAmount.textContent = `रु ${PLAN_PRICE.toLocaleString()}`;
    if (summaryDiscordId) summaryDiscordId.textContent = discordIdInput?.value.trim() || 'Not Connected';

    if (amountHidden) amountHidden.value = PLAN_PRICE;
    if (paymentMethodHidden) paymentMethodHidden.value = selectedMethod ? selectedMethod.title : 'Direct Transfer';
  }

  /* ==========================================================================
     4. RECEIPT SCREENSHOT FILE UPLOAD & CLIPBOARD PASTE
     ========================================================================== */
  function initFileUpload() {
    dropZone?.addEventListener('click', (e) => {
      if (e.target !== removeReceiptBtn) {
        receiptFileInput?.click();
      }
    });

    receiptFileInput?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        processReceiptFile(e.target.files[0]);
      }
    });

    removeReceiptBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      clearReceiptFile();
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
      dropZone?.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dropZone?.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
      });
    });

    dropZone?.addEventListener('drop', (e) => {
      if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
        processReceiptFile(e.dataTransfer.files[0]);
      }
    });

    proofUrlInput?.addEventListener('input', (e) => {
      if (e.target.value.trim()) {
        clearReceiptFile();
      }
    });
  }

  function initClipboardPaste() {
    window.addEventListener('paste', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.target.id === 'proofUrl') return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            processReceiptFile(blob, 'pasted_receipt.png');
            showToast('📋 Receipt image pasted from clipboard!');
            break;
          }
        }
      }
    });
  }

  function processReceiptFile(file, overrideName) {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, JPEG, WEBP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds 10MB. Please choose a smaller image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      uploadedReceiptBase64 = event.target.result;
      if (receiptPreviewImg) receiptPreviewImg.src = uploadedReceiptBase64;
      if (previewFileName) previewFileName.textContent = overrideName || file.name || 'receipt_screenshot.png';
      if (previewFileSize) previewFileSize.textContent = formatBytes(file.size);

      dropZoneContent?.classList.add('hidden');
      receiptPreviewContainer?.classList.remove('hidden');

      if (proofUrlInput) proofUrlInput.value = '';
    };
    reader.readAsDataURL(file);
  }

  function clearReceiptFile() {
    uploadedReceiptBase64 = null;
    if (receiptFileInput) receiptFileInput.value = '';
    if (receiptPreviewImg) receiptPreviewImg.src = '';
    receiptPreviewContainer?.classList.add('hidden');
    dropZoneContent?.classList.remove('hidden');
  }

  /* ==========================================================================
     5. FORM SUBMISSION, SUPABASE STORAGE & RECORD CREATION
     ========================================================================== */
  function initFormSubmit() {
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();

      statusAlert?.classList.add('hidden');
      if (statusAlert) statusAlert.textContent = '';

      const proofUrl = uploadedReceiptBase64 || proofUrlInput?.value.trim();
      if (!proofUrl) {
        if (statusAlert) {
          statusAlert.classList.remove('hidden');
          statusAlert.className = 'alert error';
          statusAlert.textContent = '⚠️ Please upload a screenshot of your transfer receipt (or paste an image link).';
          dropZone?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      const discordUser = window.DiscordAuth?.getUser();
      const discordIdVal = discordIdInput?.value.trim() || discordUser?.id || '';

      // PRE-FLIGHT GUARD: Strictly block duplicate submissions if pending or active (>3 days)
      if (window.SupabaseService?.isConfigured() && discordIdVal) {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.querySelector('.btn-text').textContent = 'Validating Subscription Status...';
          submitBtn.querySelector('.spinner')?.classList.remove('hidden');
        }

        try {
          const checkState = await window.SupabaseService.getUserSubscriptionState(discordIdVal);

          if (checkState.status === 'pending') {
            alert(`⚠️ Payment Under Review\n\nYou already have a payment request submitted (Tx: ${checkState.record?.transaction_id || 'PENDING'}).\nMultiple payment submissions are strictly prohibited while a request is pending.`);
            evaluateUserAccess(discordIdVal);
            return;
          }

          if (checkState.status === 'active') {
            alert(`⚠️ Active Subscription Detected\n\nYou currently have an active Monthly Subscription with ${checkState.diffDays} days remaining.\n\nPayment methods and payment QR will only pop up if you have no membership or if your membership has expired.`);
            evaluateUserAccess(discordIdVal);
            return;
          }
        } catch (guardErr) {
          console.warn('Pre-flight validation warning:', guardErr);
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.querySelector('.btn-text').textContent = 'Submit Payment Proof for Verification';
            submitBtn.querySelector('.spinner')?.classList.add('hidden');
          }
        }
      }

      const payload = {
        studentName: studentNameInput?.value.trim() || 'Student',
        phoneNumber: phoneNumberInput?.value.trim() || '',
        email: emailInput?.value.trim().toLowerCase() || '',
        discordId: discordIdVal,
        discordUsername: discordUser?.username || discordIdVal,
        isDiscordVerified: !!(discordUser && discordUser.verified),
        planName: PLAN_NAME,
        tierNumber: PLAN_TIER,
        paymentMethod: selectedMethod ? selectedMethod.title : 'Direct Transfer',
        transactionId: transactionIdInput?.value.trim() || `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
        amount: PLAN_PRICE,
        currency: PLAN_CURRENCY,
        proofUrl: proofUrl,
        notes: document.getElementById('notes')?.value.trim() || undefined,
      };

      // Set button to loading state
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.querySelector('.btn-text').textContent = 'Uploading Receipt & Submitting...';
        submitBtn.querySelector('.spinner')?.classList.remove('hidden');
      }

      try {
        let finalProofUrl = proofUrl;

        // 1. Upload receipt to Supabase Storage if binary base64
        if (window.SupabaseService?.isConfigured() && uploadedReceiptBase64) {
          try {
            if (submitBtn) submitBtn.querySelector('.btn-text').textContent = 'Saving Proof to Supabase Storage...';
            const uploadedUrl = await window.SupabaseService.uploadReceipt(uploadedReceiptBase64, discordIdVal);
            if (uploadedUrl) {
              finalProofUrl = uploadedUrl;
              payload.proofUrl = uploadedUrl;
            }
          } catch (storageErr) {
            console.warn('Supabase storage upload error:', storageErr);
          }
        }

        // 2. Persist record into Supabase Database
        let createdRecord = null;
        if (window.SupabaseService?.isConfigured()) {
          try {
            if (submitBtn) submitBtn.querySelector('.btn-text').textContent = 'Recording in Supabase Database...';
            createdRecord = await window.SupabaseService.saveVerificationRecord({
              ...payload,
              proofUrl: finalProofUrl,
            });
          } catch (dbErr) {
            console.warn('Supabase DB save error:', dbErr);
          }
        }

        // 3. Fallback sync to Bot API if active
        try {
          await fetch(`${API_URL}/api/payments/manual-submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, proofUrl: finalProofUrl }),
          });
        } catch (apiErr) {
          // Silent offline / static mode fallback
        }

        // Save submission details into local pending state
        const pendingData = {
          transactionId: payload.transactionId,
          paymentMethod: payload.paymentMethod,
          proofUrl: finalProofUrl,
          discordId: discordIdVal,
          submittedAt: Date.now(),
          status: 'pending'
        };
        localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(pendingData));

        // Add to Student Dashboard history
        window.StudentDashboard?.addSubmissionToHistory({
          transactionId: payload.transactionId,
          planName: PLAN_NAME,
          amount: PLAN_PRICE,
          paymentMethod: payload.paymentMethod,
        });

        // LOCKDOWN VIEW: User cannot submit duplicate payments until approved or rejected
        evaluateUserAccess(discordIdVal);
        showToast('🎉 Payment verification submitted! Under review by staff.');
      } catch (error) {
        if (statusAlert) {
          statusAlert.classList.remove('hidden');
          statusAlert.className = 'alert error';
          statusAlert.textContent = error.message || 'An unexpected error occurred. Please check your details and try again.';
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.querySelector('.btn-text').textContent = 'Submit Payment Proof for Verification';
          submitBtn.querySelector('.spinner')?.classList.add('hidden');
        }
      }
    });
  }

  /* ==========================================================================
     6. LOCKDOWN MODE LOGIC & REAL-TIME SUPABASE STATUS CHECKS
     ========================================================================== */
  function initLockdownCheck() {
    const user = window.DiscordAuth?.getUser();

    // Fast synchronous pre-check from stored plan to prevent any flash of payment methods/QR
    try {
      const storedPlan = window.StudentDashboard?.getStoredPlan();
      const storedPending = localStorage.getItem(PENDING_STORAGE_KEY);
      if (user && user.id) {
        if (storedPending && JSON.parse(storedPending).status === 'pending') {
          wizardMainContainer?.classList.add('hidden');
          activeMembershipCard?.classList.add('hidden');
          pendingLockdownCard?.classList.remove('hidden');
        } else if (storedPlan && storedPlan.status === 'active' && storedPlan.expiresAt > Date.now()) {
          wizardMainContainer?.classList.add('hidden');
          pendingLockdownCard?.classList.add('hidden');
          activeMembershipCard?.classList.remove('hidden');
        }
      }
    } catch (e) {}

    if (user && user.id) {
      evaluateUserAccess(user.id);
    } else {
      pendingLockdownCard?.classList.add('hidden');
      activeMembershipCard?.classList.add('hidden');
      wizardMainContainer?.classList.remove('hidden');
    }

    // Re-check whenever Discord auth state changes
    document.addEventListener('academy:discord:change', (e) => {
      const authUser = e.detail?.user;
      if (authUser && authUser.id) {
        evaluateUserAccess(authUser.id);
      } else {
        pendingLockdownCard?.classList.add('hidden');
        activeMembershipCard?.classList.add('hidden');
        wizardMainContainer?.classList.remove('hidden');
      }
    });

    // Status check button handler on pending lockdown card
    btnCheckLockdownStatus?.addEventListener('click', async () => {
      await refreshLockdownStatus();
    });

    // Status refresh button handler on active membership card
    btnRefreshActiveStatus?.addEventListener('click', async () => {
      await refreshLockdownStatus();
    });
  }

  async function evaluateUserAccess(discordId) {
    const activeUser = window.DiscordAuth?.getUser();
    const targetId = discordId || activeUser?.id;

    if (!targetId || !window.SupabaseService?.isConfigured()) {
      pendingLockdownCard?.classList.add('hidden');
      activeMembershipCard?.classList.add('hidden');
      wizardMainContainer?.classList.remove('hidden');
      return;
    }

    try {
      const state = await window.SupabaseService.getUserSubscriptionState(targetId);

      if (state.status === 'pending') {
        wizardMainContainer?.classList.add('hidden');
        activeMembershipCard?.classList.add('hidden');
        pendingLockdownCard?.classList.remove('hidden');

        const pRec = state.record;
        if (lockdownTxId) lockdownTxId.textContent = pRec?.transaction_id || 'TXN-PENDING';
        if (lockdownMethod) lockdownMethod.textContent = pRec?.payment_method || 'Direct Transfer';
        if (pRec?.proof_url && lockdownProofImg && lockdownProofWrapper) {
          lockdownProofImg.src = pRec.proof_url;
          lockdownProofWrapper.classList.remove('hidden');
        }
        lockdownRejectionNotice?.classList.add('hidden');
        return;
      }

      if (state.status === 'active') {
        // Active subscription with > 3 days left -> Prevent duplicate payment!
        wizardMainContainer?.classList.add('hidden');
        pendingLockdownCard?.classList.add('hidden');
        activeMembershipCard?.classList.remove('hidden');

        if (activeCardExpiry) {
          activeCardExpiry.textContent = new Date(state.expiresAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
        }
        if (activeCardDaysLeft) {
          activeCardDaysLeft.textContent = `⚡ ${state.diffDays} Days Remaining`;
        }
        return;
      }

      if (state.status === 'rejected') {
        wizardMainContainer?.classList.add('hidden');
        activeMembershipCard?.classList.add('hidden');
        pendingLockdownCard?.classList.remove('hidden');

        if (lockdownRejectionNotice) {
          lockdownRejectionNotice.classList.remove('hidden');
          lockdownRejectionNotice.innerHTML = `
            <h4>❌ Payment Submission Rejected</h4>
            <p>Reason: ${escapeHtml(state.record?.notes || 'Receipt unreadable or transaction reference not found.')}</p>
            <button type="button" class="btn btn-primary btn-sm mt-10" id="btnResubmitAfterReject">
              Re-submit Valid Payment Proof ➔
            </button>
          `;
          document.getElementById('btnResubmitAfterReject')?.addEventListener('click', () => {
            pendingLockdownCard?.classList.add('hidden');
            wizardMainContainer?.classList.remove('hidden');
          });
        }
        return;
      }

      // Renewal available (diffDays <= 3), expired, or none:
      pendingLockdownCard?.classList.add('hidden');
      activeMembershipCard?.classList.add('hidden');
      wizardMainContainer?.classList.remove('hidden');
      if (currentWizardStep === 0) goToWizardStep(1);
    } catch (err) {
      console.warn('Failed to evaluate user access state:', err);
    }
  }

  function enterLockdownMode(data) {
    if (!pendingLockdownCard || !wizardMainContainer) return;

    wizardMainContainer.classList.add('hidden');
    activeMembershipCard?.classList.add('hidden');
    pendingLockdownCard.classList.remove('hidden');

    if (lockdownTxId) lockdownTxId.textContent = data.transactionId || 'TXN-PENDING';
    if (lockdownMethod) lockdownMethod.textContent = data.paymentMethod || 'Direct Transfer';

    if (data.proofUrl && lockdownProofImg && lockdownProofWrapper) {
      lockdownProofImg.src = data.proofUrl;
      lockdownProofWrapper.classList.remove('hidden');
    }

    pendingLockdownCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function exitLockdownMode() {
    pendingLockdownCard?.classList.add('hidden');
    activeMembershipCard?.classList.add('hidden');
    wizardMainContainer?.classList.remove('hidden');
    if (currentWizardStep === 0) goToWizardStep(1);
  }

  async function refreshLockdownStatus() {
    const user = window.DiscordAuth?.getUser();
    if (!user || !user.id) {
      showToast('Please log in with Discord first to check status.');
      exitLockdownMode();
      window.DiscordAuth?.openConnectModal();
      return;
    }

    const spinner = btnCheckLockdownStatus?.querySelector('.spinner') || btnRefreshActiveStatus?.querySelector('.spinner');
    const btnText = btnCheckLockdownStatus?.querySelector('.btn-text') || btnRefreshActiveStatus?.querySelector('.btn-text');

    if (btnCheckLockdownStatus) btnCheckLockdownStatus.disabled = true;
    if (btnRefreshActiveStatus) btnRefreshActiveStatus.disabled = true;
    if (spinner) spinner.classList.remove('hidden');
    if (btnText) btnText.textContent = 'Checking Supabase...';

    try {
      if (window.SupabaseService?.isConfigured()) {
        await window.StudentDashboard?.syncWithBackend(user.id);
        await evaluateUserAccess(user.id);

        const state = await window.SupabaseService.getUserSubscriptionState(user.id);
        if (state.status === 'active') {
          showToast('🎉 Subscription is active! Verified with Discord.');
        } else if (state.status === 'expired') {
          showToast('⚠️ Subscription expired. Payment methods and QR are now unlocked to renew.');
        } else if (state.status === 'pending') {
          showToast('⏳ Payment is still under review by staff.');
        } else {
          showToast('✓ Status synchronized with Supabase.');
        }
      }
    } catch (err) {
      showToast('⚠️ Could not connect to verification server. Please try again.');
    } finally {
      if (btnCheckLockdownStatus) btnCheckLockdownStatus.disabled = false;
      if (btnRefreshActiveStatus) btnRefreshActiveStatus.disabled = false;
      if (spinner) spinner.classList.add('hidden');
      if (btnCheckLockdownStatus?.querySelector('.btn-text')) {
        btnCheckLockdownStatus.querySelector('.btn-text').textContent = '🔄 Check Verification Status';
      }
      if (btnRefreshActiveStatus?.querySelector('.btn-text')) {
        btnRefreshActiveStatus.querySelector('.btn-text').textContent = '🔄 Refresh Status';
      }
    }
  }

  /* ==========================================================================
     7. MODALS, TOASTS & COPY HELPERS
     ========================================================================== */
  function initModals() {
    closeZoomBtn?.addEventListener('click', () => qrZoomModal?.classList.add('hidden'));
    qrZoomModal?.addEventListener('click', (e) => {
      if (e.target === qrZoomModal) qrZoomModal.classList.add('hidden');
    });
  }

  function openQrZoom(qrUrl, title) {
    if (!qrZoomModal || !zoomImage) return;
    zoomImage.src = qrUrl;
    if (zoomTitle) zoomTitle.textContent = `${title} • Official High-Res QR Code`;
    if (downloadQrBtn) downloadQrBtn.href = qrUrl;
    qrZoomModal.classList.remove('hidden');
  }

  function initCopyButtons() {
    document.querySelectorAll('.btn-copy').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const textToCopy = btn.dataset.copy;
        if (textToCopy) {
          navigator.clipboard.writeText(textToCopy).then(() => {
            const originalText = btn.textContent;
            btn.textContent = '✓ Copied!';
            btn.classList.add('copied');
            showToast(`Copied: ${textToCopy}`);
            setTimeout(() => {
              btn.textContent = originalText;
              btn.classList.remove('copied');
            }, 2000);
          });
        }
      };
    });
  }

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3500);
  }
  window.showToast = showToast;

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
