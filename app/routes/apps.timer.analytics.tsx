import { json, type ActionFunctionArgs } from "@remix-run/node";
import prisma from "~/db.server";

/**
 * App Proxy endpoint for tracking timer analytics
 * URL: /apps/timer/analytics (via app proxy)
 *
 * Accepts POST requests with beacon data for impressions and clicks
 */
export async function action({ request }: ActionFunctionArgs) {
  console.log("Analytics: Request received", {
    method: request.method,
    url: request.url,
    origin: request.headers.get("origin"),
    referer: request.headers.get("referer"),
    userAgent: request.headers.get("user-agent"),
  });

  // Handle OPTIONS preflight
  if (request.method === "OPTIONS") {
    console.log("Analytics: Handling OPTIONS preflight");
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(),
    });
  }

  // Only accept POST
  if (request.method !== "POST") {
    console.error("Analytics: Invalid method", request.method);
    return json({ error: "Method not allowed" }, { status: 405, headers: getCorsHeaders() });
  }

  // Get shop from Shopify proxy headers or extract from referer as fallback
  let shop = request.headers.get("X-Shopify-Shop-Domain");

  // Fallback: Try to extract shop from referer header if proxy header is missing
  if (!shop) {
    const referer = request.headers.get("referer");
    console.log("Analytics: No X-Shopify-Shop-Domain header, trying referer", { referer });

    if (referer) {
      try {
        const refererUrl = new URL(referer);
        // Check if it's a myshopify.com domain
        if (refererUrl.hostname.endsWith('.myshopify.com')) {
          shop = refererUrl.hostname;
          console.log("Analytics: Extracted shop from referer", { shop });
        }
      } catch (e) {
        console.error("Analytics: Failed to parse referer URL", e);
      }
    }
  }

  console.log("Analytics: Shop determined", { shop, hasProxyHeader: !!request.headers.get("X-Shopify-Shop-Domain") });

  if (!shop) {
    console.error("Analytics: Missing shop - no proxy header and could not extract from referer", {
      referer: request.headers.get("referer"),
      origin: request.headers.get("origin"),
      allHeaders: Object.fromEntries(request.headers.entries()),
    });
    return json(
      { error: "Shop domain could not be determined. Please ensure app proxy is configured correctly." },
      { status: 401, headers: getCorsHeaders() }
    );
  }

  try {
    // Parse beacon data
    const body = await request.text();
    let data;
    
    try {
      data = JSON.parse(body);
    } catch (parseError) {
      console.error("Analytics: Failed to parse JSON body", { body, error: parseError });
      return json(
        { error: "Invalid JSON" },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const { event, timerId, timestamp, url } = data;

    if (!event || !timerId) {
      console.error("Analytics: Missing required fields", { event, timerId, shop });
      return json(
        { error: "Missing required fields" },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Validate event type
    if (!["impression", "click"].includes(event)) {
      console.error("Analytics: Invalid event type", { event, timerId, shop });
      return json(
        { error: "Invalid event type" },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Check if timer exists and belongs to this shop
    const timer = await prisma.timer.findUnique({
      where: {
        id: timerId,
      },
      select: {
        id: true,
        shop: true,
        status: true,
        impressions: true,
        clicks: true,
      },
    });

    if (!timer) {
      console.error("Analytics: Timer not found in database", {
        timerId,
        shop,
        note: "This timer may not have been synced to the database yet, or the ID is incorrect"
      });
      return json(
        { error: "Timer not found in database" },
        { status: 404, headers: getCorsHeaders() }
      );
    }

    if (timer.shop !== shop) {
      console.error("Analytics: Timer shop mismatch", {
        timerId,
        timerShop: timer.shop,
        requestShop: shop,
        note: "The timer belongs to a different shop"
      });
      return json(
        { error: "Unauthorized - timer belongs to different shop" },
        { status: 403, headers: getCorsHeaders() }
      );
    }

    // Update timer analytics in database
    const updateData = event === "impression"
      ? {
          impressions: { increment: 1 },
          updatedAt: new Date(), // Touch updatedAt to track last activity
        }
      : {
          clicks: { increment: 1 },
          updatedAt: new Date(),
        };

    const updatedTimer = await prisma.timer.update({
      where: {
        id: timerId,
      },
      data: updateData,
      select: {
        impressions: true,
        clicks: true,
      },
    });

    // Log successful tracking with new values
    console.log("Analytics: Successfully tracked and updated database", {
      event,
      timerId,
      shop,
      oldValue: event === "impression" ? timer.impressions : timer.clicks,
      newValue: event === "impression" ? updatedTimer.impressions : updatedTimer.clicks,
      totalImpressions: updatedTimer.impressions,
      totalClicks: updatedTimer.clicks,
    });

    return json(
      {
        success: true,
        impressions: updatedTimer.impressions,
        clicks: updatedTimer.clicks,
      },
      { headers: getCorsHeaders() }
    );
  } catch (error) {
    // Log errors for debugging - this helps identify issues
    console.error("Analytics: Failed to record analytics", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      shop,
    });
    
    return json(
      { error: "Failed to record analytics" },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

/**
 * Handle GET requests - provide debug information
 */
export async function loader({ request }: ActionFunctionArgs) {
  const shop = request.headers.get("X-Shopify-Shop-Domain");
  const referer = request.headers.get("referer");

  return json(
    {
      message: "Analytics endpoint is working",
      method: "Use POST to submit analytics events",
      shopDetected: shop || "none",
      referer: referer || "none",
      hasAppProxy: !!shop,
      timestamp: new Date().toISOString(),
      endpoint: "/apps/timer/analytics",
      expectedPayload: {
        event: "impression or click",
        timerId: "string",
        timestamp: "number",
        url: "string (optional)",
      },
    },
    { status: 200, headers: getCorsHeaders() }
  );
}

/**
 * Get CORS headers for app proxy responses
 */
function getCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type, X-Shopify-Shop-Domain, X-Requested-With",
    "Access-Control-Max-Age": "86400", // Cache preflight for 24 hours
    "Content-Type": "application/json",
    "Vary": "Origin", // Ensure proper caching with CORS
  };
}
