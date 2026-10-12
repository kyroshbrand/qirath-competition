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
let currentMasterPosterConfig = { cx: 50, cy: 44.5, radius: 20 };
let posterLogoCache = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Check session authorization
  if (sessionStorage.getItem('AKQC_ADMIN_LOGGED_IN') !== 'true') {
    const pin = prompt("Enter Admin Access PIN (Password: RP26):");
    const validPin = (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.adminPin) ? SUPABASE_CONFIG.adminPin : "RP26";
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
  initPaginationControls();
  initSupabaseSettingsModal();
  initDeleteHandlers();
  initMasterPosterStudio();
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
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--gold-200);">Loading participant records…</td></tr>`;
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
  const emptyState = document.getElementById('emptyStateNotice');
  const paginationBar = document.getElementById('paginationBar');
  if (!tableBody) return;

  const filtered = getFilteredParticipants();

  if (filtered.length === 0) {
    tableBody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    if (paginationBar) paginationBar.style.display = 'none';
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

  // Update pagination indicator
  const infoEl = document.getElementById('paginationInfo');
  const pageEl = document.getElementById('paginationCurrentPage');
  const prevBtn = document.getElementById('btnPrevPage');
  const nextBtn = document.getElementById('btnNextPage');

  if (infoEl) infoEl.textContent = `Showing ${startIdx + 1} to ${endIdx} of ${filtered.length} entries`;
  if (pageEl) pageEl.textContent = `Page ${currentPage} of ${totalPages}`;
  if (prevBtn) prevBtn.disabled = (currentPage <= 1);
  if (nextBtn) nextBtn.disabled = (currentPage >= totalPages);

  tableBody.innerHTML = pageItems.map(p => {
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
          <div style="display:flex; align-items:center; gap:10px;">
            <img src="${p.photo_url || 'assets/logo.png'}" alt="" style="width:34px; height:34px; border-radius:50%; object-fit:cover; border:1.5px solid var(--gold-primary); background:#0c1710; flex-shrink:0;">
            <div>
              <strong style="color:#fff; font-size:14px; display:block;">${escapeHtml(p.full_name)}</strong>
              <div style="font-size:11.5px; color:var(--text-muted);">${p.age} Yrs • ${p.category || 'Age 8 - 18 Years'}</div>
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
          <span style="color:var(--text-gold); font-weight:500;">📖 ${escapeHtml(p.surah_recited || 'N/A')}</span>
          ${p.maqam_style ? `<div style="font-size:11.5px; color:var(--text-muted);">Style: ${p.maqam_style}</div>` : ''}
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
    return img;
  }
}

// Generate Official Candidate Poster with Master Template
async function generatePosterBlob(details, photoImgElement) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  let masterData = { url: 'assets/master_poster_default.jpg', config: { cx: 50, cy: 44.5, radius: 20 } };
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

  const pConfig = masterData.config || { cx: 50, cy: 44.5, radius: 20 };

  if (masterImg && masterImg.complete && masterImg.naturalWidth > 0) {
    // 1. Draw Master Template Poster
    canvas.width = masterImg.naturalWidth;
    canvas.height = masterImg.naturalHeight;
    ctx.drawImage(masterImg, 0, 0, canvas.width, canvas.height);

    // 2. Middle round circle coordinates
    const cx = canvas.width * (pConfig.cx / 100);
    const cy = canvas.height * (pConfig.cy / 100);
    const radius = canvas.width * (pConfig.radius / 100);

    // Circular Face Photo Frame
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius + (canvas.width * 0.012), 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(212, 167, 59, 0.45)";
    ctx.lineWidth = Math.max(3, canvas.width * 0.007);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius + (canvas.width * 0.004), 0, Math.PI * 2);
    ctx.strokeStyle = "#d4a73b";
    ctx.lineWidth = Math.max(4, canvas.width * 0.009);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#0c1710";
    ctx.fill();

    if (photoImgElement && photoImgElement.complete && photoImgElement.naturalWidth > 0) {
      const pw = photoImgElement.naturalWidth, ph = photoImgElement.naturalHeight;
      const size = Math.min(pw, ph);
      const sx = (pw - size) / 2, sy = (ph - size) / 2;
      ctx.drawImage(photoImgElement, sx, sy, size, size, cx - radius, cy - radius, radius * 2, radius * 2);
    } else {
      ctx.fillStyle = "#d4a73b";
      ctx.font = `800 ${Math.round(canvas.width * 0.09)}px 'Playfair Display', serif`;
      ctx.textAlign = "center";
      ctx.fillText("RP", cx, cy + (radius * 0.3));
    }
    ctx.restore();

    // 3. Name & Registration Overlay
    const textStartY = cy + radius + (canvas.height * 0.038);
    ctx.textAlign = "center";

    // Candidate Name
    const nameFontSize = Math.round(canvas.width * 0.046);
    ctx.font = `700 ${nameFontSize}px 'Playfair Display', serif`;
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.95)";
    ctx.shadowBlur = 14;
    ctx.fillText(details.full_name || 'Participant', cx, textStartY);
    ctx.shadowBlur = 0;

    // Registration ID badge
    const badgeW = Math.round(canvas.width * 0.38);
    const badgeH = Math.round(canvas.height * 0.028);
    const badgeX = cx - (badgeW / 2);
    const badgeY = textStartY + (canvas.height * 0.016);

    ctx.fillStyle = "rgba(8, 18, 12, 0.88)";
    ctx.strokeStyle = "#d4a73b";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#fae8b2";
    const idFontSize = Math.round(badgeH * 0.62);
    ctx.font = `700 ${idFontSize}px monospace`;
    ctx.fillText(details.registration_id, cx, badgeY + (badgeH * 0.72));

    // Branch & Category Subtitle
    const metaFontSize = Math.round(canvas.width * 0.024);
    ctx.font = `600 ${metaFontSize}px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillStyle = "#e0ded7";
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = 8;
    ctx.fillText(`Category: Age 08 - 18 Years  •  Reid & Premium ${details.branch} Branch`, cx, badgeY + badgeH + (canvas.height * 0.032));
    if (details.surah_recited) {
      ctx.fillStyle = "#fae8b2";
      ctx.fillText(`📖 Reciting: ${details.surah_recited}`, cx, badgeY + badgeH + (canvas.height * 0.058));
    }
    ctx.shadowBlur = 0;

  } else {
    // Default Royal Poster Generator Fallback
    canvas.width = 900;
    canvas.height = 1200;

    const grad = ctx.createRadialGradient(450, 360, 40, 450, 600, 750);
    grad.addColorStop(0, '#0d3822');
    grad.addColorStop(0.5, '#061a10');
    grad.addColorStop(1, '#020603');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 900, 1200);

    ctx.strokeStyle = '#d4a73b';
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, 840, 1140);
    ctx.strokeStyle = 'rgba(212, 167, 59, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(40, 40, 820, 1120);

    try {
      const logoImg = await getPosterLogo();
      ctx.drawImage(logoImg, 380, 60, 140, 115);
    } catch(e) {}

    ctx.textAlign = "center";
    ctx.fillStyle = "#fae8b2";
    ctx.font = "600 14px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText("REID & PREMIUM GROOM STUDIO PRESENTS", 450, 205);

    ctx.fillStyle = "#ffffff";
    ctx.font = "800 32px 'Playfair Display', serif";
    ctx.fillText("ALL KARNATAKA QIRATH", 450, 248);

    const titleGrad = ctx.createLinearGradient(200, 0, 700, 0);
    titleGrad.addColorStop(0, "#fae8b2");
    titleGrad.addColorStop(0.5, "#d4a73b");
    titleGrad.addColorStop(1, "#9e751d");
    ctx.fillStyle = titleGrad;
    ctx.fillText("COMPETITION 2026", 450, 290);

    const ribW = 480, ribH = 38, ribX = 450 - ribW/2, ribY = 315;
    ctx.fillStyle = titleGrad;
    ctx.beginPath();
    ctx.roundRect(ribX, ribY, ribW, ribH, 19);
    ctx.fill();

    ctx.fillStyle = "#050b07";
    ctx.font = "800 14px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText("★ CONGRATULATIONS! YOU ARE SELECTED ★", 450, 340);

    const cx = 450, cy = 525, radius = 135;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 8, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(212, 167, 59, 0.4)";
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
    ctx.strokeStyle = "#d4a73b";
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#0d1b11";
    ctx.fill();

    if (photoImgElement && photoImgElement.complete && photoImgElement.naturalWidth > 0) {
      const pw = photoImgElement.naturalWidth, ph = photoImgElement.naturalHeight;
      const size = Math.min(pw, ph);
      const sx = (pw - size) / 2, sy = (ph - size) / 2;
      ctx.drawImage(photoImgElement, sx, sy, size, size, cx - radius, cy - radius, radius * 2, radius * 2);
    } else {
      ctx.fillStyle = "#d4a73b";
      ctx.font = "800 70px 'Playfair Display', serif";
      ctx.fillText("RP", cx, cy + 25);
    }
    ctx.restore();

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 34px 'Playfair Display', serif";
    ctx.fillText(details.full_name || 'Candidate', 450, 715);

    const idW = 300, idH = 38, idX = 450 - idW/2, idY = 740;
    ctx.fillStyle = "rgba(212, 167, 59, 0.12)";
    ctx.strokeStyle = "#d4a73b";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(idX, idY, idW, idH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#fae8b2";
    ctx.font = "700 18px monospace";
    ctx.fillText(details.registration_id, 450, 765);

    ctx.fillStyle = "#d8d3c5";
    ctx.font = "600 16px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText(`Category: Age 08 - 18 Years  •  Reid & Premium ${details.branch} Branch`, 450, 815);
    if (details.surah_recited) {
      ctx.fillStyle = "#fae8b2";
      ctx.font = "500 15px 'Plus Jakarta Sans', sans-serif";
      ctx.fillText(`📖 Reciting: ${details.surah_recited}`, 450, 845);
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
  const sliderY = document.getElementById('sliderCircleY');
  const sliderRadius = document.getElementById('sliderCircleRadius');
  const labelY = document.getElementById('labelCircleY');
  const labelRadius = document.getElementById('labelCircleRadius');

  if (openBtn && modal) {
    openBtn.addEventListener('click', async () => {
      modal.classList.add('open');
      const data = await getMasterPosterFromBackend();
      currentMasterPosterUrl = data.url;
      currentMasterPosterConfig = data.config || { cx: 50, cy: 44.5, radius: 20 };
      if (sliderY) sliderY.value = currentMasterPosterConfig.cy;
      if (sliderRadius) sliderRadius.value = currentMasterPosterConfig.radius;
      if (labelY) labelY.textContent = currentMasterPosterConfig.cy + '%';
      if (labelRadius) labelRadius.textContent = currentMasterPosterConfig.radius + '%';
      updateMasterPosterStatusLabel();
      await renderMasterPosterPreview();
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

  if (sliderY) {
    sliderY.addEventListener('input', () => {
      currentMasterPosterConfig.cy = parseFloat(sliderY.value);
      if (labelY) labelY.textContent = sliderY.value + '%';
      renderMasterPosterPreview();
    });
  }

  if (sliderRadius) {
    sliderRadius.addEventListener('input', () => {
      currentMasterPosterConfig.radius = parseFloat(sliderRadius.value);
      if (labelRadius) labelRadius.textContent = sliderRadius.value + '%';
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
        currentMasterPosterConfig = { cx: 50, cy: 44.5, radius: 20 };
        if (sliderY) sliderY.value = 44.5;
        if (sliderRadius) sliderRadius.value = 20;
        if (labelY) labelY.textContent = '44.5%';
        if (labelRadius) labelRadius.textContent = '20%';
        await saveMasterPosterToBackend(currentMasterPosterUrl, currentMasterPosterConfig);
        updateMasterPosterStatusLabel();
        await renderMasterPosterPreview();
        alert("Reset to default Master Template Poster.");
      }
    });
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

async function renderMasterPosterPreview() {
  const canvas = document.getElementById('masterPosterPreviewCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let posterImg = null;
  const urlToLoad = currentMasterPosterUrl || 'assets/master_poster_default.jpg';
  try {
    posterImg = await loadImgFromUrl(urlToLoad);
  } catch(e) {}

  if (!posterImg || !posterImg.complete || posterImg.naturalWidth === 0) {
    canvas.width = 900;
    canvas.height = 1200;
    ctx.fillStyle = '#0a1710';
    ctx.fillRect(0, 0, 900, 1200);
    ctx.fillStyle = '#fae8b2';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Poster Preview Loading…', 450, 600);
    return;
  }

  canvas.width = posterImg.naturalWidth;
  canvas.height = posterImg.naturalHeight;
  ctx.drawImage(posterImg, 0, 0, canvas.width, canvas.height);

  const cx = canvas.width * (currentMasterPosterConfig.cx / 100);
  const cy = canvas.height * (currentMasterPosterConfig.cy / 100);
  const radius = canvas.width * (currentMasterPosterConfig.radius / 100);

  // Draw Sample Face inside the middle circular frame
  ctx.save();
  // Glowing gold outer ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius + (canvas.width * 0.012), 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(212, 167, 59, 0.45)";
  ctx.lineWidth = Math.max(3, canvas.width * 0.007);
  ctx.stroke();

  // Solid golden border ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius + (canvas.width * 0.004), 0, Math.PI * 2);
  ctx.strokeStyle = "#d4a73b";
  ctx.lineWidth = Math.max(4, canvas.width * 0.009);
  ctx.stroke();

  // Circular clip
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "#0d1b11";
  ctx.fill();

  // Sample portrait monogram or logo
  try {
    const logoImg = await getPosterLogo();
    if (logoImg) {
      ctx.drawImage(logoImg, cx - (radius * 0.7), cy - (radius * 0.7), radius * 1.4, radius * 1.4);
    }
  } catch(e) {
    ctx.fillStyle = "#d4a73b";
    ctx.font = `800 ${Math.round(canvas.width * 0.09)}px 'Playfair Display', serif`;
    ctx.textAlign = "center";
    ctx.fillText("RP", cx, cy + (radius * 0.3));
  }
  ctx.restore();

  // Draw sample candidate text overlay
  const textStartY = cy + radius + (canvas.height * 0.038);
  ctx.textAlign = "center";

  const nameFontSize = Math.round(canvas.width * 0.046);
  ctx.font = `700 ${nameFontSize}px 'Playfair Display', serif`;
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.95)";
  ctx.shadowBlur = 14;
  ctx.fillText("Sample Candidate Name", cx, textStartY);
  ctx.shadowBlur = 0;

  const badgeW = Math.round(canvas.width * 0.38);
  const badgeH = Math.round(canvas.height * 0.028);
  const badgeX = cx - (badgeW / 2);
  const badgeY = textStartY + (canvas.height * 0.016);

  ctx.fillStyle = "rgba(8, 18, 12, 0.88)";
  ctx.strokeStyle = "#d4a73b";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#fae8b2";
  const idFontSize = Math.round(badgeH * 0.62);
  ctx.font = `700 ${idFontSize}px monospace`;
  ctx.fillText("AKQC-2026-SAMPLE", cx, badgeY + (badgeH * 0.72));

  const metaFontSize = Math.round(canvas.width * 0.024);
  ctx.font = `600 ${metaFontSize}px 'Plus Jakarta Sans', sans-serif`;
  ctx.fillStyle = "#e0ded7";
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 8;
  ctx.fillText("Category: Age 08 - 18 Years  •  Reid & Premium Branch", cx, badgeY + badgeH + (canvas.height * 0.032));
  ctx.shadowBlur = 0;
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
              <div style="font-size:11.5px; color:var(--text-muted); margin-bottom:8px;">Age: ${participant.age} Yrs • ${participant.category || 'Age 8 - 18 Years'}</div>
              
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
          ${(participant.video_url && (participant.video_url.includes('drive.google.com') || participant.video_url.includes('youtu') || !participant.video_url.match(/\.(mp4|mov|webm|avi|mkv|mp3|m4a|wav|aac|ogg)(\?.*)?$/i))) ? `
            <div style="padding:22px 16px; text-align:center; background:#0a1710;">
              <p style="color:var(--gold-200); font-weight:600; font-size:13.5px; margin-bottom:10px;">🔗 Cloud Video Link (Google Drive / YouTube)</p>
              <a href="${participant.video_url}" target="_blank" rel="noopener noreferrer" class="btn-nav-action btn-nav-gold" style="display:inline-flex; align-items:center; gap:8px; padding:8px 18px; text-decoration:none; font-size:12.5px;">
                ▶️ Open / Play Video in New Tab
              </a>
              <small style="display:block; color:var(--text-muted); margin-top:8px; font-size:11px; word-break:break-all;">${participant.video_url}</small>
            </div>
          ` : `
            <video src="${participant.video_url}" controls style="width:100%; max-height:260px; display:block;" preload="metadata"></video>
            <div style="padding:6px 12px; background:#07120a; text-align:right;">
              <a href="${participant.video_url}" target="_blank" rel="noopener noreferrer" style="color:var(--gold-200); font-size:11px; text-decoration:none;">⬇️ Open Original Video</a>
            </div>
          `}
        </div>

        <h4 style="font-family:var(--font-serif); color:var(--gold-200); font-size:15px; margin-bottom:10px; text-transform:uppercase;">
          🆔 Aadhaar Card Verification
        </h4>
        <div style="background:#000; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); overflow:hidden; text-align:center; padding:10px; margin-bottom:18px;">
          <img src="${participant.aadhaar_url}" alt="Aadhaar photo" style="max-width:100%; max-height:190px; object-fit:contain; border-radius:4px; cursor:pointer;" onclick="window.open('${participant.aadhaar_url}', '_blank')">
          <small style="color:var(--text-muted); display:block; margin-top:4px; font-size:11px;">Click photo to inspect full resolution</small>
        </div>

        <h4 style="font-family:var(--font-serif); color:var(--gold-200); font-size:15px; margin-bottom:10px; text-transform:uppercase;">
          📱 Social Follow Verification
        </h4>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div style="background:#091710; padding:8px; border-radius:6px; text-align:center; border:1px solid var(--border-subtle);">
            <span style="font-size:11px; color:#e1306c; font-weight:700; display:block; margin-bottom:4px;">Instagram Follow</span>
            <img src="${participant.ig_screenshot_url}" alt="Instagram Proof" style="width:100%; height:110px; object-fit:cover; border-radius:4px; cursor:pointer;" onclick="window.open('${participant.ig_screenshot_url}', '_blank')">
          </div>
          <div style="background:#091710; padding:8px; border-radius:6px; text-align:center; border:1px solid var(--border-subtle);">
            <span style="font-size:11px; color:#25d366; font-weight:700; display:block; margin-bottom:4px;">WhatsApp Channel</span>
            <img src="${participant.wa_screenshot_url}" alt="WhatsApp Proof" style="width:100%; height:110px; object-fit:cover; border-radius:4px; cursor:pointer;" onclick="window.open('${participant.wa_screenshot_url}', '_blank')">
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
            ${participant.age} Years • ${participant.category || 'Age 8 - 18 Years'} • Reid &amp; Premium <strong>${participant.branch}</strong> Branch
          </p>

          <table style="width:100%; font-size:12.5px; line-height:1.75;">
            <tr><td style="color:var(--text-muted); width:32%;">Phone:</td><td><strong style="color:#fff;">${participant.phone}</strong></td></tr>
            <tr><td style="color:var(--text-muted);">WhatsApp:</td><td><strong style="color:#fff;">${participant.whatsapp || participant.phone}</strong></td></tr>
            <tr><td style="color:var(--text-muted);">Address:</td><td style="color:#d8d3c5;">${escapeHtml(participant.address || 'N/A')}, ${escapeHtml(participant.district || '')}</td></tr>
            <tr><td style="color:var(--text-muted);">Surah Recited:</td><td><strong style="color:var(--gold-200);">📖 ${escapeHtml(participant.surah_recited || 'N/A')}</strong></td></tr>
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
    `"${p.category || 'Age 8 - 18 Years'}"`,
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
