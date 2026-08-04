/**
 * Redraws an uploaded image onto a canvas and re-exports it as a plain
 * PNG. This "bakes in" whatever orientation the browser displays it
 * with (modern browsers auto-rotate on-screen display based on EXIF
 * data from phone cameras/scanners), so every later use of this image
 * — the live editor, PDF exports, anything — works from the exact same
 * pixel layout. Without this step, a photo with EXIF rotation can look
 * correctly oriented in the browser while canvas-based exports read the
 * raw, unrotated pixels underneath, causing dot positions to appear
 * shifted between the editor and downloaded PDFs.
 */
export async function normalizeImageToPngBlob(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}
