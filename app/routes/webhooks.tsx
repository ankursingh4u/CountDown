import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import db from "~/db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, admin, payload } =
    await authenticate.webhook(request);

  // Note: admin context isn't returned if the webhook fired after a shop was uninstalled
  // or for compliance webhooks which don't require admin context

  switch (topic) {
    case "APP_UNINSTALLED":
      if (session) {
        // Clean up data when app is uninstalled
        await db.timer.deleteMany({ where: { shop } });
        await db.settings.deleteMany({ where: { shop } });
        await db.session.deleteMany({ where: { shop } });
      }
      break;
    case "CUSTOMERS_DATA_REQUEST":
      // Shopify requests customer data - this app doesn't store personal customer data
      // beyond what Shopify already has, so we just acknowledge the request
      console.log(`Received CUSTOMERS_DATA_REQUEST for shop: ${shop}`);
      break;
    case "CUSTOMERS_REDACT":
      // Shopify requests to delete customer data - this app doesn't store personal
      // customer data, so we just acknowledge the request
      console.log(`Received CUSTOMERS_REDACT for shop: ${shop}`);
      break;
    case "SHOP_REDACT":
      // Shopify requests to delete all shop data - 48 hours after app uninstall
      // Clean up any remaining data for this shop
      console.log(`Received SHOP_REDACT for shop: ${shop}`);
      await db.timer.deleteMany({ where: { shop } });
      await db.settings.deleteMany({ where: { shop } });
      await db.session.deleteMany({ where: { shop } });
      break;
    default:
      console.log(`Unhandled webhook topic: ${topic}`);
      return new Response("Unhandled webhook topic", { status: 404 });
  }

  return new Response(null, { status: 200 });
};
