import webpush from "web-push";

// VAPID keys — these should be set as environment variables on Railway
// Generate new keys with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BDReaVZxMZwZY9bkxqthDVClqB8V1DiyqFiY4ZBf7ImlVaNU46KQ391u9Oc7XJ-ehAqRI8P0-8cDf92vNaSh80Y";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "oCgR1i7sqDoV6zxX4XwUrDEL-cmv4JyutO1A2WCTnBU";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:orderprimos@gmail.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export { VAPID_PUBLIC_KEY };

// In-memory store for push subscriptions (persists across requests but not server restarts)
// For a restaurant with 1-2 kitchen devices, this is sufficient
const subscriptions: Map<string, webpush.PushSubscription> = new Map();

export function addSubscription(subscription: webpush.PushSubscription): void {
  // Use the endpoint as a unique key
  subscriptions.set(subscription.endpoint, subscription);
  console.log(`[Push] Subscription added. Total: ${subscriptions.size}`);
}

export function removeSubscription(endpoint: string): void {
  subscriptions.delete(endpoint);
  console.log(`[Push] Subscription removed. Total: ${subscriptions.size}`);
}

export async function sendPushNotification(payload: {
  title: string;
  body: string;
  orderNumber?: string;
}): Promise<void> {
  if (subscriptions.size === 0) {
    console.log("[Push] No subscriptions registered, skipping push notification");
    return;
  }

  const jsonPayload = JSON.stringify(payload);
  const staleEndpoints: string[] = [];

  for (const [endpoint, subscription] of subscriptions) {
    try {
      await webpush.sendNotification(subscription, jsonPayload);
      console.log(`[Push] Notification sent to ${endpoint.slice(0, 50)}...`);
    } catch (err: any) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        // Subscription expired or unsubscribed
        staleEndpoints.push(endpoint);
        console.log(`[Push] Removing stale subscription: ${endpoint.slice(0, 50)}...`);
      } else {
        console.error(`[Push] Failed to send notification:`, err.message || err);
      }
    }
  }

  // Clean up stale subscriptions
  for (const endpoint of staleEndpoints) {
    subscriptions.delete(endpoint);
  }
}
