# StockSOS Reach — account and partnership readiness

Last reviewed: 2026-10-30. This is a preparation tracker, not proof that an account or application exists. Do not put passwords, access tokens, private keys, verification documents, or payment information in this file. Update statuses only after checking the relevant account.

## Business details to confirm

- Legal business name, registration status and jurisdiction; registration number if applicable.
- Official website: owner selected `https://socksos.vercel.app`. Authority to verify it remains to be established.
- Official business contact email, support contact, phone and business address, where required by a platform.
- Authorized representative, their role, and documentation requested by each platform. The owner must complete identity verification and legal attestations.
- Platform account owners, access administrators, intended supplier markets and languages, and whether each integration supports organic sharing, catalogs, ads, or marketplace orders.
- Public privacy policy, terms, support contact, data deletion and supplier consent explanations reviewed for the actual operation. Existing privacy and terms pages explicitly call for legal review.
- Test supplier account, authorized test business and catalog, demonstration videos, and a functioning end-to-end integration before requesting permissions that require review.

## Draft company description — owner review

StockSOS is a worldwide business-to-business platform that helps buyers find inventory and connect with suppliers. Approved suppliers can manage product listings, respond to sourcing requests and manage orders through the platform. StockSOS Reach is being developed to help suppliers prepare and distribute eligible listings through supported search, social, advertising and marketplace channels.

## Draft integration and partnership description — proposal, not a claim of completed capabilities

StockSOS plans to let an authorized supplier choose a channel and explicitly grant the access needed for that channel. With the supplier's permission, the planned integration would synchronize eligible product details such as title, description, images, price and availability, subject to each platform's catalog rules. Suppliers would be able to review channel settings and disconnect access. StockSOS intends to limit permissions, protect credentials on the server, restrict business data by membership, and report synchronization errors. Advertising tools would require supplier review of creative, budget and campaign settings before activation. These controls must be implemented and verified before being represented as operational in an application.

## Website readiness

- `https://socksos.vercel.app/`, `/privacy`, `/terms`, `/contact`, `/robots.txt` and `/sitemap.xml` returned HTTP 200 on 2026-10-30. This does not establish ownership, indexing or policy compliance.
- Live `https://socksos.vercel.app/robots.txt` references `https://stocksos-7k4m2p9x.vercel.app/sitemap.xml`, and the sitemap contains that other host. A source change sets search metadata and sharing links to the owner-selected host; preview, review and production deployment are still required before Search Console submission.
- Privacy and terms pages exist but explicitly state they require legal review. Confirm actual data use, support contact, retention, deletion instructions, supplier consent and platform requirements before application review.
- Public catalog information must be checked for image, price, currency, availability, product identifiers, landing-page accuracy and destination-specific policies. Google Merchant Center and other channels have their own eligibility rules; no feed is confirmed ready.
- DNS verification records cannot be determined before the platform generates a challenge. A URL-prefix verification method may be available when DNS for a hosted subdomain is not under direct control. [Search Console ownership](https://support.google.com/webmasters/answer/9008080), [Search Console properties](https://support.google.com/webmasters/answer/34592).

## Account tracker

Status key: **Not verified** means no account or application was observed; it does not prove none exists. All verification and review statuses below are unknown. No registration or application has been submitted in this work.

| Platform | Official start or documentation | Account / verification / app / review | Intended access and next action |
| --- | --- | --- | --- |
| Google Search Console | [Start](https://search.google.com/search-console/about) | Not verified / unknown / n/a / unknown | Confirm canonical URL and sign in; add URL-prefix property, choose available ownership method, submit correct sitemap. DNS TXT only if Google supplies one and applicable DNS is controlled. |
| Google Cloud | [Console](https://console.cloud.google.com/) | Not verified / unknown / not created in this task / unknown | Create dedicated project; enable Merchant API and configure OAuth consent for suppliers; owner reviews any terms or billing. |
| Google Merchant Center | [Start](https://merchants.google.com/) | Not verified / unknown / n/a / unknown | Establish platform account, verify website and assess marketplace/service-provider account structure. [Developer registration](https://developers.google.com/merchant/api/guides/quickstart/registration) requires verified website, production account, admin access and Cloud project. |
| Google Merchant API | [Service provider setup](https://developers.google.com/merchant/3p/quickstart) | Dependent on above / unknown / not created / not submitted | Assess service-provider onboarding and supplier OAuth consent; request only necessary product/catalog scope. [Third-party access](https://developers.google.com/merchant/api/guides/authorization/access-client-accounts). |
| Meta Business Portfolio | [Meta Business](https://business.facebook.com/) | Not verified / unknown / n/a / unknown | Sign in as authorized owner, create or identify business portfolio; verify business when requested. |
| Meta developer, Facebook and Instagram | [Developer apps](https://developers.facebook.com/apps/) | Not verified / unknown / not created / not submitted | Create app and identify exact Facebook Page, Instagram professional account, catalog and advertising requirements; request minimum permissions only after implementation and review materials exist. Confirm current permissions in Meta dashboard. |
| TikTok developers | [Register an app](https://developers.tiktok.com/docs/en/getting-started-create-an-app) | Not verified / unknown / not created / not submitted | Create developer profile and sandbox; content posting requires appropriate approval and user consent. [Review guidelines](https://developers.tiktok.com/docs/en/app-review-guidelines) require a demonstration. |
| TikTok Business API | [Business API](https://business-api.tiktok.com/) | Not verified / unknown / not created / not submitted | Assess business and marketing API access separately from organic content posting; confirm markets and review requirements. |
| TikTok Shop partners | [Partner Center](https://partner.tiktokshop.com/) | Not verified / unknown / not created / not submitted | Check partner eligibility and market availability; prepare partnership application for owner review. |
| Pinterest business and developer | [Pinterest Developers](https://developers.pinterest.com/) | Not verified / unknown / not created / not submitted | Business account and claimed domain for shopping; catalog OAuth scopes `catalogs:read` and `catalogs:write` if required. [Shopping overview](https://developers.pinterest.com/docs/work-with-catalogs/shopping-overview/). |
| Microsoft Advertising and Merchant Center | [Advertising](https://ads.microsoft.com/) | Not verified / unknown / not created / not submitted | Set up business account and store where eligible; request production developer token and OAuth access. [API start](https://learn.microsoft.com/en-us/advertising/guides/get-started). |
| LinkedIn | [Developers](https://www.linkedin.com/developers/) | Not verified / unknown / not created / not submitted | Create app; member sharing and marketing permissions have different eligibility and review. [Access](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access). |
| Snapchat | [Snap for Developers](https://developers.snap.com/) | Not verified / unknown / not created / not submitted | Review Marketing API access and organization/account eligibility before applying. |
| Reddit | [Reddit for Developers](https://developers.reddit.com/) | Not verified / unknown / not created / not submitted | Review current developer and Ads API access separately; confirm commercial eligibility. |
| Shopify | [Shopify Partners](https://www.shopify.com/partners) | Not verified / unknown / not created / not submitted | Create partner organization and development app; evaluate public distribution and app review. [App development](https://shopify.dev/docs/apps/build). |
| Amazon | [Selling Partner API](https://developer-docs.amazon.com/sp-api/) | Not verified / unknown / not created / not submitted | Assess public developer registration and role review; each seller must authorize the app. |
| eBay | [Developer Program](https://developer.ebay.com/) | Not verified / unknown / not created / not submitted | Register developer, sandbox and production access; check selling APIs and permissions. |
| Walmart | [Developer Portal](https://developer.walmart.com/) | Not verified / unknown / not created / not submitted | Investigate solution-provider approval and supported regions. New supplier connections use OAuth; access is scoped. [Seller integration](https://developer.walmart.com/us-marketplace/docs/get-started-as-a-seller). |
| Criteo | [Developers](https://developers.criteo.com/) | Not verified / unknown / not created / not submitted | Assess partner onboarding, catalog and marketing permissions; obtain current eligibility and terms before applying. |
| Taboola | [Developers](https://developers.taboola.com/) | Not verified / unknown / not created / not submitted | Assess advertiser or platform access and API eligibility; no campaigns or charges authorized. |
| Outbrain | [Amplify](https://www.outbrain.com/amplify/) | Not verified / unknown / not created / not submitted | Assess advertiser account and current API/partnership access; no campaigns or charges authorized. |
| Affiliate networks | [Awin publishers](https://www.awin.com/gb/publishers), [impact.com partners](https://impact.com/partnerships/) | Not verified / unknown / not created / not submitted | Compare marketplace and affiliate eligibility, regions, fees and attribution before choosing an application; owner reviews any commercial terms. |

## Application review package

Prepare after the respective integration exists: accurate company identity and contact, public policies, product screenshots, supplier connection and disconnection flow, requested scopes with purpose, sandbox credentials provided securely through the platform, end-to-end demonstration, data deletion procedure, security and incident contacts, and details of catalog updates and advertising approval. Do not claim implementation, certification, supplier consent, data handling or platform partnership that has not been verified. Final submissions and legal attestations require owner review.
