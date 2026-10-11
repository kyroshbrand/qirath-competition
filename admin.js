/**
 * ====================================================================
 * ALL KARNATAKA QIRATH COMPETITION - ADMIN MANAGEMENT CONTROLLER
 * Easy to Manage Dashboard for Reid & Premium Organizers
 * ====================================================================
 */

let allParticipants = [];
let currentFilter = {
  branch: 'All',
  status: 'All',
  category: 'All',
  search: ''
};
let activeReviewParticipant = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Check session authorization
  if (sessionStorage.getItem('AKQC_ADMIN_LOGGED_IN') !== 'true') {
    // If not logged in, prompt or redirect
    const pin = prompt("Enter Admin Access PIN (Password: RP26):");
    const validPin = SUPABASE_CONFIG.adminPin || "RP26";
    if (pin === validPin || pin === "RP26") {
      sessionStorage.setItem('AKQC_ADMIN_LOGGED_IN', 'true');
    } else {
      alert("Unauthorized access. Redirecting to home page.");
      window.location.href = 'index.html';
      return;
    }
  }

  updateBackendIndicator();
  initToolbarFilters();
  initSupabaseSettingsModal();
  await loadAndRenderParticipants();
});

function updateBackendIndicator() {
  const badge = document.getElementById('backendStatusBadge');
  if (!badge) return;

  if (isSupabaseConfigured()) {
    badge.className = "status-pill approved";
    badge.innerHTML = "🟢 Supabase Connected";
    badge.title = "Connected to Supabase live database and storage";
  } else {
    badge.className = "status-pill pending";
    badge.innerHTML = "🟡 Demo / Offline Mode";
    badge.title = "Using local storage. Click Supabase Settings to connect live database.";
  }
}

async function loadAndRenderParticipants() {
  const tableBody = document.getElementById('participantsTableBody');
  if (tableBody) {
    tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--gold-200);">Loading participant records…</td></tr>`;
  }

  try {
    allParticipants = await fetchParticipantsFromBackend();
    renderStatsCounters(allParticipants);
    renderTableRows();
  } catch (err) {
    console.error('Failed to load participants:', err);
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:#ef4444;">Failed to load records: ${err.message}</td></tr>`;
    }
  }
}

function renderStatsCounters(list) {
  const totalEl = document.getElementById('statTotalCount');
  const pendingEl = document.getElementById('statPendingCount');
  const approvedEl = document.getElementById('statApprovedCount');
  const shortlistEl = document.getElementById('statShortlistCount');

  if (totalEl) totalEl.textContent = list.length;
  if (pendingEl) pendingEl.textContent = list.filter(p => p.status === 'Pending Review').length;
  if (approvedEl) approvedEl.textContent = list.filter(p => p.status === 'Approved').length;
  if (shortlistEl) shortlistEl.textContent = list.filter(p => p.status === 'Shortlisted').length;

  // Branch Counters
  const branches = ["Puttur", "Thokkotu", "B.C Road", "Sullia"];
  branches.forEach(b => {
    const el = document.getElementById(`statBranch_${b.replace(/[^a-zA-Z]/g, '')}`);
    if (el) {
      el.textContent = list.filter(p => p.branch === b).length;
    }
  });
}

function getFilteredParticipants() {
  return allParticipants.filter(p => {
    // Branch filter
    if (currentFilter.branch !== 'All' && p.branch !== currentFilter.branch) {
      return false;
    }
    // Status filter
    if (currentFilter.status !== 'All' && p.status !== currentFilter.status) {
      return false;
    }
    // Category filter
    if (currentFilter.category !== 'All' && p.category !== currentFilter.category) {
      return false;
    }
    // Search query
    if (currentFilter.search) {
      const q = currentFilter.search.toLowerCase();
      const matchName = (p.full_name || '').toLowerCase().includes(q);
      const matchId = (p.registration_id || '').toLowerCase().includes(q);
      const matchPhone = (p.phone || '').includes(q);
      const matchSurah = (p.surah_recited || '').toLowerCase().includes(q);
      if (!matchName && !matchId && !matchPhone && !matchSurah) {
        return false;
      }
    }
    return true;
  });
}

function renderTableRows() {
  const tableBody = document.getElementById('participantsTableBody');
  const emptyState = document.getElementById('emptyStateNotice');
  if (!tableBody) return;

  const filtered = getFilteredParticipants();

  if (filtered.length === 0) {
    tableBody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  tableBody.innerHTML = filtered.map(p => {
    let statusClass = "pending";
    if (p.status === "Approved") statusClass = "approved";
    if (p.status === "Shortlisted") statusClass = "shortlisted";
    if (p.status === "Rejected") statusClass = "rejected";

    return `
      <tr>
        <td>
          <strong style="color:var(--gold-200); font-family:monospace; font-size:13.5px;">${p.registration_id}</strong>
          <div style="font-size:11.5px; color:var(--text-muted);">${formatDate(p.created_at)}</div>
        </td>
        <td>
          <strong style="color:#fff; font-size:14.5px;">${escapeHtml(p.full_name)}</strong>
          <div style="font-size:12px; color:var(--text-muted);">${p.age} Yrs • ${p.category}</div>
        </td>
        <td>
          <span style="font-weight:600; color:var(--gold-100);">📍 ${p.branch}</span>
          <div style="font-size:11.5px; color:var(--text-muted); max-width:140px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${escapeHtml(p.address || '')}</div>
        </td>
        <td>
          <div style="font-weight:600; color:#fff;">${p.phone}</div>
          <button class="btn-table-action" style="padding:2px 8px; font-size:11px; margin-top:3px; background:#1f854a; color:#fff; border:none; border-radius:4px; cursor:pointer;" onclick="openWhatsAppChat('${p.phone}', '${escapeHtml(p.full_name)}', '${p.registration_id}', '${p.branch}', '${p.status}')">
            💬 WhatsApp
          </button>
        </td>
        <td>
          <span style="color:var(--text-gold); font-weight:500;">📖 ${escapeHtml(p.surah_recited || 'N/A')}</span>
          ${p.maqam_style ? `<div style="font-size:11.5px; color:var(--text-muted);">Style: ${p.maqam_style}</div>` : ''}
        </td>
        <td>
          <span class="status-pill ${statusClass}">${p.status}</span>
          ${p.judge_score > 0 ? `<div style="font-size:11.5px; color:var(--gold-300); margin-top:3px; font-weight:700;">Score: ${p.judge_score}/100</div>` : ''}
        </td>
        <td>
          <button class="btn-nav-action btn-nav-gold" style="padding:6px 14px; font-size:12px;" onclick="openReviewDossier('${p.registration_id}')">
            🔍 Review Dossier
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

function initToolbarFilters() {
  const searchInput = document.getElementById('tableSearchInput');
  const branchSelect = document.getElementById('filterBranch');
  const statusSelect = document.getElementById('filterStatus');
  const categorySelect = document.getElementById('filterCategory');
  const exportBtn = document.getElementById('btnExportCsv');
  const refreshBtn = document.getElementById('btnRefreshData');

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentFilter.search = searchInput.value.trim();
      renderTableRows();
    });
  }

  if (branchSelect) {
    branchSelect.addEventListener('change', () => {
      currentFilter.branch = branchSelect.value;
      renderTableRows();
    });
  }

  if (statusSelect) {
    statusSelect.addEventListener('change', () => {
      currentFilter.status = statusSelect.value;
      renderTableRows();
    });
  }

  if (categorySelect) {
    categorySelect.addEventListener('change', () => {
      currentFilter.category = categorySelect.value;
      renderTableRows();
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Refreshing…';
      await loadAndRenderParticipants();
      refreshBtn.disabled = false;
      refreshBtn.textContent = '🔄 Refresh';
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', exportParticipantsToCsv);
  }
}

// Open Detailed Review Dossier
function openReviewDossier(regId) {
  const participant = allParticipants.find(p => p.registration_id === regId);
  if (!participant) return;

  activeReviewParticipant = participant;
  const modal = document.getElementById('reviewDossierModal');
  const content = document.getElementById('dossierModalContent');
  if (!modal || !content) return;

  let statusClass = "pending";
  if (participant.status === "Approved") statusClass = "approved";
  if (participant.status === "Shortlisted") statusClass = "shortlisted";
  if (participant.status === "Rejected") statusClass = "rejected";

  content.innerHTML = `
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:24px;">
      <!-- Left Column: Media Review -->
      <div>
        <h4 style="font-family:var(--font-serif); color:var(--gold-200); font-size:16px; margin-bottom:12px; text-transform:uppercase;">
          🎥 Qirath Recitation Video
        </h4>
        <div style="background:#000; border-radius:var(--radius-sm); border:1px solid var(--border-gold); overflow:hidden; margin-bottom:18px;">
          ${(participant.video_url && (participant.video_url.includes('drive.google.com') || participant.video_url.includes('youtu') || !participant.video_url.match(/\.(mp4|mov|webm|avi|mkv|mp3|m4a|wav|aac|ogg)(\?.*)?$/i))) ? `
            <div style="padding:24px 16px; text-align:center; background:#0a1710;">
              <p style="color:var(--gold-200); font-weight:600; font-size:14px; margin-bottom:12px;">🔗 Cloud Video Link (Google Drive / YouTube)</p>
              <a href="${participant.video_url}" target="_blank" rel="noopener noreferrer" class="btn-nav-action btn-nav-gold" style="display:inline-flex; align-items:center; gap:8px; padding:10px 20px; text-decoration:none; font-size:13px;">
                ▶️ Open / Play Video in New Tab
              </a>
              <small style="display:block; color:var(--text-muted); margin-top:10px; font-size:11px; word-break:break-all;">${participant.video_url}</small>
            </div>
          ` : `
            <video src="${participant.video_url}" controls style="width:100%; max-height:280px; display:block;" preload="metadata"></video>
            <div style="padding:8px 12px; background:#07120a; text-align:right;">
              <a href="${participant.video_url}" target="_blank" rel="noopener noreferrer" style="color:var(--gold-200); font-size:11px; text-decoration:none;">⬇️ Open Original Video</a>
            </div>
          `}
        </div>

        <h4 style="font-family:var(--font-serif); color:var(--gold-200); font-size:16px; margin-bottom:12px; text-transform:uppercase;">
          🆔 Aadhaar Card Verification
        </h4>
        <div style="background:#000; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); overflow:hidden; text-align:center; padding:10px; margin-bottom:18px;">
          <img src="${participant.aadhaar_url}" alt="Aadhaar photo" style="max-width:100%; max-height:200px; object-fit:contain; border-radius:4px; cursor:pointer;" onclick="window.open('${participant.aadhaar_url}', '_blank')">
          <small style="color:var(--text-muted); display:block; margin-top:4px;">Click photo to open full resolution</small>
        </div>

        <h4 style="font-family:var(--font-serif); color:var(--gold-200); font-size:16px; margin-bottom:12px; text-transform:uppercase;">
          📱 Follow & Join Screenshots
        </h4>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div style="background:#091710; padding:8px; border-radius:6px; text-align:center; border:1px solid var(--border-subtle);">
            <span style="font-size:11px; color:#e1306c; font-weight:700; display:block; margin-bottom:4px;">Instagram Follow</span>
            <img src="${participant.ig_screenshot_url}" alt="Instagram Proof" style="width:100%; height:120px; object-fit:cover; border-radius:4px; cursor:pointer;" onclick="window.open('${participant.ig_screenshot_url}', '_blank')">
          </div>
          <div style="background:#091710; padding:8px; border-radius:6px; text-align:center; border:1px solid var(--border-subtle);">
            <span style="font-size:11px; color:#25d366; font-weight:700; display:block; margin-bottom:4px;">WhatsApp Channel</span>
            <img src="${participant.wa_screenshot_url}" alt="WhatsApp Proof" style="width:100%; height:120px; object-fit:cover; border-radius:4px; cursor:pointer;" onclick="window.open('${participant.wa_screenshot_url}', '_blank')">
          </div>
        </div>
      </div>

      <!-- Right Column: Participant Dossier & Grading -->
      <div>
        <div style="background:#091710; border:1px solid var(--border-gold); border-radius:var(--radius-md); padding:20px; margin-bottom:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <span class="status-pill ${statusClass}" id="dossierStatusBadge">${participant.status}</span>
            <span style="font-family:monospace; color:var(--gold-300); font-weight:700;">${participant.registration_id}</span>
          </div>
          <h3 style="font-size:20px; color:#fff; font-family:var(--font-serif);">${escapeHtml(participant.full_name)}</h3>
          <p style="color:var(--text-muted); font-size:13px; margin-bottom:14px;">
            ${participant.age} Years • ${participant.category} • Reid & Premium <strong>${participant.branch}</strong> Branch
          </p>

          <table style="width:100%; font-size:13px; line-height:1.8;">
            <tr><td style="color:var(--text-muted); width:35%;">Phone:</td><td><strong style="color:#fff;">${participant.phone}</strong></td></tr>
            <tr><td style="color:var(--text-muted);">WhatsApp:</td><td><strong style="color:#fff;">${participant.whatsapp || participant.phone}</strong></td></tr>
            <tr><td style="color:var(--text-muted);">Address:</td><td style="color:#d8d3c5;">${escapeHtml(participant.address || 'N/A')}, ${escapeHtml(participant.district || '')}</td></tr>
            <tr><td style="color:var(--text-muted);">Surah Recited:</td><td><strong style="color:var(--gold-200);">📖 ${escapeHtml(participant.surah_recited || 'N/A')}</strong></td></tr>
            <tr><td style="color:var(--text-muted);">Recitation Maqam:</td><td style="color:#fff;">${participant.maqam_style || 'Standard'}</td></tr>
          </table>
        </div>

        <!-- Judging & Status Change Box -->
        <div style="background:var(--bg-card); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:20px;">
          <h4 style="font-family:var(--font-serif); color:var(--gold-100); font-size:16px; margin-bottom:14px; text-transform:uppercase;">
            ⚖️ Official Assessment & Action
          </h4>

          <div style="margin-bottom:14px;">
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px; text-transform:uppercase; font-weight:600;">
              Judge Total Score (0 - 100):
            </label>
            <input type="number" id="dossierScoreInput" class="form-control" min="0" max="100" step="0.5" value="${participant.judge_score || ''}" placeholder="e.g. 92.5">
          </div>

          <div style="margin-bottom:16px;">
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px; text-transform:uppercase; font-weight:600;">
              Judge Feedback / Evaluation Notes:
            </label>
            <textarea id="dossierNotesInput" class="form-control" placeholder="Comments on Tajweed, voice control, waqf, pronunciation...">${escapeHtml(participant.judge_notes || '')}</textarea>
          </div>

          <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:8px; text-transform:uppercase; font-weight:600;">
            Update Status:
          </label>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:16px;">
            <button class="btn-nav-action btn-nav-gold" style="justify-content:center; padding:10px;" onclick="saveDossierStatus('Approved')">
              ✅ Approve Entry
            </button>
            <button class="btn-nav-action" style="justify-content:center; padding:10px; background:linear-gradient(135deg, #1d6b43, #22c55e); color:#fff; border:none;" onclick="saveDossierStatus('Shortlisted')">
              🌟 Shortlist for Finale
            </button>
            <button class="btn-nav-action btn-nav-outline" style="justify-content:center; padding:10px;" onclick="saveDossierStatus('Pending Review')">
              ⏳ Keep Pending
            </button>
            <button class="btn-nav-action" style="justify-content:center; padding:10px; background:rgba(239, 68, 68, 0.2); border:1px solid rgba(239, 68, 68, 0.5); color:#f87171;" onclick="saveDossierStatus('Rejected')">
              ❌ Reject Entry
            </button>
          </div>

          <button class="btn-submit-entry" style="padding:12px; font-size:13px; background:#25d366; color:#06140b; border:none;" onclick="openWhatsAppChat('${participant.phone}', '${escapeHtml(participant.full_name)}', '${participant.registration_id}', '${participant.branch}', '${participant.status}')">
            📲 Send WhatsApp Status Update to Participant
          </button>
        </div>
      </div>
    </div>
  `;

  modal.classList.add('open');
}

async function saveDossierStatus(newStatus) {
  if (!activeReviewParticipant) return;

  const score = parseFloat(document.getElementById('dossierScoreInput')?.value) || 0;
  const notes = document.getElementById('dossierNotesInput')?.value.trim() || '';

  try {
    const updates = {
      status: newStatus,
      judge_score: score,
      judge_notes: notes
    };

    await updateParticipantInBackend(activeReviewParticipant.registration_id, updates);

    // Update in local memory
    activeReviewParticipant.status = newStatus;
    activeReviewParticipant.judge_score = score;
    activeReviewParticipant.judge_notes = notes;

    const idx = allParticipants.findIndex(p => p.registration_id === activeReviewParticipant.registration_id);
    if (idx !== -1) {
      allParticipants[idx] = { ...allParticipants[idx], ...updates };
    }

    renderStatsCounters(allParticipants);
    renderTableRows();

    // Update badge in modal
    const badge = document.getElementById('dossierStatusBadge');
    if (badge) {
      badge.textContent = newStatus;
      let statusClass = "pending";
      if (newStatus === "Approved") statusClass = "approved";
      if (newStatus === "Shortlisted") statusClass = "shortlisted";
      if (newStatus === "Rejected") statusClass = "rejected";
      badge.className = `status-pill ${statusClass}`;
    }

    alert(`Successfully updated status to: ${newStatus}`);
  } catch (err) {
    console.error('Failed to update status:', err);
    alert('Error updating status: ' + err.message);
  }
}

function openWhatsAppChat(phone, name, regId, branch, status) {
  const cleanPhone = phone.replace(/\D/g, '');
  let message = "";

  if (status === "Approved") {
    message = `Assalamu Alaikum *${name}*,\n\nCongratulations! Your registration for the *All Karnataka Qirath Competition* (Reid & Premium ${branch} Branch) has been *APPROVED*! ✅\n\nRegistration ID: *${regId}*\nOur judging panel will evaluate your recitation for the Grand Finale shortlist.\n\nBest Regards,\n*Reid & Premium Groom Studio*`;
  } else if (status === "Shortlisted") {
    message = `Assalamu Alaikum *${name}*,\n\n🌟 *GRAND NEWS!* You have been *SHORTLISTED FOR THE GRAND FINALE* of the All Karnataka Qirath Competition!\n\nRegistration ID: *${regId}*\nBranch: *Reid & Premium ${branch}*\n\nOur organizing committee will contact you shortly with the Grand Finale date and venue details. Mabrook!\n\n*Reid & Premium Groom Studio*`;
  } else {
    message = `Assalamu Alaikum *${name}*,\nThis is an official update regarding your All Karnataka Qirath Competition registration (${regId}) with Reid & Premium ${branch} Branch.\nStatus: *${status}*.\n\nBest Regards,\n*Reid & Premium Groom Studio*`;
  }

  window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`, '_blank');
}

// Export Participants to CSV
function exportParticipantsToCsv() {
  const list = getFilteredParticipants();
  if (list.length === 0) {
    alert("No records to export.");
    return;
  }

  const headers = [
    "Registration ID",
    "Full Name",
    "Age",
    "Category",
    "Branch",
    "Phone",
    "WhatsApp",
    "Address",
    "District",
    "Surah Recited",
    "Maqam Style",
    "Status",
    "Judge Score",
    "Judge Notes",
    "Video URL",
    "Aadhaar URL",
    "Registered At"
  ];

  const rows = list.map(p => [
    `"${p.registration_id || ''}"`,
    `"${(p.full_name || '').replace(/"/g, '""')}"`,
    p.age || '',
    `"${p.category || ''}"`,
    `"${p.branch || ''}"`,
    `"${p.phone || ''}"`,
    `"${p.whatsapp || ''}"`,
    `"${(p.address || '').replace(/"/g, '""')}"`,
    `"${(p.district || '').replace(/"/g, '""')}"`,
    `"${(p.surah_recited || '').replace(/"/g, '""')}"`,
    `"${p.maqam_style || ''}"`,
    `"${p.status || ''}"`,
    p.judge_score || 0,
    `"${(p.judge_notes || '').replace(/"/g, '""')}"`,
    `"${p.video_url || ''}"`,
    `"${p.aadhaar_url || ''}"`,
    `"${p.created_at || ''}"`
  ]);

  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `All_Karnataka_Qirath_Participants_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Supabase Settings Modal
function initSupabaseSettingsModal() {
  const modal = document.getElementById('supabaseSettingsModal');
  const openBtn = document.getElementById('btnOpenSupabaseSettings');
  const closeBtn = document.getElementById('closeSupabaseSettingsModal');
  const saveBtn = document.getElementById('btnSaveSupabaseConfig');
  const resetBtn = document.getElementById('btnResetToDemo');
  const urlInput = document.getElementById('supabaseUrlInput');
  const keyInput = document.getElementById('supabaseKeyInput');
  const pinInput = document.getElementById('supabasePinInput');

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => {
      if (urlInput) urlInput.value = localStorage.getItem('AKQC_SUPABASE_URL') || '';
      if (keyInput) keyInput.value = localStorage.getItem('AKQC_SUPABASE_ANON_KEY') || '';
      if (pinInput) pinInput.value = localStorage.getItem('AKQC_ADMIN_PIN') || 'RP26';
      modal.classList.add('open');
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

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const url = urlInput.value.trim();
      const key = keyInput.value.trim();
      const pin = pinInput.value.trim() || 'RP26';

      if (!url || !key) {
        alert("Please enter both Supabase Project URL and Anon Key.");
        return;
      }

      saveSupabaseCredentials(url, key, pin);
      updateBackendIndicator();
      modal.classList.remove('open');
      alert("✅ Supabase credentials saved! Connecting to cloud database now...");
      await loadAndRenderParticipants();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm("Switch back to offline LocalStorage Demo mode?")) {
        resetToDemoMode();
        updateBackendIndicator();
        modal.classList.remove('open');
        await loadAndRenderParticipants();
      }
    });
  }
}
