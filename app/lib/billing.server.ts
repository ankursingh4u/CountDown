import { authenticate } from "~/shopify.server";

type AdminClient = Awaited<ReturnType<typeof authenticate.admin>>["admin"];

// This app bills merchants via Shopify App Pricing (configured in the Partner
// Dashboard), not the app's own Billing API. Subscription status for that
// comes from the Partner API, not the Admin API, so it's checked here with a
// direct fetch rather than through `authenticate.admin`'s `billing` helpers.
export const PLAN_FREE = "free";
export const PLAN_PAID = "standard";
export const FREE_ACTIVE_TIMER_LIMIT = 1;

export type PlanId = typeof PLAN_FREE | typeof PLAN_PAID;

export interface ShopPlan {
  plan: PlanId;
  planName: string;
}

const PARTNER_API_VERSION = "2026-07";

async function fetchActiveSubscription(appId: string, shopId: string) {
  const orgId = process.env.SHOPIFY_PARTNER_ORG_ID;
  const token = process.env.SHOPIFY_PARTNER_API_ACCESS_TOKEN;

  if (!orgId || !token) {
    throw new Error(
      "SHOPIFY_PARTNER_ORG_ID / SHOPIFY_PARTNER_API_ACCESS_TOKEN are not set"
    );
  }

  const response = await fetch(
    `https://partners.shopify.com/${orgId}/api/${PARTNER_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({
        query: `query ActiveSubscription($appId: ID!, $shopId: ID!) {
          activeSubscription(appId: $appId, shopId: $shopId) {
            cancelAtEndOfCycle
          }
        }`,
        variables: { appId, shopId },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Partner API request failed with status ${response.status}`);
  }

  const { data, errors } = await response.json();

  if (errors?.length) {
    throw new Error(`Partner API error: ${JSON.stringify(errors)}`);
  }

  // Null means the shop has no active Shopify App Pricing subscription for this app.
  return data.activeSubscription;
}

/**
 * Determines which plan the current shop is on. Defaults to the free plan on
 * any failure (missing credentials, Partner API error) so a billing-check
 * outage degrades to under-gating rather than locking paying merchants out.
 */
export async function getShopPlan(admin: AdminClient): Promise<ShopPlan> {
  const response = await admin.graphql(`#graphql
    query ShopAndAppId {
      shop {
        id
      }
      currentAppInstallation {
        app {
          id
        }
      }
    }
  `);
  const { data } = await response.json();
  const shopId = data?.shop?.id;
  const appId = data?.currentAppInstallation?.app?.id;

  if (!shopId || !appId) {
    console.error("getShopPlan: could not resolve shop/app id from Admin API");
    return { plan: PLAN_FREE, planName: "Free" };
  }

  try {
    const subscription = await fetchActiveSubscription(appId, shopId);
    return subscription
      ? { plan: PLAN_PAID, planName: "Standard" }
      : { plan: PLAN_FREE, planName: "Free" };
  } catch (error) {
    console.error("getShopPlan: Partner API subscription check failed", error);
    return { plan: PLAN_FREE, planName: "Free" };
  }
}

export function activeTimerLimitFor(plan: PlanId): number {
  return plan === PLAN_PAID ? Infinity : FREE_ACTIVE_TIMER_LIMIT;
}
