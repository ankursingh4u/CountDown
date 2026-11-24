import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Box,
  Divider,
} from "@shopify/polaris";
import { authenticate } from "~/shopify.server";
import { countActiveTimers } from "~/utils/timer.server";
import {
  getShopPlan,
  activeTimerLimitFor,
  PLAN_PAID,
} from "~/lib/billing.server";

// Matches the `shopify.app.maveric-countdown-timer.toml` filename
// (`shopify.app.<handle>.toml`) — this is how Shopify builds the hosted
// plan-selection page URL below.
const APP_HANDLE = "maveric-countdown-timer";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  const { plan, planName } = await getShopPlan(admin);
  const limit = activeTimerLimitFor(plan);
  const activeTimers = await countActiveTimers(shop);

  const storeHandle = shop.replace(".myshopify.com", "");
  const planSelectionUrl = `https://admin.shopify.com/store/${storeHandle}/charges/${APP_HANDLE}/pricing_plans`;

  return json({
    plan,
    planName,
    limit: Number.isFinite(limit) ? limit : null,
    activeTimers,
    planSelectionUrl,
  });
};

export default function PlanPage() {
  const { plan, planName, limit, activeTimers, planSelectionUrl } =
    useLoaderData<typeof loader>();

  const isPaid = plan === PLAN_PAID;

  return (
    <Page title="Plan">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">
                    Current plan
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Billed by Shopify as part of your store's subscription
                  </Text>
                </BlockStack>
                <Badge tone={isPaid ? "success" : undefined} size="large">
                  {planName}
                </Badge>
              </InlineStack>

              <Divider />

              <InlineStack align="space-between" blockAlign="center">
                <Text as="span" variant="bodyMd">
                  Active timers
                </Text>
                <Text as="span" variant="bodyMd" fontWeight="semibold">
                  {limit === null ? `${activeTimers} (unlimited)` : `${activeTimers} / ${limit}`}
                </Text>
              </InlineStack>

              {!isPaid && (
                <Box
                  background="bg-surface-secondary"
                  borderRadius="200"
                  padding="400"
                >
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd">
                      You're on the Free plan, limited to {limit} active timer.
                      Upgrade to Standard for unlimited active timers.
                    </Text>
                    <Box>
                      {/* Plain anchor + target="_top" is required here: the plan
                          selection page is outside this app's iframe, and a
                          Polaris Button can't escape the frame on its own. */}
                      <a
                        href={planSelectionUrl}
                        target="_top"
                        rel="noopener"
                        style={{
                          display: "inline-block",
                          padding: "8px 16px",
                          borderRadius: "8px",
                          background: "#000",
                          color: "#fff",
                          textDecoration: "none",
                          fontWeight: 600,
                        }}
                      >
                        Upgrade plan
                      </a>
                    </Box>
                  </BlockStack>
                </Box>
              )}

              {isPaid && (
                <Text as="p" variant="bodySm" tone="subdued">
                  Need to change or cancel your plan? Manage it from{" "}
                  <a href={planSelectionUrl} target="_top" rel="noopener">
                    your plan settings
                  </a>
                  .
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
