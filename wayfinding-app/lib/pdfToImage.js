/**
 * Converts the first page of a PDF file into a PNG blob, entirely in the
 * browser. Used when someone uploads a PDF plan instead of a JPG/PNG —
 * the rest of the app only ever deals with images, so this is the one
 * place PDF-specific handling happens.
 */
export async function renderPdfFirstPageToBlob(file, scale = 2.5) {
  const pdfjsLib = await import("pdfjs-dist/build/pdf");
  // Pointing at the matching CDN build avoids bundling the worker as a
  // webpack asset, which trips up the production minifier on this file.
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");

  await page.render({ canvasContext: ctx, viewport }).promise;

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}
