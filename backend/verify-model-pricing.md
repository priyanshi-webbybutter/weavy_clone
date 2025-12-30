# Model Pricing Verification Guide

## Current Database Pricing

| Model ID | Model Name | Current Price | Credits | Last Updated |
|----------|------------|---------------|---------|--------------|
| `bytedance/seedream-4` | Seedream-4 | $0.03 | 1.5 credits | ✅ Verified |
| `black-forest-labs/flux-redux-dev` | FLUX.1 Redux | $0.025 | 1.25 credits | ✅ Updated |
| `black-forest-labs/flux-1.1-pro-ultra` | FLUX 1.1 Pro Ultra | $0.11 | 5.5 credits | ⚠️ Verify |
| `black-forest-labs/flux-canny-pro` | FLUX Canny Pro | $0.06 | 3 credits | ⚠️ Verify |
| `reve/edit` | Reve Edit | $0.04 | 2 credits | ⚠️ Verify |
| `lucataco/moondream2` | Moondream2 | $0.01 | 0.5 credits | ⚠️ Verify |
| `pixverse/pixverse-v4.5` | Pixverse v4.5 | $0.50 | 25 credits | ⚠️ Verify |

## How to Verify Pricing

1. **Generate an image/video with each model**
2. **Check your Replicate billing dashboard** - Note the cost increase
3. **Compare with database pricing** - Update if different

## How to Update Pricing

### Option 1: Update via SQL (Direct)

```sql
UPDATE model_pricing 
SET dollar_cost_per_unit = 0.XXX,  -- Replace XXX with actual cost
    last_updated = NOW()
WHERE model_id = 'model-id-here';
```

### Option 2: Update via API Endpoint

Call `POST /api/credits/fetch-pricing` after updating `backend/lib/fetch-replicate-pricing.js`

### Option 3: Update Code Files

1. Update `backend/lib/fetch-replicate-pricing.js` - `knownPricing` object
2. Update `backend/list-models-pricing.js` - `knownPricing` object  
3. Run the update script or call the API endpoint

## Example: Updating FLUX 1.1 Pro Ultra

If you find FLUX 1.1 Pro Ultra actually costs $0.08 per image:

```sql
UPDATE model_pricing 
SET dollar_cost_per_unit = 0.08,
    last_updated = NOW()
WHERE model_id = 'black-forest-labs/flux-1.1-pro-ultra';
```

Then update the code files:
- `backend/lib/fetch-replicate-pricing.js`: Change `0.11` to `0.08`
- `backend/list-models-pricing.js`: Change `0.11` to `0.08`

## Notes

- Pricing is per image/request/video (not per token for Replicate models)
- Credits = Dollar Cost × 50 (since 1000 credits = $20)
- Always verify pricing against actual Replicate billing

