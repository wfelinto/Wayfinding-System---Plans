import jsPDF from "jspdf";
import { nonEmptyMessages, formatMessageLine } from "./crosscheck";

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
 * point, for the per-sign report.
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
    const r = Math.max(5, canvas.width * 0.005);

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = Math.max(2, canvas.width * 0.0015);
    ctx.strokeStyle = "#2f6f5e";
    ctx.stroke();

    if (p.sign_code) {
      ctx.fillStyle = "#1c2530";
      ctx.font = `${Math.max(11, canvas.width * 0.007)}px sans-serif`;
      ctx.fillText(p.sign_code, x + r + 4, y - r - 2);
    }

    if (highlightId && p.id === highlightId) {
      const s = r * 3.2;
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = Math.max(3, canvas.width * 0.0022);
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

    sectionTitle("Messages");
    const messageLines = nonEmptyMessages(point.message_slots).map(formatMessageLine);
    boxedText(messageLines, 100);

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
  });

  pdf.save(`${plan.name} - sign report.pdf`);
}
