const genericProductTitles = new Set([
  "good", "item", "new item", "product", "new product", "product name",
  "sample", "sample product", "test", "testing", "test product", "your product",
]);

export function hasSpecificProductTitle(title: string) {
  const normalized = title.trim().toLowerCase().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  return normalized.length >= 3 && !genericProductTitles.has(normalized);
}

export function getProductListingQualityIssues(product: {
  name: string;
  image_path: string | null;
  media_paths?: string[] | null;
  specifications?: string | null;
  visibility: string;
}) {
  const issues: string[] = [];
  if (!hasSpecificProductTitle(product.name)) issues.push("Add a specific product name buyers will recognize.");
  const hasPhoto = Boolean(product.image_path)
    || Boolean(product.media_paths?.some((path) => /\.(jpg|jpeg|png|webp)$/i.test(path)));
  if (product.visibility === "public" && !hasPhoto) issues.push("Add a cover photo before publishing publicly.");
  return issues;
}

export function getProductDistributionReadiness(product: {
  name: string;
  image_path: string | null;
  media_paths?: string[] | null;
  specifications?: string | null;
  visibility: string;
  inventory?: { quantity_available: number; unit_price_kobo: number } | { quantity_available: number; unit_price_kobo: number }[] | null;
}) {
  const issues = getProductListingQualityIssues(product);
  const stock = Array.isArray(product.inventory) ? product.inventory[0] : product.inventory;
  const hasPhoto = Boolean(product.image_path)
    || Boolean(product.media_paths?.some((path) => /\.(jpg|jpeg|png|webp)$/i.test(path)));
  const hasDetails = (product.specifications?.trim().length ?? 0) >= 40;
  const hasPrice = Number(stock?.unit_price_kobo ?? 0) > 0;
  const inStock = Number(stock?.quantity_available ?? 0) > 0;

  if (!hasDetails) issues.push("Add at least a short description so customers understand the product.");
  if (!hasPrice) issues.push("Add a current unit price before sharing this listing.");
  if (!inStock) issues.push("Update available stock before promoting this listing.");

  const score = [
    hasSpecificProductTitle(product.name),
    hasPhoto,
    hasDetails,
    hasPrice,
    inStock,
    product.visibility === "public",
  ].reduce((total, complete) => total + (complete ? 1 : 0), 0);

  return {
    score: Math.round((score / 6) * 100),
    ready: score === 6,
    issues,
  };
}
