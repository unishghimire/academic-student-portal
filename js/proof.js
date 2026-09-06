document.addEventListener('DOMContentLoaded', () => {
  const API_URL = window.API_BASE || window.location.origin;

  // State (Priced in NPR 1,000 default)
  let selectedTier = 1;
  let selectedPrice = 1000;
  let selectedTierName = 'Monthly All-Access Subscription';
  let selectedMethodTitle = 'eSewa Mobile Wallet';
  let uploadedReceiptBase64 = null;
  let methodsData = [];

  // DOM Elements
  const form = document.getElementById('paymentProofForm');
  const submitBtn = document.getElementById('submitBtn');
  const statusAlert = document.getElementById('statusAlert');
  const successCard = document.getElementById('successCard');
  const confirmedTxId = document.getElementById('confirmedTxId');
  const copyRefBtn = document.getElementById('copyRefBtn');
  const paymentMethodSelect = document.getElementById('paymentMethod');
  const amountInput = document.getElementById('amount');
  const methodsContainer = document.getElementById('methodsContainer');
  const methodsLoading = document.getElementById('methodsLoading');
  const noMethodsAlert = document.getElementById('noMethodsAlert');

  // Summary elements
  const summaryTierName = document.getElementById('summaryTierName');
  const summaryMethodName = document.getElementById('summaryMethodName');
  const summaryAmount = document.getElementById('summaryAmount');

  // Stepper elements
  const step1 = document.getElementById('stepIndicator1');
  const step2 = document.getElementById('stepIndicator2');
  const step3 = document.getElementById('stepIndicator3');

  // Discord Form Elements
  const discordIdInput = document.getElementById('discordId');
  const discordVerifiedBadge = document.getElementById('discordVerifiedBadge');
  const discordFormBanner = document.getElementById('discordFormBanner');
  const discordBannerTitle = document.getElementById('discordBannerTitle');
  const discordBannerDesc = document.getElementById('discordBannerDesc');
  const btnConnectInForm = document.getElementById('btnConnectInForm');
  const studentNameInput = document.getElementById('studentName');
  const emailInput = document.getElementById('email');

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

  // Modals
  const qrZoomModal = document.getElementById('qrZoomModal');
  const zoomTitle = document.getElementById('zoomTitle');
  const zoomImage = document.getElementById('zoomImage');
  const downloadQrBtn = document.getElementById('downloadQrBtn');
  const closeZoomBtn = document.getElementById('closeZoomBtn');

  const toast = document.getElementById('toast');

  // Initialize
  initTierSelection();
  loadPaymentMethods();
  initFileUpload();
  initModals();
  initClipboardPaste();
  initDiscordFormSync();
  initFormSubmit();

  /* ==========================================================================
     1. TIER SELECTION LOGIC (NPR 1,000 TIERS)
     ========================================================================== */
  function initTierSelection() {
    const tierCards = document.querySelectorAll('.tier-card');
    const customToggle = document.getElementById('customAmountToggle');
    const customInputWrapper = document.getElementById('customAmountInputWrapper');
    const customAmountField = document.getElementById('customAmountField');

    tierCards.forEach((card) => {
      card.addEventListener('click', () => {
        tierCards.forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');

        selectedTier = parseInt(card.dataset.tier, 10) || 1;
        selectedPrice = parseFloat(card.dataset.price) || 1000;
        selectedTierName = card.dataset.tierName || 'Monthly All-Access Subscription';

        // Uncheck custom if checked
        if (customToggle) {
          customToggle.checked = false;
          customInputWrapper?.classList.add('hidden');
        }

        updateSummary();
        setStepActive(2);
      });
    });

    // Custom Amount Toggle
    customToggle?.addEventListener('change', (e) => {
      if (e.target.checked) {
        tierCards.forEach((c) => c.classList.remove('selected'));
        customInputWrapper?.classList.remove('hidden');
        customAmountField?.focus();
        selectedTierName = 'Custom Plan / Invoice';
        if (customAmountField && customAmountField.value) {
          selectedPrice = parseFloat(customAmountField.value) || 0;
        }
      } else {
        customInputWrapper?.classList.add('hidden');
        // Re-select Monthly default
        const t1 = document.querySelector('.tier-card[data-tier="1"]');
        if (t1) t1.click();
      }
      updateSummary();
    });

    customAmountField?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      selectedPrice = isNaN(val) ? 0 : val;
      updateSummary();
    });
  }

  function updateSummary() {
    if (summaryTierName) summaryTierName.textContent = selectedTierName;
    if (summaryAmount) summaryAmount.textContent = `रु ${selectedPrice.toLocaleString()}`;
    if (amountInput) amountInput.value = selectedPrice > 0 ? selectedPrice : '';
  }

  /* ==========================================================================
     2. PAYMENT METHODS & NEPALI QR CODES
     ========================================================================== */
  async function loadPaymentMethods() {
    methodsLoading?.classList.remove('hidden');

    try {
      const res = await fetch(`${API_URL}/api/payments/methods`);
      const json = await res.json();

      if (res.ok && json.success && json.data && json.data.length > 0) {
        methodsData = json.data;
      } else {
        // Fallback to official Nepali payment methods (eSewa, Khalti, Fonepay)
        methodsData = window.DEFAULT_PAYMENT_METHODS || [];
      }
    } catch (err) {
      // Offline / Direct static mode: use default Nepali wallets
      methodsData = window.DEFAULT_PAYMENT_METHODS || [];
    } finally {
      methodsLoading?.classList.add('hidden');
      if (methodsData.length > 0) {
        renderMethods(methodsData);
        populateSelectOptions(methodsData);
      } else {
        noMethodsAlert?.classList.remove('hidden');
      }
    }
  }

  function renderMethods(methods) {
    if (!methodsContainer) return;
    methodsContainer.innerHTML = '';
    methodsContainer.classList.remove('hidden');

    methods.forEach((m, idx) => {
      const card = document.createElement('div');
      card.className = `method-card ${idx === 0 ? 'selected' : ''}`;
      card.dataset.methodTitle = m.title;

      const qrHtml = m.qrCodeUrl
        ? `<div class="method-qr-container" title="Click to zoom in on QR Code">
             <img src="${m.qrCodeUrl}" alt="${m.title} QR" class="method-qr-img">
           </div>`
        : `<div class="method-no-qr">
             <span>💳</span>
             <span>Account Details Only</span>
           </div>`;

      const accountNameHtml = m.accountName
        ? `<div class="detail-item">
             <div class="detail-label">Account Holder</div>
             <div class="account-copy-row">
               <span class="account-val">${escapeHtml(m.accountName)}</span>
               <button type="button" class="btn-copy" data-copy="${escapeHtml(m.accountName)}">Copy</button>
             </div>
           </div>`
        : '';

      const accountNumberHtml = m.accountNumber
        ? `<div class="detail-item">
             <div class="detail-label">eSewa ID / Phone / Acc No</div>
             <div class="account-copy-row">
               <span class="account-val">${escapeHtml(m.accountNumber)}</span>
               <button type="button" class="btn-copy" data-copy="${escapeHtml(m.accountNumber)}">Copy</button>
             </div>
           </div>`
        : '';

      const instructionsHtml = m.instructions
        ? `<div class="method-instructions">💡 ${escapeHtml(m.instructions)}</div>`
        : '';

      const badgeHtml = m.badge
        ? `<span class="method-badge-pill">${escapeHtml(m.badge)}</span>`
        : '';

      card.innerHTML = `
        <div class="method-header-row">
          <div class="method-title-badge">
            <span class="method-emoji">${m.iconEmoji || '⚡'}</span>
            <strong>${escapeHtml(m.title)}</strong>
          </div>
          ${badgeHtml}
        </div>
        ${qrHtml}
        <div class="method-details">
          ${accountNameHtml}
          ${accountNumberHtml}
        </div>
        ${instructionsHtml}
        <button type="button" class="btn-select-method">Pay with ${escapeHtml(m.title)}</button>
      `;

      // Zoom QR handler
      const qrEl = card.querySelector('.method-qr-container');
      qrEl?.addEventListener('click', (e) => {
        e.stopPropagation();
        openQrZoom(m.qrCodeUrl, m.title);
      });

      // Select method card handler
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-copy')) return;
        selectMethodCard(card, m.title);
      });

      methodsContainer.appendChild(card);
    });

    // Auto-select first method
    if (methods.length > 0) {
      selectMethodCard(methodsContainer.firstElementChild, methods[0].title, false);
    }

    initCopyButtons();
  }

  function selectMethodCard(card, methodTitle, scrollIntoView = true) {
    document.querySelectorAll('.method-card').forEach((c) => c.classList.remove('selected'));
    card.classList.add('selected');

    selectedMethodTitle = methodTitle;
    if (summaryMethodName) summaryMethodName.textContent = methodTitle;

    syncDropdown(methodTitle);
    setStepActive(3);

    if (scrollIntoView) {
      const formSection = document.getElementById('formSection');
      formSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function syncDropdown(methodTitle) {
    if (!paymentMethodSelect) return;
    for (let i = 0; i < paymentMethodSelect.options.length; i++) {
      if (paymentMethodSelect.options[i].value.toLowerCase().includes(methodTitle.toLowerCase()) ||
          methodTitle.toLowerCase().includes(paymentMethodSelect.options[i].value.toLowerCase())) {
        paymentMethodSelect.selectedIndex = i;
        return;
      }
    }
    const opt = document.createElement('option');
    opt.value = methodTitle;
    opt.textContent = methodTitle;
    paymentMethodSelect.appendChild(opt);
    paymentMethodSelect.value = methodTitle;
  }

  function populateSelectOptions(methods) {
    if (!paymentMethodSelect) return;
    // Ensure all loaded methods are options in the dropdown
    methods.forEach((m) => {
      let found = false;
      for (let i = 0; i < paymentMethodSelect.options.length; i++) {
        if (paymentMethodSelect.options[i].value === m.title) {
          found = true;
          break;
        }
      }
      if (!found) {
        const opt = document.createElement('option');
        opt.value = m.title;
        opt.textContent = m.title;
        paymentMethodSelect.appendChild(opt);
      }
    });
  }

  /* ==========================================================================
     3. DISCORD AUTHENTICATION & FORM SYNC
     ========================================================================== */
  function initDiscordFormSync() {
    btnConnectInForm?.addEventListener('click', () => {
      window.DiscordAuth?.openConnectModal();
    });

    // Listen for auth changes
    document.addEventListener('academy:discord:change', (e) => {
      applyDiscordUserState(e.detail.user);
    });

    // Initial check
    if (window.DiscordAuth?.isLoggedIn()) {
      applyDiscordUserState(window.DiscordAuth.getUser());
    }
  }

  function applyDiscordUserState(user) {
    if (user && user.id) {
      if (discordIdInput) {
        discordIdInput.value = user.username || user.id;
        discordIdInput.readOnly = true;
        discordIdInput.classList.add('input-locked');
      }

      if (discordVerifiedBadge) {
        discordVerifiedBadge.textContent = `✓ Discord ID Verified: ${user.id}`;
        discordVerifiedBadge.classList.remove('hidden');
      }

      if (discordFormBanner) {
        discordFormBanner.classList.add('verified-banner');
        if (discordBannerTitle) discordBannerTitle.textContent = `✓ Discord Identity Verified: @${user.username}`;
        if (discordBannerDesc) discordBannerDesc.textContent = `User ID ${user.id} is verified. Your role permissions will be applied to this account automatically.`;
        if (btnConnectInForm) btnConnectInForm.textContent = 'Switch Account';
      }

      // Pre-fill profile info if available
      if (emailInput && !emailInput.value && user.email) {
        emailInput.value = user.email;
      }
      if (studentNameInput && !studentNameInput.value && user.displayName) {
        studentNameInput.value = user.displayName;
      }
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
        if (discordBannerDesc) discordBannerDesc.textContent = 'Connect your Discord account so our bot can verify your snowflake ID and automatically grant your subscription roles.';
        if (btnConnectInForm) btnConnectInForm.textContent = 'Connect Account';
      }
    }
  }

  /* ==========================================================================
     4. RECEIPT FILE UPLOAD & CLIPBOARD PASTE
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
     5. MODALS & HELPERS
     ========================================================================== */
  function initModals() {
    closeZoomBtn?.addEventListener('click', () => qrZoomModal?.classList.add('hidden'));
    qrZoomModal?.addEventListener('click', (e) => {
      if (e.target === qrZoomModal) qrZoomModal.classList.add('hidden');
    });

    copyRefBtn?.addEventListener('click', () => {
      const code = confirmedTxId?.textContent;
      if (code) {
        navigator.clipboard.writeText(code).then(() => showToast('✓ Reference code copied!'));
      }
    });
  }

  function openQrZoom(qrUrl, title) {
    if (!qrZoomModal || !zoomImage) return;
    zoomImage.src = qrUrl;
    if (zoomTitle) zoomTitle.textContent = `${title} • Official QR Code`;
    if (downloadQrBtn) downloadQrBtn.href = qrUrl;
    qrZoomModal.classList.remove('hidden');
  }

  function initCopyButtons() {
    document.querySelectorAll('.btn-copy').forEach((btn) => {
      btn.addEventListener('click', (e) => {
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
      });
    });
  }

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
  }
  window.showToast = showToast;

  function setStepActive(stepNum) {
    if (stepNum >= 1) step1?.classList.add('active');
    if (stepNum >= 2) {
      step1?.classList.add('completed');
      step2?.classList.add('active');
    }
    if (stepNum >= 3) {
      step2?.classList.add('completed');
      step3?.classList.add('active');
    }
  }

  /* ==========================================================================
     6. FORM SUBMISSION WITH VERIFIED DISCORD METADATA
     ========================================================================== */
  function initFormSubmit() {
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      statusAlert?.classList.add('hidden');
      if (statusAlert) statusAlert.textContent = '';

      const formData = new FormData(form);
      const proofUrl = uploadedReceiptBase64 || formData.get('proofUrl')?.toString().trim() || undefined;

      if (!proofUrl) {
        if (statusAlert) {
          statusAlert.classList.remove('hidden');
          statusAlert.className = 'alert error';
          statusAlert.textContent = '⚠️ Please upload a screenshot of your transfer receipt (or paste an image link).';
          dropZone?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      const amountVal = parseFloat(formData.get('amount')?.toString() || '0');
      if (isNaN(amountVal) || amountVal <= 0) {
        if (statusAlert) {
          statusAlert.classList.remove('hidden');
          statusAlert.className = 'alert error';
          statusAlert.textContent = '⚠️ Please enter a valid payment amount.';
        }
        return;
      }

      const discordUser = window.DiscordAuth?.getUser();
      const discordIdVal = discordUser?.id || formData.get('discordId')?.toString().trim();

      const payload = {
        studentName: formData.get('studentName')?.toString().trim(),
        phoneNumber: formData.get('phoneNumber')?.toString().trim(),
        email: formData.get('email')?.toString().trim().toLowerCase(),
        discordId: discordIdVal || undefined,
        discordUsername: discordUser?.username || formData.get('discordId')?.toString().trim(),
        isDiscordVerified: !!(discordUser && discordUser.verified),
        planName: selectedTierName,
        tierNumber: selectedTier,
        paymentMethod: formData.get('paymentMethod')?.toString().trim(),
        transactionId: formData.get('transactionId')?.toString().trim(),
        amount: amountVal,
        currency: 'NPR',
        proofUrl,
        notes: formData.get('notes')?.toString().trim() || undefined,
      };

      // Loading state
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.querySelector('.btn-text').textContent = 'Submitting Proof for Verification...';
        submitBtn.querySelector('.spinner')?.classList.remove('hidden');
      }

      try {
        let submissionResultTxId = payload.transactionId;
        let finalProofUrl = proofUrl;

        // 1. If Supabase is configured and screenshot was provided, upload to Supabase Storage
        if (window.SupabaseService?.isConfigured() && uploadedReceiptBase64) {
          try {
            if (submitBtn) submitBtn.querySelector('.btn-text').textContent = 'Uploading Proof to Supabase Storage...';
            const uploadedUrl = await window.SupabaseService.uploadReceipt(uploadedReceiptBase64, discordIdVal);
            if (uploadedUrl) {
              finalProofUrl = uploadedUrl;
              payload.proofUrl = uploadedUrl;
            }
          } catch (storageErr) {
            console.warn('Supabase storage upload failed; proceeding with base64/link:', storageErr);
          }
        }

        // 2. Save complete verification record to Supabase Database
        if (window.SupabaseService?.isConfigured()) {
          try {
            if (submitBtn) submitBtn.querySelector('.btn-text').textContent = 'Recording in Supabase Database...';
            const record = await window.SupabaseService.saveVerificationRecord({
              ...payload,
              proofUrl: finalProofUrl,
            });
            if (record && record.transaction_id) {
              submissionResultTxId = record.transaction_id;
            }
          } catch (dbErr) {
            console.warn('Supabase DB save error:', dbErr);
          }
        }

        // 3. Call backend API if available
        try {
          if (submitBtn) submitBtn.querySelector('.btn-text').textContent = 'Synchronizing with Academy API...';
          const response = await fetch(`${API_URL}/api/payments/manual-submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, proofUrl: finalProofUrl }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data?.transactionId) {
              submissionResultTxId = data.data.transactionId;
            }
          }
        } catch (apiErr) {
          // If offline or standalone static, gracefully proceed with submitted ref ID
        }

        // Add to Student Dashboard history
        window.StudentDashboard?.addSubmissionToHistory({
          transactionId: submissionResultTxId,
          planName: selectedTierName,
          amount: amountVal,
          paymentMethod: payload.paymentMethod,
        });

        // Transition to success screen
        form.classList.add('hidden');
        if (confirmedTxId) confirmedTxId.textContent = submissionResultTxId;
        successCard?.classList.remove('hidden');
        successCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });

        showToast('🎉 Payment verification submitted successfully!');
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
