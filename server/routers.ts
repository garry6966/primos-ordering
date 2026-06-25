import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import {
  getCategories, getAllMenuItems, getPizzaToppings,
  createOrder, getOrders, updateOrderStatus,
  getApprovedReviews, getPendingReviews, createReview, moderateReview,
  replyToReviewDb, getAllApprovedReviews,
  getLoyaltyByEmail, awardLoyaltyStamp, redeemLoyaltyStamps,
  markLoyaltyStampsAwarded, markReviewEmailSent,
  getOrdersByEmail,
  createMenuItem, updateMenuItem, deleteMenuItem,
  createCategory, deleteCategory,
  getOffers, getActiveOffer, createOffer, toggleOffer, deleteOffer,
  getDeliverySettings, updateDeliverySettings,
} from "./db";
import OpenAI from "openai";
import { nanoid } from "nanoid";
import { notifyNewOrder } from "./index";
import { sendOrderNotificationEmail, sendReviewRequestEmail, sendOrderRejectionEmail } from "./email";
import { capturePayment, cancelPayment } from "./stripe";
import { updateOrderPaymentStatus } from "./db";

const t = initTRPC.context<{ req: any; res: any; user: any }>().create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(() => null),
    logout: publicProcedure.mutation(() => ({ success: true } as const)),
  }),

  menu: router({
    getCategories: publicProcedure.query(async () => {
      return getCategories();
    }),
    getAllItems: publicProcedure.query(async () => {
      return getAllMenuItems();
    }),
    getPizzaToppings: publicProcedure.query(async () => {
      return getPizzaToppings();
    }),

    // Kitchen management routes
    createItem: publicProcedure
      .input(z.object({
        categoryId: z.number(),
        name: z.string().min(1),
        description: z.string().optional(),
        price: z.string(),
        imageUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return createMenuItem(input);
      }),

    updateItem: publicProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        price: z.string().optional(),
        imageUrl: z.string().optional(),
        available: z.boolean().optional(),
        categoryId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return updateMenuItem(id, data);
      }),

    deleteItem: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return deleteMenuItem(input.id);
      }),

    createCategory: publicProcedure
      .input(z.object({
        name: z.string().min(1),
        slug: z.string().min(1),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return createCategory(input);
      }),

    deleteCategory: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return deleteCategory(input.id);
      }),
  }),

  orders: router({
    create: publicProcedure
      .input(z.object({
        customerName: z.string().min(1),
        customerPhone: z.string().min(1),
        customerEmail: z.string().email().optional().or(z.literal("")),
        orderType: z.enum(["delivery", "collection"]),
        deliveryAddress: z.string().optional(),
        deliveryFee: z.number(),
        subtotal: z.number(),
        total: z.number(),
        items: z.array(z.object({
          menuItemId: z.number(),
          name: z.string(),
          basePrice: z.number(),
          quantity: z.number(),
          toppings: z.array(z.object({ name: z.string(), price: z.number() })).optional(),
          mealDeal: z.string().nullable().optional(),
          mealDealPrice: z.number().optional(),
          totalPrice: z.number(),
        })),
        notes: z.string().optional(),
        redeemStamps: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const orderNumber = `PRM-${nanoid(6).toUpperCase()}`;

        // Handle loyalty redemption
        let actualTotal = input.total;
        let loyaltyRedemption = false;
        if (input.redeemStamps && input.customerEmail) {
          try {
            await redeemLoyaltyStamps(input.customerEmail);
            loyaltyRedemption = true;
          } catch (e) {
            console.warn("[Loyalty] Redemption failed:", e);
          }
        }

        const order = await createOrder({
          orderNumber,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          customerEmail: input.customerEmail || undefined,
          orderType: input.orderType,
          deliveryAddress: input.deliveryAddress,
          deliveryFee: input.deliveryFee.toFixed(2),
          subtotal: input.subtotal.toFixed(2),
          total: input.total.toFixed(2),
          items: input.items,
          notes: input.notes,
          loyaltyRedemption,
          paymentStatus: "paid",
        });

        // Award loyalty stamp if actual spend (subtotal minus discounts, excluding delivery) >= £30
        let stampsAwarded = false;
        let currentStamps = 0;
        // Actual spend = total - deliveryFee (total already has discounts applied, we exclude delivery)
        const spendForStamp = input.total - input.deliveryFee;
        if (input.customerEmail && spendForStamp >= 30) {
          try {
            const loyalty = await awardLoyaltyStamp(input.customerEmail);
            if (loyalty) {
              currentStamps = loyalty.stamps;
              stampsAwarded = true;
              await markLoyaltyStampsAwarded(order!.id);
            }
          } catch (e) {
            console.warn("[Loyalty] Award failed:", e);
          }
        } else if (input.customerEmail) {
          const loyalty = await getLoyaltyByEmail(input.customerEmail);
          if (loyalty) currentStamps = loyalty.stamps;
        }

        // Notify kitchen dashboard via SSE
        notifyNewOrder(order);
        // Send email notification to restaurant (fire-and-forget)
        sendOrderNotificationEmail({
          orderNumber: order!.orderNumber,
          customerName: order!.customerName,
          customerPhone: order!.customerPhone,
          customerEmail: order!.customerEmail,
          orderType: order!.orderType as "delivery" | "collection",
          deliveryAddress: order!.deliveryAddress,
          items: (order!.items as any[]).map((item: any) => ({
            name: item.name,
            quantity: item.quantity,
            totalPrice: item.totalPrice,
            toppings: item.toppings,
            mealDeal: item.mealDeal,
          })),
          subtotal: order!.subtotal,
          deliveryFee: order!.deliveryFee,
          total: order!.total,
          notes: order!.notes,
          createdAt: order!.createdAt,
        }).catch(err => console.error("[Email] Background send failed:", err));

        return {
          ...order,
          stampsAwarded,
          currentStamps,
          loyaltyRedemption,
        };
      }),

    list: publicProcedure.query(async () => {
      return getOrders();
    }),

    updateStatus: publicProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending_acceptance", "new", "preparing", "ready", "delivered", "collected", "rejected"]),
      }))
      .mutation(async ({ input }) => {
        const order = await updateOrderStatus(input.id, input.status);

        // --- ACCEPT: capture payment ---
        if (input.status === "new" && order && order.stripePaymentIntentId && order.paymentStatus === "authorized") {
          const captureResult = await capturePayment(order.stripePaymentIntentId);
          if (captureResult.success) {
            await updateOrderPaymentStatus(order.id, "paid");
            console.log(`[Payment] Captured for order ${order.orderNumber}`);

            // Award loyalty stamp now that payment is captured
            const actualSpend = parseFloat(order.subtotal) - parseFloat(order.discountAmount || "0");
            if (order.customerEmail && actualSpend >= 30 && !order.loyaltyStampsAwarded) {
              try {
                const loyalty = await awardLoyaltyStamp(order.customerEmail);
                if (loyalty) {
                  await markLoyaltyStampsAwarded(order.id);
                }
              } catch (e) {
                console.warn("[Loyalty] Award failed:", e);
              }
            }
          } else {
            console.error(`[Payment] Capture failed for ${order.orderNumber}: ${captureResult.error}`);
            throw new Error(`Payment capture failed: ${captureResult.error}`);
          }
        }

        // --- REJECT: cancel payment ---
        if (input.status === "rejected" && order && order.stripePaymentIntentId && order.paymentStatus === "authorized") {
          const cancelResult = await cancelPayment(order.stripePaymentIntentId);
          if (cancelResult.success) {
            await updateOrderPaymentStatus(order.id, "cancelled");
            console.log(`[Payment] Cancelled (hold released) for order ${order.orderNumber}`);
          } else {
            console.error(`[Payment] Cancel failed for ${order.orderNumber}: ${cancelResult.error}`);
          }

          // Send rejection email to customer
          if (order.customerEmail) {
            sendOrderRejectionEmail({
              orderNumber: order.orderNumber,
              customerName: order.customerName,
              customerEmail: order.customerEmail,
            }).catch(err => console.error("[Email] Rejection email failed:", err));
          }
        }

        // Schedule review request email 2 hours after order completion
        if ((input.status === "delivered" || input.status === "collected") && order && order.customerEmail && !order.reviewEmailSent) {
          const delayMs = 2 * 60 * 60 * 1000; // 2 hours
          setTimeout(async () => {
            try {
              const loyalty = await getLoyaltyByEmail(order.customerEmail!);
              const stampCount = loyalty ? loyalty.stamps : 0;

              await sendReviewRequestEmail({
                orderNumber: order.orderNumber,
                customerName: order.customerName,
                customerEmail: order.customerEmail!,
                items: (order.items as any[]).map((item: any) => ({
                  name: item.name,
                  quantity: item.quantity,
                })),
                stampCount,
              });
              await markReviewEmailSent(order.id);
              console.log(`[Email] Review request sent for ${order.orderNumber}`);
            } catch (err) {
              console.error("[Email] Review request failed:", err);
            }
          }, delayMs);
        }

        return order;
      }),

    getByEmail: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .query(async ({ input }) => {
        return getOrdersByEmail(input.email);
      }),
  }),

  kitchen: router({
    login: publicProcedure
      .input(z.object({ password: z.string() }))
      .mutation(({ input }) => {
        const kitchenPassword = process.env.KITCHEN_PASSWORD || "primos2024";
        if (input.password === kitchenPassword) {
          return { success: true };
        }
        return { success: false };
      }),
  }),

  reviews: router({
    list: publicProcedure.query(async () => {
      return getApprovedReviews();
    }),

    listAllApproved: publicProcedure.query(async () => {
      return getAllApprovedReviews();
    }),

    submit: publicProcedure
      .input(z.object({
        customerName: z.string().min(1).max(100),
        customerEmail: z.string().email().optional().or(z.literal("")),
        orderNumber: z.string().optional().or(z.literal("")),
        rating: z.number().min(1).max(5),
        comment: z.string().min(5).max(1000),
      }))
      .mutation(async ({ input }) => {
        return createReview({
          customerName: input.customerName,
          customerEmail: input.customerEmail || undefined,
          orderNumber: input.orderNumber || undefined,
          rating: input.rating,
          comment: input.comment,
        });
      }),

    listPending: publicProcedure.query(async () => {
      return getPendingReviews();
    }),

    moderate: publicProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["approved", "rejected"]),
      }))
      .mutation(async ({ input }) => {
        return moderateReview(input.id, input.status);
      }),

    replyToReview: publicProcedure
      .input(z.object({
        reviewId: z.number(),
        reply: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        return replyToReviewDb(input.reviewId, input.reply);
      }),

    generateReviewReply: publicProcedure
      .input(z.object({
        reviewText: z.string(),
        customerName: z.string(),
        starRating: z.number(),
      }))
      .mutation(async ({ input }) => {
        const client = new OpenAI();
        const isNegative = input.starRating <= 2;
        const systemPrompt = isNegative
          ? "You are replying to a customer review on behalf of Primos Restaurant. The review is negative (1-2 stars). Be apologetic, empathetic, and offer to make it right. Keep your reply to 1-2 sentences. Be warm and professional. Sign off as Primos Restaurant."
          : "You are replying to a customer review on behalf of Primos Restaurant. Be warm, thankful, and professional. Reference what the customer said. Keep your reply to 1-2 sentences. Sign off as Primos Restaurant.";

        const response = await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Customer name: ${input.customerName}\nRating: ${input.starRating}/5 stars\nReview: "${input.reviewText}"\n\nWrite a short reply:` },
          ],
          max_tokens: 150,
          temperature: 0.7,
        });

        const reply = response.choices[0]?.message?.content?.trim() || "Thank you for your feedback!";
        return { reply };
      }),
  }),

  loyalty: router({
    getStamps: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .query(async ({ input }) => {
        const account = await getLoyaltyByEmail(input.email);
        return account ? { stamps: account.stamps, totalStampsEarned: account.totalStampsEarned } : { stamps: 0, totalStampsEarned: 0 };
      }),

    check: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .query(async ({ input }) => {
        const account = await getLoyaltyByEmail(input.email);
        return {
          stamps: account?.stamps || 0,
          canRedeem: (account?.stamps || 0) >= 10,
          totalStampsEarned: account?.totalStampsEarned || 0,
        };
      }),
  }),

  account: router({
    orders: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .query(async ({ input }) => {
        const orders = await getOrdersByEmail(input.email);
        return orders.map(o => ({
          id: o.id,
          orderNumber: o.orderNumber,
          total: o.total,
          status: o.status,
          orderType: o.orderType,
          items: o.items,
          createdAt: o.createdAt,
        }));
      }),
  }),

  offers: router({
    list: publicProcedure.query(async () => {
      return getOffers();
    }),

    getActive: publicProcedure.query(async () => {
      return getActiveOffer();
    }),

    create: publicProcedure
      .input(z.object({
        name: z.string().min(1),
        discountPercent: z.number().min(1).max(100),
      }))
      .mutation(async ({ input }) => {
        return createOffer(input);
      }),

    toggle: publicProcedure
      .input(z.object({
        id: z.number(),
        active: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        return toggleOffer(input.id, input.active);
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return deleteOffer(input.id);
      }),
  }),

  delivery: router({
    getSettings: publicProcedure.query(async () => {
      const settings = await getDeliverySettings();
      if (!settings) {
        // Return defaults if no settings in DB yet
        return {
          id: 0,
          maxRadiusMiles: "3.0",
          freeDeliveryThreshold: "30.00",
          tiers: [{ maxMiles: 2, fee: 2.5 }, { maxMiles: 3, fee: 3.5 }],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      return {
        ...settings,
        tiers: typeof settings.tiers === "string" ? JSON.parse(settings.tiers) : settings.tiers,
      };
    }),

    updateSettings: publicProcedure
      .input(z.object({
        maxRadiusMiles: z.string().optional(),
        freeDeliveryThreshold: z.string().optional(),
        tiers: z.array(z.object({
          maxMiles: z.number(),
          fee: z.number(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        return updateDeliverySettings({
          maxRadiusMiles: input.maxRadiusMiles,
          freeDeliveryThreshold: input.freeDeliveryThreshold,
          tiers: input.tiers,
        });
      }),
  }),
});

export type AppRouter = typeof appRouter;
