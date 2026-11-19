# RotiHai — Craving Buddy product metadata audit

Date: 2026-11-19. Status: **READ-ONLY AUDIT; implementation awaits approval.**

Includes the dietary/default-preparation/customization extension requested by the user. The requested named audit was not present in either repository's `docs` directory, so this creates the specified audit report rather than overwriting the existing implementation report, `CRAVING_BUDDY.md`.

Only this report is an authorized deliverable. No application source, dependencies, migrations, database records, configuration, orders or deployments were changed for this audit. Existing local work was read as-is. No database connection, production API call, administrative mutation or real order/payment was used. Database findings describe checked-in schema/migration files, **not a verified deployed database**.

## 1. Recommendation and classifications

**Fix matching independently of metadata enrichment. Then introduce optional, reviewed product metadata in the existing Admin Product form. Keep default attributes, supported preparation changes and customer notes distinct. Do not enable guaranteed customized dietary matches until selection validation and order persistence are approved.**

Classifications: REQUIRED = needed for the stated accuracy requirement; OPTIONAL = defer until useful; ALREADY_EXISTS = reuse; NOT_RECOMMENDED = avoid; NEEDS_BUSINESS_DECISION = semantics/ownership/operational approval required.

| Recommendation | Classification | Decision |
| --- | --- | --- |
| Stop automatic irrelevant fallback; require explicit broadening | REQUIRED | Can be done before any database work |
| Hindi/Hinglish taste, conjunction and intent fixes | REQUIRED | Independent of migration |
| Product-level, verified default attributes with UNKNOWN handling | REQUIRED | Never derive verified taste/diet from names or chef classification |
| Cuisine per product | OPTIONAL | Useful for cuisine requests; does not prove taste |
| Taste tags and spice level | REQUIRED | Structured, optional values; absent is UNKNOWN |
| Reuse category and menu section | ALREADY_EXISTS | Do not rename or repurpose category IDs |
| Orthogonal dish type for breakfast/snack/main/dessert/beverage | OPTIONAL | Useful because current categories mix kitchen type, business model and food type |
| Product food style | OPTIONAL | Chef home/restaurant classification already exists, but does not establish every product's style |
| Vegetarian flag | ALREADY_EXISTS | Keep strict boolean filtering; legacy true values were not independently recipe-verified |
| Vegan verification | REQUIRED if vegan search is offered | Separate evidence-backed assertion; veg does not imply vegan |
| Generic customizable flag and free-text cooking instructions | ALREADY_EXISTS | Neither establishes which changes are possible or guarantees execution |
| Explicit chef-supported preparation options | REQUIRED if customization discovery is offered | Separate capability from default preparation; per-product scope |
| Price-changing or confirmation-required customizations | NEEDS_BUSINESS_DECISION | Defer from minimal implementation; cannot be promised by notes alone |
| New custom chef/taste search service or duplicate Product/Admin module | NOT_RECOMMENDED | Reuse existing catalog APIs and screens |
| Nutrient/medical claims inferred from text | NOT_RECOMMENDED | No sugar, sodium, oil, protein or medical suitability inference |

## 2. Existing schema, UI and APIs inspected

### Backend / Admin / web

Sources in `Replitrotihai`:

- [`shared/schema.ts`](../../Replitrotihai/shared/schema.ts): `categories` (~line 69), `chefs` (~82), `products` (~144), `productVariants` (~171), orders JSONB items (~243), `insertProductSchema` (~584), `insertOrderSchema` (~648).
- [`client/src/pages/admin/AdminProducts.tsx`](../../Replitrotihai/client/src/pages/admin/AdminProducts.tsx): existing shared Add/Edit dialog, default values, edit reset, submission, product/variant mode, Customizable switches and Vegetarian switch.
- [`server/adminRoutes.ts`](../../Replitrotihai/server/adminRoutes.ts): existing product GET/POST/PATCH and variant routes (~1287–1523).
- [`server/storage.ts`](../../Replitrotihai/server/storage.ts): product creation/update (~585–642), variant storage methods.
- [`server/routes.ts`](../../Replitrotihai/server/routes.ts): public product list/detail (~1850, ~1999), order item sanitization (~2168–2182), preorder confirmation logic.
- [`server/partnerRoutes.ts`](../../Replitrotihai/server/partnerRoutes.ts): order acceptance/rejection; partner product listing, ownership-checked availability and fulfillment edits (~392–500).
- [`server/billing.ts`](../../Replitrotihai/server/billing.ts): quote input, duplicate-line checks, instruction preservation and authoritative product/variant pricing.
- Web `ProductCard`, `VariantSelectorDialog`, `CartCard`, `CheckoutDialog`, `use-cart`, `cartItem` type, and partner order display in `PartnerDashboard`.

**Products already have:** name/description/image, selling/cost prices and rupees-off discount in the existing `offerPercentage` field, margin, rating/review count, `isVeg`, `isCustomizable`, stock/availability, category/chef linkage, section + section/product ordering, fulfillment mode and `hasVariants`. There is **no product JSON metadata field**, taste/cuisine/spice/default-recipe/nutrient field or explicit supported-customization list in the inspected Product schema.

**Variants already have:** name/display name/**description**, independent selling/cost price, stock/availability/active flag, ordering and timestamps. Descriptions are text, not verified preparation evidence. Variants can represent options, not just sizes; however there is no structured dietary scope or customization contract. Do not duplicate variants for an ordinary same-price note, or blindly apply a parent claim to variants with different ingredients.

**Notes:** Product has no dedicated cooking-note column. The `notes` fields found in shared schema belong to payout transactions and subscription delivery logs; subscription `paymentNotes` concerns payment adjustments. They are not reusable product preparation metadata. Orders and saved checkout items use JSONB, but that does not create a Product metadata field.

**Categories** have name, description, image/icon/count, delivery-slot requirement and display order. They are operational classifications used by carts/checkout/subscriptions as well as browsing. **Chef** has `chefType` (`home`/`restaurant`), category membership, description, verification/compliance/FSSAI fields, service areas, schedules and fulfillment settings. Chef verification/compliance is not verification of a dish's nutrient or dietary attributes. Chef home type is not proof that every dish is home-style.

**Admin form:** existing controls and dialog already support name, description, category, chef, section/order, price/discount, images, variants, Vegetarian, Customizable, stock, availability and fulfillment. There are two bindings for the same `isCustomizable` value in the inspected layout; inspect their presentation before extending, rather than adding a third flag or a new module. Creation uses `insertProductSchema.safeParse`. PATCH only explicitly validates discount before passing `req.body` to storage; full metadata validation must be added for PATCH as well as POST. Do not assume form-side validation protects all writers.

**Partner menu:** existing routes list the partner's products and permit ownership-checked availability/fulfillment edits. The inspected partner UI does not expose full ingredient/dietary verification editing. Existing order acceptance/rejection is general fulfillment handling, not a per-option dietary confirmation contract. Preorder `requiresChefConfirmation` concerns scheduling and must not be reused as evidence of dietary customization acceptance.

**Public API:** `/api/products` and `/api/products/:id` spread stored product rows, add effective fulfillment mode and optionally variants. List responses use a five-minute product cache. Additive metadata can use these endpoints; explicit public serialization is needed so private recipe evidence, reviewer identities and internal notes do not leak through row spreading.

### Mobile

- [`models.ts`](../src/core/api/models.ts): Product/Variant/CartItem contract; mobile Variant currently omits backend variant description, and Product omits `isCustomizable` despite it being in saved API rows.
- [`useDiscovery.ts`](../src/presentation/user/hooks/useDiscovery.ts): existing server location candidates, products/categories, refresh and pincode restrictions.
- [`CatalogScreens.tsx`](../src/presentation/user/screens/CatalogScreens.tsx): ProductScreen has size selection and **Cooking instructions (optional)**, max 300 characters. Instructions are offered without a supported-change list or documented chef guarantee.
- [`menuRules.ts`](../src/application/user/catalog/menuRules.ts): shared product-to-cart converter retains instructions and variant data.
- [`CartProvider.tsx`](../src/application/user/cart/CartProvider.tsx), `cartRules.ts`, `restoreCart.ts`: persisted baskets, identity/merging, quantity checks, instruction editing and reorder.
- [`CheckoutScreen.tsx`](../src/presentation/user/screens/CheckoutScreen.tsx): quote input and submitted items include `specialInstructions`; recoverable attempts also retain them.
- [`OrderScreens.tsx`](../src/presentation/user/screens/OrderScreens.tsx): order detail displays saved instructions.
- [`cravingRules.ts`](../src/application/user/catalog/cravingRules.ts), [`CravingBuddy.tsx`](../src/presentation/user/components/CravingBuddy.tsx): current interpreter, matching and automatic alternatives.

### Migration history limits

Inspected baseline products in `migrations/0000_supreme_zzzax.sql`, fulfillment additions in `0003_deep_tarantula.sql`, other SQL migrations including supplier price, chef verification/compliance and `20261118_product_rupee_discounts.sql`, plus `migrations/meta/_journal.json`. No taste/cuisine/spice/dietary/customization metadata migration was found in the inspected migration directory. The repository mixes numbered and manually maintained migrations; journal entries and files alone do not prove which migrations ran in any environment. Confirm actual deployed Product/Variant columns and migration state read-only before approving a migration. Do not run schema push or a blanket migration as part of this audit.

## 3. Reproducible matching defects

Ran the existing pure TypeScript interpreter/matcher in memory against the mobile's saved `review/public-data/{products,chefs,categories}.json`. No source/test file changes, network calls or DB reads. These are **fixture reproductions**, not current serviceability/stock on the user's phone. Matcher output is capped at 12 exact or 6 alternative rows; counts below are returned rows, not total matching inventory. Fixture chefs were passed as candidates without a real customer location, so this reproduction diagnoses interpretation/ranking only; application serviceability still uses `useDiscovery`.

| Query | Current parsed requirement | Returned exact / alternatives | Defect / required interpretation |
| --- | --- | --- | --- |
| Meetha khatta chahiye | sweet synonym group + literal `khatta` | 3 / 0 | Kala Khatta name + Sweets & Desserts category treated as verified sweet-and-sour; require verified sweet AND sour tags |
| Kuch khatta khana hai | literal `khatta` | 4 / 0 | Finds literal-name dishes; does not understand sour/tangy equivalents |
| Sweet and sour | sweet + literal `sour`; “and” discarded | 5 / 0 | Name text yields “exact,” but no verified taste attributes |
| Spicy chicken | spicy + chicken | 5 / 0 | Text/name/category evidence only; verify taste separately from protein/ingredient naming |
| Mild paneer | mild + paneer | 0 / 6 | Paneer momos shown with only paneer match; mild requirement relaxed |
| Ghar jaisa khana | homemade synonyms | 12 / 0 | Text-based home-style classification, not product verification |
| South Indian breakfast | three literal tokens | 0 / 6 | Indian sandwich/roti alternatives despite no South Indian breakfast match; cuisine phrase not recognized |
| Kuch chatpata chahiye | literal `chatpata` | 3 / 0 | Names treated as taste proof; define the intended culinary profile or clarify |
| Sirf veg chahiye | diet=veg plus literal `sirf` | 0 / 6 | Strict veg filter remains, but filler “sirf” breaks exact search and zero-keyword-hit alternatives appear |
| ₹150 ke andar | budget=150 plus literal `andar` | 0 / 6 | Budget stays enforced, but “andar” becomes a spurious food term |

Additional findings:

- Hindi `मीठा खट्टा` returns 0 exact and 6 sweet-only alternatives in the same snapshot; Latin/Hindi script equivalents are inconsistent.
- `meetha ya khatta` treats `ya` as a required literal token, rather than OR. “Meetha khatta” together should be AND; “meetha ya khatta” should be OR; ambiguity should trigger a short clarification.
- `low sugar` and `low salt` return six alternatives with zero keyword hits. `low oil` can return **Gehu Roti (with Oil)**. None is verified for the requested preparation attribute.
- `medium spice` partially matches product **size** words such as Chicken Popcorn Medium. `hot spice` can match soup descriptions rather than measured/declared spice.
- `no added sugar`, `no added salt`, `no added oil` currently trigger the generic exclusion warning and no results; they are not understood as positive structured default/capability requests. `vegan` also returns a limitation with no matches; this conservative behavior must not be replaced by inferred vegan labels.
- `metadata = name + description + section + category.name` supplies taste evidence. Every eligible non-exact dish goes into alternatives, **even when score=0**. If there are no exact results, six alternatives are returned automatically.
- The UI labels alternatives, but displays them without customer consent under wording such as “Let’s try something close.” Labelling alone does not satisfy explicit opt-in broadening.
- Missing fields are not literally converted to true today; the problem is that no verified attributes are consulted, textual evidence is over-promoted to exact, and fallback ignores unmatched required concepts. Serviceability, stock, availability, explicit veg/non-veg and budget checks are generally retained by the current matcher; do not remove them while fixing relevance.

## 4. Catalog data quality and ownership

Saved snapshot (product file last modified 2026-11-14; not a production freshness guarantee): **2,219 products, 25 chefs, 7 categories**. All products have a boolean `isVeg` and a chef association; **48** have `isCustomizable=true`, **262** have `hasVariants=true`. **3** have empty descriptions; **27** match the generic phrase “prepared fresh with quality ingredients.” Nonempty descriptions are not necessarily informative, complete or verified.

Snapshot categories: Home Meals, Frozen Food, Quick Bites, Restaurants, Sweets & Desserts, Bulk Orders (Catering), Custom Subscriptions. Home Meals and Frozen Food carry delivery-slot requirements. They mix kitchen style, food category, sales model and fulfillment hints; a new culinary search facet must not change their operational meaning.

No structured taste/cuisine/spice/recipe/dietary/customization metadata keys are present in these saved product records. **Zero products can be newly certified for sugar/salt/oil/vegan attributes from the inspected verified records alone.** This is an evidence statement, not a claim that no such dishes exist. Names/descriptions/categories may nominate a review queue, never publish verified attributes automatically. Existing veg booleans can be used as the current catalog declaration, but their historical recipe verification was not established; the schema/create form defaults true.

REQUIRED: chef supplies actual recipe/default preparation and feasible changes; Admin reviews/publishes claims under a defined policy. Start with active serviceable/high-demand dishes and the 48 customizable products, then review the remaining catalog. Bulk editing is OPTIONAL for repeated values only when each selected dish/variant genuinely shares that verified recipe; do not bulk-stamp a chef's entire menu. Preserve provenance, review date and recipe scope. Production and current local database completeness remain **unverified**; no production credentials or DB sessions were used.

## 5. Meaning of defaults, capabilities and notes

| Layer | Example | Evidence needed | Permitted Buddy language |
| --- | --- | --- | --- |
| Verified default | Standard recipe meets the approved low-salt definition | Reviewed recipe/measurement basis, scope, reviewer/date; valid current recipe | “This dish is low salt,” only when the claim is actually supported |
| Supported change | Chef can reduce added salt for this product | Explicit chef capability; which variants; supported value; conditions and whether confirmed/guaranteed | “This dish can be prepared with less salt,” with confirmation status disclosed |
| Customer note | “Please add less salt” | Customer request only | “Your request will be sent to the chef.” Never “low salt confirmed” |

**The smallest safe design uses all three layers, without conflating them.** Verified defaults support direct search. Capabilities support a separate “Can be customized” path after explicit selection; capabilities do not rewrite a default attribute. Existing instructions remain available for free-text requests. If the chef cannot commit, UNKNOWN/unsupported must not be treated as a match.

### Requested attribute semantics

| Attribute | Default claim | Separate supported-change example | Important distinction |
| --- | --- | --- | --- |
| No added sugar | Reviewed recipe adds no sugar according to approved ingredient policy | Omit added sugar, if feasible | Not sugar-free, low total sugar or a quantified nutrient claim; consider sauces/premixes |
| Low sugar | Only if an approved definition and recipe/measurement evidence support it | “Less added sugar” relative to normal recipe | Reduced added sugar does not establish a low-sugar finished dish |
| No added salt | Reviewed default, including approved treatment of prepared ingredients | Omit added salt where feasible | Does not mean sodium-free or low sodium; sauces/premixes may contain sodium |
| Low salt | Only after approved claim criteria/evidence | “Less added salt” relative to normal recipe | Do not turn this into a numeric sodium guarantee |
| No added oil | Reviewed recipe/process including relevant components | Omit added oil if preparation permits | Not fat-free and not proof of low total fat |
| Low oil | Only after a defined preparation standard/evidence | “Less added oil” relative to normal recipe | Must not guess from steaming, roasting or dish names |
| Mild / medium / hot | One reviewed default spice level; allow none/unknown | Specific supported target level, possibly subject to ingredient limitations | “Medium” size and “hot” serving temperature are not spice evidence |
| Vegetarian | Existing `isVeg` declaration | Not automatically changeable | Preserve current field; a separate per-claim verification record can reference it without duplicating truth |
| Vegan | Reviewed ingredients/default recipe | A chef-approved vegan preparation only if all substitutions and constraints are known | Veg is not vegan; omitting dairy text does not establish vegan ingredients or cross-contact safety |

Do not add diabetes-friendly, heart-healthy, high-protein, numeric sugar/sodium/oil/protein or medical-suitability badges from text or these options. Nutrient data, units, serving basis and evidence would be a separate approved scope. This audit proposes **no numeric nutrient thresholds or medical advice**. Business must define which claims may be published and the evidence/claim-review policy before enabling low-sugar/low-salt/low-oil labels. “Verified” must identify the platform's verification basis rather than imply independent certification or lab analysis that did not occur.

## 6. Minimal schema design comparison and recommendation

| Approach | Assessment |
| --- | --- |
| Optional Product columns | Valid alternative for small fixed facets: cuisine, taste array, spice, style. Simple filtering/indexing, but evidence and supported options still need structured data and many dietary boolean columns risk ambiguity. Do not add boolean defaults false for unknown claims. |
| Existing JSON metadata | **Does not exist on Product.** Do not pretend current `notes`, description, order JSONB or `isCustomizable` is this container. |
| One NEW nullable Product JSONB metadata object | **Recommended minimum storage expansion** for the combined requested scope: validated sections for discovery/default facts and supported changes, with review provenance. No new tables. Explicit application validation is mandatory. |
| New normalized attribute/option/review tables | NOT_RECOMMENDED initially at this observed catalog size and mobile filtering approach. Revisit for shared recipe libraries, extensive auditing, reporting or demonstrated query/index needs. |

Proposed conceptual Product field: optional `catalogMetadata` / `catalog_metadata` JSONB, initially NULL. Naming requires approval. This is a **new field**, not reuse of an existing column. Do not also add parallel scalar taste/diet fields unless the alternative column strategy is chosen. Keep original product fields intact.

Suggested validated sections (design sketch, not a migration or production contract):

- `schemaVersion` and `revision` for forward compatibility/revalidation.
- `discovery`: one optional primary `cuisine`; `tasteTags`; `spiceLevel`; optional `dishType` and `foodStyle`. Tag vocabulary controlled. `null`/missing facet means UNKNOWN; empty tags are not a reviewed declaration of “no taste.”
- `defaultPreparation`: per-attribute assertions such as `noAddedSugar`, `lowSugar`, `noAddedSalt`, `lowSalt`, `noAddedOil`, `lowOil`, `vegan`. Each uses explicit `value` yes/no/unknown and review status. Only `yes + reviewed + current applicable scope` yields a verified match. Missing/stale/unreviewed values never qualify. Discovery taste/spice assertions need the same reviewed-current gate.
- `review`: server-owned reviewer identity, reviewed time, evidence reference/basis, recipe revision/scope. Different claims may have different review records. Optional effective expiry/variant applicability as needed. Public DTO returns claim status and safe attribution only; internal evidence/identities stay private. Negative values do not silently become verified just because a form defaults them.
- `supportedPreparationChanges`: stable option code, allowed values/target, enabled state, explicit chef-supported status, applicable variant IDs or guaranteed all-variant scope, confirmation requirement and conditions. For the minimum phase, options are **same-price only**. Price-changing options are not enabled until priced/persisted through an approved existing product/variant or authoritative option quote path.

Cuisine: start with a single primary controlled value (Maharashtrian, Punjabi, South Indian, North Indian, Indo-Chinese, Gujarati, Other; absent UNKNOWN). Multi-cuisine is OPTIONAL/NEEDS_BUSINESS_DECISION, not justified by the inspected data. “Other” is not an excuse to match every cuisine.

Taste: sweet, sour/tangy, savoury, spicy, bitter, salty can be controlled values; salty taste is not low/high sodium measurement. “Chatpata” needs an agreed chef-facing definition or a clarification, not an automatic synonym for every spicy/sour dish. Avoid collecting unused bitter/salty labels unless useful. Spice level: none, mild, medium, hot, UNKNOWN. Existing categories remain authoritative for operations; an orthogonal `dishType` is optional and only required if search must reliably distinguish breakfast/main/snack/dessert/beverage. Product home-/street-style is optional; no inheritance from `chefType`.

Variants: inherit a reviewed parent attribute only when the review explicitly covers every applicable variant and common recipe. Otherwise default to UNKNOWN for that variant. The minimum launch can limit verified claims to products whose variants share the same verified defaults; adding metadata to the Variant table is deferred until different recipes/options actually require it. Do not show the cheapest unrelated variant as the price for a dietary-matching size.

Migration proposal only: one nullable additive field, no backfill of guessed values, review target-environment schema first, deploy compatible readers, then writers and verified matcher gates. Do not require a new index initially: the current mobile matcher already filters downloaded catalog data. Measure payload/query behavior; add a targeted JSONB/expression index only if future backend filtering needs it. Avoid changing enums, prices, quantity/stock fields or existing IDs.

## 7. Admin and chef maintenance plan

REQUIRED: extend the existing Add/Edit Product dialog with an optional “Discovery & preparation” section after the existing descriptive/category/section controls and before save. Reuse Select, Checkbox/Switch, FormField/FormDescription and current error handling; no new Admin module.

1. Cuisine dropdown, taste multi-select, spice dropdown, optional dish type/style. Explicit “Not reviewed/Unknown”; no automatic defaults from names/category/chef.
2. Clearly separate **“Standard recipe / default preparation”** from **“Changes this chef supports.”** Show verified status and evidence/date/scope for claims. A raw switch alone must not publish “low salt.”
3. Supported-options controls enumerate specific changes (less added salt, omit added salt, less/omit added sugar, less/omit added oil, supported spice targets; vegan substitution only after actual recipe review). Do not interpret the existing generic Customizable flag as permission for every option.
4. Admin publishes reviewed data. Chef provides/attests facts initially through the existing operational process. Direct partner editing is OPTIONAL later and requires the existing chef ownership checks plus draft/review restrictions; do not give all partners admin verification authority.
5. Changing chef association, recipe-related description/ingredients, preparation variant composition or relevant options should invalidate/review affected assertions. A price-only change need not revoke recipe verification. Preserve provenance/revisions server-side; do not accept forged verification identity/status from public clients.
6. Preserve all existing price/discount, variants, stock, image, category, kitchen, sorting, fulfillment and availability controls. PATCH omission preserves old metadata; null explicitly clears it. Define section updates carefully to avoid partial JSON replacement losing other fields or verification history. Handle stale concurrent edits using metadata revision.

ALREADY_EXISTS: generic `isCustomizable`. Retain for backwards compatibility; do not add `canCustomize`. It may indicate “accepts requests,” but explicit supported options are the only basis for capability matching. Existing `false` does not prove no modifications are possible; reconcile inconsistent flags/options in Admin rather than guessing.

## 8. Instructions, cart identity, confirmations, pricing and persistence

### Existing path

Customer instructions already survive mobile Product → CartItem → persisted local basket → quote/request → order `items` JSONB → mobile order detail and web partner order display. Web CartCard has an editable instruction field; CheckoutDialog forwards it. Server `insertOrderSchema`, order sanitization and billing quote items explicitly preserve `specialInstructions`. Existing reorder keeps notes while refreshing products/prices/stock. **Reuse this field for nonbinding free-text requests**; no duplicate `cookingNotes` order field is needed.

But storage alone does not guarantee a chef sees/accepts/can execute a requirement. No inspected flow confirms each dietary option, charges for it or records a per-option commitment. Generic chef order acceptance is not proof that “less salt” was separately acknowledged. Free text must remain labelled as a request.

### Identity and stock constraint — REQUIRED before independently customized portions

- Mobile key is `productId:variantId`; adding the same key merges quantity and replaces the item with incoming notes, potentially overwriting earlier instructions.
- Web merges on product ID + variant ID and generally retains the old item when increasing quantity; its instruction updater matches product ID, which needs careful variant scoping review.
- Backend quote logic rejects duplicate product ID + variant ID pairs and checks stock at that grain.

**Minimum compatible policy:** one preparation selection/note per existing product+variant line, applying to the entire quantity. If adding the same line with a conflicting request, require an explicit replacement/edit decision; do not silently overwrite or merge. If business requires two identical sizes with different preparation, a separate cart-line identity, aggregate stock validation and backend duplicate-line policy redesign is REQUIRED; it is not part of a “metadata-only” change. No such redesign is approved by this audit.

### Execution scope options

| Phase | What is safe | Required changes |
| --- | --- | --- |
| Default discovery only | Match “this dish is low salt” only against current reviewed default; existing checkout untouched | Metadata + matcher; no customization-selection persistence needed |
| Capability discovery only | “Chef supports less added salt; preparation not yet confirmed” as separate information, not a verified default | Reviewed capability metadata; no automatic promise or silent cart mutation |
| Executable same-price customization | Explicit selection shown on Product, cart, checkout, order and chef view | Structured selection validation and persistence; see below; separate approval |
| Price-changing / individually confirmed customization | Cannot safely be guaranteed today | Business workflow, pricing/confirmation design and tests before enablement |

If executable options are approved, the smallest durable extension is **inside existing item objects**, not a new order table: optional `preparationSelections` (stable code/value), a server-created accepted option/recipe revision snapshot and explicit request/acceptance semantics. Keep `specialInstructions` separate; optionally generate a readable summary for older chef displays, but text must not be the authoritative option record. Server derives snapshot/status; never trust client “verified” flags.

Selections must survive Product → cart → local restore → quote input → quote fingerprint/snapshot → order sanitizer/schema → existing `orders.items` JSONB → customer/Admin/chef view → saved/reorder paths. Public order parsing currently whitelists known item fields; **adding fields only on the client would drop them**. Fresh revalidation must check product+chef+variant, option availability and combinations and remove/reconfirm stale selections. Reordering is a fresh request, not reuse of a past chef confirmation.

Even same-price changes need binding into quote/reconciliation item identity so one preparation is not quoted then silently replaced by another. Existing quote input already includes notes; new structured choices would need the equivalent binding. Mobile's unresolved-order recovery signature currently compares product ID, variant ID and quantity, not preparation choices/notes; it asks the customer to confirm a single matching order. Executable customizations would require a preparation-aware recovery comparison before claiming that the recovered order preserves the chosen recipe. This affects validation/data plumbing, **not billing formulas, fee schedules or payment rules**. Subscriptions/custom plans must not inherit options just because their item records contain a name; recurring recipe capability is a separate scope.

**Price:** smallest phase supports no surcharges. If a change genuinely uses a separately priced existing variant, reuse its authoritative price/stock, but variant names alone are not dietary proof. Otherwise defer paid changes; never append a price in notes or trust a client surcharge. Billing/discount/payment calculation changes are unnecessary for metadata/default matching and explicitly out of scope. Any paid-option work needs separate approval.

**Chef confirmation:** require explicit per-option acceptance if fulfillment is not guaranteed in advance. The inspected system lacks that contract and generic acceptance occurs after payment/admin confirmation in the partner flow. Do not bolt a new health-related promise onto that timing. Either restrict first executable options to chef-precommitted same-price capabilities applying to the chosen product/variant, or keep the outcome pending confirmation and define rejection/substitution handling before launch. No silent substitution and no unsupported medical guarantee.

## 9. API and matcher changes proposed

### Existing APIs only

REQUIRED: extend `insertProductSchema` for optional typed metadata and validate both Admin POST and PATCH, including enum vocabulary, length/array limits, cross-field consistency, review permissions, variant scopes and metadata revisions. Storage create/update preserves original defaults and omitted data. Review `isVeg=true` legacy defaults before using them as a stronger reviewed claim; do not reclassify legacy items automatically.

Additive public metadata in existing product list/detail responses; mobile optional types support older backends. Explicit public DTO excludes internal evidence and review actor details. Invalidate existing product caches on metadata changes; preserve visibility, variant hydration and fulfillment fields. Partner product read can expose owned metadata through its existing route; no new public craving endpoint/search engine is necessary. Write support for partners is a later ownership-reviewed extension, not a reason to duplicate admin APIs.

No new backend instruction endpoint. If executable customization is separately approved, extend existing item schemas/quote/order serializers and revalidation as described above. Older clients without selections retain current behavior; clients without metadata must see UNKNOWN and no verified dietary matches.

### Deterministic intent and evidence requirements

1. Normalize Hindi/English/Hinglish synonyms: sour/tangy/khatta/खट्टा; mild/कम तीखा; appropriate medium/hot spice phrases; “sirf,” “ke andar,” cuisine phrases, breakfast and approved chatpata interpretation. Prefer typed intents over leftover arbitrary tokens for constraints.
2. Represent AND/OR explicitly. Meetha khatta = both; meetha **ya** khatta = either. Clarify ambiguous taste or whether the customer wants the normal recipe versus a change.
3. Match taste/cuisine/style/spice/vegan/preparation constraints only with applicable, reviewed metadata. Names and descriptions remain keyword relevance signals for dish identity, **not verified dietary/taste evidence**. Chef cuisine/type never stamps all products.
4. For strict requirements, apply all constraints before ranking. UNKNOWN, stale review, unsupported option, variant mismatch and unconfirmed capability are not verified matches. Maintain existing serviceability, stock, availability, fulfillment and budget guards.
5. Split outcomes: verified default match; customizable candidate with exact supported change and confirmation condition; no verified match. Never say “This dish is low salt” solely because its chef offers less salt.
6. Never treat `no added sugar` as `low sugar`, `less salt` as low sodium, vegetarian as vegan, or a dish name as nutrient/protein/medical evidence. Unsupported health/nutrient requests receive an honest limitation.
7. Empty exact results remain empty. Ask “No verified sweet-and-sour dishes nearby. Would you like sweet options or tangy options?” Only after consent broaden that specific facet. Diet, health-related constraints, location, availability and budget remain hard unless the customer explicitly changes the applicable preference; never relax dietary safety claims implicitly.
8. Explain matches using actual applicable facts, e.g. reviewed sweet+sour tags or “less added salt supported, same price, requires confirmation.” Do not invent availability, ratings or certainty. No paid LLM is required.

## 10. Regression impact and required tests

| Area | Compatibility / tests required |
| --- | --- |
| Product/Admin | Create/edit old products with no metadata; enum validation; unknown stays unknown; omitted PATCH preserves data; explicit clear; unauthorized verification rejected; recipe edit revokes affected claims; stale revision conflict |
| Chef management | Ownership enforcement; Admin review authority; generic isCustomizable is not a blanket capability; order acceptance does not silently verify options |
| Public APIs/web/mobile | Older clients/backends tolerate omitted metadata; list/detail parity; cache invalidation; public DTO hides internal evidence; categories/sections/ranking remain stable |
| Matcher | All ten query reproductions; Hindi script parity; AND vs OR; phrase fillers; no score-zero fallback; consent-gated alternatives; missing/stale/false metadata excluded; chef/category/name not evidence |
| Dietary/defaults | Low/no-added sugar/salt/oil distinct; low claims require approved policy/evidence; vegan vs veg; no protein/medical inference; standard “mild” vs size “Medium”; variant applicability |
| Capability selection | Default vs customizable wording; unsupported/disabled options rejected; conditional/paid options gated; conflicting combinations; no automatic selection based only on speech; explicit customer review |
| Cart | Existing quantity/chef-category grouping/fulfillment; same-line conflicting prep decision; no instruction loss; variant-aware edit; aggregate stock if separate lines ever approved |
| Checkout/billing | Existing quotes, fees, discounts/wallet and totals unchanged; new choices bound to quote if enabled; stale option/recipe requires review; no client surcharge; pending recovery cannot confuse different preparation requests |
| Orders/reorder | Sanitizer and schema preserve selections/notes; snapshot displayed to customer and chef/Admin; actor-owned confirmation; reorder revalidates capabilities instead of inheriting old confirmation |
| Variants/stock/discounts | Same-price and priced variants preserved; unavailable/zero-stock excluded; cheapest qualifying size only; existing rupees-off discounts and quantity caps unchanged |
| Saved orders/subscriptions | Legacy JSON unaffected; saved notes preserved as requests; old metadata not retroactively asserted; custom subscriptions do not inherit per-order capabilities without an approved contract |

No integration/regression suite was run in this read-only audit because no implementation was changed. Reproductions above execute pure functions with saved fixtures; they are evidence of defects, not a certification of a proposed implementation. No new test files were generated.

## 11. Recommended phases and approval gates

1. **Accuracy correction — REQUIRED:** synonyms, typed AND/OR intent, explicit unknown, stop unsolicited fallback, clarify unsupported requirements. Can precede migration. With no verified metadata, expect honest no-match states for strict dietary/taste claims.
2. **Metadata contract and policy — REQUIRED:** approve one JSONB versus scalar alternative; claim definitions/evidence/review ownership; primary cuisine; taste/spice vocabulary; variant scope; optional dish type/style. Review actual target DB schema before drafting migration.
3. **Admin/API + controlled catalog review — REQUIRED:** additive metadata, existing forms/DTOs/cache behavior, Admin review, chef-supplied recipes. Tag a small reviewed cohort then expand; never auto-backfill health/taste facts from names.
4. **Verified-default matching — REQUIRED:** enforce applicable current facts and give evidence-based explanations. Existing cart/checkout/payment logic remains unchanged.
5. **Capabilities and execution — separately approved:** optionally display reviewed capabilities first; enable same-price precommitted changes only after structured selection, line conflict handling, revalidation and order/quote persistence. Chef-confirmation and surcharge workflows remain deferred until approved.
6. **Bulk tooling/performance — OPTIONAL:** only if manual review workload/query measurements justify it; no new search service or lookup tables by default.

Decisions awaiting approval: metadata storage strategy; approved cuisine/taste/spice values; low/less/no-added semantics and review evidence; who can publish verification; optional dish type/style; variant exceptions; whether capabilities are informational or executable; one-preparation-per-line restriction; chef precommitment versus per-order confirmation; whether paid options are out of scope; bulk maintenance responsibility and re-review triggers. **No implementation, migration, data tagging or deployment should begin until these decisions are approved.**
