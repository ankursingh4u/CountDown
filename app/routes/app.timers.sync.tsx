import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { syncTimersToMetafield } from "~/utils/sync.server";

/**
 * Manual sync endpoint - force sync timers to metafields
 * POST /app/timers/sync
 */
export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    console.log("Manual sync requested for shop:", shop);

    const success = await syncTimersToMetafield(admin, shop);

    if (success) {
      return json({
        success: true,
        message: "Timers successfully synced to storefront",
        shop,
        timestamp: new Date().toISOString(),
      });
    } else {
      return json(
        {
          success: false,
          error: "Failed to sync timers to metafield",
          shop,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Manual sync failed:", error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        shop,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
