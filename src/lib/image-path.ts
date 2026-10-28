const imageNamePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i;
const businessIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isMarketplaceImagePath(path: string) {
  const [businessId, imageName, ...extra] = path.split("/");
  return businessIdPattern.test(businessId) && Boolean(imageName) && extra.length === 0 && imageNamePattern.test(imageName);
}

export function isMarketplaceImagePathForBusiness(path: string, businessId: string) {
  return isMarketplaceImagePath(path) && path.split("/")[0] === businessId;
}
