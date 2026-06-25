import { eq, asc, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, menuCategories, menuItems, pizzaToppings, orders, reviews, loyaltyAccounts, offers, deliverySettings } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === process.env.OWNER_OPEN_ID) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ========== Menu queries ==========
export async function getCategories() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(menuCategories).orderBy(asc(menuCategories.sortOrder));
}

export async function getMenuItemsByCategory(categoryId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(menuItems)
    .where(eq(menuItems.categoryId, categoryId))
    .orderBy(asc(menuItems.sortOrder));
}

export async function getAllMenuItems() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(menuItems).orderBy(asc(menuItems.sortOrder));
}

export async function getPizzaToppings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pizzaToppings).orderBy(asc(pizzaToppings.sortOrder));
}

// ========== Menu Management (Kitchen) ==========
export async function createMenuItem(data: {
  categoryId: number;
  name: string;
  description?: string;
  price: string;
  imageUrl?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Get max sortOrder for the category
  const existing = await db.select().from(menuItems)
    .where(eq(menuItems.categoryId, data.categoryId))
    .orderBy(desc(menuItems.sortOrder))
    .limit(1);
  const nextSort = existing.length > 0 ? existing[0].sortOrder + 1 : 1;
  await db.insert(menuItems).values({
    categoryId: data.categoryId,
    name: data.name,
    description: data.description || null,
    price: data.price,
    imageUrl: data.imageUrl || null,
    available: true,
    sortOrder: nextSort,
  });
  return { success: true };
}

export async function updateMenuItem(id: number, data: {
  name?: string;
  description?: string;
  price?: string;
  imageUrl?: string;
  available?: boolean;
  categoryId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateSet: Record<string, unknown> = {};
  if (data.name !== undefined) updateSet.name = data.name;
  if (data.description !== undefined) updateSet.description = data.description;
  if (data.price !== undefined) updateSet.price = data.price;
  if (data.imageUrl !== undefined) updateSet.imageUrl = data.imageUrl;
  if (data.available !== undefined) updateSet.available = data.available;
  if (data.categoryId !== undefined) updateSet.categoryId = data.categoryId;
  if (Object.keys(updateSet).length === 0) return { success: true };
  await db.update(menuItems).set(updateSet).where(eq(menuItems.id, id));
  return { success: true };
}

export async function deleteMenuItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(menuItems).where(eq(menuItems.id, id));
  return { success: true };
}

export async function createCategory(data: { name: string; slug: string; description?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(menuCategories).orderBy(desc(menuCategories.sortOrder)).limit(1);
  const nextSort = existing.length > 0 ? existing[0].sortOrder + 1 : 1;
  await db.insert(menuCategories).values({
    name: data.name,
    slug: data.slug,
    description: data.description || null,
    sortOrder: nextSort,
  });
  return { success: true };
}

export async function deleteCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete all items in the category first
  await db.delete(menuItems).where(eq(menuItems.categoryId, id));
  await db.delete(menuCategories).where(eq(menuCategories.id, id));
  return { success: true };
}

// ========== Order queries ==========
export async function createOrder(data: {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  orderType: "delivery" | "collection";
  deliveryAddress?: string;
  deliveryFee: string;
  subtotal: string;
  total: string;
  items: unknown;
  notes?: string;
  loyaltyRedemption?: boolean;
  stripeSessionId?: string;
  paymentStatus?: "pending" | "paid" | "failed";
  discountPercent?: number;
  discountAmount?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(orders).values({
    orderNumber: data.orderNumber,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    customerEmail: data.customerEmail || null,
    orderType: data.orderType,
    deliveryAddress: data.deliveryAddress || null,
    deliveryFee: data.deliveryFee,
    subtotal: data.subtotal,
    total: data.total,
    items: data.items,
    notes: data.notes || null,
    loyaltyRedemption: data.loyaltyRedemption || false,
    stripeSessionId: data.stripeSessionId || null,
    paymentStatus: data.paymentStatus || "pending",
    status: "pending_acceptance",
    discountPercent: data.discountPercent || 0,
    discountAmount: data.discountAmount || "0.00",
  });
  const result = await db.select().from(orders).where(eq(orders.orderNumber, data.orderNumber)).limit(1);
  return result[0];
}

export async function getOrders() {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(orders).orderBy(asc(orders.createdAt));
  } catch (error) {
    console.error("[Database] getOrders() failed, returning empty array:", error);
    return [];
  }
}

export async function updateOrderStatus(id: number, status: "pending_acceptance" | "new" | "preparing" | "ready" | "delivered" | "collected" | "rejected") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orders).set({ status }).where(eq(orders.id, id));
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result[0];
}

export async function markReviewEmailSent(orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orders).set({ reviewEmailSent: true }).where(eq(orders.id, orderId));
}

export async function markLoyaltyStampsAwarded(orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orders).set({ loyaltyStampsAwarded: true }).where(eq(orders.id, orderId));
}

// ========== Reviews queries ==========
export async function getApprovedReviews() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reviews)
    .where(eq(reviews.status, "approved"))
    .orderBy(desc(reviews.createdAt))
    .limit(20);
}

export async function getPendingReviews() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reviews)
    .where(eq(reviews.status, "pending"))
    .orderBy(desc(reviews.createdAt));
}

export async function createReview(data: {
  customerName: string;
  customerEmail?: string;
  orderNumber?: string;
  rating: number;
  comment: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(reviews).values({
    customerName: data.customerName,
    customerEmail: data.customerEmail || null,
    orderNumber: data.orderNumber || null,
    rating: data.rating,
    comment: data.comment,
  });
  return { success: true };
}

export async function moderateReview(id: number, status: "approved" | "rejected") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(reviews).set({ status }).where(eq(reviews.id, id));
  return { success: true };
}

export async function replyToReviewDb(id: number, reply: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(reviews).set({ reply, repliedAt: new Date() }).where(eq(reviews.id, id));
  return { success: true };
}

export async function getAllApprovedReviews() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reviews)
    .where(eq(reviews.status, "approved"))
    .orderBy(desc(reviews.createdAt));
}

// ========== Loyalty queries ==========
export async function getLoyaltyByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(loyaltyAccounts)
    .where(eq(loyaltyAccounts.email, email.toLowerCase()))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function awardLoyaltyStamp(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getLoyaltyByEmail(email);
  if (existing) {
    await db.update(loyaltyAccounts).set({
      stamps: existing.stamps + 1,
      totalStampsEarned: existing.totalStampsEarned + 1,
    }).where(eq(loyaltyAccounts.id, existing.id));
  } else {
    await db.insert(loyaltyAccounts).values({
      email: email.toLowerCase(),
      stamps: 1,
      totalStampsEarned: 1,
    });
  }
  const updated = await getLoyaltyByEmail(email);
  return updated;
}

export async function redeemLoyaltyStamps(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getLoyaltyByEmail(email);
  if (!existing || existing.stamps < 10) {
    throw new Error("Not enough stamps to redeem");
  }
  await db.update(loyaltyAccounts).set({
    stamps: existing.stamps - 10,
  }).where(eq(loyaltyAccounts.id, existing.id));
  return { success: true, remainingStamps: existing.stamps - 10 };
}

// ========== Account queries ==========
export async function getOrdersByEmail(email: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders)
    .where(eq(orders.customerEmail, email.toLowerCase()))
    .orderBy(desc(orders.createdAt))
    .limit(50);
}

// ========== Offers queries ==========
export async function getOffers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(offers).orderBy(desc(offers.createdAt));
}

export async function getActiveOffer() {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(offers)
    .where(eq(offers.active, true))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createOffer(data: { name: string; discountPercent: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(offers).values({
    name: data.name,
    discountPercent: data.discountPercent,
    active: false,
  });
  return { success: true };
}

export async function toggleOffer(id: number, active: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // If activating, deactivate all others first
  if (active) {
    await db.update(offers).set({ active: false }).where(eq(offers.active, true));
  }
  await db.update(offers).set({ active }).where(eq(offers.id, id));
  return { success: true };
}

export async function deleteOffer(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(offers).where(eq(offers.id, id));
  return { success: true };
}

// ========== Delivery Settings queries ==========
export async function getDeliverySettings() {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(deliverySettings).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateDeliverySettings(data: {
  maxRadiusMiles?: string;
  freeDeliveryThreshold?: string;
  tiers?: unknown;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getDeliverySettings();
  if (!existing) {
    // Create with defaults if not exists
    await db.insert(deliverySettings).values({
      maxRadiusMiles: data.maxRadiusMiles || "3.0",
      freeDeliveryThreshold: data.freeDeliveryThreshold || "30.00",
      tiers: data.tiers || [{ maxMiles: 2, fee: 2.5 }, { maxMiles: 3, fee: 3.5 }],
    });
  } else {
    const updateSet: Record<string, unknown> = {};
    if (data.maxRadiusMiles !== undefined) updateSet.maxRadiusMiles = data.maxRadiusMiles;
    if (data.freeDeliveryThreshold !== undefined) updateSet.freeDeliveryThreshold = data.freeDeliveryThreshold;
    if (data.tiers !== undefined) updateSet.tiers = data.tiers;
    if (Object.keys(updateSet).length > 0) {
      await db.update(deliverySettings).set(updateSet).where(eq(deliverySettings.id, existing.id));
    }
  }
  return { success: true };
}
