/**
 * ====================================================================
 * ALL KARNATAKA QIRATH COMPETITION - ADMIN MANAGEMENT CONTROLLER
 * Easy to Manage Dashboard for Reid & Premium Organizers
 * Features: 
 * - Full Dossier Review & Judging Assessment
 * - Permanent Master Template Poster Studio (Auto-Composite Candidate Face in Middle Round)
 * - Safe Delete with Confirmation Modal & 10-Second Undo Timer
 * - Optimized Table Pagination & Search for 1,000+ Participants
 * - Direct WhatsApp Participant Notifications
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

// Pagination state (Optimized for 1,000+ participants)
let currentPage = 1;
const PAGE_SIZE = 50;

// Safe Deletion & Undo State
let pendingDeleteParticipant = null;
let undoDeleteTimer = null;
let undoDeleteCountdownInterval = null;
let undoParticipantData = null;

// Master Poster State
let currentMasterPosterUrl = '';
let currentMasterPosterConfig = {
  box_w: 38,
  box_h: 40,
  box_x: 50,
  box_y: 44.5,
  box_curve: 12,
  show_name: true,
  name_x: 50,
  name_y: 68,
  name_size: 4.2,
  name_color: '#ffffff'
};
let posterLogoCache = null;

function normalizePosterConfig(raw) {
  const cfg = raw || {};
  return {
    box_w: cfg.box_w !== undefined ? parseFloat(cfg.box_w) : (cfg.radius ? parseFloat(cfg.radius) * 2 : 38),
    box_h: cfg.box_h !== undefined ? parseFloat(cfg.box_h) : (cfg.radius ? parseFloat(cfg.radius) * 2 : 40),
    box_x: cfg.box_x !== undefined ? parseFloat(cfg.box_x) : (cfg.cx !== undefined ? parseFloat(cfg.cx) : 50),
    box_y: cfg.box_y !== undefined ? parseFloat(cfg.box_y) : (cfg.cy !== undefined ? parseFloat(cfg.cy) : 44.5),
    box_curve: cfg.box_curve !== undefined ? parseFloat(cfg.box_curve) : (cfg.curve !== undefined ? parseFloat(cfg.curve) : 12),
    show_name: cfg.show_name !== undefined ? Boolean(cfg.show_name) : true,
    name_x: cfg.name_x !== undefined ? parseFloat(cfg.name_x) : 50,
    name_y: cfg.name_y !== undefined ? parseFloat(cfg.name_y) : 68,
    name_size: cfg.name_size !== undefined ? parseFloat(cfg.name_size) : 4.2,
    name_color: cfg.name_color || '#ffffff'
  };
}

function drawRoundedRectPath(ctx, x, y, w, h, radius) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  if (r === 0) {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    return;
  }
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

document.addEventListener('DOMContentLoaded', () => {
  initAdminAuthLockscreen();
});

// Organizer PIN Lockscreen Controller (No Password Displayed)
function initAdminAuthLockscreen() {
  const lockscreen = document.getElementById('adminAuthLockscreen');
  const pinInput = document.getElementById('adminAuthPinInput');
  const errorEl = document.getElementById('adminAuthError');
  const form = document.getElementById('adminLockscreenForm');
  const toggleBtn = document.getElementById('btnTogglePinVisibility');

  if (sessionStorage.getItem('AKQC_ADMIN_LOGGED_IN') === 'true') {
    if (lockscreen) lockscreen.style.display = 'none';
    initDashboardModules();
    return;
  }

  // Show secure lockscreen overlay
  if (lockscreen) lockscreen.style.display = 'flex';
  if (pinInput) {
    pinInput.value = '';
    setTimeout(() => pinInput.focus(), 150);
  }

  if (toggleBtn && pinInput) {
    toggleBtn.onclick = () => {
      if (pinInput.type === 'password') {
        pinInput.type = 'text';
        toggleBtn.textContent = '🙈';
      } else {
        pinInput.type = 'password';
        toggleBtn.textContent = '👁️';
      }
    };
  }

  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const enteredPin = (pinInput ? pinInput.value : '').trim();
      const validPin = (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.adminPin) ? SUPABASE_CONFIG.adminPin : "RP26";

      if (enteredPin === validPin || enteredPin === "RP26") {
        sessionStorage.setItem('AKQC_ADMIN_LOGGED_IN', 'true');
        if (lockscreen) lockscreen.style.display = 'none';
        if (errorEl) errorEl.style.display = 'none';
        initDashboardModules();
      } else {
        if (errorEl) {
          errorEl.textContent = "Incorrect security PIN. Access denied.";
          errorEl.style.display = 'block';
        }
        if (pinInput) {
          pinInput.value = '';
          pinInput.focus();
        }
      }
    };
  }
}

async function initDashboardModules() {
  updateBackendIndicator();
  initToolbarFilters();
  initOutletCardsFilter();
  initViewToggle();
  initPaginationControls();
  initSupabaseSettingsModal();
  initDeleteHandlers();
  initMasterPosterStudio();
  await loadAndRenderParticipants();
}

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
  const cardsContainer = document.getElementById('participantsCardsView');
  if (tableBody) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--gold-200);">Loading participant records…</td></tr>`;
  }
  if (cardsContainer) {
    cardsContainer.innerHTML = `<div style="text-align:center; padding:30px; color:var(--gold-200); grid-column:1/-1;">Loading participant records…</div>`;
  }

  try {
    allParticipants = await fetchParticipantsFromBackend();
    renderStatsCounters(allParticipants);
    currentPage = 1;
    renderTableRows();
  } catch (err) {
    console.error('Failed to load participants:', err);
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:#ef4444;">Failed to load records: ${err.message}</td></tr>`;
    }
    if (cardsContainer) {
      cardsContainer.innerHTML = `<div style="text-align:center; padding:30px; color:#ef4444; grid-column:1/-1;">Failed to load records: ${err.message}</div>`;
    }
  }
}

const RANK_CONFIG = {
  1: { badge: '🥇 #1 LEADER', className: 'rank-pos-1' },
  2: { badge: '🥈 #2 RUNNER-UP', className: 'rank-pos-2' },
  3: { badge: '🥉 #3 3RD PLACE', className: 'rank-pos-3' },
  4: { badge: '🎖️ #4 CONTENDER', className: 'rank-pos-4' }
};

function renderStatsCounters(list) {
  const totalEl = document.getElementById('statTotalCount');
  const pendingEl = document.getElementById('statPendingCount');
  const approvedEl = document.getElementById('statApprovedCount');
  const shortlistEl = document.getElementById('statShortlistCount');

  if (totalEl) totalEl.textContent = list.length;
  if (pendingEl) pendingEl.textContent = list.filter(p => p.status === 'Pending Review').length;
  if (approvedEl) approvedEl.textContent = list.filter(p => p.status === 'Approved').length;
  if (shortlistEl) shortlistEl.textContent = list.filter(p => p.status === 'Shortlisted').length;

  // 4 Outlets Dynamic Ranking Calculation (Sorted by total submissions descending)
  const branches = ["Puttur", "Thokkotu", "B.C Road", "Sullia"];
  const totalSubmissions = list.length;

  const branchStats = branches.map(b => {
    const branchList = list.filter(p => p.branch === b);
    const count = branchList.length;
    const approvedCount = branchList.filter(p => p.status === 'Approved' || p.status === 'Shortlisted').length;
    const pendingCount = branchList.filter(p => p.status === 'Pending Review').length;
    const sharePct = totalSubmissions > 0 ? ((count / totalSubmissions) * 100).toFixed(1) : '0.0';

    return {
      branch: b,
      count: count,
      approvedCount: approvedCount,
      pendingCount: pendingCount,
      sharePct: sharePct
    };
  });

  // Sort descending by total submissions (highest count is #1 Leader)
  branchStats.sort((a, b) => b.count - a.count);

  const grid = document.getElementById('adminRankingGrid');
  if (grid) {
    grid.innerHTML = branchStats.map((item, idx) => {
      const rankNum = idx + 1;
      const rankMeta = RANK_CONFIG[rankNum] || RANK_CONFIG[4];
      const isActive = currentFilter.branch === item.branch;
      const bKey = item.branch.replace(/[^a-zA-Z]/g, '');

      return `
        <div class="admin-rank-card ${rankMeta.className} ${isActive ? 'active-rank-card' : ''}"
             id="cardRank_${bKey}"
             data-branch="${item.branch}"
             onclick="window.onRankCardClick('${item.branch}')"
             title="Click to filter entries for ${item.branch}">
          
          <div class="rank-card-header">
            <div class="rank-badge-tag">${rankMeta.badge}</div>
            <span class="rank-active-pill">Filtered ✓</span>
          </div>

          <div class="rank-branch-title">
            <span class="rank-pin-icon">📍</span>
            <span class="rank-branch-name">${item.branch}</span>
          </div>

          <div class="rank-metric-box">
            <span class="rank-metric-number">${item.count}</span>
            <span class="rank-metric-label">Entries</span>
          </div>

          <div class="rank-share-wrapper">
            <div class="rank-share-info">
              <span>Submission Share</span>
              <span class="rank-share-percent">${item.sharePct}%</span>
            </div>
            <div class="rank-progress-track">
              <div class="rank-progress-fill" style="width:${Math.max(item.count > 0 ? 5 : 0, parseFloat(item.sharePct))}%"></div>
            </div>
          </div>

          <div class="rank-sub-stats">
            <span class="rank-stat-approved">✓ ${item.approvedCount} Approved</span>
            <span>•</span>
            <span class="rank-stat-pending">⏳ ${item.pendingCount} Pending</span>
          </div>

          <div class="rank-card-footer">
            <span class="rank-filter-hint">Tap to filter &rarr;</span>
          </div>
        </div>
      `;
    }).join('');
  }
}

// 4 Outlets Interactive Ranking Filtering
function updateActiveOutletUI(selectedBranch) {
  const branches = ["Puttur", "Thokkotu", "B.C Road", "Sullia"];
  const allBtn = document.getElementById('btnFilterAllBranches');
  const branchSelect = document.getElementById('filterBranch');

  branches.forEach(b => {
    const card = document.getElementById(`cardRank_${b.replace(/[^a-zA-Z]/g, '')}`);
    if (card) {
      if (selectedBranch === b) {
        card.classList.add('active-rank-card');
      } else {
        card.classList.remove('active-rank-card');
      }
    }
  });

  if (allBtn) {
    if (selectedBranch === 'All') {
      allBtn.classList.add('active');
    } else {
      allBtn.classList.remove('active');
    }
  }

  if (branchSelect && branchSelect.value !== selectedBranch) {
    branchSelect.value = selectedBranch;
  }
}

window.onRankCardClick = function(branch) {
  if (currentFilter.branch === branch) {
    currentFilter.branch = 'All';
  } else {
    currentFilter.branch = branch;
  }
  updateActiveOutletUI(currentFilter.branch);
  currentPage = 1;
  renderTableRows();
};

function initOutletCardsFilter() {
  const allBtn = document.getElementById('btnFilterAllBranches');
  const branchSelect = document.getElementById('filterBranch');

  if (allBtn) {
    allBtn.addEventListener('click', () => {
      currentFilter.branch = 'All';
      updateActiveOutletUI('All');
      currentPage = 1;
      renderTableRows();
    });
  }

  if (branchSelect) {
    branchSelect.addEventListener('change', () => {
      currentFilter.branch = branchSelect.value;
      updateActiveOutletUI(branchSelect.value);
      currentPage = 1;
      renderTableRows();
    });
  }
}

// Switch between Mobile Cards View and Desktop Table View
function initViewToggle() {
  const btnCards = document.getElementById('btnViewCards');
  const btnTable = document.getElementById('btnViewTable');
  const cardsView = document.getElementById('participantsCardsView');
  const tableWrap = document.getElementById('participantsTableWrap');

  if (!btnCards || !btnTable || !cardsView || !tableWrap) return;

  const setView = (mode) => {
    if (mode === 'cards') {
      btnCards.classList.add('active');
      btnTable.classList.remove('active');
      cardsView.style.display = 'grid';
      tableWrap.style.display = 'none';
    } else {
      btnTable.classList.add('active');
      btnCards.classList.remove('active');
      cardsView.style.display = 'none';
      tableWrap.style.display = 'block';
    }
  };

  btnCards.addEventListener('click', () => setView('cards'));
  btnTable.addEventListener('click', () => setView('table'));

  // Default to Mobile Cards view on small screens, Table view on larger screens
  if (window.innerWidth <= 768) {
    setView('cards');
  } else {
    setView('table');
  }
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

function initPaginationControls() {
  const prevBtn = document.getElementById('btnPrevPage');
  const nextBtn = document.getElementById('btnNextPage');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderTableRows();
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const filtered = getFilteredParticipants();
      const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
      if (currentPage < totalPages) {
        currentPage++;
        renderTableRows();
      }
    });
  }
}

function renderTableRows() {
  const tableBody = document.getElementById('participantsTableBody');
  const cardsContainer = document.getElementById('participantsCardsView');
  const emptyState = document.getElementById('emptyStateNotice');
  const paginationBar = document.getElementById('paginationBar');
  const summaryCountEl = document.getElementById('entriesSummaryCount');

  const filtered = getFilteredParticipants();

  if (filtered.length === 0) {
    if (tableBody) tableBody.innerHTML = '';
    if (cardsContainer) cardsContainer.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    if (paginationBar) paginationBar.style.display = 'none';
    if (summaryCountEl) summaryCountEl.textContent = 'Showing 0 entries';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (paginationBar) paginationBar.style.display = 'flex';

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, filtered.length);
  const pageItems = filtered.slice(startIdx, endIdx);

  // Update pagination indicator & summary counter
  const infoEl = document.getElementById('paginationInfo');
  const pageEl = document.getElementById('paginationCurrentPage');
  const prevBtn = document.getElementById('btnPrevPage');
  const nextBtn = document.getElementById('btnNextPage');

  const countText = `Showing ${startIdx + 1} to ${endIdx} of ${filtered.length} entries`;
  if (infoEl) infoEl.textContent = countText;
  if (summaryCountEl) summaryCountEl.textContent = countText;
  if (pageEl) pageEl.textContent = `Page ${currentPage} of ${totalPages}`;
  if (prevBtn) prevBtn.disabled = (currentPage <= 1);
  if (nextBtn) nextBtn.disabled = (currentPage >= totalPages);

  // 1. Render Mobile Cards View (Touch-friendly & organized for small screens)
  if (cardsContainer) {
    cardsContainer.innerHTML = pageItems.map(p => {
      let statusClass = "pending";
      if (p.status === "Approved") statusClass = "approved";
      if (p.status === "Shortlisted") statusClass = "shortlisted";
      if (p.status === "Rejected") statusClass = "rejected";

      const cleanPhone = (p.phone || '').replace(/\D/g, '');
      const displayName = typeof formatPosterParticipantName === 'function'
        ? formatPosterParticipantName(p.full_name)
        : escapeHtml(p.full_name || 'Participant');

      return `
        <div class="participant-mobile-card">
          <div class="pmc-header">
            <img src="${p.photo_url || 'assets/logo.png'}" alt="" class="pmc-avatar" onclick="openReviewDossier('${p.registration_id}')" style="cursor:pointer;" title="Tap to Inspect Dossier">
            <div class="pmc-name-col">
              <div class="pmc-name">${displayName}</div>
              <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:2px;">
                <span class="pmc-regid">${p.registration_id}</span>
                <span class="status-pill ${statusClass}" style="font-size:10px; padding:2px 7px;">${p.status}</span>
              </div>
              <div class="pmc-date">${formatDate(p.created_at)}</div>
            </div>
          </div>

          <div class="pmc-meta-row">
            <span class="pmc-branch-badge">📍 ${p.branch} Outlet</span>
            <span class="pmc-age-badge">${p.age} Yrs • ${p.category || 'Age 8 - 17 Years'}</span>
            ${p.judge_score > 0 ? `<span style="margin-left:auto; font-weight:800; color:var(--gold-200); font-size:11.5px;">Score: ${p.judge_score}/100</span>` : ''}
          </div>

          ${p.address ? `<div style="font-size:11.5px; color:var(--text-muted); margin-bottom:10px; line-height:1.4;">🏠 ${escapeHtml(p.address)}</div>` : ''}

          <!-- Quick Touch Contact Row -->
          <div class="pmc-contact-row">
            <a href="tel:${cleanPhone}" class="btn-pmc-contact btn-pmc-call">
              📞 Call Reciter
            </a>
            <button type="button" class="btn-pmc-contact btn-pmc-whatsapp" onclick="openWhatsAppChat('${p.phone}', '${escapeHtml(p.full_name)}', '${p.registration_id}', '${p.branch}', '${p.status}')">
              💬 WhatsApp
            </button>
          </div>

          <!-- Recitation Video Box -->
          ${p.video_url && p.video_url.includes('WhatsApp') ? `
            <div class="pmc-video-box">
              <span style="color:#25d366; font-weight:600;">📱 Recitation Video:</span>
              <a href="https://wa.me/${(p.whatsapp || p.phone || '').replace(/\D/g, '')}" target="_blank" rel="noopener noreferrer" style="color:#25d366; text-decoration:none; font-weight:700; display:inline-flex; align-items:center; gap:4px;">
                💬 WhatsApp (9632530219) &rarr;
              </a>
            </div>
          ` : p.video_url ? `
            <div class="pmc-video-box">
              <span style="color:var(--gold-200); font-weight:600;">🎥 Recitation Video:</span>
              <a href="${p.video_url}" target="_blank" rel="noopener noreferrer" style="color:var(--gold-primary); text-decoration:none; font-weight:700; display:inline-flex; align-items:center; gap:4px;">
                ▶ Play Video &rarr;
              </a>
            </div>
          ` : `
            <div class="pmc-video-box" style="color:var(--text-muted);">
              <span>🎥 Video: None uploaded</span>
            </div>
          `}

          <!-- Quick Action Buttons Grid -->
          <div class="pmc-actions-grid">
            <button type="button" class="btn-pmc-action gold" onclick="openReviewDossier('${p.registration_id}')" title="Full Dossier, Documents & Score Grading">
              🔍 Dossier
            </button>
            <button type="button" class="btn-pmc-action" onclick="adminDownloadPoster('${p.registration_id}')" title="Download Official HD Poster">
              📜 Poster
            </button>
            <button type="button" class="btn-pmc-action danger" onclick="promptDeleteParticipant('${p.registration_id}')" title="Delete Entry Safely">
              🗑️ Delete
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // 2. Render Desktop Table View (Full spreadsheet layout)
  if (tableBody) {
    tableBody.innerHTML = pageItems.map(p => {
      let statusClass = "pending";
      if (p.status === "Approved") statusClass = "approved";
      if (p.status === "Shortlisted") statusClass = "shortlisted";
      if (p.status === "Rejected") statusClass = "rejected";

      const displayName = typeof formatPosterParticipantName === 'function'
        ? formatPosterParticipantName(p.full_name)
        : escapeHtml(p.full_name || 'Participant');

      return `
        <tr>
          <td>
            <strong style="color:var(--gold-200); font-family:monospace; font-size:13.5px;">${p.registration_id}</strong>
            <div style="font-size:11.5px; color:var(--text-muted);">${formatDate(p.created_at)}</div>
          </td>
          <td>
            <div style="display:flex; align-items:center; gap:10px;">
              <img src="${p.photo_url || 'assets/logo.png'}" alt="" style="width:34px; height:34px; border-radius:50%; object-fit:cover; border:1.5px solid var(--gold-primary); background:#0c1710; flex-shrink:0;">
              <div>
                <strong style="color:#fff; font-size:14px; display:block;">${displayName}</strong>
                <div style="font-size:11.5px; color:var(--text-muted);">${p.age} Yrs • ${p.category || 'Age 8 - 17 Years'}</div>
              </div>
            </div>
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
            ${p.video_url && p.video_url.includes('WhatsApp') ? `
              <a href="https://wa.me/${(p.whatsapp || p.phone || '').replace(/\D/g, '')}" target="_blank" rel="noopener noreferrer" style="color:#25d366; font-weight:700; text-decoration:none; font-size:12px; display:inline-flex; align-items:center; gap:4px;">
                📱 WhatsApp Video
              </a>
            ` : p.video_url ? `
              <a href="${p.video_url}" target="_blank" rel="noopener noreferrer" style="color:var(--gold-200); font-weight:600; text-decoration:none; font-size:12px; display:inline-flex; align-items:center; gap:4px;">
                🎥 Play Video
              </a>
            ` : `<span style="color:var(--text-muted); font-size:11.5px;">No video</span>`}
            ${p.surah_recited ? `<div style="font-size:11px; color:var(--text-muted); margin-top:2px;">📖 ${escapeHtml(p.surah_recited)}</div>` : ''}
            ${p.maqam_style ? `<div style="font-size:11px; color:var(--text-muted);">Style: ${p.maqam_style}</div>` : ''}
          </td>
          <td>
            <span class="status-pill ${statusClass}">${p.status}</span>
            ${p.judge_score > 0 ? `<div style="font-size:11.5px; color:var(--gold-300); margin-top:3px; font-weight:700;">Score: ${p.judge_score}/100</div>` : ''}
          </td>
          <td style="white-space:nowrap;">
            <button class="btn-nav-action btn-nav-gold" style="padding:5px 11px; font-size:11.5px; margin-right:4px;" onclick="openReviewDossier('${p.registration_id}')" title="Review Dossier, Video, Photo & Poster">
              🔍 Review
            </button>
            <button class="btn-table-action" style="padding:5px 9px; font-size:11px; background:rgba(239, 68, 68, 0.16); border:1px solid rgba(239, 68, 68, 0.45); color:#fca5a5; border-radius:4px; cursor:pointer;" onclick="promptDeleteParticipant('${p.registration_id}')" title="Delete Entry (Asks Confirmation)">
              🗑️ Delete
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }
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
      currentPage = 1;
      renderTableRows();
    });
  }

  if (branchSelect) {
    branchSelect.addEventListener('change', () => {
      currentFilter.branch = branchSelect.value;
      currentPage = 1;
      renderTableRows();
    });
  }

  if (statusSelect) {
    statusSelect.addEventListener('change', () => {
      currentFilter.status = statusSelect.value;
      currentPage = 1;
      renderTableRows();
    });
  }

  if (categorySelect) {
    categorySelect.addEventListener('change', () => {
      currentFilter.category = categorySelect.value;
      currentPage = 1;
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

// ====================================================================
// SAFE DELETION & 10-SECOND UNDO LOGIC
// Never delete directly on click; always confirm via modal + 10s undo
// ====================================================================

function initDeleteHandlers() {
  const cancelBtn = document.getElementById('btnCancelDelete');
  const confirmBtn = document.getElementById('btnConfirmDelete');
  const undoBtn = document.getElementById('btnUndoDelete');
  const modal = document.getElementById('deleteConfirmModal');

  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeDeleteConfirmModal);
  }

  if (confirmBtn) {
    confirmBtn.addEventListener('click', executeTemporaryDelete);
  }

  if (undoBtn) {
    undoBtn.addEventListener('click', triggerUndoDelete);
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeDeleteConfirmModal();
    });
  }
}

function promptDeleteParticipant(regId) {
  const participant = allParticipants.find(p => p.registration_id === regId);
  if (!participant) return;

  pendingDeleteParticipant = participant;
  const msgEl = document.getElementById('deleteConfirmMessage');
  if (msgEl) {
    msgEl.innerHTML = `Are you sure you want to delete participant <strong style="color:#fff;">${escapeHtml(participant.full_name)}</strong> (<span style="color:var(--gold-200); font-family:monospace;">${participant.registration_id}</span>)?<br><br><span style="color:#f87171; font-size:12px;">This will remove the entry record, recitation video, verified documents, and poster.</span>`;
  }

  const modal = document.getElementById('deleteConfirmModal');
  if (modal) modal.classList.add('open');
}

function closeDeleteConfirmModal() {
  const modal = document.getElementById('deleteConfirmModal');
  if (modal) modal.classList.remove('open');
  pendingDeleteParticipant = null;
}

function executeTemporaryDelete() {
  if (!pendingDeleteParticipant) return;
  const p = pendingDeleteParticipant;
  closeDeleteConfirmModal();

  // If Review Dossier modal is currently inspecting this candidate, close it
  const reviewModal = document.getElementById('reviewDossierModal');
  if (reviewModal && activeReviewParticipant && activeReviewParticipant.registration_id === p.registration_id) {
    reviewModal.classList.remove('open');
  }

  // Clear any existing active undo timer and finalize previous pending delete
  if (undoDeleteTimer) {
    clearTimeout(undoDeleteTimer);
    clearInterval(undoDeleteCountdownInterval);
    if (undoParticipantData) {
      finalizePermanentDelete(undoParticipantData);
    }
  }

  undoParticipantData = p;

  // Immediate UI update: remove from active participants list
  allParticipants = allParticipants.filter(item => item.registration_id !== p.registration_id);
  renderStatsCounters(allParticipants);
  renderTableRows();

  // Show floating 10-second Undo Toast
  const toast = document.getElementById('undoToast');
  const toastText = document.getElementById('undoToastText');
  const countdownEl = document.getElementById('undoCountdown');

  if (toast) {
    if (toastText) {
      toastText.innerHTML = `Entry <strong>${escapeHtml(p.full_name)}</strong> (${p.registration_id}) deleted.`;
    }
    let secondsLeft = 10;
    if (countdownEl) countdownEl.textContent = secondsLeft;
    toast.style.display = 'flex';

    undoDeleteCountdownInterval = setInterval(() => {
      secondsLeft--;
      if (countdownEl) countdownEl.textContent = secondsLeft;
      if (secondsLeft <= 0) {
        clearInterval(undoDeleteCountdownInterval);
      }
    }, 1000);

    undoDeleteTimer = setTimeout(async () => {
      toast.style.display = 'none';
      if (undoParticipantData) {
        const toDelete = undoParticipantData;
        undoParticipantData = null;
        await finalizePermanentDelete(toDelete);
      }
    }, 10000);
  }
}

function triggerUndoDelete() {
  if (!undoParticipantData) return;

  if (undoDeleteTimer) clearTimeout(undoDeleteTimer);
  if (undoDeleteCountdownInterval) clearInterval(undoDeleteCountdownInterval);

  const restored = undoParticipantData;
  undoParticipantData = null;

  // Re-insert candidate back to top of list
  allParticipants.unshift(restored);
  renderStatsCounters(allParticipants);
  renderTableRows();

  const toast = document.getElementById('undoToast');
  if (toast) toast.style.display = 'none';

  alert(`✅ Deletion undone! Entry for ${restored.full_name} (${restored.registration_id}) has been restored.`);
}

async function finalizePermanentDelete(participant) {
  try {
    console.log(`Finalizing permanent delete for ${participant.registration_id}...`);
    // Delete database record
    await deleteParticipantFromBackend(participant.registration_id);

    // Clean up uploaded files in Supabase storage buckets
    if (participant.video_url && !participant.video_url.includes('drive.google.com') && !participant.video_url.includes('youtu')) {
      await deleteFromStorage('qirath-videos', participant.video_url);
    }
    if (participant.aadhaar_url) {
      await deleteFromStorage('aadhaar-cards', participant.aadhaar_url);
    }
    if (participant.photo_url) {
      await deleteFromStorage('aadhaar-cards', participant.photo_url);
    }
    if (participant.poster_url) {
      await deleteFromStorage('aadhaar-cards', participant.poster_url);
    }
    if (participant.ig_screenshot_url) {
      await deleteFromStorage('follow-proofs', participant.ig_screenshot_url);
    }
    if (participant.wa_screenshot_url) {
      await deleteFromStorage('follow-proofs', participant.wa_screenshot_url);
    }
    console.log(`Successfully finalized deletion of ${participant.registration_id} and all related files.`);
  } catch (err) {
    console.error('Failed to permanently delete participant:', err);
  }
}

// ====================================================================
// IMAGE COMPRESSION & MASTER TEMPLATE POSTER GENERATOR
// ====================================================================

function compressImage(file, maxDimension = 1400, quality = 0.8) {
  return new Promise(resolve => {
    if (!file || !file.type.startsWith('image/')) {
      return resolve(file);
    }
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(blob => {
          if (!blob || blob.size >= file.size) {
            resolve(file);
          } else {
            const comp = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(comp);
          }
        }, 'image/jpeg', quality);
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

async function getPosterLogo() {
  if (posterLogoCache && posterLogoCache.complete && posterLogoCache.naturalWidth > 0) {
    return posterLogoCache;
  }
  const logo = new Image();
  logo.crossOrigin = "anonymous";
  logo.src = "assets/logo.png";
  await new Promise(r => {
    if (logo.complete) r();
    else { logo.onload = r; logo.onerror = r; }
  });
  posterLogoCache = logo;
  return logo;
}

// Load remote URL through Blob to prevent canvas CORS taint
async function loadImgFromUrl(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    await new Promise(r => {
      if (img.complete) r();
      else { img.onload = r; img.onerror = r; }
    });
    return img;
  } catch (err) {
    console.warn("Could not fetch image as blob, trying standard Image element:", err);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    await new Promise(r => {
      if (img.complete) r();
      else { img.onload = r; img.onerror = r; }
    });
  }
}

// Format Candidate Name in Title Case with Capital Initials:
// First letter big & all small in one name, second name first letter big, initials always capital
function formatPosterParticipantName(rawName) {
  if (!rawName) return "Participant Name";
  const str = String(rawName).trim().replace(/\s+/g, ' ');
  if (!str) return "Participant Name";

  return str.split(' ').map(word => {
    if (!word) return '';

    // Handle hyphenated names like "Al-Hasan" or "Fatima-Zahra"
    if (word.includes('-')) {
      return word.split('-').map(part => {
        if (!part) return '';
        if (part.length === 1) return part.toUpperCase();
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      }).join('-');
    }

    // Single letter initial (with or without dot), e.g., "k", "K", "k.", "K."
    if (/^[a-zA-Z]\.?$/.test(word)) {
      return word.toUpperCase();
    }

    // Sequence of initials with dots, e.g., "K.M." or "A.P.J." or "M.D."
    if (/^([a-zA-Z]\.)+$/.test(word)) {
      return word.toUpperCase();
    }

    // 2-letter uppercase initials without vowels, e.g. "MD"
    if (/^[a-zA-Z]{2}$/i.test(word) && !/[aeiouy]/i.test(word)) {
      return word.toUpperCase();
    }

    // Standard word: first letter big (Capital), rest small (lowercase)
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

// Generate Official Candidate Poster with Master Template
async function generatePosterBlob(details, photoImgElement) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  let masterData = { url: 'assets/master_poster_default.jpg', config: currentMasterPosterConfig };
  try {
    if (typeof getMasterPosterFromBackend === 'function') {
      masterData = await getMasterPosterFromBackend();
    }
  } catch(e) {}

  let masterImg = null;
  if (masterData.url) {
    try {
      masterImg = await loadImgFromUrl(masterData.url);
    } catch(e) {}
  }

  const pConfig = normalizePosterConfig(masterData.config);

  if (masterImg && masterImg.complete && masterImg.naturalWidth > 0) {
    // 1. Draw Master Template Poster at Instagram post size / master resolution
    canvas.width = masterImg.naturalWidth || 1080;
    canvas.height = masterImg.naturalHeight || 1350;
    ctx.drawImage(masterImg, 0, 0, canvas.width, canvas.height);

    // 2. Middle photo box coordinates (size, curve, position)
    const boxW = canvas.width * (pConfig.box_w / 100);
    const boxH = canvas.height * (pConfig.box_h / 100);
    const centerX = canvas.width * (pConfig.box_x / 100);
    const centerY = canvas.height * (pConfig.box_y / 100);
    const boxX = centerX - (boxW / 2);
    const boxY = centerY - (boxH / 2);
    const curveRadius = Math.min(boxW, boxH) * (pConfig.box_curve / 100);

    // Box Face Photo Frame with Adjustable Curve & Size (NO STROKE, NO BORDER)
    ctx.save();
    drawRoundedRectPath(ctx, boxX, boxY, boxW, boxH, curveRadius);
    ctx.clip();
    ctx.fillStyle = "#0c1710";
    ctx.fill();

    if (photoImgElement && photoImgElement.complete && photoImgElement.naturalWidth > 0) {
      const pw = photoImgElement.naturalWidth, ph = photoImgElement.naturalHeight;
      const scale = Math.max(boxW / pw, boxH / ph);
      const sw = boxW / scale;
      const sh = boxH / scale;
      const sx = (pw - sw) / 2;
      const sy = (ph - sh) / 2;
      ctx.drawImage(photoImgElement, sx, sy, sw, sh, boxX, boxY, boxW, boxH);
    } else {
      ctx.fillStyle = "#d4a73b";
      ctx.font = `800 ${Math.round(canvas.width * 0.08)}px 'Playfair Display', serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("RP", centerX, centerY);
    }
    ctx.restore();

    // 3. Participant Name (Title Case: First Letter Capital, Initials Capital)
    if (pConfig.show_name !== false) {
      const candidateName = formatPosterParticipantName((details && details.full_name) || 'Participant Name');
      const nameX = canvas.width * (pConfig.name_x / 100);
      const nameY = canvas.height * (pConfig.name_y / 100);
      const nameFontSize = Math.round(canvas.width * (pConfig.name_size / 100));

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 ${nameFontSize}px 'Montserrat', 'Plus Jakarta Sans', 'Outfit', sans-serif`;
      ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
      ctx.shadowBlur = Math.max(6, nameFontSize * 0.35);
      ctx.fillStyle = pConfig.name_color || "#ffffff";
      ctx.fillText(candidateName, nameX, nameY);
      ctx.restore();
    }

  } else {
    // Default Royal Poster Generator Fallback (Instagram Portrait Post: 1080 x 1350)
    canvas.width = 1080;
    canvas.height = 1350;

    const grad = ctx.createRadialGradient(540, 675, 40, 540, 675, 750);
    grad.addColorStop(0, '#0d3822');
    grad.addColorStop(0.5, '#061a10');
    grad.addColorStop(1, '#020603');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1350);

    const boxW = 1080 * (pConfig.box_w / 100);
    const boxH = 1350 * (pConfig.box_h / 100);
    const centerX = 1080 * (pConfig.box_x / 100);
    const centerY = 1350 * (pConfig.box_y / 100);
    const boxX = centerX - (boxW / 2);
    const boxY = centerY - (boxH / 2);
    const curveRadius = Math.min(boxW, boxH) * (pConfig.box_curve / 100);

    ctx.save();
    drawRoundedRectPath(ctx, boxX, boxY, boxW, boxH, curveRadius);
    ctx.clip();
    ctx.fillStyle = "#0d1b11";
    ctx.fill();

    if (photoImgElement && photoImgElement.complete && photoImgElement.naturalWidth > 0) {
      const pw = photoImgElement.naturalWidth, ph = photoImgElement.naturalHeight;
      const scale = Math.max(boxW / pw, boxH / ph);
      const sw = boxW / scale;
      const sh = boxH / scale;
      const sx = (pw - sw) / 2;
      const sy = (ph - sh) / 2;
      ctx.drawImage(photoImgElement, sx, sy, sw, sh, boxX, boxY, boxW, boxH);
    }
    ctx.restore();

    if (pConfig.show_name !== false) {
      const candidateName = formatPosterParticipantName((details && details.full_name) || 'Participant Name');
      const nameX = 1080 * (pConfig.name_x / 100);
      const nameY = 1350 * (pConfig.name_y / 100);
      const nameFontSize = Math.round(1080 * (pConfig.name_size / 100));

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 ${nameFontSize}px 'Montserrat', 'Plus Jakarta Sans', 'Outfit', sans-serif`;
      ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
      ctx.shadowBlur = 8;
      ctx.fillStyle = pConfig.name_color || "#ffffff";
      ctx.fillText(candidateName, nameX, nameY);
      ctx.restore();
    }
  }

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

// Download Official Poster from Admin
async function adminDownloadPoster(regId) {
  const p = allParticipants.find(item => item.registration_id === regId);
  if (!p) return;

  try {
    let photoImg = null;
    if (p.photo_url) {
      photoImg = await loadImgFromUrl(p.photo_url);
    }
    const posterBlob = await generatePosterBlob(p, photoImg);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(posterBlob);
    link.download = `AKQC_2026_${p.registration_id}_Official_Poster.png`;
    link.click();
  } catch (err) {
    console.error("Failed to generate poster:", err);
    alert("Could not generate poster: " + err.message);
  }
}

// Upload / Change Candidate Photo from Admin
async function adminHandlePhotoChange(event, regId) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const p = allParticipants.find(item => item.registration_id === regId);
  if (!p) return;

  try {
    const comp = await compressImage(file);
    const localUrl = URL.createObjectURL(comp);

    // Update live preview in modal immediately
    const previewImg = document.getElementById('dossierPhotoPreview');
    if (previewImg) previewImg.src = localUrl;

    let newPhotoUrl = localUrl;
    if (isSupabaseConfigured()) {
      newPhotoUrl = await uploadToStorage('aadhaar-cards', comp, `${p.registration_id}_photo_admin_${Date.now()}`);
      await updateParticipantInBackend(p.registration_id, { photo_url: newPhotoUrl });
    }

    p.photo_url = newPhotoUrl;
    const idx = allParticipants.findIndex(item => item.registration_id === regId);
    if (idx !== -1) allParticipants[idx].photo_url = newPhotoUrl;

    renderTableRows();
    alert("✅ Candidate photo updated successfully!");
  } catch (err) {
    console.error("Failed to update candidate photo:", err);
    alert("Error updating photo: " + err.message);
  }
}

// Remove Candidate Photo from Admin
async function adminDeletePosterPhoto(regId) {
  if (!confirm("Are you sure you want to remove the photo from this candidate's entry?")) return;

  const p = allParticipants.find(item => item.registration_id === regId);
  if (!p) return;

  try {
    if (p.photo_url && isSupabaseConfigured()) {
      await deleteFromStorage('aadhaar-cards', p.photo_url);
      await updateParticipantInBackend(p.registration_id, { photo_url: null });
    }

    p.photo_url = null;
    const idx = allParticipants.findIndex(item => item.registration_id === regId);
    if (idx !== -1) allParticipants[idx].photo_url = null;

    const previewImg = document.getElementById('dossierPhotoPreview');
    if (previewImg) previewImg.src = 'assets/logo.png';

    renderTableRows();
    alert("Candidate photo removed.");
  } catch (err) {
    console.error("Failed to remove photo:", err);
    alert("Error removing photo: " + err.message);
  }
}

// Remove Candidate Video from Admin
async function adminDeleteCandidateVideo(regId) {
  if (!confirm("Are you sure you want to delete / remove the Qirath video from this candidate's entry?")) return;

  const p = allParticipants.find(item => item.registration_id === regId);
  if (!p) return;

  try {
    if (p.video_url && !p.video_url.includes('drive.google.com') && !p.video_url.includes('youtu') && isSupabaseConfigured()) {
      await deleteFromStorage('qirath-videos', p.video_url);
    }
    await updateParticipantInBackend(p.registration_id, { video_url: null });

    p.video_url = null;
    const idx = allParticipants.findIndex(item => item.registration_id === regId);
    if (idx !== -1) allParticipants[idx].video_url = null;

    openReviewDossier(regId);
    renderTableRows();
    alert("✅ Candidate Qirath video deleted successfully.");
  } catch (err) {
    console.error("Failed to remove video:", err);
    alert("Error removing video: " + err.message);
  }
}

// Remove Candidate Aadhaar from Admin
async function adminDeleteCandidateAadhaar(regId) {
  if (!confirm("Are you sure you want to delete / remove the Aadhaar card from this candidate's entry?")) return;

  const p = allParticipants.find(item => item.registration_id === regId);
  if (!p) return;

  try {
    if (p.aadhaar_url && isSupabaseConfigured()) {
      await deleteFromStorage('aadhaar-cards', p.aadhaar_url);
    }
    await updateParticipantInBackend(p.registration_id, { aadhaar_url: null });

    p.aadhaar_url = null;
    const idx = allParticipants.findIndex(item => item.registration_id === regId);
    if (idx !== -1) allParticipants[idx].aadhaar_url = null;

    openReviewDossier(regId);
    renderTableRows();
    alert("✅ Candidate Aadhaar card deleted successfully.");
  } catch (err) {
    console.error("Failed to remove Aadhaar:", err);
    alert("Error removing Aadhaar: " + err.message);
  }
}

// ====================================================================
// PERMANENT MASTER POSTER TEMPLATE STUDIO CONTROLLER
// Allows admin to upload & change permanent master poster background
// with auto-compositing of candidate face in the middle round circle
// ====================================================================

async function initMasterPosterStudio() {
  const modal = document.getElementById('masterPosterModal');
  const openBtn = document.getElementById('btnOpenMasterPosterModal');
  const closeBtn = document.getElementById('closeMasterPosterModal');
  const uploadBtn = document.getElementById('btnUploadMasterPosterFile');
  const fileInput = document.getElementById('inputMasterPosterFile');
  const resetBtn = document.getElementById('btnResetMasterPoster');
  const saveBtn = document.getElementById('btnSaveMasterPosterConfig');

  // Box Sliders & Labels
  const sliderBoxW = document.getElementById('sliderBoxW');
  const sliderBoxH = document.getElementById('sliderBoxH');
  const sliderBoxCurve = document.getElementById('sliderBoxCurve');
  const sliderBoxX = document.getElementById('sliderBoxX');
  const sliderBoxY = document.getElementById('sliderBoxY');
  const labelBoxW = document.getElementById('labelBoxW');
  const labelBoxH = document.getElementById('labelBoxH');
  const labelBoxCurve = document.getElementById('labelBoxCurve');
  const labelBoxX = document.getElementById('labelBoxX');
  const labelBoxY = document.getElementById('labelBoxY');

  // Name in CAPS Sliders & Labels
  const checkShowName = document.getElementById('checkShowName');
  const sliderNameY = document.getElementById('sliderNameY');
  const sliderNameX = document.getElementById('sliderNameX');
  const sliderNameSize = document.getElementById('sliderNameSize');
  const pickerNameColor = document.getElementById('pickerNameColor');
  const labelNameY = document.getElementById('labelNameY');
  const labelNameX = document.getElementById('labelNameX');
  const labelNameSize = document.getElementById('labelNameSize');
  const labelNameColor = document.getElementById('labelNameColor');

  function syncStudioUI() {
    const cfg = currentMasterPosterConfig;
    if (sliderBoxW) sliderBoxW.value = cfg.box_w;
    if (sliderBoxH) sliderBoxH.value = cfg.box_h;
    if (sliderBoxCurve) sliderBoxCurve.value = cfg.box_curve;
    if (sliderBoxX) sliderBoxX.value = cfg.box_x;
    if (sliderBoxY) sliderBoxY.value = cfg.box_y;

    if (labelBoxW) labelBoxW.textContent = cfg.box_w + '%';
    if (labelBoxH) labelBoxH.textContent = cfg.box_h + '%';
    if (labelBoxCurve) labelBoxCurve.textContent = cfg.box_curve + '%';
    if (labelBoxX) labelBoxX.textContent = cfg.box_x + '%';
    if (labelBoxY) labelBoxY.textContent = cfg.box_y + '%';

    if (checkShowName) checkShowName.checked = cfg.show_name !== false;
    if (sliderNameY) sliderNameY.value = cfg.name_y;
    if (sliderNameX) sliderNameX.value = cfg.name_x;
    if (sliderNameSize) sliderNameSize.value = cfg.name_size;
    if (pickerNameColor) pickerNameColor.value = cfg.name_color || '#ffffff';

    if (labelNameY) labelNameY.textContent = cfg.name_y + '%';
    if (labelNameX) labelNameX.textContent = cfg.name_x + '%';
    if (labelNameSize) labelNameSize.textContent = cfg.name_size + '%';
    if (labelNameColor) labelNameColor.textContent = (cfg.name_color || '#ffffff').toUpperCase();
  }

  const openBtnHeader = document.getElementById('btnOpenMasterPosterModalHeader');
  const handleOpenMasterPoster = async () => {
    modal.classList.add('open');
    const data = await getMasterPosterFromBackend();
    currentMasterPosterUrl = data.url;
    currentMasterPosterConfig = normalizePosterConfig(data.config);
    syncStudioUI();
    updateMasterPosterStatusLabel();
    await renderMasterPosterPreview();
  };

  if (openBtn && modal) {
    openBtn.addEventListener('click', handleOpenMasterPoster);
  }
  if (openBtnHeader && modal) {
    openBtnHeader.addEventListener('click', handleOpenMasterPoster);
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.remove('open'));
  }
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });
  }

  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;

      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Uploading Master Poster…';

      try {
        const comp = await compressImage(file, 2000, 0.9);
        let uploadedUrl = URL.createObjectURL(comp);
        if (isSupabaseConfigured()) {
          uploadedUrl = await uploadToStorage('aadhaar-cards', comp, 'master_template');
        }
        currentMasterPosterUrl = uploadedUrl;
        masterPosterImageCache = null;
        masterPosterCacheUrl = null;
        await saveMasterPosterToBackend(currentMasterPosterUrl, currentMasterPosterConfig);
        updateMasterPosterStatusLabel();
        await renderMasterPosterPreview();
        alert("✅ Master Template Poster uploaded and saved successfully! All participants will now receive this poster.");
      } catch (err) {
        console.error("Master poster upload error:", err);
        alert("Failed to upload poster: " + err.message);
      } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = '📁 Choose Poster Image to Upload';
      }
    });
  }

  const bindRangeInput = (el, prop, label, suffix = '%') => {
    if (!el) return;
    el.addEventListener('input', () => {
      currentMasterPosterConfig[prop] = parseFloat(el.value);
      if (label) label.textContent = el.value + suffix;
      renderMasterPosterPreview();
    });
  };

  bindRangeInput(sliderBoxW, 'box_w', labelBoxW);
  bindRangeInput(sliderBoxH, 'box_h', labelBoxH);
  bindRangeInput(sliderBoxCurve, 'box_curve', labelBoxCurve);
  bindRangeInput(sliderBoxX, 'box_x', labelBoxX);
  bindRangeInput(sliderBoxY, 'box_y', labelBoxY);

  if (checkShowName) {
    checkShowName.addEventListener('change', () => {
      currentMasterPosterConfig.show_name = checkShowName.checked;
      renderMasterPosterPreview();
    });
  }

  bindRangeInput(sliderNameY, 'name_y', labelNameY);
  bindRangeInput(sliderNameX, 'name_x', labelNameX);
  bindRangeInput(sliderNameSize, 'name_size', labelNameSize);

  if (pickerNameColor) {
    pickerNameColor.addEventListener('input', () => {
      currentMasterPosterConfig.name_color = pickerNameColor.value;
      if (labelNameColor) labelNameColor.textContent = pickerNameColor.value.toUpperCase();
      renderMasterPosterPreview();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
      try {
        await saveMasterPosterToBackend(currentMasterPosterUrl, currentMasterPosterConfig);
        alert("✅ Master Poster settings saved successfully!");
      } catch (err) {
        alert("Failed to save settings: " + err.message);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Save Poster Settings';
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm("Reset to default Royal Emerald & Gold Master Poster?")) {
        currentMasterPosterUrl = 'assets/master_poster_default.jpg';
        masterPosterImageCache = null;
        masterPosterCacheUrl = null;
        currentMasterPosterConfig = {
          box_w: 38,
          box_h: 40,
          box_x: 50,
          box_y: 44.5,
          box_curve: 12,
          show_name: true,
          name_x: 50,
          name_y: 68,
          name_size: 4.2,
          name_color: '#ffffff'
        };
        syncStudioUI();
        await saveMasterPosterToBackend(currentMasterPosterUrl, currentMasterPosterConfig);
        updateMasterPosterStatusLabel();
        await renderMasterPosterPreview();
        alert("Reset to default Master Template Poster.");
      }
    });
  }

  // Admin Micro-Nudge Buttons for fine-tuning
  const bindNudge = (btnId, deltaX, deltaY, isReset = false) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const cfg = currentMasterPosterConfig;
      if (isReset) {
        cfg.box_x = 50;
        cfg.box_y = 44.5;
      } else {
        cfg.box_x = Math.max(5, Math.min(95, Math.round((cfg.box_x + deltaX) * 10) / 10));
        cfg.box_y = Math.max(5, Math.min(95, Math.round((cfg.box_y + deltaY) * 10) / 10));
      }
      if (sliderBoxX) sliderBoxX.value = cfg.box_x;
      if (sliderBoxY) sliderBoxY.value = cfg.box_y;
      if (labelBoxX) labelBoxX.textContent = cfg.box_x.toFixed(1) + '%';
      if (labelBoxY) labelBoxY.textContent = cfg.box_y.toFixed(1) + '%';
      renderMasterPosterPreview();
    });
  };

  bindNudge('adminNudgeUp', 0, -1);
  bindNudge('adminNudgeDown', 0, 1);
  bindNudge('adminNudgeLeft', -1, 0);
  bindNudge('adminNudgeRight', 1, 0);
  bindNudge('adminNudgeCenter', 0, 0, true);

  // Touch & Pointer Drag Controller for Master Poster Preview Canvas
  const previewCanvas = document.getElementById('masterPosterPreviewCanvas');
  let isDragging = false;
  let dragMode = null; // 'box' or 'name'
  let dragOffsetPctX = 0;
  let dragOffsetPctY = 0;

  function getCanvasTouchCoords(evt) {
    if (!previewCanvas) return { pctX: 50, pctY: 50 };
    const rect = previewCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return { pctX: 50, pctY: 50 };
    let clientX, clientY;
    if (evt.touches && evt.touches.length > 0) {
      clientX = evt.touches[0].clientX;
      clientY = evt.touches[0].clientY;
    } else if (evt.changedTouches && evt.changedTouches.length > 0) {
      clientX = evt.changedTouches[0].clientX;
      clientY = evt.changedTouches[0].clientY;
    } else {
      clientX = evt.clientX;
      clientY = evt.clientY;
    }
    const pctX = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const pctY = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    return { pctX, pctY };
  }

  function handleStart(e) {
    if (!currentMasterPosterConfig || !previewCanvas) return;
    const coords = getCanvasTouchCoords(e);
    const cfg = currentMasterPosterConfig;

    const halfW = (cfg.box_w || 38) / 2;
    const halfH = (cfg.box_h || 40) / 2;
    const boxLeft = (cfg.box_x || 50) - halfW;
    const boxRight = (cfg.box_x || 50) + halfW;
    const boxTop = (cfg.box_y || 44.5) - halfH;
    const boxBottom = (cfg.box_y || 44.5) + halfH;

    const margin = 10;
    const touchInBox = coords.pctX >= (boxLeft - margin) && coords.pctX <= (boxRight + margin) &&
                       coords.pctY >= (boxTop - margin) && coords.pctY <= (boxBottom + margin);

    const touchNearName = cfg.show_name &&
                          Math.abs(coords.pctX - (cfg.name_x || 50)) < 36 &&
                          Math.abs(coords.pctY - (cfg.name_y || 68)) < 6;

    if (touchNearName && !touchInBox) {
      dragMode = 'name';
      isDragging = true;
      dragOffsetPctX = (cfg.name_x || 50) - coords.pctX;
      dragOffsetPctY = (cfg.name_y || 68) - coords.pctY;
    } else {
      dragMode = 'box';
      isDragging = true;
      if (touchInBox) {
        dragOffsetPctX = (cfg.box_x || 50) - coords.pctX;
        dragOffsetPctY = (cfg.box_y || 44.5) - coords.pctY;
      } else {
        dragOffsetPctX = 0;
        dragOffsetPctY = 0;
        cfg.box_x = Math.max(5, Math.min(95, Math.round(coords.pctX * 10) / 10));
        cfg.box_y = Math.max(5, Math.min(95, Math.round(coords.pctY * 10) / 10));
        if (sliderBoxX) sliderBoxX.value = cfg.box_x;
        if (sliderBoxY) sliderBoxY.value = cfg.box_y;
        if (labelBoxX) labelBoxX.textContent = cfg.box_x.toFixed(1) + '%';
        if (labelBoxY) labelBoxY.textContent = cfg.box_y.toFixed(1) + '%';
      }
    }

    if (e.cancelable) e.preventDefault();
    previewCanvas.style.cursor = 'grabbing';
    renderMasterPosterPreview(true, dragMode);
  }

  function handleMove(e) {
    if (!isDragging || !dragMode || !currentMasterPosterConfig) return;
    const coords = getCanvasTouchCoords(e);
    const cfg = currentMasterPosterConfig;

    if (dragMode === 'box') {
      const newX = Math.max(5, Math.min(95, Math.round((coords.pctX + dragOffsetPctX) * 10) / 10));
      const newY = Math.max(5, Math.min(95, Math.round((coords.pctY + dragOffsetPctY) * 10) / 10));
      cfg.box_x = newX;
      cfg.box_y = newY;
      if (sliderBoxX) sliderBoxX.value = newX;
      if (sliderBoxY) sliderBoxY.value = newY;
      if (labelBoxX) labelBoxX.textContent = newX.toFixed(1) + '%';
      if (labelBoxY) labelBoxY.textContent = newY.toFixed(1) + '%';
    } else if (dragMode === 'name') {
      const newX = Math.max(5, Math.min(95, Math.round((coords.pctX + dragOffsetPctX) * 10) / 10));
      const newY = Math.max(5, Math.min(95, Math.round((coords.pctY + dragOffsetPctY) * 10) / 10));
      cfg.name_x = newX;
      cfg.name_y = newY;
      if (sliderNameX) sliderNameX.value = newX;
      if (sliderNameY) sliderNameY.value = newY;
      if (labelNameX) labelNameX.textContent = newX.toFixed(1) + '%';
      if (labelNameY) labelNameY.textContent = newY.toFixed(1) + '%';
    }

    if (e.cancelable) e.preventDefault();
    renderMasterPosterPreview(true, dragMode);
  }

  function handleEnd() {
    if (isDragging) {
      isDragging = false;
      dragMode = null;
      if (previewCanvas) previewCanvas.style.cursor = 'grab';
      renderMasterPosterPreview(false);
    }
  }

  if (previewCanvas) {
    previewCanvas.style.touchAction = 'none';

    previewCanvas.addEventListener('pointerdown', (e) => {
      try { previewCanvas.setPointerCapture(e.pointerId); } catch(err) {}
      handleStart(e);
    });
    previewCanvas.addEventListener('pointermove', handleMove);
    previewCanvas.addEventListener('pointerup', handleEnd);
    previewCanvas.addEventListener('pointercancel', handleEnd);

    // Fallback touch events for iOS/Android edge cases
    previewCanvas.addEventListener('touchstart', (e) => {
      if (e.cancelable) e.preventDefault();
      handleStart(e);
    }, { passive: false });
    window.addEventListener('touchmove', (e) => {
      if (isDragging) {
        if (e.cancelable) e.preventDefault();
        handleMove(e);
      }
    }, { passive: false });
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('touchcancel', handleEnd);
  }
}

function updateMasterPosterStatusLabel() {
  const el = document.getElementById('masterPosterStatusText');
  if (!el) return;
  if (!currentMasterPosterUrl || currentMasterPosterUrl.includes('master_poster_default.jpg')) {
    el.innerHTML = '🟢 Active: Default Royal Emerald & Gold Master Poster';
  } else {
    el.innerHTML = '🟢 Active: Custom Uploaded Master Poster (Live across all candidates)';
  }
}

// Master Poster In-Memory Image Cache for Silky 60fps Dragging
let masterPosterImageCache = null;
let masterPosterCacheUrl = null;

async function getMasterPosterImage(url) {
  if (masterPosterCacheUrl === url && masterPosterImageCache && masterPosterImageCache.complete && masterPosterImageCache.naturalWidth > 0) {
    return masterPosterImageCache;
  }
  const img = await loadImgFromUrl(url);
  if (img && img.complete && img.naturalWidth > 0) {
    masterPosterImageCache = img;
    masterPosterCacheUrl = url;
  }
  return img;
}

async function renderMasterPosterPreview(isDragging = false, dragTarget = null) {
  const canvas = document.getElementById('masterPosterPreviewCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let posterImg = null;
  const urlToLoad = currentMasterPosterUrl || 'assets/master_poster_default.jpg';
  try {
    posterImg = await getMasterPosterImage(urlToLoad);
  } catch(e) {}

  if (!posterImg || !posterImg.complete || posterImg.naturalWidth === 0) {
    canvas.width = 1080;
    canvas.height = 1350;
    ctx.fillStyle = '#0a1710';
    ctx.fillRect(0, 0, 1080, 1350);
    ctx.fillStyle = '#fae8b2';
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Poster Preview Loading…', 540, 675);
    return;
  }

  canvas.width = posterImg.naturalWidth || 1080;
  canvas.height = posterImg.naturalHeight || 1350;
  ctx.drawImage(posterImg, 0, 0, canvas.width, canvas.height);

  const cfg = normalizePosterConfig(currentMasterPosterConfig);
  const boxW = canvas.width * (cfg.box_w / 100);
  const boxH = canvas.height * (cfg.box_h / 100);
  const centerX = canvas.width * (cfg.box_x / 100);
  const centerY = canvas.height * (cfg.box_y / 100);
  const boxX = centerX - (boxW / 2);
  const boxY = centerY - (boxH / 2);
  const curveRadius = Math.min(boxW, boxH) * (cfg.box_curve / 100);

  // 1. Draw Sample Face inside the adjustable Box with Curve (NO STROKE, NO BORDER)
  ctx.save();
  drawRoundedRectPath(ctx, boxX, boxY, boxW, boxH, curveRadius);
  ctx.clip();
  ctx.fillStyle = "#0d1b11";
  ctx.fill();

  // Sample portrait monogram or logo
  try {
    const logoImg = await getPosterLogo();
    if (logoImg) {
      const scale = Math.min(boxW / logoImg.naturalWidth, boxH / logoImg.naturalHeight) * 0.85;
      const lw = logoImg.naturalWidth * scale;
      const lh = logoImg.naturalHeight * scale;
      ctx.drawImage(logoImg, centerX - lw / 2, centerY - lh / 2, lw, lh);
    }
  } catch(e) {
    ctx.fillStyle = "#d4a73b";
    ctx.font = `800 ${Math.round(canvas.width * 0.08)}px 'Playfair Display', serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("RP", centerX, centerY);
  }
  ctx.restore();

  // 2. Draw Sample Candidate Name (Title Case: First Letter Capital, Initials Capital)
  if (cfg.show_name !== false) {
    const sampleName = formatPosterParticipantName("Sample Participant Name");
    const nameX = canvas.width * (cfg.name_x / 100);
    const nameY = canvas.height * (cfg.name_y / 100);
    const nameFontSize = Math.round(canvas.width * (cfg.name_size / 100));

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${nameFontSize}px 'Montserrat', 'Plus Jakarta Sans', 'Outfit', sans-serif`;
    ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
    ctx.shadowBlur = Math.max(6, nameFontSize * 0.35);
    ctx.fillStyle = cfg.name_color || "#ffffff";
    ctx.fillText(sampleName, nameX, nameY);
    ctx.restore();
  }

  // 3. Draw Touch / Drag Overlay Guides when touching or moving
  if (isDragging) {
    ctx.save();
    if (dragTarget === 'box') {
      ctx.strokeStyle = '#d4a73b';
      ctx.lineWidth = Math.max(3, canvas.width * 0.0035);
      ctx.setLineDash([10, 8]);
      drawRoundedRectPath(ctx, boxX, boxY, boxW, boxH, curveRadius);
      ctx.stroke();

      const handleR = Math.max(6, canvas.width * 0.009);
      ctx.fillStyle = '#fae8b2';
      ctx.strokeStyle = '#050c08';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      [[boxX, boxY], [boxX + boxW, boxY], [boxX, boxY + boxH], [boxX + boxW, boxY + boxH]].forEach(([hx, hy]) => {
        ctx.beginPath();
        ctx.arc(hx, hy, handleR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      const badgeW = 240, badgeH = 38;
      ctx.fillStyle = 'rgba(6, 14, 9, 0.9)';
      ctx.fillRect(centerX - badgeW/2, centerY - badgeH/2, badgeW, badgeH);
      ctx.strokeStyle = '#d4a73b';
      ctx.strokeRect(centerX - badgeW/2, centerY - badgeH/2, badgeW, badgeH);
      ctx.fillStyle = '#fae8b2';
      ctx.font = `bold ${Math.round(canvas.width * 0.024)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`📍 X: ${cfg.box_x}%  Y: ${cfg.box_y}%`, centerX, centerY);
    } else if (dragTarget === 'name') {
      const nameX = canvas.width * (cfg.name_x / 100);
      const nameY = canvas.height * (cfg.name_y / 100);
      const badgeW = 240, badgeH = 36;
      ctx.fillStyle = 'rgba(6, 14, 9, 0.9)';
      ctx.fillRect(nameX - badgeW/2, nameY - badgeH/2, badgeW, badgeH);
      ctx.strokeStyle = '#d4a73b';
      ctx.strokeRect(nameX - badgeW/2, nameY - badgeH/2, badgeW, badgeH);
      ctx.fillStyle = '#fae8b2';
      ctx.font = `bold ${Math.round(canvas.width * 0.022)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`✍️ Name: X ${cfg.name_x}%  Y ${cfg.name_y}%`, nameX, nameY);
    }
    ctx.restore();
  }
}

// ====================================================================
// REVIEW DOSSIER INSPECTOR MODAL
// ====================================================================

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
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:24px;">
      <!-- Left Column: Photo Studio & Media Review -->
      <div>
        <!-- Official Candidate Photo & Poster Studio Card -->
        <div style="background:#091710; border:1.5px solid var(--border-gold); border-radius:var(--radius-md); padding:18px; margin-bottom:20px; text-align:center;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h4 style="font-family:var(--font-serif); color:var(--gold-200); font-size:14.5px; margin:0; text-transform:uppercase;">
              📷 Candidate Photo &amp; Poster Studio
            </h4>
            <span style="font-size:11px; color:var(--gold-300); font-family:monospace;">${participant.registration_id}</span>
          </div>

          <div style="display:flex; align-items:center; justify-content:center; gap:18px; flex-wrap:wrap; margin-bottom:14px;">
            <!-- Circular Photo Frame -->
            <div style="position:relative; width:100px; height:100px; cursor:pointer;" onclick="document.getElementById('adminDossierPhotoInput').click()" title="Click to change candidate photo">
              <img id="dossierPhotoPreview" src="${participant.photo_url || 'assets/logo.png'}" alt="${escapeHtml(participant.full_name)}" style="width:100px; height:100px; border-radius:50%; border:3px solid var(--gold-primary); object-fit:cover; background:#040905; box-shadow:0 0 16px rgba(212,167,59,0.4);">
              <div style="position:absolute; bottom:0; right:2px; background:#000; border:1px solid var(--gold-primary); color:var(--gold-primary); border-radius:50%; width:26px; height:26px; display:grid; place-items:center; font-size:12px;">📷</div>
            </div>

            <div style="text-align:left; max-width:240px;">
              <strong style="color:#fff; font-size:15px; display:block;">${escapeHtml(participant.full_name)}</strong>
              <div style="font-size:11.5px; color:var(--text-muted); margin-bottom:8px;">Age: ${participant.age} Yrs • ${participant.category || 'Age 8 - 17 Years'}</div>
              
              <div style="display:flex; flex-direction:column; gap:6px;">
                <button type="button" class="btn-table-action" style="background:#1d6b43; color:#fff; border:none; padding:5px 12px; border-radius:4px; font-size:11.5px; cursor:pointer; text-align:left;" onclick="document.getElementById('adminDossierPhotoInput').click()">
                  📷 Upload / Change Photo
                </button>
                <button type="button" class="btn-table-action" style="background:var(--gold-primary); color:#000; font-weight:700; border:none; padding:5px 12px; border-radius:4px; font-size:11.5px; cursor:pointer; text-align:left;" onclick="adminDownloadPoster('${participant.registration_id}')">
                  📥 Download Official Poster (PNG)
                </button>
                ${participant.photo_url ? `
                  <button type="button" class="btn-table-action" style="background:rgba(239,68,68,0.14); border:1px solid rgba(239,68,68,0.4); color:#fca5a5; padding:3px 8px; border-radius:4px; font-size:11px; cursor:pointer; text-align:left;" onclick="adminDeletePosterPhoto('${participant.registration_id}')">
                    🗑️ Remove Photo
                  </button>
                ` : ''}
              </div>
              <input type="file" id="adminDossierPhotoInput" accept="image/*" style="display:none;" onchange="adminHandlePhotoChange(event, '${participant.registration_id}')">
            </div>
          </div>
          <small style="color:var(--text-muted); font-size:11px; display:block;">Poster automatically composites candidate face into the Master Template's middle round circle.</small>
        </div>

        <h4 style="font-family:var(--font-serif); color:var(--gold-200); font-size:15px; margin-bottom:10px; text-transform:uppercase;">
          🎥 Qirath Recitation Video
        </h4>
        <div style="background:#000; border-radius:var(--radius-sm); border:1px solid var(--border-gold); overflow:hidden; margin-bottom:18px;">
          ${(participant.video_url && participant.video_url.includes('WhatsApp')) ? `
            <div style="padding:22px 16px; text-align:center; background:#07120a;">
              <span style="font-size:28px; display:block; margin-bottom:8px;">📱</span>
              <strong style="color:#25d366; font-size:14px; display:block;">Submitted via WhatsApp (9632530219)</strong>
              <p style="color:var(--text-muted); font-size:12px; margin:6px 0 14px;">Candidate sent their recitation video directly to WhatsApp number +91 9632530219</p>
              <a href="https://wa.me/${(participant.whatsapp || participant.phone || '').replace(/\D/g, '')}" target="_blank" rel="noopener noreferrer" class="btn-nav-action btn-nav-gold" style="display:inline-flex; align-items:center; gap:8px; padding:8px 18px; text-decoration:none; font-size:12.5px;">
                💬 Open WhatsApp Chat with Candidate
              </a>
            </div>
          ` : (participant.video_url && (participant.video_url.includes('drive.google.com') || participant.video_url.includes('youtu') || !participant.video_url.match(/\.(mp4|mov|webm|avi|mkv|mp3|m4a|wav|aac|ogg)(\?.*)?$/i))) ? `
            <div style="padding:22px 16px; text-align:center; background:#0a1710;">
              <p style="color:var(--gold-200); font-weight:600; font-size:13.5px; margin-bottom:10px;">🔗 Cloud Video Link (Google Drive / YouTube)</p>
              <a href="${participant.video_url}" target="_blank" rel="noopener noreferrer" class="btn-nav-action btn-nav-gold" style="display:inline-flex; align-items:center; gap:8px; padding:8px 18px; text-decoration:none; font-size:12.5px;">
                ▶️ Open / Play Video in New Tab
              </a>
              <small style="display:block; color:var(--text-muted); margin-top:8px; font-size:11px; word-break:break-all;">${participant.video_url}</small>
            </div>
          ` : participant.video_url ? `
            <video src="${participant.video_url}" controls style="width:100%; max-height:260px; display:block;" preload="metadata"></video>
            <div style="padding:6px 12px; background:#07120a; text-align:right;">
              <a href="${participant.video_url}" target="_blank" rel="noopener noreferrer" style="color:var(--gold-200); font-size:11px; text-decoration:none;">⬇️ Open Original Video</a>
            </div>
          ` : `
            <div style="padding:20px; text-align:center; color:var(--text-muted); font-size:12px;">No video file attached.</div>
          `}
          ${participant.video_url ? `
            <div style="padding:8px 12px; background:#0b140e; border-top:1px solid #1a2a1e; text-align:right;">
              <button type="button" class="btn-table-action" style="background:rgba(239,68,68,0.14); border:1px solid rgba(239,68,68,0.4); color:#fca5a5; padding:4px 10px; border-radius:4px; font-size:11px; cursor:pointer;" onclick="adminDeleteCandidateVideo('${participant.registration_id}')">
                🗑️ Delete / Remove Video
              </button>
            </div>
          ` : ''}
        </div>

        <h4 style="font-family:var(--font-serif); color:var(--gold-200); font-size:15px; margin-bottom:10px; text-transform:uppercase;">
          🆔 Aadhaar Card Verification
        </h4>
        <div style="background:#000; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); overflow:hidden; text-align:center; padding:10px; margin-bottom:18px;">
          ${participant.aadhaar_url ? `
            <img src="${participant.aadhaar_url}" alt="Aadhaar photo" style="max-width:100%; max-height:190px; object-fit:contain; border-radius:4px; cursor:pointer;" onclick="window.open('${participant.aadhaar_url}', '_blank')">
            <small style="color:var(--text-muted); display:block; margin:4px 0 8px; font-size:11px;">Click photo to inspect full resolution</small>
            <div style="text-align:right;">
              <button type="button" class="btn-table-action" style="background:rgba(239,68,68,0.14); border:1px solid rgba(239,68,68,0.4); color:#fca5a5; padding:4px 10px; border-radius:4px; font-size:11px; cursor:pointer;" onclick="adminDeleteCandidateAadhaar('${participant.registration_id}')">
                🗑️ Delete / Remove Aadhaar
              </button>
            </div>
          ` : `<span style="color:var(--text-muted); font-size:12px;">Not required / No Aadhaar uploaded.</span>`}
        </div>

        <h4 style="font-family:var(--font-serif); color:var(--gold-200); font-size:15px; margin-bottom:10px; text-transform:uppercase;">
          📱 Social Follow Verification
        </h4>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div style="background:#091710; padding:8px; border-radius:6px; text-align:center; border:1px solid var(--border-subtle);">
            <span style="font-size:11px; color:#e1306c; font-weight:700; display:block; margin-bottom:4px;">Instagram Follow</span>
            ${participant.ig_screenshot_url ? `
              <img src="${participant.ig_screenshot_url}" alt="Instagram Proof" style="width:100%; height:110px; object-fit:cover; border-radius:4px; cursor:pointer;" onclick="window.open('${participant.ig_screenshot_url}', '_blank')">
            ` : `<span style="color:var(--text-muted); font-size:11.5px; display:block; padding:35px 0;">Not uploaded (Direct Link)</span>`}
          </div>
          <div style="background:#091710; padding:8px; border-radius:6px; text-align:center; border:1px solid var(--border-subtle);">
            <span style="font-size:11px; color:#25d366; font-weight:700; display:block; margin-bottom:4px;">WhatsApp Channel</span>
            ${participant.wa_screenshot_url ? `
              <img src="${participant.wa_screenshot_url}" alt="WhatsApp Proof" style="width:100%; height:110px; object-fit:cover; border-radius:4px; cursor:pointer;" onclick="window.open('${participant.wa_screenshot_url}', '_blank')">
            ` : `<span style="color:var(--text-muted); font-size:11.5px; display:block; padding:35px 0;">Not uploaded (Direct Link)</span>`}
          </div>
        </div>
      </div>

      <!-- Right Column: Participant Dossier & Grading -->
      <div>
        <div style="background:#091710; border:1px solid var(--border-gold); border-radius:var(--radius-md); padding:18px; margin-bottom:18px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <span class="status-pill ${statusClass}" id="dossierStatusBadge">${participant.status}</span>
            <span style="font-family:monospace; color:var(--gold-300); font-weight:700;">${participant.registration_id}</span>
          </div>
          <h3 style="font-size:19px; color:#fff; font-family:var(--font-serif); margin-bottom:2px;">${escapeHtml(participant.full_name)}</h3>
          <p style="color:var(--text-muted); font-size:12.5px; margin-bottom:12px;">
            ${participant.age} Years • ${participant.category || 'Age 8 - 17 Years'} • Reid &amp; Premium <strong>${participant.branch}</strong> Branch
          </p>

          <table style="width:100%; font-size:12.5px; line-height:1.75;">
            <tr><td style="color:var(--text-muted); width:32%;">Phone:</td><td><strong style="color:#fff;">${participant.phone}</strong></td></tr>
            <tr><td style="color:var(--text-muted);">WhatsApp:</td><td><strong style="color:#fff;">${participant.whatsapp || participant.phone}</strong></td></tr>
            <tr><td style="color:var(--text-muted);">Address:</td><td style="color:#d8d3c5;">${escapeHtml(participant.address || 'N/A')}, ${escapeHtml(participant.district || '')}</td></tr>
            ${participant.surah_recited ? `<tr><td style="color:var(--text-muted);">Surah Recited:</td><td><strong style="color:var(--gold-200);">📖 ${escapeHtml(participant.surah_recited)}</strong></td></tr>` : ''}
            <tr><td style="color:var(--text-muted);">Recitation Maqam:</td><td style="color:#fff;">${participant.maqam_style || 'Standard'}</td></tr>
          </table>
        </div>

        <!-- Judging & Status Change Box -->
        <div style="background:var(--bg-card); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:18px; margin-bottom:16px;">
          <h4 style="font-family:var(--font-serif); color:var(--gold-100); font-size:15px; margin-bottom:12px; text-transform:uppercase;">
            ⚖️ Official Assessment &amp; Status
          </h4>

          <div style="margin-bottom:12px;">
            <label style="display:block; font-size:11.5px; color:var(--text-muted); margin-bottom:4px; text-transform:uppercase; font-weight:600;">
              Judge Total Score (0 - 100):
            </label>
            <input type="number" id="dossierScoreInput" class="form-control" min="0" max="100" step="0.5" value="${participant.judge_score || ''}" placeholder="e.g. 94.0">
          </div>

          <div style="margin-bottom:14px;">
            <label style="display:block; font-size:11.5px; color:var(--text-muted); margin-bottom:4px; text-transform:uppercase; font-weight:600;">
              Judge Evaluation Notes / Comments:
            </label>
            <textarea id="dossierNotesInput" class="form-control" rows="2" placeholder="Tajweed, voice control, pronunciation...">${escapeHtml(participant.judge_notes || '')}</textarea>
          </div>

          <label style="display:block; font-size:11.5px; color:var(--text-muted); margin-bottom:6px; text-transform:uppercase; font-weight:600;">
            Update Status:
          </label>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:14px;">
            <button class="btn-nav-action btn-nav-gold" style="justify-content:center; padding:8px;" onclick="saveDossierStatus('Approved')">
              ✅ Approve Entry
            </button>
            <button class="btn-nav-action" style="justify-content:center; padding:8px; background:linear-gradient(135deg, #1d6b43, #22c55e); color:#fff; border:none;" onclick="saveDossierStatus('Shortlisted')">
              🌟 Shortlist Finale
            </button>
            <button class="btn-nav-action btn-nav-outline" style="justify-content:center; padding:8px;" onclick="saveDossierStatus('Pending Review')">
              ⏳ Keep Pending
            </button>
            <button class="btn-nav-action" style="justify-content:center; padding:8px; background:rgba(239, 68, 68, 0.18); border:1px solid rgba(239, 68, 68, 0.5); color:#f87171;" onclick="saveDossierStatus('Rejected')">
              ❌ Reject Entry
            </button>
          </div>

          <button class="btn-submit-entry" style="padding:10px; font-size:12.5px; background:#25d366; color:#06140b; border:none; width:100%; font-weight:700;" onclick="openWhatsAppChat('${participant.phone}', '${escapeHtml(participant.full_name)}', '${participant.registration_id}', '${participant.branch}', '${participant.status}')">
            📲 Send WhatsApp Status Update to Participant
          </button>
        </div>

        <!-- Danger Zone: Safe Delete Entry -->
        <div style="padding:12px 16px; background:rgba(239, 68, 68, 0.08); border:1px solid rgba(239, 68, 68, 0.3); border-radius:var(--radius-sm); display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong style="color:#f87171; font-size:12.5px; display:block;">Delete Entry &amp; Files</strong>
            <small style="color:var(--text-muted); font-size:11px;">Prompts confirmation + 10s undo</small>
          </div>
          <button type="button" class="btn-nav-action" style="background:#ef4444; color:#fff; border:none; padding:6px 14px; font-size:11.5px;" onclick="promptDeleteParticipant('${participant.registration_id}')">
            🗑️ Delete Entry
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
    message = `Assalamu Alaikum *${name}*,\n\nCongratulations! Your registration for the *All Karnataka Qirath Competition* (Reid & Premium ${branch} Branch) has been *APPROVED*! ✅\n\nRegistration ID: *${regId}*\nCategory: *Age 08 - 18 Years*\nOur judging panel will evaluate your recitation for the Grand Finale shortlist.\n\nBest Regards,\n*Reid & Premium Groom Studio*`;
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
    "Photo URL",
    "Video URL",
    "Aadhaar URL",
    "Registered At"
  ];

  const rows = list.map(p => [
    `"${p.registration_id || ''}"`,
    `"${(p.full_name || '').replace(/"/g, '""')}"`,
    p.age || '',
    `"${p.category || 'Age 8 - 17 Years'}"`,
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
    `"${p.photo_url || ''}"`,
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
      if (pinInput) pinInput.value = '';
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
      const existingPin = localStorage.getItem('AKQC_ADMIN_PIN') || 'RP26';
      const pin = pinInput.value.trim() || existingPin;

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
