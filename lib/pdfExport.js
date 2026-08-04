import jsPDF from "jspdf";
import { nonEmptyMessages } from "./crosscheck";

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

/**
 * Downloads a multi-page PDF, one page per sign (decision point): the
 * plan with that sign's dot highlighted in red, plus a panel with its
 * messages, functional area, and sign type.
 */
export async function downloadSignReportPdf(plan, imageUrl, decisionPoints, signTypesById) {
  const img = await loadImage(imageUrl);
  const orderedPoints = [...decisionPoints].sort(
    (a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0)
  );

  if (orderedPoints.length === 0) {
    throw new Error("No signs (decision points) on this plan yet.");
  }

  const pdf = new jsPDF({ orientation: "l", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 28;

  orderedPoints.forEach((point, index) => {
    if (index > 0) pdf.addPage();

    const signCode = point.sign_code || `Sign ${index + 1}`;

    pdf.setFontSize(16);
    pdf.setTextColor(28, 37, 48);
    pdf.text(signCode, margin, margin + 6);

    const planAreaW = pageWidth * 0.58 - margin;
    const planAreaH = pageHeight - margin * 2 - 30;
    const canvas = drawPlanToCanvas(img, decisionPoints, { highlightId: point.id });
    const dataUrl = canvas.toDataURL("image/png");
    const scale = Math.min(planAreaW / canvas.width, planAreaH / canvas.height);
    const drawW = canvas.width * scale;
    const drawH = canvas.height * scale;
    pdf.addImage(dataUrl, "PNG", margin, margin + 30, drawW, drawH);

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
      const content = lines.length ? lines : ["—"];
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
    // as usual, but each arrow is drawn as a small vector icon on the
    // right edge of the box instead of embedded in the text string.
    sectionTitle("Messages");
    const messages = nonEmptyMessages(point.message_slots);
    const lineHeight = 14;
    const messagesBoxHeight = Math.max(100, (messages.length || 1) * lineHeight + 16);
    pdf.setDrawColor(220, 220, 220);
    pdf.rect(panelX, cursorY, panelW, messagesBoxHeight);
    pdf.setFontSize(11);
    pdf.setTextColor(28, 37, 48);
    if (messages.length === 0) {
      pdf.text("—", panelX + 8, cursorY + 18);
    } else {
      let ty = cursorY + 18;
      messages.forEach((m) => {
        const wrapped = pdf.splitTextToSize(m.text || " ", panelW - 30);
        wrapped.forEach((wl, i) => {
          pdf.text(wl, panelX + 8, ty);
          if (i === 0 && m.arrow) {
            drawArrowIcon(pdf, panelX + panelW - 14, ty - 3.5, m.arrow, 11);
          }
          ty += lineHeight;
        });
      });
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
    boxedText([point.location || "—", point.status || "Draft"], 40);

    sectionTitle("Comments");
    const commentLines = point.comments
      ? point.comments.split("\n").map((l) => l.trim()).filter(Boolean)
      : [];
    boxedText(commentLines, 40);
  });

  pdf.save(`${plan.name} - sign report.pdf`);
}
