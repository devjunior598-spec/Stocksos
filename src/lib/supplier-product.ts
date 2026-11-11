const photoExtension = /\.(?:jpg|png|webp)$/i;
const videoExtension = /\.(?:mp4|webm)$/i;

export function validProductMedia(paths: string[], coverPath: string) {
  const photos = paths.filter((path) => photoExtension.test(path));
  const videos = paths.filter((path) => videoExtension.test(path));
  return photos.length <= 10 && videos.length <= 1 && photos.length + videos.length === paths.length
    && new Set(paths).size === paths.length
    && (!coverPath || photos.includes(coverPath));
}

export function publicProductRequirements({
  visibility, active = true, priceMinor, quantity, coverPath,
}: {
  visibility: string;
  active?: boolean;
  priceMinor: number | null;
  quantity: number;
  coverPath: string;
}): "photo" | "price" | "stock" | null {
  if (visibility !== "public" || !active) return null;
  if (!coverPath) return "photo";
  if (priceMinor === null || priceMinor <= 0) return "price";
  if (quantity <= 0) return "stock";
  return null;
}
