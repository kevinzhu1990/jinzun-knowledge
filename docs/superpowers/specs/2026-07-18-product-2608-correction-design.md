# Product 2608 Correction Design

## Canonical product data

- Active SKU: `2608`
- Product name: `杏仁饼258g`
- Retired SKU: `2576`
- SKU `0206` net weight: `800g`
- SKU `2545` remains active and must not be removed.

## Required behavior

1. Existing generated questions containing `2576` are rewritten to `2608` before deployment.
2. Product-name fields and answer text use `杏仁饼258g`; the SKU must not be embedded in the product name.
3. The daily-product image is migrated from `2576.jpg` to `2608.jpg` in the deployment output.
4. The build version is changed so browsers do not reuse the old product JSON.
5. The product generator normalizes either legacy source code `2576` or current source code `2608` to the canonical identity.
6. The generator forces `0206` net weight to `800g` and preserves `2545`.
7. Deployment fails rather than publishing if `2608`, `0206`, or `2545` validation fails.

## Acceptance criteria

- No deployed product-question JSON field contains `2576`.
- Questions for code `2608` show product name `杏仁饼258g`.
- The `0206` net-weight answer is `800g`.
- Questions for `2545` remain present.
- `assets/product-images/daily/2608.jpg` exists in the deployment output and the legacy image path is removed.
- Automated Node and Python regression tests pass.
