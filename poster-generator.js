/**
 * ====================================================================
 * ALL KARNATAKA QIRATH COMPETITION - OFFICIAL POSTER GENERATOR
 * Generates Royal Gold & Dark Emerald Celebratory Story/Status Posters
 * ====================================================================
 */

/**
 * Loads an image from a URL or File/Blob object
 */
function loadImageSource(src) {
  return new Promise((resolve, reject) => {
    if (!src) return resolve(null);
    if (src instanceof HTMLImageElement && src.complete && src.naturalWidth) {
      return resolve(src);
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn("Could not load image source:", src);
      resolve(null);
    };
    if (src instanceof Blob || src instanceof File) {
      img.src = URL.createObjectURL(src);
    } else {
      img.src = src;
    }
  });
}

/**
 * Generates a 1080x1350 High-Definition Official Competition Poster
 * @param {Object} participant - { full_name, registration_id, branch, age, category, surah_recited }
 * @param {string|File|Blob|Image} photoSource - Candidate portrait photo
 * @returns {Promise<HTMLCanvasElement>}
 */
async function generateCompetitionPoster(participant, photoSource) {
  const width = 1080;
  const height = 1350;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // 1. Background Gradient (Royal Emerald Obsidian)
  const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, 850);
  bgGrad.addColorStop(0, "#0c1d14");
  bgGrad.addColorStop(0.5, "#08130d");
  bgGrad.addColorStop(1, "#030705");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle luxury star-dust pattern
  ctx.fillStyle = "rgba(212, 167, 59, 0.04)";
  for (let i = 0; i < 90; i++) {
    const rx = (i * 127) % width;
    const ry = (i * 193) % height;
    ctx.beginPath();
    ctx.arc(rx, ry, (i % 3) + 1, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Ornate Golden Borders
  // Outer border
  ctx.strokeStyle = "rgba(212, 167, 59, 0.4)";
  ctx.lineWidth = 2;
  ctx.strokeRect(32, 32, width - 64, height - 64);

  // Inner border
  const goldGrad = ctx.createLinearGradient(0, 0, width, height);
  goldGrad.addColorStop(0, "#fae8b2");
  goldGrad.addColorStop(0.5, "#d4a73b");
  goldGrad.addColorStop(1, "#9e751d");

  ctx.strokeStyle = goldGrad;
  ctx.lineWidth = 4;
  ctx.strokeRect(46, 46, width - 92, height - 92);

  // Corner Accents (Triangles/Diamonds)
  const corners = [
    [46, 46],
    [width - 46, 46],
    [46, height - 46],
    [width - 46, height - 46]
  ];
  ctx.fillStyle = goldGrad;
  corners.forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fill();
  });

  // 3. Top Reid & Premium Crown Logo
  try {
    const logoImg = await loadImageSource("assets/logo.png");
    if (logoImg) {
      const logoW = 160;
      const logoH = (logoImg.height / logoImg.width) * logoW;
      ctx.drawImage(logoImg, (width - logoW) / 2, 68, logoW, logoH);
    }
  } catch (e) {
    console.warn("Logo draw skipped", e);
  }

  // 4. Header Titles
  ctx.textAlign = "center";
  ctx.fillStyle = "#fae8b2";
  ctx.font = "600 16px 'Plus Jakarta Sans', sans-serif";
  ctx.letterSpacing = "6px";
  ctx.fillText("REID & PREMIUM GROOM STUDIO PRESENTS", width / 2, 246);

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 42px 'Playfair Display', serif";
  ctx.letterSpacing = "2px";
  ctx.fillText("ALL KARNATAKA QIRATH", width / 2, 296);

  ctx.fillStyle = goldGrad;
  ctx.font = "800 42px 'Playfair Display', serif";
  ctx.fillText("COMPETITION 2026", width / 2, 346);

  // Top Subtitle Badge
  ctx.fillStyle = "rgba(212, 167, 59, 0.15)";
  ctx.strokeStyle = "rgba(212, 167, 59, 0.4)";
  ctx.lineWidth = 1.5;
  const badgeW = 340;
  const badgeH = 34;
  roundRect(ctx, (width - badgeW) / 2, 366, badgeW, badgeH, 17);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#fae8b2";
  ctx.font = "700 13px 'Plus Jakarta Sans', sans-serif";
  ctx.letterSpacing = "3px";
  ctx.fillText("STATE LEVEL • AGE 08 TO 18 YEARS", width / 2, 388);

  // 5. Center Round Photo Frame (Candidate Portrait)
  const portraitCenterX = width / 2;
  const portraitCenterY = 580;
  const portraitRadius = 150;

  // Outer gold glow aura
  const auraGrad = ctx.createRadialGradient(
    portraitCenterX, portraitCenterY, portraitRadius - 10,
    portraitCenterX, portraitCenterY, portraitRadius + 35
  );
  auraGrad.addColorStop(0, "rgba(212, 167, 59, 0.6)");
  auraGrad.addColorStop(0.5, "rgba(212, 167, 59, 0.2)");
  auraGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = auraGrad;
  ctx.beginPath();
  ctx.arc(portraitCenterX, portraitCenterY, portraitRadius + 35, 0, Math.PI * 2);
  ctx.fill();

  // Photo Drawing (Clipped in circle)
  let photoImg = await loadImageSource(photoSource);
  ctx.save();
  ctx.beginPath();
  ctx.arc(portraitCenterX, portraitCenterY, portraitRadius, 0, Math.PI * 2);
  ctx.clip();

  if (photoImg) {
    // Cover photo proportionally inside circle
    const diameter = portraitRadius * 2;
    let sw = photoImg.width;
    let sh = photoImg.height;
    let dw, dh, dx, dy;

    if (sw > sh) {
      dh = diameter;
      dw = (sw / sh) * diameter;
      dx = portraitCenterX - dw / 2;
      dy = portraitCenterY - portraitRadius;
    } else {
      dw = diameter;
      dh = (sh / sw) * diameter;
      dx = portraitCenterX - portraitRadius;
      dy = portraitCenterY - dh / 2;
    }
    ctx.drawImage(photoImg, dx, dy, dw, dh);
  } else {
    // Default Royal Monogram Silhouette if photo not uploaded
    ctx.fillStyle = "#0c1711";
    ctx.fillRect(portraitCenterX - portraitRadius, portraitCenterY - portraitRadius, portraitRadius * 2, portraitRadius * 2);
    ctx.fillStyle = goldGrad;
    ctx.font = "800 64px 'Playfair Display', serif";
    ctx.fillText("RP", portraitCenterX, portraitCenterY + 22);
  }
  ctx.restore();

  // Outer Golden Ring Frame
  ctx.strokeStyle = goldGrad;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(portraitCenterX, portraitCenterY, portraitRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Inner ring
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(portraitCenterX, portraitCenterY, portraitRadius - 6, 0, Math.PI * 2);
  ctx.stroke();

  // Verified Badge underneath photo
  const ribbonW = 280;
  const ribbonH = 36;
  const ribbonY = portraitCenterY + portraitRadius - 16;
  ctx.fillStyle = "#040906";
  ctx.strokeStyle = goldGrad;
  ctx.lineWidth = 2;
  roundRect(ctx, (width - ribbonW) / 2, ribbonY, ribbonW, ribbonH, 18);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#fae8b2";
  ctx.font = "800 12.5px 'Plus Jakarta Sans', sans-serif";
  ctx.letterSpacing = "2px";
  ctx.fillText("★ OFFICIAL PARTICIPANT ★", width / 2, ribbonY + 23);

  // 6. Congratulations Header
  ctx.fillStyle = goldGrad;
  ctx.font = "800 36px 'Playfair Display', serif";
  ctx.letterSpacing = "3px";
  ctx.fillText("CONGRATULATIONS!", width / 2, 800);

  ctx.fillStyle = "#d4cfc2";
  ctx.font = "500 16px 'Plus Jakarta Sans', sans-serif";
  ctx.letterSpacing = "1.5px";
  ctx.fillText("YOUR ENTRY IS OFFICIALLY REGISTERED & SELECTED FOR REVIEW", width / 2, 836);

  // 7. Participant Full Name
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 40px 'Playfair Display', serif";
  ctx.letterSpacing = "1px";
  const pName = (participant.full_name || "Honorable Candidate").toUpperCase();
  ctx.fillText(pName, width / 2, 900);

  // Thin gold divider under name
  ctx.strokeStyle = goldGrad;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 140, 922);
  ctx.lineTo(width / 2 + 140, 922);
  ctx.stroke();

  // 8. Details Strip Cards (ID, Branch, Category)
  const cardY = 955;
  const cardH = 90;
  const cardW = 900;
  const cardX = (width - cardW) / 2;

  ctx.fillStyle = "rgba(12, 27, 18, 0.85)";
  ctx.strokeStyle = "rgba(212, 167, 59, 0.35)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, cardX, cardY, cardW, cardH, 12);
  ctx.fill();
  ctx.stroke();

  // Column 1: Reg ID
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(212, 167, 59, 0.8)";
  ctx.font = "700 12px 'Plus Jakarta Sans', sans-serif";
  ctx.letterSpacing = "2px";
  ctx.fillText("REGISTRATION ID", cardX + 160, cardY + 34);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 22px monospace";
  ctx.fillText(participant.registration_id || "AKQC-2026", cardX + 160, cardY + 66);

  // Vertical divider
  ctx.strokeStyle = "rgba(212, 167, 59, 0.25)";
  ctx.beginPath();
  ctx.moveTo(cardX + 310, cardY + 16);
  ctx.lineTo(cardX + 310, cardY + cardH - 16);
  ctx.stroke();

  // Column 2: Branch
  ctx.fillStyle = "rgba(212, 167, 59, 0.8)";
  ctx.font = "700 12px 'Plus Jakarta Sans', sans-serif";
  ctx.letterSpacing = "2px";
  ctx.fillText("REID & PREMIUM BRANCH", cardX + 460, cardY + 34);
  ctx.fillStyle = "#fae8b2";
  ctx.font = "700 20px 'Playfair Display', serif";
  ctx.fillText((participant.branch || "Karnataka") + " Branch", cardX + 460, cardY + 66);

  // Vertical divider
  ctx.beginPath();
  ctx.moveTo(cardX + 610, cardY + 16);
  ctx.lineTo(cardX + 610, cardY + cardH - 16);
  ctx.stroke();

  // Column 3: Age & Category
  ctx.fillStyle = "rgba(212, 167, 59, 0.8)";
  ctx.font = "700 12px 'Plus Jakarta Sans', sans-serif";
  ctx.letterSpacing = "2px";
  ctx.fillText("COMPETITION AGE", cardX + 750, cardY + 34);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 20px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText(`${participant.age || '8-18'} Yrs • General`, cardX + 750, cardY + 66);

  // Recitation mention
  if (participant.surah_recited) {
    ctx.fillStyle = "rgba(250, 232, 178, 0.9)";
    ctx.font = "600 15px 'Plus Jakarta Sans', sans-serif";
    ctx.letterSpacing = "1px";
    ctx.fillText(`📖 Recited: ${participant.surah_recited}`, width / 2, 1086);
  }

  // 9. Callout Box for Story & Status Sharing
  const shareBoxY = 1120;
  const shareBoxW = 760;
  const shareBoxH = 54;
  ctx.fillStyle = "rgba(212, 167, 59, 0.1)";
  ctx.strokeStyle = "rgba(212, 167, 59, 0.4)";
  ctx.lineWidth = 1;
  roundRect(ctx, (width - shareBoxW) / 2, shareBoxY, shareBoxW, shareBoxH, 27);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#fae8b2";
  ctx.font = "600 14px 'Plus Jakarta Sans', sans-serif";
  ctx.letterSpacing = "1.5px";
  ctx.fillText("SHARE ON INSTAGRAM STORY & WHATSAPP STATUS", width / 2, shareBoxY + 33);

  // 10. Footer Brand Stamp
  ctx.fillStyle = "#9ca3af";
  ctx.font = "500 13px 'Plus Jakarta Sans', sans-serif";
  ctx.letterSpacing = "3px";
  ctx.fillText("PUTTUR  •  THOKKOTU  •  B.C ROAD  •  SULLIA", width / 2, 1225);

  ctx.fillStyle = goldGrad;
  ctx.font = "700 16px 'Plus Jakarta Sans', sans-serif";
  ctx.letterSpacing = "1px";
  ctx.fillText("reidandpremium.kyrosh.in", width / 2, 1260);

  return canvas;
}

/**
 * Helper to draw rounded rectangle on Canvas
 */
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Triggers HD poster download (.PNG)
 */
function downloadPosterCanvas(canvas, filename = "AKQC_Congratulations_Poster.png") {
  canvas.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }, "image/png");
}

/**
 * Shares directly to WhatsApp Status / App using Web Share API or WhatsApp link
 */
async function sharePosterToWhatsApp(canvas, participant) {
  const shareText = `Alhamdulillah! I have officially registered for the All Karnataka Qirath Competition presented by Reid & Premium Groom Studio!\n\nCandidate: ${participant.full_name}\nRegistration ID: ${participant.registration_id}\nBranch: ${participant.branch}\n\nTrack or Register at: https://reidandpremium.kyrosh.in`;

  // Try Native Web Share with file (Android / iPhone)
  if (navigator.canShare) {
    try {
      const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
      const file = new File([blob], `${participant.registration_id}_Poster.png`, { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "All Karnataka Qirath Competition Poster",
          text: shareText
        });
        return;
      }
    } catch (e) {
      console.log("Native file share fallback", e);
    }
  }

  // Fallback: Download poster and open WhatsApp web/intent
  downloadPosterCanvas(canvas, `${participant.registration_id}_Poster.png`);
  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
  window.open(waUrl, "_blank");
}

/**
 * Shares to Instagram Story (Downloads HD poster and directs to Instagram)
 */
async function sharePosterToInstagram(canvas, participant) {
  // If native share supports images, try opening system share sheet (Instagram Story)
  if (navigator.canShare) {
    try {
      const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
      const file = new File([blob], `${participant.registration_id}_Story.png`, { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Instagram Story Poster",
          text: `All Karnataka Qirath Competition • Reid & Premium Groom Studio @reid_and_premium`
        });
        return;
      }
    } catch (e) {
      console.log("Instagram native share fallback", e);
    }
  }

  // Fallback: Download file and open Instagram
  downloadPosterCanvas(canvas, `${participant.registration_id}_Story_Poster.png`);
  alert("Poster downloaded to your photos! Open Instagram, tap '+' > Story, select this poster, and tag @reid_and_premium");
  window.open("https://instagram.com", "_blank");
}
