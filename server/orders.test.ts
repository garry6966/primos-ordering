import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("kitchen.login", () => {
  it("returns success with correct password", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.kitchen.login({ password: "primos2024" });
    expect(result).toEqual({ success: true });
  });

  it("returns failure with incorrect password", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.kitchen.login({ password: "wrong" });
    expect(result).toEqual({ success: false });
  });

  it("returns failure with empty password", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.kitchen.login({ password: "" });
    expect(result).toEqual({ success: false });
  });
});

describe("menu.getCategories", () => {
  it("returns an array of categories", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const categories = await caller.menu.getCategories();
    expect(Array.isArray(categories)).toBe(true);
    expect(categories.length).toBe(12);
    expect(categories[0]).toHaveProperty("name");
    expect(categories[0]).toHaveProperty("slug");
  });

  it("categories are in correct sort order", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const categories = await caller.menu.getCategories();
    expect(categories[0].slug).toBe("pizza");
    expect(categories[1].slug).toBe("parmesans");
    expect(categories[2].slug).toBe("beef-burgers");
  });
});

describe("menu.getAllItems", () => {
  it("returns an array of menu items", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const items = await caller.menu.getAllItems();
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(50);
    expect(items[0]).toHaveProperty("name");
    expect(items[0]).toHaveProperty("price");
    expect(items[0]).toHaveProperty("categoryId");
  });
});

describe("menu.getPizzaToppings", () => {
  it("returns an array of pizza toppings", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const toppings = await caller.menu.getPizzaToppings();
    expect(Array.isArray(toppings)).toBe(true);
    expect(toppings.length).toBe(19);
    expect(toppings[0]).toHaveProperty("name");
    expect(toppings[0]).toHaveProperty("price");
  });

  it("includes free toppings (EVOO, Crushed Chilli)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const toppings = await caller.menu.getPizzaToppings();
    const freeToppings = toppings.filter(t => parseFloat(t.price) === 0);
    expect(freeToppings.length).toBe(2);
  });
});

describe("orders.create", () => {
  it("creates an order and returns it with order number", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const order = await caller.orders.create({
      customerName: "Test Customer",
      customerPhone: "07123456789",
      customerEmail: "test@example.com",
      orderType: "collection",
      deliveryFee: 0,
      subtotal: 11.95,
      total: 11.95,
      items: [{
        menuItemId: 1,
        name: "Margherita",
        basePrice: 11.95,
        quantity: 1,
        totalPrice: 11.95,
      }],
    });
    expect(order).toHaveProperty("orderNumber");
    expect(order!.orderNumber).toMatch(/^PRM-/);
    expect(order!.customerName).toBe("Test Customer");
    expect(order!.status).toBe("new");
  });
});
