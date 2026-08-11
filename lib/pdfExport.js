import jsPDF from "jspdf";
import { nonEmptyMessagesForSide, sidesForDesign } from "./crosscheck";
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
 * Draws one sign marker at (0,0) in the current (already translated and
 * rotated) canvas context. Mirrors the shapes in components/SignMarker.js
 * so the plan view and PDF exports look the same:
 * - One Side Panel: a downward arrow above a baseline
 * - Two-Sided Structure: a bar with faces A (above) and B (below)
 * - 4-Sided Structure: a solid block with faces A/B/C/D
 * - anything else: a plain circle (no sign type chosen yet)
 */
function drawMarkerShape(ctx, size, design) {
  const stroke = "#1c2530";
  const fill = "#2f6f5e";

  if (design === "One Side Panel") {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = size * 0.12;
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.6);
    ctx.lineTo(0, -size * 0.05);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-size * 0.25, -size * 0.05);
    ctx.lineTo(size * 0.25, -size * 0.05);
    ctx.lineTo(0, size * 0.3);
    ctx.closePath();
    ctx.fillStyle = stroke;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-size * 0.5, size * 0.55);
    ctx.lineTo(size * 0.5, size * 0.55);
    ctx.stroke();
    return;
  }

  if (design === "Two-Sided Structure") {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = size * 0.1;
    ctx.beginPath();
    ctx.moveTo(-size * 0.5, 0);
    ctx.lineTo(size * 0.5, 0);
    ctx.stroke();
    ctx.fillStyle = stroke;
    ctx.font = `bold ${size * 0.35}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("A", 0, -size * 0.22);
    ctx.fillText("B", 0, size * 0.48);
    return;
  }

  if (design === "4-Sided Structure") {
    const half = size * 0.4;
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = size * 0.05;
    ctx.fillRect(-half, -half, half * 2, half * 2);
    ctx.strokeRect(-half, -half, half * 2, half * 2);
    ctx.fillStyle = stroke;
    ctx.font = `bold ${size * 0.26}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("A", 0, -half - size * 0.1);
    ctx.fillText("C", 0, half + size * 0.28);
    ctx.textAlign = "left";
    ctx.fillText("B", half + size * 0.08, size * 0.1);
    ctx.textAlign = "right";
    ctx.fillText("D", -half - size * 0.08, size * 0.1);
    return;
  }

  // Fallback: plain circle with white halo (previous default look).
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = size * 0.06;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

// PDF pages don't benefit from full native image resolution — the plan
// gets re-embedded fresh for every sign's page in the Message Schedule
// report (each needs a different dot highlighted), so an uncapped
// high-resolution source (especially a PDF-derived upload, rendered at
// 2.5x) can push the total document past the browser's maximum string
// length once there are more than a handful of signs. This caps the
// working resolution to something comfortably print-quality while
// keeping file size and generation reliable regardless of sign count.
const MAX_CANVAS_DIMENSION = 1800;

/**
 * Draws the plan image plus sign markers onto a canvas, capped to a
 * print-appropriate resolution. Optionally puts a red square around one
 * specific point, for the per-sign report. Each marker's shape reflects
 * its sign type's Sign Design, rotated by the sign's own rotation
 * setting; a white halo sits behind every marker so it stays visible
 * against busy or high-res floor plans.
 */
function drawPlanToCanvas(img, decisionPoints, signTypesById, { highlightId } = {}) {
  const scale = Math.min(1, MAX_CANVAS_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const toPxX = (pct) => (pct / 100) * canvas.width;
  const toPxY = (pct) => (pct / 100) * canvas.height;

  decisionPoints.forEach((p) => {
    const x = toPxX(p.x);
    const y = toPxY(p.y);
    const size = Math.max(20, canvas.width * 0.018);
    const design = signTypesById?.[p.sign_type_id]?.sign_design;
    const rotationDeg = p.rotation || 0;

    // White halo behind every marker, drawn in the unrotated frame so it
    // stays a plain circle regardless of the marker's own rotation.
    ctx.beginPath();
    ctx.arc(x, y, size * 0.62, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fill();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rotationDeg * Math.PI) / 180);
    drawMarkerShape(ctx, size, design);
    ctx.restore();

    if (p.sign_code) {
      const fontSize = Math.max(13, canvas.width * 0.009);
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = "left";
      const label = p.sign_code;
      const textW = ctx.measureText(label).width;
      const labelX = x + size * 0.7;
      const labelY = y - size * 0.5;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillRect(labelX - 3, labelY - fontSize, textW + 6, fontSize + 6);
      ctx.fillStyle = "#1c2530";
      ctx.fillText(label, labelX, labelY + 2);
    }

    if (highlightId && p.id === highlightId) {
      const s = size * 1.8;
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = Math.max(3.5, canvas.width * 0.0028);
      ctx.strokeRect(x - s / 2, y - s / 2, s, s);
    }
  });

  return canvas;
}

/** Downloads a single-page PDF of the plan with every sign location marked. */
/**
 * Downloads a multi-page PDF, one page per sign: the plan with that
 * sign's dot highlighted in red and its code at the top, plus a compact
 * panel alongside with Sign Code, Sign Type, Location, Functional Area,
 * and Comments. This is the quick-reference report — full message
 * content lives in the separate Message Schedule PDF.
 */
export async function downloadDotPlanPdf(plan, imageUrl, decisionPoints, signTypesById = {}) {
  const img = await loadImage(imageUrl);
  const signPoints = decisionPoints.filter((p) => p.point_type !== "dot");
  const orderedPoints = [...signPoints].sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0));

  if (orderedPoints.length === 0) {
    throw new Error("No signs on this plan yet.");
  }

  const pdf = new jsPDF({ orientation: "l", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 28;

  orderedPoints.forEach((point, index) => {
    if (index > 0) pdf.addPage();

    const code = point.sign_code || `Sign ${index + 1}`;
    pdf.setFontSize(16);
    pdf.setTextColor(28, 37, 48);
    pdf.text(code, margin, margin + 6);

    const panelX = pageWidth * 0.78;
    const panelW = pageWidth - panelX - margin;
    const areaW = panelX - margin - 16;
    const areaH = pageHeight - margin * 2 - 30;
    const canvas = drawPlanToCanvas(img, signPoints, signTypesById, { highlightId: point.id });
    const dataUrl = canvas.toDataURL("image/png");
    const scale = Math.min(areaW / canvas.width, areaH / canvas.height);
    const drawW = canvas.width * scale;
    const drawH = canvas.height * scale;
    const offsetX = margin + (areaW - drawW) / 2;
    pdf.addImage(dataUrl, "PNG", offsetX, margin + 30, drawW, drawH);

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

    sectionTitle("Sign code");
    boxedText([code], 30);

    sectionTitle("Sign type");
    const signTypeName =
      point.sign_type_id && signTypesById[point.sign_type_id] ? signTypesById[point.sign_type_id].name : "";
    boxedText([signTypeName], 30);

    sectionTitle("Location");
    const locationLines = point.location
      ? point.location.split("\n").map((l) => l.trim()).filter(Boolean)
      : [];
    boxedText(locationLines, 40);

    sectionTitle("Functional area");
    const faLines = point.functional_area
      ? point.functional_area.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    boxedText(faLines, 40);

    sectionTitle("Comments");
    const commentLines = point.comments
      ? point.comments.split("\n").map((l) => l.trim()).filter(Boolean)
      : [];
    boxedText(commentLines, 60);
  });

  pdf.save(`${plan.name} - dot plan.pdf`);
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

/** Loads a file from a storage bucket and returns it as a canvas, capped to a print-appropriate resolution, or null on failure/absence. */
async function loadBucketImageCanvas(bucket, imagePath) {
  if (!imagePath) return null;
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(imagePath);
    const img = await loadImage(data.publicUrl);
    const scale = Math.min(1, MAX_CANVAS_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } catch {
    return null;
  }
}

/**
 * Downloads a multi-page PDF, one page per dot location (point_type
 * "dot"): the plan — showing only dot locations, no sign markers — with
 * that dot highlighted in red, its code at the top, and its Location and
 * Comments in a small panel alongside.
 */
export async function downloadDotPlanReportPdf(plan, imageUrl, decisionPoints) {
  const img = await loadImage(imageUrl);
  const dotPoints = decisionPoints.filter((p) => p.point_type === "dot");
  const orderedPoints = [...dotPoints].sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0));

  if (orderedPoints.length === 0) {
    throw new Error("No dot locations on this plan yet — add some with \"Add Dot Location\" first.");
  }

  const pdf = new jsPDF({ orientation: "l", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 28;

  orderedPoints.forEach((point, index) => {
    if (index > 0) pdf.addPage();

    const code = point.sign_code || `Dot ${index + 1}`;
    pdf.setFontSize(16);
    pdf.setTextColor(28, 37, 48);
    pdf.text(code, margin, margin + 6);

    const panelX = pageWidth * 0.78;
    const panelW = pageWidth - panelX - margin;
    const areaW = panelX - margin - 16;
    const areaH = pageHeight - margin * 2 - 30;
    // Only dot locations are drawn — sign markers are intentionally
    // excluded so this report stays focused on dot locations alone.
    const canvas = drawPlanToCanvas(img, dotPoints, {}, { highlightId: point.id });
    const dataUrl = canvas.toDataURL("image/png");
    const scale = Math.min(areaW / canvas.width, areaH / canvas.height);
    const drawW = canvas.width * scale;
    const drawH = canvas.height * scale;
    const offsetX = margin + (areaW - drawW) / 2;
    pdf.addImage(dataUrl, "PNG", offsetX, margin + 30, drawW, drawH);

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

    sectionTitle("Location");
    const locationLines = point.location
      ? point.location.split("\n").map((l) => l.trim()).filter(Boolean)
      : [];
    boxedText(locationLines, 60);

    sectionTitle("Comments");
    const commentLines = point.comments
      ? point.comments.split("\n").map((l) => l.trim()).filter(Boolean)
      : [];
    boxedText(commentLines, 80);
  });

  pdf.save(`${plan.name} - dot plan report.pdf`);
}

/**
 * Draws one message board (one side's worth of messages) inside the
 * given rectangle: a bordered box with a "SIDE X" header and each
 * message's text, arrow, pictogram, and — where the message is linked to
 * a glossary term — its ES/FR/PT translations underneath.
 */
async function drawMessageBoard(pdf, x, y, w, h, sideLabel, messages, getPictogramCanvas, glossaryTermsById = {}) {
  pdf.setDrawColor(220, 220, 220);
  pdf.rect(x, y, w, h);

  pdf.setFont(undefined, "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(90, 100, 110);
  pdf.text(`SIDE ${sideLabel}`, x + 8, y + 16);
  pdf.setFont(undefined, "normal");

  if (messages.length === 0) return;

  pdf.setFontSize(11);
  pdf.setTextColor(28, 37, 48);
  const lineHeight = 15;
  const translationLineHeight = 12;
  let ty = y + 34;
  const maxY = y + h - 6;

  for (const m of messages) {
    if (ty > maxY) break;
    const pictogramCanvas = await getPictogramCanvas(m.pictogram_id);
    const wrapped = pdf.splitTextToSize(m.text || " ", w - 34);
    for (let i = 0; i < wrapped.length; i++) {
      if (ty > maxY) break;
      pdf.setFontSize(11);
      pdf.setTextColor(28, 37, 48);
      pdf.text(wrapped[i], x + 8, ty);
      if (i === 0) {
        if (m.arrow) drawArrowIcon(pdf, x + w - 26, ty - 3.5, m.arrow, 11);
        if (pictogramCanvas) {
          const iconSize = 11;
          const s = Math.min(iconSize / pictogramCanvas.width, iconSize / pictogramCanvas.height);
          pdf.addImage(
            pictogramCanvas.toDataURL("image/png"),
            "PNG",
            x + w - 12 - (pictogramCanvas.width * s) / 2,
            ty - 3.5 - (pictogramCanvas.height * s) / 2,
            pictogramCanvas.width * s,
            pictogramCanvas.height * s
          );
        }
      }
      ty += lineHeight;
    }

    const term = m.glossary_id ? glossaryTermsById[m.glossary_id] : null;
    if (term) {
      const translations = [
        term.term_es && `ES: ${term.term_es}`,
        term.term_fr && `FR: ${term.term_fr}`,
        term.term_pt && `PT: ${term.term_pt}`,
      ].filter(Boolean);
      if (translations.length) {
        pdf.setFontSize(9);
        pdf.setTextColor(120, 130, 140);
        for (const line of translations) {
          if (ty > maxY) break;
          pdf.text(line, x + 14, ty);
          ty += translationLineHeight;
        }
      }
    }
  }
}

/**
 * Downloads a multi-page PDF, two pages per sign (point_type "sign"):
 *   Page 1 — the plan with that sign's dot highlighted in red, its code
 *            at the top, and its Photo/Artwork below (if any).
 *   Page 2 — its full content: message boards (1, 2, or 4 depending on
 *            the sign's design) laid out dynamically across the page,
 *            plus functional area, sign type, location/status, and
 *            comments in a side column.
 */
export async function downloadMessageSchedulePdf(
  plan,
  imageUrl,
  decisionPoints,
  signTypesById,
  pictogramsById = {},
  glossaryTermsById = {}
) {
  const img = await loadImage(imageUrl);
  const signPoints = decisionPoints.filter((p) => p.point_type !== "dot");
  const orderedPoints = [...signPoints].sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0));

  if (orderedPoints.length === 0) {
    throw new Error("No signs on this plan yet.");
  }

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

    // ---------- PAGE 1: plan + highlight + photo/artwork ----------
    pdf.setFontSize(16);
    pdf.setTextColor(28, 37, 48);
    pdf.text(signCode, margin, margin + 6);

    const photoCanvas = await loadBucketImageCanvas("dot-images", point.image_path);
    const artworkCanvas = await loadBucketImageCanvas("dot-images", point.artwork_path);
    const hasBottomRow = !!(photoCanvas || artworkCanvas);

    const planTop = margin + 30;
    const planBottom = pageHeight - margin;
    const availH = planBottom - planTop;
    const availW = pageWidth - margin * 2;
    const gap = 10;
    const rowTargetH = hasBottomRow ? Math.min(150, availH * 0.28) : 0;
    const planAreaH = availH - (hasBottomRow ? rowTargetH + gap : 0);

    // Only sign markers are drawn here — dot locations are a separate,
    // simpler system and stay out of the sign-focused report.
    const canvas = drawPlanToCanvas(img, signPoints, signTypesById, { highlightId: point.id });
    const dataUrl = canvas.toDataURL("image/png");
    const planScale = Math.min(availW / canvas.width, planAreaH / canvas.height);
    const planDrawW = canvas.width * planScale;
    const planDrawH = canvas.height * planScale;
    const planOffsetX = margin + (availW - planDrawW) / 2;
    pdf.addImage(dataUrl, "PNG", planOffsetX, planTop, planDrawW, planDrawH);

    if (hasBottomRow) {
      const rowY = planTop + planDrawH + gap;
      const colGap = 10;
      const colW = (availW - colGap) / 2;
      const rowMaxH = Math.min(rowTargetH, planBottom - rowY - 14);

      pdf.setFontSize(9);
      pdf.setTextColor(120, 130, 140);

      pdf.text("PHOTO", margin, rowY - 2);
      if (photoCanvas) {
        const s = Math.min(colW / photoCanvas.width, rowMaxH / photoCanvas.height);
        pdf.addImage(
          photoCanvas.toDataURL("image/png"),
          "PNG",
          margin,
          rowY + 4,
          photoCanvas.width * s,
          photoCanvas.height * s
        );
      }

      const artX = margin + colW + colGap;
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

    // ---------- PAGE 2: message boards + sign details ----------
    pdf.addPage();
    pdf.setFontSize(16);
    pdf.setTextColor(28, 37, 48);
    pdf.text(`${signCode} — Message Schedule`, margin, margin + 6);

    const design = point.sign_type_id ? signTypesById[point.sign_type_id]?.sign_design : null;
    const sides = sidesForDesign(design);

    const infoX = pageWidth * 0.72;
    const infoW = pageWidth - infoX - margin;
    let cursorY = margin + 40;

    function sectionTitle(label) {
      pdf.setFontSize(10);
      pdf.setTextColor(120, 130, 140);
      pdf.text(label.toUpperCase(), infoX, cursorY);
      cursorY += 14;
    }

    function boxedText(lines, minHeight) {
      const lineHeight = 14;
      const content = lines.length ? lines : [""];
      const contentHeight = Math.max(minHeight, content.length * lineHeight + 16);
      pdf.setDrawColor(220, 220, 220);
      pdf.rect(infoX, cursorY, infoW, contentHeight);
      pdf.setFontSize(11);
      pdf.setTextColor(28, 37, 48);
      let ty = cursorY + 18;
      content.forEach((line) => {
        const wrapped = pdf.splitTextToSize(line, infoW - 16);
        wrapped.forEach((wl) => {
          pdf.text(wl, infoX + 8, ty);
          ty += lineHeight;
        });
      });
      cursorY += contentHeight + 16;
    }

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

    // Message boards fill the rest of the page, laid out dynamically
    // depending on how many sides this sign's design has.
    const mainX = margin;
    const mainTop = margin + 30;
    const mainBottom = pageHeight - margin;
    const mainW = infoX - mainX - 16;
    const mainH = mainBottom - mainTop;
    const boardGap = 12;

    let boardRects;
    if (sides.length <= 1) {
      boardRects = [{ side: sides[0] || "A", x: mainX, y: mainTop, w: mainW, h: mainH }];
    } else if (sides.length === 2) {
      const bw = (mainW - boardGap) / 2;
      boardRects = [
        { side: sides[0], x: mainX, y: mainTop, w: bw, h: mainH },
        { side: sides[1], x: mainX + bw + boardGap, y: mainTop, w: bw, h: mainH },
      ];
    } else {
      const bw = (mainW - boardGap) / 2;
      const bh = (mainH - boardGap) / 2;
      boardRects = [
        { side: sides[0], x: mainX, y: mainTop, w: bw, h: bh },
        { side: sides[1], x: mainX + bw + boardGap, y: mainTop, w: bw, h: bh },
        { side: sides[2], x: mainX, y: mainTop + bh + boardGap, w: bw, h: bh },
        { side: sides[3], x: mainX + bw + boardGap, y: mainTop + bh + boardGap, w: bw, h: bh },
      ];
    }

    for (const rect of boardRects) {
      const messages = nonEmptyMessagesForSide(point.message_slots, rect.side);
      await drawMessageBoard(pdf, rect.x, rect.y, rect.w, rect.h, rect.side, messages, getPictogramCanvas, glossaryTermsById);
    }
  }

  pdf.save(`${plan.name} - message schedule.pdf`);
}
