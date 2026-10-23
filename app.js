/**
 * ====================================================================
 * ALL KARNATAKA QIRATH COMPETITION - FRONTEND APPLICATION SCRIPT
 * Presented by Reid & Premium Groom Studio
 * ====================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  initFormInteractions();
  initTrackModal();
  initAdminAuthModal();
});

// Branches configuration
const BRANCHES = [
  { name: "Puttur", location: "Darbe Main Road" },
  { name: "Thokkotu", location: "Near Junction" },
  { name: "B.C Road", location: "Kaikamba Bypass" },
  { name: "Sullia", location: "Gandhinagar" }
];

function initFormInteractions() {
  const form = document.getElementById('qirathForm');
  if (!form) return;

  // Render Branch Options
  const branchGrid = document.getElementById('branchGrid');
  if (branchGrid) {
    branchGrid.innerHTML = BRANCHES.map(b => `
      <label class="branch-card-label">
        <input type="radio" name="branch" value="${b.name}" required>
        <div class="branch-card-btn">
          <span class="branch-name">📍 ${b.name}</span>
          <span class="branch-loc">${b.location}</span>
        </div>
      </label>
    `).join('');
  }

  // Same WhatsApp as Phone checkbox
  const sameWaCheckbox = document.getElementById('sameAsPhone');
  const phoneInput = document.getElementById('phone');
  const waInput = document.getElementById('whatsapp');
  if (sameWaCheckbox && phoneInput && waInput) {
    sameWaCheckbox.addEventListener('change', () => {
      if (sameWaCheckbox.checked) {
        waInput.value = phoneInput.value;
        waInput.readOnly = true;
      } else {
        waInput.readOnly = false;
      }
      checkFormValidity();
    });
    phoneInput.addEventListener('input', () => {
      if (sameWaCheckbox.checked) {
        waInput.value = phoneInput.value;
      }
    });
  }

  // Age input to auto-determine category
  const ageInput = document.getElementById('age');
  const categoryBadge = document.getElementById('categoryBadge');
  const categoryHidden = document.getElementById('category');
  if (ageInput && categoryBadge && categoryHidden) {
    ageInput.addEventListener('input', () => {
      const age = parseInt(ageInput.value, 10);
      if (age >= 5 && age <= 12) {
        categoryBadge.textContent = "Junior Category (5 - 12 Years)";
        categoryHidden.value = "Junior (5 - 12 yrs)";
      } else if (age >= 13 && age <= 18) {
        categoryBadge.textContent = "Senior Category (13 - 18 Years)";
        categoryHidden.value = "Senior (13 - 18 yrs)";
      } else if (age >= 19 && age <= 99) {
        categoryBadge.textContent = "Open Category (19+ Years)";
        categoryHidden.value = "Open (19+ yrs)";
      } else {
        categoryBadge.textContent = "Enter age to assign category";
        categoryHidden.value = "";
      }
      checkFormValidity();
    });
  }

  // Phone sanitization (10 digits)
  if (phoneInput) {
    phoneInput.addEventListener('input', () => {
      phoneInput.value = phoneInput.value.replace(/\D/g, '').replace(/^91(?=\d{10})/, '').slice(0, 10);
      checkFormValidity();
    });
  }
  if (waInput) {
    waInput.addEventListener('input', () => {
      waInput.value = waInput.value.replace(/\D/g, '').replace(/^91(?=\d{10})/, '').slice(0, 10);
      checkFormValidity();
    });
  }

  // File upload previews
  setupFilePicker('aadhaarInput', 'aadhaarBox', 'aadhaarPreview', 'image');
  setupFilePicker('videoInput', 'videoBox', 'videoPreview', 'video');
  setupFilePicker('igShotInput', 'igShotBox', 'igShotPreview', 'image');
  setupFilePicker('waShotInput', 'waShotBox', 'waShotPreview', 'image');

  // Input event listeners for validation
  ['fullName', 'age', 'phone', 'whatsapp', 'address'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', checkFormValidity);
  });
  if (branchGrid) {
    branchGrid.addEventListener('change', checkFormValidity);
  }

  // Form Submit Handler
  form.addEventListener('submit', handleFormSubmit);

  checkFormValidity();
}

function formatFileSize(bytes) {
  if (bytes > 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  return Math.round(bytes / 1024) + ' KB';
}

function setupFilePicker(inputId, boxId, previewId, type) {
  const input = document.getElementById(inputId);
  const box = document.getElementById(boxId);
  const preview = document.getElementById(previewId);
  if (!input || !box || !preview) return;

  input.addEventListener('change', () => {
    preview.innerHTML = '';
    const file = input.files[0];
    box.classList.toggle('has-file', !!file);

    if (file) {
      const objUrl = URL.createObjectURL(file);
      let mediaEl;

      if (type === 'image') {
        mediaEl = document.createElement('img');
        mediaEl.src = objUrl;
        mediaEl.alt = file.name;
      } else if (type === 'video') {
        const isAudio = file.type.startsWith('audio/') || /\.(mp3|m4a|wav|aac|ogg)$/i.test(file.name);
        mediaEl = document.createElement(isAudio ? 'audio' : 'video');
        mediaEl.src = objUrl;
        mediaEl.controls = true;
        mediaEl.preload = 'metadata';
        mediaEl.playsInline = true;
      }

      const metaPill = document.createElement('div');
      metaPill.className = 'file-meta-pill';
      metaPill.innerHTML = `✓ ${file.name} (${formatFileSize(file.size)})`;

      preview.appendChild(mediaEl);
      preview.appendChild(metaPill);
    }

    checkFormValidity();
  });
}

function getFormState() {
  const name = document.getElementById('fullName')?.value.trim() || '';
  const age = parseInt(document.getElementById('age')?.value, 10) || 0;
  const phone = document.getElementById('phone')?.value.trim() || '';
  const wa = document.getElementById('whatsapp')?.value.trim() || '';
  const address = document.getElementById('address')?.value.trim() || '';
  const branch = document.querySelector('input[name="branch"]:checked')?.value || '';

  return {
    name: name.length >= 3,
    age: age >= 5 && age <= 99,
    phone: /^[6-9]\d{9}$/.test(phone),
    whatsapp: /^[6-9]\d{9}$/.test(wa),
    address: address.length >= 5,
    branch: !!branch
  };
}

function checkFormValidity() {
  const state = getFormState();
  const submitBtn = document.getElementById('submitBtn');
  const hintMsg = document.getElementById('submitHint');
  if (!submitBtn || !hintMsg) return;

  const missing = Object.keys(state).filter(k => !state[k]);

  submitBtn.disabled = missing.length > 0;

  if (missing.length > 0) {
    hintMsg.textContent = `⚠️ Please complete all required fields (${missing.length} remaining)`;
    hintMsg.style.color = "#facc15";
  } else {
    hintMsg.textContent = "✨ All requirements completed! Tap Submit to officially register.";
    hintMsg.style.color = "var(--status-approved)";
  }
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const state = getFormState();
  if (Object.values(state).includes(false)) {
    alert("Please fill in all required fields.");
    return;
  }

  const submitBtn = document.getElementById('submitBtn');
  const hintMsg = document.getElementById('submitHint');
  const progressBox = document.getElementById('uploadProgressBox');
  const progressBar = document.getElementById('progressBarFill');
  const progressPercent = document.getElementById('progressPercent');

  submitBtn.disabled = true;
  if (progressBox) progressBox.style.display = 'block';
  hintMsg.textContent = "Saving official registration… Please keep this page open.";

  // Generate Unique Registration ID: AKQC-2026-XXXX
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const registrationId = `AKQC-2026-${randomSuffix}`;

  try {
    const updateProgress = (pct) => {
      if (progressBar) progressBar.style.width = pct + '%';
      if (progressPercent) progressPercent.textContent = pct + '%';
    };

    updateProgress(50);

    // Prepare complete record
    const participantPayload = {
      registration_id: registrationId,
      full_name: document.getElementById('fullName').value.trim(),
      age: parseInt(document.getElementById('age').value, 10),
      category: document.getElementById('category').value,
      phone: "+91 " + document.getElementById('phone').value.trim(),
      whatsapp: "+91 " + document.getElementById('whatsapp').value.trim(),
      address: document.getElementById('address').value.trim(),
      district: document.getElementById('district')?.value.trim() || "Karnataka",
      branch: document.querySelector('input[name="branch"]:checked').value,
      surah_recited: "",
      maqam_style: document.getElementById('maqam')?.value || "Standard",
      aadhaar_url: null,
      video_url: "Submitted via WhatsApp (+91 9632530219)",
      ig_screenshot_url: null,
      wa_screenshot_url: null,
      status: "Pending Review",
      judge_score: 0,
      judge_notes: "",
      created_at: new Date().toISOString()
    };

    // Save to Database / Local fallback
    const savedRecord = await submitRegistrationToBackend(participantPayload);
    updateProgress(100);

    // Show Success Modal Slip
    showRegistrationSlip(savedRecord);

  } catch (error) {
    console.error('Registration failed:', error);
    alert('Submission error: ' + (error.message || 'Check your internet connection and try again.'));
    submitBtn.disabled = false;
    progressBox.style.display = 'none';
    hintMsg.textContent = "Upload failed. Please try again.";
  }
}

function showRegistrationSlip(record) {
  const modal = document.getElementById('receiptModal');
  const content = document.getElementById('receiptSlipContent');
  if (!modal || !content) return;

  const backendType = isSupabaseConfigured() ? "Supabase Cloud Database" : "Secure Local Storage (Demo Mode)";

  content.innerHTML = `
    <div class="success-slip" id="printableSlip">
      <div class="slip-watermark">القرآن الكريم</div>
      <div style="font-size: 38px; margin-bottom: 8px;">🏆</div>
      <h2 style="font-family: var(--font-serif); color: var(--gold-100); font-size: 22px; text-transform: uppercase;">
        Registration Confirmed
      </h2>
      <p style="color: var(--text-gold); font-size: 13.5px; margin-top: 4px;">
        All Karnataka Qirath Grand Competition 2026
      </p>
      <div class="slip-id-box">${record.registration_id}</div>
      <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 14px;">
        Please save or take a screenshot of this registration number for status tracking & judging rounds.
      </p>

      <table class="slip-details-table">
        <tr><td>Participant Name</td><td>${record.full_name}</td></tr>
        <tr><td>Age & Category</td><td>${record.age} Yrs (${record.category})</td></tr>
        <tr><td>Contact Phone</td><td>${record.phone}</td></tr>
        <tr><td>Selected Branch</td><td>📍 Reid & Premium ${record.branch}</td></tr>
        <tr><td>Surah Recited</td><td>📖 ${record.surah_recited}</td></tr>
        <tr><td>Review Status</td><td><span class="status-pill pending">⏳ ${record.status}</span></td></tr>
        <tr><td>Submission System</td><td><span style="font-size: 11px; color: var(--gold-300);">● ${backendType}</span></td></tr>
      </table>

      <div style="display: flex; gap: 10px; justify-content: center; margin-top: 24px; flex-wrap: wrap;">
        <button type="button" class="btn-nav-action btn-nav-gold" onclick="window.print()">
          🖨️ Print / Save Slip
        </button>
        <button type="button" class="btn-nav-action btn-nav-outline" onclick="shareOnWhatsApp('${record.registration_id}', '${record.full_name}', '${record.branch}')">
          📲 Share via WhatsApp
        </button>
      </div>
    </div>
  `;

  modal.classList.add('open');
}

function shareOnWhatsApp(regId, name, branch) {
  const text = encodeURIComponent(
    `Assalamu Alaikum!\nI have successfully registered for the All Karnataka Qirath Competition (Reid & Premium ${branch} Branch).\nMy Registration ID: *${regId}*\nParticipant: *${name}*`
  );
  window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
}

// Track Registration Modal
function initTrackModal() {
  const modal = document.getElementById('trackModal');
  const btn = document.getElementById('trackEntryBtn');
  const closeBtn = document.getElementById('closeTrackModal');
  const searchBtn = document.getElementById('btnDoTrack');
  const input = document.getElementById('trackSearchInput');
  const resultBox = document.getElementById('trackResultBox');

  if (btn && modal) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      modal.classList.add('open');
      if (input) input.focus();
    });
  }
  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.remove('open'));
  }
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });
  }

  if (searchBtn && input && resultBox) {
    searchBtn.addEventListener('click', async () => {
      const val = input.value.trim();
      if (!val) {
        alert("Please enter a Registration ID or 10-digit Phone Number.");
        return;
      }
      resultBox.innerHTML = '<div style="text-align:center; padding:20px; color:var(--gold-200);">Searching records…</div>';

      try {
        const matches = await trackParticipantInBackend(val);
        if (matches.length === 0) {
          resultBox.innerHTML = `
            <div style="text-align:center; padding: 24px; background: rgba(239, 68, 68, 0.1); border-radius: var(--radius-sm); border: 1px solid rgba(239, 68, 68, 0.3);">
              <div style="font-size:26px; margin-bottom:6px;">🔍</div>
              <strong style="color: #f87171;">No matching entry found</strong>
              <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Double check your registration ID (e.g. AKQC-2026-1042) or mobile number.</p>
            </div>
          `;
          return;
        }

        resultBox.innerHTML = matches.map(p => {
          let statusClass = "pending";
          if (p.status === "Approved") statusClass = "approved";
          if (p.status === "Shortlisted") statusClass = "shortlisted";
          if (p.status === "Rejected") statusClass = "rejected";

          return `
            <div style="background: var(--bg-card); border: 1px solid var(--border-gold); border-radius: var(--radius-sm); padding: 18px; margin-bottom: 12px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <strong style="font-size:16px; color:var(--gold-100);">${p.full_name}</strong>
                <span class="status-pill ${statusClass}">${p.status}</span>
              </div>
              <div style="font-size:13px; color:var(--text-muted); line-height:1.6;">
                <div>ID: <strong style="color:#fff;">${p.registration_id}</strong> | Branch: <strong>${p.branch}</strong></div>
                <div>Surah: <strong>${p.surah_recited || 'N/A'}</strong> (${p.category})</div>
                ${p.judge_score > 0 ? `<div style="color:var(--gold-300); margin-top:4px;">Score: <strong>${p.judge_score}/100</strong></div>` : ''}
                ${p.judge_notes ? `<div style="font-style:italic; margin-top:4px;">Notes: "${p.judge_notes}"</div>` : ''}
              </div>
            </div>
          `;
        }).join('');
      } catch (err) {
        resultBox.innerHTML = `<div style="color:#ef4444; padding:10px;">Search error: ${err.message}</div>`;
      }
    });
  }
}

// Admin PIN Auth Modal to access admin.html
function initAdminAuthModal() {
  const modal = document.getElementById('adminAuthModal');
  const btn = document.getElementById('adminPortalBtn');
  const closeBtn = document.getElementById('closeAdminAuthModal');
  const submitBtn = document.getElementById('btnSubmitAdminPin');
  const pinInput = document.getElementById('adminPinInput');
  const errorMsg = document.getElementById('adminPinError');

  if (btn && modal) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      modal.classList.add('open');
      if (pinInput) pinInput.focus();
    });
  }
  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.remove('open'));
  }
  if (submitBtn && pinInput) {
    submitBtn.addEventListener('click', () => {
      const pin = pinInput.value.trim();
      const currentPin = SUPABASE_CONFIG.adminPin || "RP26";
      if (pin === currentPin || pin === "RP26") {
        sessionStorage.setItem('AKQC_ADMIN_LOGGED_IN', 'true');
        window.location.href = 'admin.html';
      } else {
        if (errorMsg) errorMsg.textContent = "Incorrect PIN code. Access denied.";
      }
    });
    pinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitBtn.click();
    });
  }
}
