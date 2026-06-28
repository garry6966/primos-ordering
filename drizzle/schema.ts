import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const menuCategories = mysqlTable("menu_categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  sortOrder: int("sortOrder").default(0).notNull(),
});

export const menuItems = mysqlTable("menu_items", {
  id: int("id").autoincrement().primaryKey(),
  categoryId: int("categoryId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 6, scale: 2 }).notNull(),
  imageUrl: varchar("imageUrl", { length: 500 }),
  available: boolean("available").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
});

export const pizzaToppings = mysqlTable("pizza_toppings", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  price: decimal("price", { precision: 5, scale: 2 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
});

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  orderNumber: varchar("orderNumber", { length: 20 }).notNull().unique(),
  customerName: varchar("customerName", { length: 200 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 30 }).notNull(),
  customerEmail: varchar("customerEmail", { length: 320 }),
  orderType: mysqlEnum("orderType", ["delivery", "collection"]).notNull(),
  deliveryAddress: text("deliveryAddress"),
  deliveryFee: decimal("deliveryFee", { precision: 5, scale: 2 }).default("0.00").notNull(),
  subtotal: decimal("subtotal", { precision: 8, scale: 2 }).notNull(),
  total: decimal("total", { precision: 8, scale: 2 }).notNull(),
  discountPercent: int("discountPercent").default(0),
  discountAmount: decimal("discountAmount", { precision: 8, scale: 2 }).default("0.00"),
  status: mysqlEnum("status", ["pending_acceptance", "new", "preparing", "ready", "delivered", "collected", "rejected"]).default("pending_acceptance").notNull(),
  items: json("items").notNull(),
  notes: text("notes"),
  reviewEmailSent: boolean("reviewEmailSent").default(false).notNull(),
  loyaltyStampsAwarded: boolean("loyaltyStampsAwarded").default(false).notNull(),
  loyaltyRedemption: boolean("loyaltyRedemption").default(false).notNull(),
  stripeSessionId: varchar("stripeSessionId", { length: 255 }),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  paymentStatus: varchar("paymentStatus", { length: 20 }).default("pending").notNull(),
  paymentMethod: varchar("paymentMethod", { length: 10 }).default("card").notNull(),
  dailyNumber: int("dailyNumber"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  customerName: varchar("customerName", { length: 200 }).notNull(),
  customerEmail: varchar("customerEmail", { length: 320 }),
  orderNumber: varchar("orderNumber", { length: 20 }),
  rating: int("rating").notNull(),
  comment: text("comment").notNull(),
  reply: text("reply"),
  repliedAt: timestamp("repliedAt"),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const loyaltyAccounts = mysqlTable("loyalty_accounts", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  stamps: int("stamps").default(0).notNull(),
  totalStampsEarned: int("totalStampsEarned").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const offers = mysqlTable("offers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  discountPercent: int("discountPercent").notNull(),
  active: boolean("active").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const deliverySettings = mysqlTable("delivery_settings", {
  id: int("id").autoincrement().primaryKey(),
  maxRadiusMiles: decimal("maxRadiusMiles", { precision: 4, scale: 1 }).notNull().default("3.0"),
  freeDeliveryThreshold: decimal("freeDeliveryThreshold", { precision: 6, scale: 2 }).notNull().default("30.00"),
  tiers: json("tiers").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type MenuCategory = typeof menuCategories.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
export type PizzaTopping = typeof pizzaToppings.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type LoyaltyAccount = typeof loyaltyAccounts.$inferSelect;
export type Offer = typeof offers.$inferSelect;
export type DeliverySettings = typeof deliverySettings.$inferSelect;
