import jsPDF from "jspdf";
import { nonEmptyMessages } from "./crosscheck";
import { supabase } from "./supabaseClient";

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Draws the plan image plus sign markers onto a canvas at the image's
 * native resolution. Optionally puts a red square around one specific
 * point, for the per-sign report. Markers are drawn as a solid colored
 * dot with a white halo so they stay visible against busy or high-res
 * floor plans, rather than a thin outline that can get lost.
 */
function drawPlanToCanvas(img, decisionPoints, { highlightId } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const toPxX = (pct) => (pct / 100) * canvas.width;
  const toPxY = (pct) => (pct / 100) * canvas.height;

  decisionPoints.forEach((p) => {
    const x = toPxX(p.x);
    const y = toPxY(p.y);
    const r = Math.max(9, canvas.width * 0.008);

    // White halo first, so the dot reads clearly on any background.
    ctx.beginPath();
    ctx.arc(x, y, r + 3, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    // Solid colored dot on top.
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = "#2f6f5e";
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, canvas.width * 0.001);
    ctx.strokeStyle = "#1c2530";
    ctx.stroke();

    if (p.sign_code) {
      const fontSize = Math.max(13, canvas.width * 0.009);
      ctx.font = `bold ${fontSize}px sans-serif`;
      const label = p.sign_code;
      const textW = ctx.measureText(label).width;
      // Small white backing rectangle behind the label for legibility.
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillRect(x + r + 4, y - r - fontSize - 2, textW + 6, fontSize + 6);
      ctx.fillStyle = "#1c2530";
      ctx.fillText(label, x + r + 7, y - r + 2);
    }

    if (highlightId && p.id === highlightId) {
      const s = r * 3.6;
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = Math.max(3.5, canvas.width * 0.0028);
      ctx.strokeRect(x - s / 2, y - s / 2, s, s);
    }
  });

  return canvas;
}

/** Downloads a single-page PDF of the plan with every sign location marked. */
export async function downloadPlanPdf(plan, imageUrl, decisionPoints) {
  const img = await loadImage(imageUrl);
  const canvas = drawPlanToCanvas(img, decisionPoints);
  const dataUrl = canvas.toDataURL("image/png");

  const orientation = canvas.width >= canvas.height ? "l" : "p";
  const pdf = new jsPDF({ orientation, unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 24;
  const availW = pageWidth - margin * 2;
  const availH = pageHeight - margin * 2 - 24;

  const scale = Math.min(availW / canvas.width, availH / canvas.height);
  const drawW = canvas.width * scale;
  const drawH = canvas.height * scale;
  const offsetX = (pageWidth - drawW) / 2;
  const offsetY = margin + 24;

  pdf.setFontSize(14);
  pdf.text(plan.name, margin, margin + 10);
  pdf.addImage(dataUrl, "PNG", offsetX, offsetY, drawW, drawH);

  pdf.save(`${plan.name} - sign locations.pdf`);
}

// Angle (degrees, 0 = pointing right, increasing clockwise since PDF
// y-coordinates increase downward) for each arrow direction.
const ARROW_ANGLES = {
  "↑": 270,
  "↗": 315,
  "→": 0,
  "↘": 45,
  "↓": 90,
  "↙": 135,
  "←": 180,
  "↖": 225,
};

/**
 * Draws a small vector arrow at (cx, cy). jsPDF's built-in fonts only
 * support basic Latin text, so a Unicode arrow character (↑, ↗, etc.)
 * renders as a fallback glyph instead of the actual arrow — drawing it
 * as a line + triangle avoids that entirely.
 */
function drawArrowIcon(pdf, cx, cy, arrowChar, size) {
  const angleDeg = ARROW_ANGLES[arrowChar];
  if (angleDeg === undefined) return;
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);

  const tailX = cx - (dx * size) / 2;
  const tailY = cy - (dy * size) / 2;
  const tipX = cx + (dx * size) / 2;
  const tipY = cy + (dy * size) / 2;

  pdf.setDrawColor(28, 37, 48);
  pdf.setLineWidth(1.1);
  pdf.line(tailX, tailY, tipX, tipY);

  const headLen = size * 0.4;
  const headAngle = (28 * Math.PI) / 180;
  const leftX = tipX - headLen * Math.cos(rad - headAngle);
  const leftY = tipY - headLen * Math.sin(rad - headAngle);
  const rightX = tipX - headLen * Math.cos(rad + headAngle);
  const rightY = tipY - headLen * Math.sin(rad + headAngle);

  pdf.setFillColor(28, 37, 48);
  pdf.triangle(tipX, tipY, leftX, leftY, rightX, rightY, "F");
}

/** Loads a file from a storage bucket and returns it as a canvas, or null on failure/absence. */
async function loadBucketImageCanvas(bucket, imagePath) {
  if (!imagePath) return null;
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(imagePath);
    const img = await loadImage(data.publicUrl);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d").drawImage(img, 0, 0);
    return canvas;
  } catch {
    return null;
  }
}

/**
 * Downloads a multi-page PDF, one page per sign (decision point): the
 * plan with that sign's dot highlighted in red, plus a panel with its
 * messages, functional area, and sign type.
 */
export async function downloadSignReportPdf(plan, imageUrl, decisionPoints, signTypesById, pictogramsById = {}) {
  const img = await loadImage(imageUrl);
  const orderedPoints = [...decisionPoints].sort(
    (a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0)
  );

  if (orderedPoints.length === 0) {
    throw new Error("No signs (decision points) on this plan yet.");
  }

  // Cache pictogram canvases across the whole report — the same
  // pictogram is often reused across many messages/signs.
  const pictogramCanvasCache = {};
  async function getPictogramCanvas(pictogramId) {
    if (!pictogramId) return null;
    if (pictogramId in pictogramCanvasCache) return pictogramCanvasCache[pictogramId];
    const pictogram = pictogramsById[pictogramId];
    const canvas = pictogram ? await loadBucketImageCanvas("pictograms", pictogram.image_path) : null;
    pictogramCanvasCache[pictogramId] = canvas;
    return canvas;
  }

  const pdf = new jsPDF({ orientation: "l", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 28;

  for (let index = 0; index < orderedPoints.length; index++) {
    const point = orderedPoints[index];
    if (index > 0) pdf.addPage();

    const signCode = point.sign_code || `Sign ${index + 1}`;

    pdf.setFontSize(16);
    pdf.setTextColor(28, 37, 48);
    pdf.text(signCode, margin, margin + 6);

    // Try loading Photo and Artwork first, so we know up front whether to
    // reserve a row for them below the plan — if neither exists (or both
    // fail to load), the plan simply gets the full column height.
    const photoCanvas = await loadBucketImageCanvas("dot-images", point.image_path);
    const artworkCanvas = await loadBucketImageCanvas("dot-images", point.artwork_path);
    const hasBottomRow = !!(photoCanvas || artworkCanvas);

    const leftX = margin;
    const leftTop = margin + 30;
    const leftBottom = pageHeight - margin;
    const leftAvailH = leftBottom - leftTop;
    const planAreaW = pageWidth * 0.58 - margin;
    const gap = 10;

    // The photo/artwork row gets up to ~32% of the column, capped at
    // 150pt, so the plan always keeps the majority of the space.
    const rowTargetH = hasBottomRow ? Math.min(150, leftAvailH * 0.32) : 0;
    const planAreaH = leftAvailH - (hasBottomRow ? rowTargetH + gap : 0);

    const canvas = drawPlanToCanvas(img, decisionPoints, { highlightId: point.id });
    const dataUrl = canvas.toDataURL("image/png");
    const planScale = Math.min(planAreaW / canvas.width, planAreaH / canvas.height);
    const planDrawW = canvas.width * planScale;
    const planDrawH = canvas.height * planScale;
    pdf.addImage(dataUrl, "PNG", leftX, leftTop, planDrawW, planDrawH);

    if (hasBottomRow) {
      const rowY = leftTop + planDrawH + gap;
      const colGap = 10;
      const colW = (planAreaW - colGap) / 2;
      const rowMaxH = Math.min(rowTargetH, leftBottom - rowY - 14);

      pdf.setFontSize(9);
      pdf.setTextColor(120, 130, 140);

      pdf.text("PHOTO", leftX, rowY - 2);
      if (photoCanvas) {
        const s = Math.min(colW / photoCanvas.width, rowMaxH / photoCanvas.height);
        pdf.addImage(
          photoCanvas.toDataURL("image/png"),
          "PNG",
          leftX,
          rowY + 4,
          photoCanvas.width * s,
          photoCanvas.height * s
        );
      }

      const artX = leftX + colW + colGap;
      pdf.text("ARTWORK", artX, rowY - 2);
      if (artworkCanvas) {
        const s = Math.min(colW / artworkCanvas.width, rowMaxH / artworkCanvas.height);
        pdf.addImage(
          artworkCanvas.toDataURL("image/png"),
          "PNG",
          artX,
          rowY + 4,
          artworkCanvas.width * s,
          artworkCanvas.height * s
        );
      }
    }

    const panelX = pageWidth * 0.62;
    const panelW = pageWidth - panelX - margin;
    let cursorY = margin + 40;

    function sectionTitle(label) {
      pdf.setFontSize(10);
      pdf.setTextColor(120, 130, 140);
      pdf.text(label.toUpperCase(), panelX, cursorY);
      cursorY += 14;
    }

    function boxedText(lines, minHeight) {
      const lineHeight = 14;
      const content = lines.length ? lines : [""];
      const contentHeight = Math.max(minHeight, content.length * lineHeight + 16);
      pdf.setDrawColor(220, 220, 220);
      pdf.rect(panelX, cursorY, panelW, contentHeight);
      pdf.setFontSize(11);
      pdf.setTextColor(28, 37, 48);
      let ty = cursorY + 18;
      content.forEach((line) => {
        const wrapped = pdf.splitTextToSize(line, panelW - 16);
        wrapped.forEach((wl) => {
          pdf.text(wl, panelX + 8, ty);
          ty += lineHeight;
        });
      });
      cursorY += contentHeight + 16;
    }

    // Messages get their own renderer: the text goes through pdf.text()
    // as usual, while the arrow and pictogram are drawn as small icons
    // near the right edge — "message - arrow - pictogram".
    sectionTitle("Messages");
    const messages = nonEmptyMessages(point.message_slots);
    const lineHeight = 14;
    const messagesBoxHeight = Math.max(100, (messages.length || 1) * lineHeight + 16);
    pdf.setDrawColor(220, 220, 220);
    pdf.rect(panelX, cursorY, panelW, messagesBoxHeight);
    pdf.setFontSize(11);
    pdf.setTextColor(28, 37, 48);
    if (messages.length === 0) {
      // Left blank rather than a placeholder character.
    } else {
      let ty = cursorY + 18;
      for (const m of messages) {
        const pictogramCanvas = await getPictogramCanvas(m.pictogram_id);
        const wrapped = pdf.splitTextToSize(m.text || " ", panelW - 44);
        for (let i = 0; i < wrapped.length; i++) {
          pdf.text(wrapped[i], panelX + 8, ty);
          if (i === 0) {
            if (m.arrow) {
              drawArrowIcon(pdf, panelX + panelW - 26, ty - 3.5, m.arrow, 11);
            }
            if (pictogramCanvas) {
              const iconSize = 11;
              const s = Math.min(iconSize / pictogramCanvas.width, iconSize / pictogramCanvas.height);
              pdf.addImage(
                pictogramCanvas.toDataURL("image/png"),
                "PNG",
                panelX + panelW - 12 - (pictogramCanvas.width * s) / 2,
                ty - 3.5 - (pictogramCanvas.height * s) / 2,
                pictogramCanvas.width * s,
                pictogramCanvas.height * s
              );
            }
          }
          ty += lineHeight;
        }
      }
    }
    cursorY += messagesBoxHeight + 16;

    sectionTitle("Functional area");
    const faLines = point.functional_area
      ? point.functional_area.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    boxedText(faLines, 40);

    sectionTitle("Sign type");
    const signTypeName =
      point.sign_type_id && signTypesById[point.sign_type_id]
        ? signTypesById[point.sign_type_id].name
        : "Not selected";
    boxedText([signTypeName], 30);

    sectionTitle("Location / status");
    boxedText([point.location || "", point.status || "Draft"], 40);

    sectionTitle("Comments");
    const commentLines = point.comments
      ? point.comments.split("\n").map((l) => l.trim()).filter(Boolean)
      : [];
    boxedText(commentLines, 40);
  }

  pdf.save(`${plan.name} - sign report.pdf`);
}
