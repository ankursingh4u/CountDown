import { json, type LoaderFunctionArgs } from "@remix-run/node";
import prisma from "~/db.server";

/**
 * Debug endpoint for testing analytics setup
 * URL: /apps/timer/debug (via app proxy)
 *
 * This endpoint provides diagnostic information about:
 * - App proxy configuration
 * - Timer synchronization status
 * - Analytics tracking status
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const timerId = url.searchParams.get("timerId");

  // Get shop from Shopify proxy headers
  const shop = request.headers.get("X-Shopify-Shop-Domain");
  const referer = request.headers.get("referer");
  const origin = request.headers.get("origin");

  // Diagnostic information
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    endpoint: "/apps/timer/debug",
    appProxy: {
      configured: !!shop,
      shopHeader: shop || "NOT FOUND",
      refererHeader: referer || "NOT FOUND",
      originHeader: origin || "NOT FOUND",
      note: shop
        ? "App proxy is working correctly"
        : "App proxy header missing - check Shopify app configuration",
    },
    headers: Object.fromEntries(request.headers.entries()),
  };

  // If shop is available, fetch timer information
  if (shop) {
    try {
      // Get timer counts
      const totalTimers = await prisma.timer.count({ where: { shop } });
      const activeTimers = await prisma.timer.count({
        where: { shop, status: "ACTIVE" },
      });

      // Get analytics summary
      const timers = await prisma.timer.findMany({
        where: { shop, status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          impressions: true,
          clicks: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      diagnostics.database = {
        status: "connected",
        totalTimers,
        activeTimers,
        timers: timers.map((t) => ({
          id: t.id,
          name: t.name,
          impressions: t.impressions,
          clicks: t.clicks,
          lastUpdated: t.updatedAt.toISOString(),
          created: t.createdAt.toISOString(),
        })),
      };

      // If specific timer requested, get detailed info
      if (timerId) {
        const timer = await prisma.timer.findUnique({
          where: { id: timerId },
        });

        if (timer) {
          diagnostics.requestedTimer = {
            found: true,
            id: timer.id,
            name: timer.name,
            shop: timer.shop,
            status: timer.status,
            type: timer.type,
            impressions: timer.impressions,
            clicks: timer.clicks,
            createdAt: timer.createdAt.toISOString(),
            updatedAt: timer.updatedAt.toISOString(),
            belongsToShop: timer.shop === shop,
          };
        } else {
          diagnostics.requestedTimer = {
            found: false,
            timerId,
            note: "Timer not found in database",
          };
        }
      }
    } catch (error) {
      diagnostics.database = {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  } else {
    diagnostics.database = {
      status: "skipped",
      note: "Cannot query database without shop information",
    };
  }

  // Add recommendations
  diagnostics.recommendations = [];

  if (!shop) {
    diagnostics.recommendations.push(
      "Configure app proxy in Shopify Admin: Apps > Your App > Configuration > App Proxy"
    );
    diagnostics.recommendations.push(
      "Ensure proxy URL points to: https://countdown-timer-bar.vercel.app/apps/timer"
    );
    diagnostics.recommendations.push(
      'Set subpath to "timer" and prefix to "apps"'
    );
  }

  if (shop && diagnostics.database?.totalTimers === 0) {
    diagnostics.recommendations.push(
      "Create at least one timer in the admin dashboard"
    );
  }

  if (shop && diagnostics.database?.activeTimers === 0) {
    diagnostics.recommendations.push("Activate at least one timer");
  }

  if (
    shop &&
    diagnostics.database?.timers?.length > 0 &&
    diagnostics.database.timers.every((t: any) => t.impressions === 0)
  ) {
    diagnostics.recommendations.push(
      "Impressions are zero - timer may not be rendering on storefront or analytics tracking is not working"
    );
    diagnostics.recommendations.push(
      "Check that the theme block is installed and enabled"
    );
    diagnostics.recommendations.push(
      "Verify app proxy is accessible from storefront by visiting: https://[your-shop].myshopify.com/apps/timer/debug"
    );
  }

  return json(diagnostics, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, X-Shopify-Shop-Domain, X-Requested-With",
      "Content-Type": "application/json",
    },
  });
}

/**
 * Handle OPTIONS preflight
 */
export async function action({ request }: LoaderFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, X-Shopify-Shop-Domain, X-Requested-With",
      },
    });
  }

  return json({ error: "Method not allowed" }, { status: 405 });
}
