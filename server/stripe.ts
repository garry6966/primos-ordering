import Stripe from "stripe";
import { Request, Response, Router } from "express";
import { nanoid } from "nanoid";
import {
  createOrder, getDb,
  awardLoyaltyStamp, redeemLoyaltyStamps,
  getLoyaltyByEmail, markLoyaltyStampsAwarded,
  getDeliverySettings,
  getNextDailyNumber,
} from "./db";
import { orders } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { notifyNewOrder } from "./index";
import { sendOrderNotificationEmail } from "./email";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export const stripeRouter = Router();

// Refund an order by its payment intent ID
export async function refundOrder(paymentIntentId: string): Promise<{ success: boolean; refundId?: string; error?: string }> {
  try {
    if (!paymentIntentId) {
      return { success: false, error: "No payment intent ID" };
    }
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
    });
    console.log(`[Stripe] Refund created: ${refund.id} for payment intent: ${paymentIntentId}`);
    return { success: true, refundId: refund.id };
  } catch (err: any) {
    console.error(`[Stripe] Refund failed for ${paymentIntentId}:`, err.message);
    return { success: false, error: err.message };
  }
}

// Capture an authorized payment
export async function capturePayment(paymentIntentId: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!paymentIntentId) {
      return { success: false, error: "No payment intent ID" };
    }
    await stripe.paymentIntents.capture(paymentIntentId);
    console.log(`[Stripe] Payment captured for: ${paymentIntentId}`);
    return { success: true };
  } catch (err: any) {
    console.error(`[Stripe] Capture failed for ${paymentIntentId}:`, err.message);
    return { success: false, error: err.message };
  }
}

// Cancel an authorized payment (release the hold)
export async function cancelPayment(paymentIntentId: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!paymentIntentId) {
      return { success: false, error: "No payment intent ID" };
    }
    await stripe.paymentIntents.cancel(paymentIntentId);
    console.log(`[Stripe] Payment cancelled (hold released) for: ${paymentIntentId}`);
    return { success: true };
  } catch (err: any) {
    console.error(`[Stripe] Cancel failed for ${paymentIntentId}:`, err.message);
    return { success: false, error: err.message };
  }
}

// Helper: calculate delivery fee server-side for validation
async function calculateDeliveryFeeServer(address: string): Promise<{ fee: number; withinRadius: boolean; distance: number }> {
  // Geocode the address using Nominatim
  const query = encodeURIComponent(address.trim());
  const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=gb`;
  const geoRes = await fetch(nominatimUrl, {
    headers: { "User-Agent": "PrimosOrdering/1.0" },
  });
  const geoData = await geoRes.json();

  if (!geoData || geoData.length === 0) {
    throw new Error("Could not geocode address");
  }

  const customerLat = parseFloat(geoData[0].lat);
  const customerLon = parseFloat(geoData[0].lon);

  // Restaurant coordinates
  const restaurantLat = 55.9641;
  const restaurantLon = -3.2492;

  // Haversine formula
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(customerLat - restaurantLat);
  const dLon = toRad(customerLon - restaurantLon);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(restaurantLat)) * Math.cos(toRad(customerLat)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceMiles = 3959 * c;

  // Get delivery settings
  const settings = await getDeliverySettings();
  const maxRadius = settings ? parseFloat(settings.maxRadiusMiles) : 3.0;
  const tiers: Array<{ maxMiles: number; fee: number }> = settings?.tiers
    ? (typeof settings.tiers === "string" ? JSON.parse(settings.tiers) : settings.tiers)
    : [{ maxMiles: 2, fee: 2.5 }, { maxMiles: 3, fee: 3.5 }];

  if (distanceMiles > maxRadius) {
    return { fee: 0, withinRadius: false, distance: distanceMiles };
  }

  // Calculate fee based on tiers
  const sortedTiers = [...tiers].sort((a, b) => a.maxMiles - b.maxMiles);
  let fee = sortedTiers.length > 0 ? sortedTiers[sortedTiers.length - 1].fee : 0;
  for (const tier of sortedTiers) {
    if (distanceMiles <= tier.maxMiles) {
      fee = tier.fee;
      break;
    }
  }

  return { fee, withinRadius: true, distance: distanceMiles };
}

// --- Create Checkout Session ---
stripeRouter.post("/create-checkout-session", async (req: Request, res: Response) => {
  try {
    const {
      customerName,
      customerPhone,
      customerEmail,
      orderType,
      deliveryAddress,
      deliveryFee,
      subtotal,
      total,
      items,
      notes,
      redeemStamps,
      discountPercent,
      discountAmount,
    } = req.body;

    // Server-side delivery fee validation for delivery orders
    let validatedDeliveryFee = deliveryFee;
    if (orderType === "delivery" && deliveryAddress) {
      try {
        const settings = await getDeliverySettings();
        const freeThreshold = settings ? parseFloat(settings.freeDeliveryThreshold) : 30.0;

        // If subtotal is above free delivery threshold, fee should be 0
        if (subtotal >= freeThreshold) {
          validatedDeliveryFee = 0;
        } else {
          const calcResult = await calculateDeliveryFeeServer(deliveryAddress);
          if (!calcResult.withinRadius) {
            return res.status(400).json({ error: "Delivery address is outside our delivery area" });
          }
          validatedDeliveryFee = calcResult.fee;
        }
      } catch (err: any) {
        // If geocoding fails, accept the client-sent fee (graceful degradation)
        console.warn("[Stripe] Delivery fee validation failed, using client value:", err.message);
      }
    }

    // Build line items for Stripe
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((item: any) => ({
      price_data: {
        currency: "gbp",
        product_data: {
          name: item.name,
          description: item.toppings?.length
            ? `Toppings: ${item.toppings.map((t: any) => t.name).join(", ")}`
            : undefined,
        },
        unit_amount: Math.round(item.totalPrice * 100), // Convert to pence
      },
      quantity: item.quantity,
    }));

    // Add delivery fee as a line item if applicable
    if (validatedDeliveryFee > 0) {
      lineItems.push({
        price_data: {
          currency: "gbp",
          product_data: {
            name: "Delivery Fee",
          },
          unit_amount: Math.round(validatedDeliveryFee * 100),
        },
        quantity: 1,
      });
    }

    // Recalculate total with validated delivery fee
    const validatedTotal = subtotal + validatedDeliveryFee - (discountAmount || 0) - (redeemStamps ? 10 : 0);
    const finalTotal = Math.max(0, validatedTotal);

    // Handle discounts (offer + loyalty)
    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
    const totalDiscountPence = Math.round((discountAmount || 0) * 100) + (redeemStamps ? 1000 : 0);
    if (totalDiscountPence > 0) {
      const couponName = [];
      if (discountAmount > 0 && discountPercent > 0) couponName.push(`${discountPercent}% Off Offer`);
      if (redeemStamps) couponName.push('Loyalty Reward (10 Stamps)');
      const coupon = await stripe.coupons.create({
        amount_off: totalDiscountPence,
        currency: "gbp",
        duration: "once",
        name: couponName.join(' + '),
      });
      discounts = [{ coupon: coupon.id }];
    }

    // Generate order number ahead of time
    const orderNumber = `PRM-${nanoid(6).toUpperCase()}`;
    const dailyNumber = await getNextDailyNumber();

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ["card"],
      mode: "payment",
      line_items: lineItems,
      success_url: `https://orderprimosfood.com/confirmation/${orderNumber}`,
      cancel_url: `https://orderprimosfood.com/checkout`,
      customer_email: customerEmail || undefined,
      payment_intent_data: {
        capture_method: "manual",
      },
      metadata: {
        orderNumber,
        customerName,
        customerPhone,
        customerEmail: customerEmail || "",
        orderType,
        deliveryAddress: deliveryAddress || "",
        deliveryFee: String(validatedDeliveryFee),
        subtotal: String(subtotal),
        total: String(finalTotal),
        items: JSON.stringify(items),
        notes: notes || "",
        redeemStamps: redeemStamps ? "true" : "false",
      },
    };

    if (discounts) {
      sessionParams.discounts = discounts;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Create the order in the database with pending payment status
    await createOrder({
      orderNumber,
      customerName,
      customerPhone,
      customerEmail: customerEmail || undefined,
      orderType,
      deliveryAddress: orderType === "delivery" ? deliveryAddress : undefined,
      deliveryFee: validatedDeliveryFee.toFixed(2),
      subtotal: subtotal.toFixed(2),
      total: finalTotal.toFixed(2),
      items,
      notes: notes || undefined,
      loyaltyRedemption: redeemStamps || false,
      stripeSessionId: session.id,
      paymentStatus: "pending",
      discountPercent: discountPercent || 0,
      discountAmount: discountAmount ? discountAmount.toFixed(2) : "0.00",
      dailyNumber,
    });

    res.json({ url: session.url, orderNumber });
  } catch (error: any) {
    console.error("[Stripe] Error creating checkout session:", error);
    res.status(500).json({ error: error.message || "Failed to create checkout session" });
  }
});

// --- Webhook Handler ---
stripeRouter.post(
  "/webhook",
  async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: Stripe.Event;

    try {
      if (webhookSecret) {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } else {
        // In development without webhook secret, parse the event directly
        event = req.body as Stripe.Event;
      }
    } catch (err: any) {
      console.error("[Stripe Webhook] Signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`[Stripe Webhook] Payment authorized for session: ${session.id}`);

        try {
          const db = await getDb();
          if (!db) {
            console.error("[Stripe Webhook] Database not available");
            break;
          }

          // Update order payment status to "authorized" (not captured yet)
          await db.update(orders).set({
            paymentStatus: "authorized",
            stripePaymentIntentId: session.payment_intent as string,
          }).where(eq(orders.stripeSessionId, session.id));

          // Get the updated order
          const [order] = await db.select().from(orders)
            .where(eq(orders.stripeSessionId, session.id))
            .limit(1);

          if (order) {
            // Handle loyalty redemption (deduct stamps immediately since customer committed)
            if (session.metadata?.redeemStamps === "true" && order.customerEmail) {
              try {
                await redeemLoyaltyStamps(order.customerEmail);
              } catch (e) {
                console.warn("[Stripe Webhook] Loyalty redemption failed:", e);
              }
            }

            // Do NOT award loyalty stamps yet — wait until payment is captured (staff accepts)

            // Notify kitchen dashboard via SSE
            notifyNewOrder(order);

            // Send email notification to restaurant
            sendOrderNotificationEmail({
              orderNumber: order.orderNumber,
              customerName: order.customerName,
              customerPhone: order.customerPhone,
              customerEmail: order.customerEmail,
              orderType: order.orderType as "delivery" | "collection",
              deliveryAddress: order.deliveryAddress,
              items: (order.items as any[]).map((item: any) => ({
                name: item.name,
                quantity: item.quantity,
                totalPrice: item.totalPrice,
                toppings: item.toppings,
                mealDeal: item.mealDeal,
              })),
              subtotal: order.subtotal,
              deliveryFee: order.deliveryFee,
              total: order.total,
              notes: order.notes,
              createdAt: order.createdAt,
            }).catch(err => console.error("[Stripe Webhook] Email send failed:", err));
          }
        } catch (error) {
          console.error("[Stripe Webhook] Error processing payment:", error);
        }
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`[Stripe Webhook] Session expired: ${session.id}`);

        try {
          const db = await getDb();
          if (db) {
            await db.update(orders).set({
              paymentStatus: "failed",
            }).where(eq(orders.stripeSessionId, session.id));
          }
        } catch (error) {
          console.error("[Stripe Webhook] Error handling expired session:", error);
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  }
);
