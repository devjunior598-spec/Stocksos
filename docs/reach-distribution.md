# StockSOS product discovery and distribution

## Available without external platform accounts

When an approved supplier publishes a public product with available inventory, StockSOS can show it in the marketplace, on the supplier storefront, in the product sitemap, and in the public RSS feed at `/feeds/products`. The product page has shareable metadata. Suppliers can use the existing sharing tools to send a listing through their device share sheet or supported share links. These features do not require a paid advertising account.

The RSS feed and sitemap help compatible services discover public listings; they do not guarantee indexing, ranking, traffic, sales, or posting on another platform. Only approved, public, in-stock products appear in the feed.

## Requires each platform's setup

Publishing directly to Instagram, Facebook, TikTok, Pinterest, YouTube, LinkedIn, X, or WhatsApp needs the appropriate official account, API access, and the owner or supplier's authorization. Some platforms require app review, business verification, or a particular content format. Python can prepare captions, images, feed exports, and schedules, but cannot bypass platform access controls. Do not scrape accounts, store passwords for posting bots, or present a share link as an automated publication.

## Next integration steps

1. Confirm StockSOS's registered legal operator and platform ownership.
2. Create and verify the official business and developer accounts for each chosen channel.
3. Implement a supplier consent screen that states which products and permissions each channel receives.
4. Store OAuth tokens server side with encryption, rotation, and revocation support.
5. Add a reviewable publishing queue with channel specific validation, retries, and audit history.
6. Label each channel in the UI as connected, pending review, or unavailable based on its real status.

No external social publishing is enabled by the current product feed.
