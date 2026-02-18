# Analytics Tracking Fix

## Problem
Total Impressions and Total Clicks remained at zero despite timer interactions, indicating that analytics tracking was not working properly.

## Root Cause
The analytics tracking system relies on Shopify's App Proxy to route requests from the storefront to the backend. The issues were:

1. **Insufficient error handling** - Failed requests were not being retried
2. **Limited debugging** - No visibility into why requests were failing
3. **Strict shop validation** - Required exact header from app proxy without fallback
4. **No diagnostic tools** - Difficult to troubleshoot configuration issues

## Changes Made

### 1. Backend Analytics Endpoint (`app/routes/apps.timer.analytics.tsx`)
- ✅ Added fallback shop detection from referer header
- ✅ Enhanced error logging with detailed context
- ✅ Improved CORS headers for better cross-origin support
- ✅ Return updated impression/click counts in response
- ✅ Touch updatedAt timestamp on each analytics event
- ✅ Better error messages for troubleshooting

### 2. Frontend Analytics Tracking (`extensions/countdown-timer-block/assets/timer.js`)
- ✅ Added automatic retry logic with exponential backoff
- ✅ Enhanced error logging and response parsing
- ✅ Added debug mode (enable with `?countdown_debug=1` or localStorage)
- ✅ Better tracking of success/failure states
- ✅ Explicit CORS mode and credentials handling

### 3. Debug Tools

#### New Debug Endpoint (`app/routes/apps.timer.debug.tsx`)
Access via app proxy: `https://[your-shop].myshopify.com/apps/timer/debug`

Provides diagnostic information:
- App proxy configuration status
- Database connection status
- List of active timers with analytics
- Specific timer lookup (add `?timerId=xxx`)
- Configuration recommendations

#### Manual Sync Endpoint (`app/routes/app.timers.sync.tsx`)
Force sync timers to metafields from admin panel

## Testing the Fix

### Step 1: Verify App Proxy Configuration

1. Go to Shopify Admin → Apps → Your App → Configuration
2. Verify App Proxy settings:
   - **Subpath**: `timer`
   - **Subpath prefix**: `apps`
   - **Proxy URL**: `https://countdown-timer-bar.vercel.app/apps/timer`

### Step 2: Test Debug Endpoint

Visit: `https://[your-shop].myshopify.com/apps/timer/debug`

**Expected Response:**
```json
{
  "timestamp": "2026-02-18T...",
  "appProxy": {
    "configured": true,
    "shopHeader": "your-shop.myshopify.com",
    "note": "App proxy is working correctly"
  },
  "database": {
    "status": "connected",
    "totalTimers": 1,
    "activeTimers": 1,
    "timers": [...]
  }
}
```

**If app proxy is not working:**
```json
{
  "appProxy": {
    "configured": false,
    "shopHeader": "NOT FOUND",
    "note": "App proxy header missing - check Shopify app configuration"
  }
}
```

### Step 3: Enable Debug Mode

Add to your shop URL: `?countdown_debug=1`

This will show detailed console logs:
- Timer initialization
- Impression tracking
- Click tracking
- Analytics request/response details

### Step 4: Test Analytics Tracking

1. **Clear browser cache and reload** the page
2. **Open browser console** (F12 → Console tab)
3. **Look for these logs:**
   ```
   Countdown Timer: Processing timer { id: "xxx", type: "FIXED" }
   Countdown Timer: Tracking impression for timer xxx
   Analytics: Sending event (attempt 1) { event: "impression", timerId: "xxx" }
   Analytics: Response received { status: 200, ok: true }
   Analytics: Successfully tracked { impressions: 1, clicks: 0 }
   ```

4. **Click a CTA button** and verify:
   ```
   Countdown Timer: CTA clicked { timerId: "xxx" }
   Countdown Timer: Tracking click for timer xxx
   Analytics: Successfully tracked { impressions: 1, clicks: 1 }
   ```

### Step 5: Verify Dashboard Updates

1. Go to admin dashboard: `/app`
2. Check "Total Impressions" and "Total Clicks" cards
3. **Refresh the page** to see updated counts

### Step 6: Test Specific Timer

Visit: `https://[your-shop].myshopify.com/apps/timer/debug?timerId=[timer-id]`

This shows detailed information about a specific timer including:
- Current impression/click counts
- Last updated timestamp
- Whether it belongs to your shop

## Troubleshooting

### Issue: "Shop domain could not be determined"

**Cause:** App proxy is not configured correctly

**Solution:**
1. Verify app proxy settings in Shopify Admin
2. Ensure proxy URL matches your deployment URL
3. Check that the app is installed on the shop

### Issue: "Timer not found in database"

**Cause:** Timer ID mismatch or timer not synced

**Solution:**
1. Force sync: Call POST `/app/timers/sync` from admin
2. Verify timer exists in database
3. Check timer ID in metafield matches database ID

### Issue: Analytics requests return 404

**Cause:** App proxy route not configured

**Solution:**
1. Verify app proxy subpath is `timer`
2. Verify app proxy prefix is `apps`
3. Test directly: `https://countdown-timer-bar.vercel.app/apps/timer/analytics`

### Issue: CORS errors

**Cause:** Cross-origin request blocked

**Solution:**
- Check browser console for specific CORS error
- Verify CORS headers are present in response
- Ensure app proxy is routing requests correctly

## Monitoring

### Console Logs to Watch

**Success:**
```
Analytics: Successfully tracked { event: "impression", timerId: "xxx", impressions: 1 }
```

**Retry:**
```
Analytics: Queuing for retry { event: "impression", timerId: "xxx", retryCount: 0 }
```

**Failure:**
```
Analytics: Max retries reached { event: "impression", timerId: "xxx" }
```

### Database Query

Check impressions and clicks directly:
```sql
SELECT id, name, impressions, clicks, "updatedAt"
FROM "Timer"
WHERE shop = 'your-shop.myshopify.com'
AND status = 'ACTIVE';
```

## Next Steps

After verifying the fix works:

1. ✅ Test on production shop
2. ✅ Monitor console logs for 24 hours
3. ✅ Verify analytics data accumulates correctly
4. ✅ Respond to Shopify app review team

## Support

If issues persist after following this guide:

1. Collect debug endpoint output
2. Check browser console logs (with debug mode enabled)
3. Check server logs for analytics requests
4. Provide timer ID and shop domain for investigation
