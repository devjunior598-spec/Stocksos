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
  visibility: string;
}) {
  const issues: string[] = [];
  if (!hasSpecificProductTitle(product.name)) issues.push("Add a specific product name buyers will recognize.");
  const hasPhoto = Boolean(product.image_path)
    || Boolean(product.media_paths?.some((path) => /\.(jpg|jpeg|png|webp)$/i.test(path)));
  if (product.visibility === "public" && !hasPhoto) issues.push("Add a cover photo before publishing publicly.");
  return issues;
}
