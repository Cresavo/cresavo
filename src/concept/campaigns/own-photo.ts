// A photo from the owner's phone or computer, used for one poster. It stays in
// this browser tab (an object URL) until photos can be saved with the salon.

const MAX_SIDE = 1600;

export const isOwnPhoto = (image: string) => image.startsWith("blob:");

/** The photo scaled down to at most 1600 px on its longest side, as an object URL for this tab. A PNG stays PNG, so a cut-out keeps its transparency. */
export async function ownPhotoUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Not an image");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.88));
  if (!blob) throw new Error("Could not read the photo");
  return URL.createObjectURL(blob);
}
