import { dominantColours } from "../../page/logo-colours";
import { MAX_LOGO_LENGTH } from "../../page/theme";

const MAX_WIDTH = 320;
const MAX_HEIGHT = 120;

/** A picked image file as a small data URL for the header, plus its main colours. Null when it cannot be read or stays too large. */
export async function readLogo(file: Blob): Promise<{ logo: string; logoColors: string[] } | null> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return null;
  try {
    const bitmap = await createImageBitmap(file);
    for (const scale of [1, 0.75, 0.5, 0.35]) {
      const fit = Math.min(MAX_WIDTH / bitmap.width, MAX_HEIGHT / bitmap.height, 1) * scale;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * fit));
      canvas.height = Math.max(1, Math.round(bitmap.height * fit));
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const logo = canvas.toDataURL("image/webp", 0.9);
      if (/^data:image\/(png|jpeg|webp);base64,/.test(logo) && logo.length <= MAX_LOGO_LENGTH) {
        return { logo, logoColors: dominantColours(context.getImageData(0, 0, canvas.width, canvas.height).data) };
      }
    }
  } catch {
    // Not an image the browser can decode.
  }
  return null;
}
