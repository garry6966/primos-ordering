import "dotenv/config";
import express from "express";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { stripeRouter } from "./stripe";
import mysql from "mysql2/promise";

// Simple event emitter for order updates
type OrderListener = (data: unknown) => void;
const orderListeners: Set<OrderListener> = new Set();

export function notifyNewOrder(order: unknown) {
  orderListeners.forEach(listener => listener(order));
}

async function runMigrations() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.warn("[Migration] No DATABASE_URL, skipping migrations");
    return;
  }
  
  try {
    const connection = await mysql.createConnection(dbUrl);
    console.log("[Migration] Connected to database, running migrations...");
    
    // Create tables
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS menu_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        sortOrder INT NOT NULL DEFAULT 0
      )
    `);
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        categoryId INT NOT NULL,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        price DECIMAL(6,2) NOT NULL,
        available BOOLEAN NOT NULL DEFAULT TRUE,
        sortOrder INT NOT NULL DEFAULT 0
      )
    `);
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS pizza_toppings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        price DECIMAL(5,2) NOT NULL,
        sortOrder INT NOT NULL DEFAULT 0
      )
    `);
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        orderNumber VARCHAR(20) NOT NULL UNIQUE,
        customerName VARCHAR(200) NOT NULL,
        customerPhone VARCHAR(30) NOT NULL,
        customerEmail VARCHAR(320),
        orderType ENUM('delivery','collection') NOT NULL,
        deliveryAddress TEXT,
        deliveryFee DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        subtotal DECIMAL(8,2) NOT NULL,
        total DECIMAL(8,2) NOT NULL,
        status ENUM('new','preparing','ready','delivered','collected') NOT NULL DEFAULT 'new',
        items JSON NOT NULL,
        notes TEXT,
        reviewEmailSent BOOLEAN NOT NULL DEFAULT FALSE,
        loyaltyStampsAwarded BOOLEAN NOT NULL DEFAULT FALSE,
        loyaltyRedemption BOOLEAN NOT NULL DEFAULT FALSE,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    // Add columns to orders table
    const orderCols = [
      { name: 'reviewEmailSent', def: 'BOOLEAN NOT NULL DEFAULT FALSE' },
      { name: 'loyaltyStampsAwarded', def: 'BOOLEAN NOT NULL DEFAULT FALSE' },
      { name: 'loyaltyRedemption', def: 'BOOLEAN NOT NULL DEFAULT FALSE' },
      { name: 'stripeSessionId', def: 'VARCHAR(255) DEFAULT NULL' },
      { name: 'stripePaymentIntentId', def: 'VARCHAR(255) DEFAULT NULL' },
      { name: 'paymentStatus', def: "VARCHAR(20) NOT NULL DEFAULT 'pending'" },
      { name: 'discountPercent', def: 'INT DEFAULT 0' },
      { name: 'discountAmount', def: "DECIMAL(8,2) DEFAULT '0.00'" },
      { name: 'dailyNumber', def: 'INT DEFAULT NULL' },
    ];
    for (const col of orderCols) {
      try {
        await connection.execute(`ALTER TABLE orders ADD COLUMN ${col.name} ${col.def}`);
        console.log(`[Migration] Added column: orders.${col.name}`);
      } catch (e: any) {
        if (!e.message.includes('Duplicate column')) {
          console.warn(`[Migration] Could not add column ${col.name}:`, e.message);
        }
      }
    }
    // Migrate orders.status ENUM to include new values
    try {
      await connection.execute(`
        ALTER TABLE orders MODIFY COLUMN status ENUM('pending_acceptance','new','preparing','ready','delivered','collected','rejected') NOT NULL DEFAULT 'pending_acceptance'
      `);
      console.log('[Migration] Updated orders.status ENUM');
    } catch (e: any) {
      // Might already be updated
      if (!e.message.includes('Duplicate')) {
        console.warn('[Migration] Could not update orders.status ENUM:', e.message);
      }
    }

    // Add imageUrl column to menu_items if not exists
    try {
      await connection.execute(`ALTER TABLE menu_items ADD COLUMN imageUrl VARCHAR(500) DEFAULT NULL`);
      console.log('[Migration] Added column: menu_items.imageUrl');
    } catch (e: any) {
      if (!e.message.includes('Duplicate column')) {
        console.warn('[Migration] Could not add imageUrl column:', e.message);
      }
    }

    // Create offers table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS offers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        discountPercent INT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT FALSE,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('[Migration] Offers table ready');

    // Create delivery_settings table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS delivery_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        maxRadiusMiles DECIMAL(4,1) NOT NULL DEFAULT 3.0,
        freeDeliveryThreshold DECIMAL(6,2) NOT NULL DEFAULT 30.00,
        tiers JSON NOT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    // Seed delivery_settings with defaults if empty
    const [dsRows] = await connection.execute("SELECT COUNT(*) as cnt FROM delivery_settings");
    if ((dsRows as any)[0].cnt === 0) {
      await connection.execute(
        `INSERT INTO delivery_settings (maxRadiusMiles, freeDeliveryThreshold, tiers) VALUES (3.0, 30.00, ?)`,
        [JSON.stringify([{"maxMiles": 2, "fee": 2.50}, {"maxMiles": 3, "fee": 3.50}])]
      );
      console.log('[Migration] Delivery settings seeded with defaults');
    }
    console.log('[Migration] Delivery settings table ready');

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customerName VARCHAR(200) NOT NULL,
        customerEmail VARCHAR(320),
        orderNumber VARCHAR(20),
        rating INT NOT NULL,
        comment TEXT NOT NULL,
        status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Add reply columns to reviews table if not exists
    try {
      await connection.execute(`ALTER TABLE reviews ADD COLUMN reply TEXT DEFAULT NULL`);
      console.log(`[Migration] Added column: reviews.reply`);
    } catch (e: any) {
      if (!e.message.includes('Duplicate column')) {
        console.warn(`[Migration] reviews.reply:`, e.message);
      }
    }
    try {
      await connection.execute(`ALTER TABLE reviews ADD COLUMN repliedAt TIMESTAMP NULL DEFAULT NULL`);
      console.log(`[Migration] Added column: reviews.repliedAt`);
    } catch (e: any) {
      if (!e.message.includes('Duplicate column')) {
        console.warn(`[Migration] reviews.repliedAt:`, e.message);
      }
    }

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS loyalty_accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(320) NOT NULL UNIQUE,
        stamps INT NOT NULL DEFAULT 0,
        totalStampsEarned INT NOT NULL DEFAULT 0,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Check if menu data exists
    const [rows] = await connection.execute("SELECT COUNT(*) as cnt FROM menu_categories");
    const count = (rows as any)[0].cnt;
    
    if (count === 0) {
      console.log("[Migration] Seeding menu data...");
      
      // Seed categories
      await connection.execute(`
        INSERT INTO menu_categories (name, slug, description, sortOrder) VALUES
        ('Pizza', 'pizza', 'All pizzas are made fresh on the premises and include San Marzano tomatoes and 100% mozzarella. All our pizzas are 12 inch. Choice of thin base or pan base available.', 1),
        ('Parmesans', 'parmesans', 'A specialty dish, a crispy breadcrumbed succulent chicken breast fillet, topped with creamy parmesan sauce and a special mix of cheese and lightly grilled. All parmos served with fries, a fresh crunchy side salad with homemade chilli and garlic sauce.', 2),
        ('Beef Burgers', 'beef-burgers', 'All burgers served on a Martins Potato Bun with 2x beef patties.', 3),
        ('Loaded Fries', 'loaded-fries', 'Crispy golden fries loaded with delicious toppings.', 4),
        ('Loaded Tots', 'loaded-tots', 'Golden tater tots loaded with delicious toppings.', 5),
        ('Kebabs', 'kebabs', 'All kebabs are served with a soft pitta bread, fresh crunchy salad and homemade chilli and garlic sauce.', 6),
        ('Wraps', 'wraps', 'Fresh wraps with your choice of filling.', 7),
        ('Sides', 'sides', 'Sides and extras to complement your meal.', 8),
        ('Dips', 'dips', 'Sauces and dips.', 9),
        ('Milkshakes', 'milkshakes', 'Thick, creamy milkshakes.', 10),
        ('Desserts', 'desserts', 'Sweet treats to finish your meal.', 11),
        ('Waffles', 'waffles', 'Fresh waffles with delicious toppings.', 12)
      `);
      
      // Seed pizza items
      await connection.execute(`
        INSERT INTO menu_items (categoryId, name, description, price, sortOrder) VALUES
        (1, 'Margherita', 'Tomato base, mozzarella, grana padano, basil and EVOO', 11.95, 1),
        (1, 'Mushroom', 'Tomato base, mozzarella, mushrooms', 12.95, 2),
        (1, 'Plain Chicken', 'Tomato base, mozzarella, chicken', 13.95, 3),
        (1, 'Chicken Tikka', 'Tomato base, mozzarella, chicken tikka, onions, mixed peppers and green chillies', 13.95, 4),
        (1, 'BBQ Chicken', 'BBQ sauce base, mozzarella, BBQ chicken', 13.95, 5),
        (1, 'Butter Chicken', 'Butter chicken sauce base, chicken tikka, onions and jalapenos', 13.95, 6),
        (1, 'Donner', 'Tomato base, mozzarella, donner meat, homemade chilli and garlic sauce', 13.95, 7),
        (1, 'Lahori Special', 'Tomato base, mozzarella, chicken tikka, keema, onions, mixed peppers and green chilli or jalapenos', 14.95, 8),
        (1, 'Paneer', 'Tomato base, mozzarella, paneer, onions, and green chilli', 12.95, 9),
        (1, 'Veggie', 'Tomato base, mozzarella, red onions, mixed peppers, black olives, mushrooms and sweetcorn', 13.95, 10)
      `);
      
      // Seed parmesans
      await connection.execute(`
        INSERT INTO menu_items (categoryId, name, description, price, sortOrder) VALUES
        (2, 'The OG Parmo', 'Topped with parmesan sauce, red onions and a special cheese mix', 11.95, 1),
        (2, 'Hot Shot Parmo', 'Topped with parmesan sauce, red onions, mixed peppers, jalapenos, crushed chillies and a special cheese mix', 12.95, 2),
        (2, 'Veggie Parmo', 'Topped with parmesan sauce, red onions, mixed peppers, mushrooms, sweetcorn, black olives and a special cheese mix', 12.95, 3),
        (2, 'Tandoori Parmo', 'Topped with parmesan sauce, chicken tikka, red onions, mixed peppers and a special cheese mix', 12.95, 4),
        (2, 'Turkish Delight Parmo', 'Topped with parmesan sauce, onions, donner meat and a special cheese mix', 13.95, 5),
        (2, 'Garlic Mushroom Parmo', 'Topped with parmesan sauce, creamy garlic mushrooms and a special cheese mix', 12.95, 6),
        (2, 'Primo''s Special Parmo', 'Topped with parmesan sauce, chicken tikka, keema, red onions, mixed peppers, jalapenos, chilli flakes and a special cheese mix', 13.95, 7)
      `);
      
      // Seed beef burgers
      await connection.execute(`
        INSERT INTO menu_items (categoryId, name, description, price, sortOrder) VALUES
        (3, 'Classic', '2x beef patties, grilled onions, gherkins, Primo''s sauce, Martins Potato Bun', 8.95, 1),
        (3, 'Cheeseburger', '2x beef patties, American cheese, lettuce, house mayo, Primo''s sauce, Martins Potato Bun', 8.95, 2),
        (3, 'Cosmic', '2x beef patties, American cheese, potato cakes, grilled onions, gherkins, house cheese sauce, Primo''s sauce, Martins Potato Bun', 9.95, 3),
        (3, 'Hot One', '2x beef patties, American cheese, jalapenos, grilled onions, Flamin'' Hot Doritoz, hot honey, chipotle mayo, Martins Potato Bun', 9.95, 4),
        (3, 'Superstar', '2x beef patties, American cheese, cheesy lamb donner, grilled onions, jalapenos, house mayo, chilli sauce, Martins Potato Bun', 10.95, 5),
        (3, 'Ring Leader', '2x beef patties, American cheese, lettuce, crispy onion rings, house cheese sauce, Primo''s sauce, Martins Potato Bun', 9.95, 6),
        (3, 'Big Smoke', '2x beef patties, American cheese, crispy fried onions, tomato, lettuce, hickory BBQ sauce, house mayo, Martins Potato Bun', 9.95, 7),
        (3, 'Blizzard', '2x beef patties, American cheese, premium white cheddar cheese, grilled onions, mixed peppers and jalapenos, Primo''s sauce, Martins Potato Bun', 9.95, 8),
        (3, 'Veggie Burger', 'Breadcrumbed veggie patty, American cheese, lettuce, house mayo, Martins Potato Bun', 9.95, 9)
      `);
      
      // Seed loaded fries
      await connection.execute(`
        INSERT INTO menu_items (categoryId, name, description, price, sortOrder) VALUES
        (4, 'Cheeseburger Fries', 'Crispy fries topped with chopped beef patties, creamy cheese sauce, fresh lettuce, tangy gherkins, and red onions, finished with a drizzle of Primo''s house sauce', 9.95, 1),
        (4, 'Popcorn Fries', 'Crispy popcorn chicken, served on a bed of golden fries, topped with fresh lettuce and finished with a creamy ranch drizzle', 7.95, 2),
        (4, 'Garlic & Parm'' Fries', 'Crispy fries topped with garlic mayo and grated Italian cheese', 7.95, 3),
        (4, '3 Cheese Blend Fries', 'Crispy fries topped with garlic mayo and grated Italian cheese', 7.95, 4)
      `);
      
      // Seed loaded tots
      await connection.execute(`
        INSERT INTO menu_items (categoryId, name, description, price, sortOrder) VALUES
        (5, 'Cheesy Tots', 'Golden tater tots topped with a creamy cheese sauce and finished with a sprinkle of smoky paprika for a flavourful crunch', 6.95, 1),
        (5, 'Hot Tots', 'Golden tater tots topped with a creamy cheese sauce and topped with diced jalapenos, chipotle sauce', 6.95, 2)
      `);
      
      // Seed kebabs
      await connection.execute(`
        INSERT INTO menu_items (categoryId, name, description, price, sortOrder) VALUES
        (6, 'Donner Kebab', 'Served with a soft pitta bread, fresh crunchy salad and homemade chilli and garlic sauce', 8.95, 1),
        (6, 'Chicken Kebab', 'Served with a soft pitta bread, fresh crunchy salad and homemade chilli and garlic sauce', 8.95, 2),
        (6, 'Chicken Tikka Kebab', 'Served with a soft pitta bread, fresh crunchy salad and homemade chilli and garlic sauce', 8.95, 3),
        (6, 'Mixed Kebab', 'Served with a soft pitta bread, fresh crunchy salad and homemade chilli and garlic sauce', 8.95, 4),
        (6, 'Chicken Shawarma Tray', 'Served with a soft pitta bread, fresh crunchy salad and homemade chilli and garlic sauce', 8.95, 5),
        (6, 'Donner Tray', 'Served with a soft pitta bread, fresh crunchy salad and homemade chilli and garlic sauce', 8.95, 6)
      `);
      
      // Seed wraps
      await connection.execute(`
        INSERT INTO menu_items (categoryId, name, description, price, sortOrder) VALUES
        (7, 'Lamb Donner Wrap', 'Fresh wrap with lamb donner', 8.45, 1),
        (7, 'Chicken Shawarma Wrap', 'Fresh wrap with chicken shawarma', 7.95, 2),
        (7, 'Mixed Wrap', 'Fresh wrap with mixed meats', 11.45, 3),
        (7, 'Donner Hoagie Wrap', 'Fresh hoagie wrap with donner', 9.95, 4),
        (7, 'Chicken Hoagie Wrap', 'Fresh hoagie wrap with chicken', 8.95, 5)
      `);
      
      // Seed sides
      await connection.execute(`
        INSERT INTO menu_items (categoryId, name, description, price, sortOrder) VALUES
        (8, 'Mozzarella Sticks', 'Crispy mozzarella sticks', 4.95, 1),
        (8, 'Jalapeno Bites', 'Spicy jalapeno bites', 5.95, 2),
        (8, 'Cheesey Bites', 'Cheesy bites', 4.95, 3),
        (8, 'Mac N Cheese Bites', 'Mac and cheese bites', 5.95, 4),
        (8, 'Halloumi Fries', 'Crispy halloumi fries', 4.95, 5),
        (8, 'Onion Rings', 'Crispy onion rings', 4.95, 6),
        (8, 'Chicken Popcorn', 'Crispy chicken popcorn', 4.95, 7),
        (8, 'Chicken Nuggets', 'Crispy chicken nuggets', 4.95, 8),
        (8, 'Tater Tots', 'Golden tater tots', 3.95, 9),
        (8, 'Waffle Fries', 'Crispy waffle fries', 3.95, 10),
        (8, 'Chips', 'Classic chips', 2.95, 11),
        (8, 'Chips and Cheese', 'Chips with melted cheese', 3.95, 12),
        (8, 'Donner and Chips', 'Donner meat with chips', 6.95, 13),
        (8, '12" Garlic Bread', 'Large garlic bread', 4.95, 14),
        (8, 'Pitta Bread', 'Soft pitta bread', 1.45, 15)
      `);
      
      // Seed dips
      await connection.execute(`
        INSERT INTO menu_items (categoryId, name, description, price, sortOrder) VALUES
        (9, 'Garlic Mayo', 'Creamy garlic mayo', 0.95, 1),
        (9, 'House Mayo', 'House mayo', 0.95, 2),
        (9, 'Ketchup', 'Classic ketchup', 0.95, 3),
        (9, 'Chilli Sauce', 'Spicy chilli sauce', 0.95, 4),
        (9, 'BBQ Sauce', 'Smoky BBQ sauce', 0.95, 5),
        (9, 'Chipotle', 'Chipotle sauce', 0.95, 6),
        (9, 'Salad Dressing', 'Fresh salad dressing', 0.95, 7)
      `);
      
      // Seed milkshakes
      await connection.execute(`
        INSERT INTO menu_items (categoryId, name, description, price, sortOrder) VALUES
        (10, 'Lotus Dream', 'Crushed lotus biscuits, biscoff sauce', 5.95, 1),
        (10, 'Black Magic', 'Oreo, maltesers, white chocolate drops, oreo, strawberry, chocolate sauce', 5.95, 2),
        (10, 'Bueno Vamos', 'Kinder bueno, Terry''s chocolate orange', 5.95, 3),
        (10, 'Forerro Delight', 'Forerro, Rafaello, Nutella', 5.95, 4),
        (10, 'Milky Magic', 'Milky stars, Milky Way, Magic Stars', 5.95, 5),
        (10, 'Aero Mint', 'Refreshing aero mint milkshake', 5.95, 6),
        (10, 'Bubblegum', 'Millions bubblegum milkshake', 5.95, 7),
        (10, 'Oreo', 'A creamy, rich blend of vanilla ice cream and crushed Oreo cookies — smooth, chocolatey, and irresistibly delicious. Topped with whipped cream and Oreo crumbs for the ultimate cookie-lover''s dream!', 5.95, 8),
        (10, 'Nutella', 'A rich and creamy blend of smooth Nutella and ice cream — pure chocolate-hazelnut happiness in every sip!', 5.95, 9),
        (10, 'Bueno', 'A creamy and dreamy blend of rich vanilla ice cream and smooth chocolate, infused with the irresistible taste of Kinder Bueno. Topped with whipped cream, chocolate drizzle and crushed Kinder pieces — pure chocolate heaven in a glass!', 5.95, 10)
      `);
      
      // Seed desserts
      await connection.execute(`
        INSERT INTO menu_items (categoryId, name, description, price, sortOrder) VALUES
        (11, 'Matilda Cake', 'Served warm. Ultra-rich chocolate cake layered with thick fudge frosting. Pure chocolate indulgence', 5.95, 1),
        (11, 'Sticky Toffee Pudding', 'Served warm. Warm, rich sponge pudding served with a smooth, buttery toffee sauce. Soft, moist and deeply caramelised', 5.95, 2),
        (11, 'Biscoff Milkcake', 'Creamy biscoff milkcake', 5.95, 3),
        (11, 'Oreo Milkcake', 'Creamy oreo milkcake', 5.95, 4)
      `);
      
      // Seed waffles
      await connection.execute(`
        INSERT INTO menu_items (categoryId, name, description, price, sortOrder) VALUES
        (12, 'Nutella Waffle', 'Fresh waffle with Nutella', 6.95, 1),
        (12, 'Biscoff Waffle', 'Fresh waffle with biscoff spread', 6.95, 2),
        (12, 'Kinder Bueno Waffle', 'Fresh waffle with Kinder Bueno', 6.95, 3),
        (12, 'Oreo Waffle', 'Fresh waffle with crushed Oreo', 6.95, 4)
      `);
      
      // Seed pizza toppings
      await connection.execute(`
        INSERT INTO pizza_toppings (name, price, sortOrder) VALUES
        ('Mozzarella', 2.00, 1),
        ('Cheddar', 2.00, 2),
        ('Grana Padano', 3.00, 3),
        ('EVOO', 0.00, 4),
        ('Garlic', 1.00, 5),
        ('Red Onions', 1.00, 6),
        ('Mixed Peppers', 1.00, 7),
        ('Tomatoes', 1.00, 8),
        ('Mushrooms', 1.00, 9),
        ('Sweetcorn', 1.00, 10),
        ('Crushed Chilli', 0.00, 11),
        ('Green Chillies', 1.00, 12),
        ('Jalapenos', 1.00, 13),
        ('Black Olives', 1.00, 14),
        ('Pineapple', 1.00, 15),
        ('Chicken Tikka', 2.00, 16),
        ('BBQ Chicken', 2.00, 17),
        ('Plain Chicken', 2.00, 18),
        ('Keema', 3.00, 19)
      `);
      
      console.log("[Migration] Menu data seeded successfully!");
    } else {
      console.log("[Migration] Menu data already exists, skipping seed.");
    }
    
    await connection.end();
    console.log("[Migration] Migrations complete!");
  } catch (error) {
    console.error("[Migration] Error:", error);
  }
}

async function startServer() {
  // Run migrations first
  await runMigrations();
  
  const app = express();
  const server = createServer(app);

  // Stripe webhook needs raw body for signature verification — must be before json middleware
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }));

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Mount Stripe routes
  app.use("/api/stripe", stripeRouter);

  // SSE endpoint for kitchen real-time updates
  app.get("/api/kitchen/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();

    const listener: OrderListener = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    orderListeners.add(listener);

    req.on("close", () => {
      orderListeners.delete(listener);
    });
  });

  // Manual migration trigger endpoint
  app.get("/api/run-migration", async (_req, res) => {
    try {
      await runMigrations();
      res.json({ success: true, message: "Migrations completed successfully" });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Delivery fee calculation endpoint
  app.post("/api/delivery/calculate", async (req, res) => {
    try {
      const { address } = req.body;
      if (!address || typeof address !== "string" || address.trim().length < 3) {
        return res.status(400).json({ error: "Please provide a valid address" });
      }

      // Geocode the address using Nominatim
      const query = encodeURIComponent(address.trim());
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=gb`;
      const geoRes = await fetch(nominatimUrl, {
        headers: { "User-Agent": "PrimosOrdering/1.0" },
      });
      const geoData = await geoRes.json();

      if (!geoData || geoData.length === 0) {
        return res.status(404).json({ error: "Could not find that address. Please enter a more specific address." });
      }

      const customerLat = parseFloat(geoData[0].lat);
      const customerLon = parseFloat(geoData[0].lon);

      // Restaurant coordinates: 6 Groathill Road North, Edinburgh EH4 2SW
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
      const distanceMiles = 3959 * c; // Earth radius in miles

      // Get delivery settings from DB
      const { getDeliverySettings } = await import("./db");
      const settings = await getDeliverySettings();
      const maxRadius = settings ? parseFloat(settings.maxRadiusMiles) : 3.0;
      const freeThreshold = settings ? parseFloat(settings.freeDeliveryThreshold) : 30.0;
      const tiers: Array<{ maxMiles: number; fee: number }> = settings?.tiers
        ? (typeof settings.tiers === "string" ? JSON.parse(settings.tiers) : settings.tiers)
        : [{ maxMiles: 2, fee: 2.5 }, { maxMiles: 3, fee: 3.5 }];

      // Check if within radius
      if (distanceMiles > maxRadius) {
        return res.json({
          distance: Math.round(distanceMiles * 10) / 10,
          fee: 0,
          withinRadius: false,
          freeDeliveryThreshold: freeThreshold,
        });
      }

      // Calculate fee based on tiers (sorted ascending by maxMiles)
      const sortedTiers = [...tiers].sort((a, b) => a.maxMiles - b.maxMiles);
      let fee = sortedTiers.length > 0 ? sortedTiers[sortedTiers.length - 1].fee : 0;
      for (const tier of sortedTiers) {
        if (distanceMiles <= tier.maxMiles) {
          fee = tier.fee;
          break;
        }
      }

      return res.json({
        distance: Math.round(distanceMiles * 10) / 10,
        fee,
        withinRadius: true,
        freeDeliveryThreshold: freeThreshold,
      });
    } catch (error: any) {
      console.error("[Delivery Calculate] Error:", error);
      return res.status(500).json({ error: "Failed to calculate delivery fee" });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext: ({ req, res }) => ({ req, res, user: null }),
    })
  );

  // Explicit 404 for unmatched /api/* routes — prevents the SPA catch-all from swallowing them
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API route not found" });
  });

  // Serve static files in production
  const distPath = path.resolve(import.meta.dirname, "public");
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.use("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  } else {
    // Fallback for development
    const devDistPath = path.resolve(import.meta.dirname, "..", "dist", "public");
    if (fs.existsSync(devDistPath)) {
      app.use(express.static(devDistPath));
      app.use("*", (_req, res) => {
        res.sendFile(path.resolve(devDistPath, "index.html"));
      });
    }
  }

  const port = parseInt(process.env.PORT || "3000");
  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);

    // Auto-rejection timer: check every 60 seconds for stale authorized orders (>15 min old)
    setInterval(async () => {
      try {
        const { getStaleAuthorizedOrders, updateOrderPaymentStatus, updateOrderStatus } = await import("./db");
        const { cancelPayment } = await import("./stripe");
        const { sendOrderRejectionEmail } = await import("./email");

        const staleOrders = await getStaleAuthorizedOrders(15);
        for (const order of staleOrders) {
          console.log(`[Auto-Reject] Order ${order.orderNumber} expired (>15 min with no action)`);

          // Cancel the payment hold
          if (order.stripePaymentIntentId) {
            const result = await cancelPayment(order.stripePaymentIntentId);
            if (result.success) {
              console.log(`[Auto-Reject] Payment hold released for ${order.orderNumber}`);
            } else {
              console.error(`[Auto-Reject] Failed to cancel payment for ${order.orderNumber}: ${result.error}`);
            }
          }

          // Update order status to rejected and payment status to cancelled
          await updateOrderStatus(order.id, "rejected");
          await updateOrderPaymentStatus(order.id, "cancelled");

          // Send rejection email to customer
          if (order.customerEmail) {
            sendOrderRejectionEmail({
              orderNumber: order.orderNumber,
              customerName: order.customerName,
              customerEmail: order.customerEmail,
            }).catch(err => console.error("[Auto-Reject] Email failed:", err));
          }

          // Notify kitchen dashboard that order was auto-rejected
          notifyNewOrder({ ...order, status: "rejected", paymentStatus: "cancelled" });
        }

        if (staleOrders.length > 0) {
          console.log(`[Auto-Reject] Processed ${staleOrders.length} expired order(s)`);
        }
      } catch (err) {
        console.error("[Auto-Reject] Timer error:", err);
      }
    }, 60 * 1000); // Run every 60 seconds
  });
}

startServer().catch(console.error);
