export interface CartItem {
  id: string; // unique cart item id
  menuItemId: number;
  name: string;
  basePrice: number;
  quantity: number;
  toppings?: { id: number; name: string; price: number }[];
  mealDeal?: "chips_drink" | "chips_milkshake" | null;
  mealDealPrice?: number;
  totalPrice: number; // per-item total including toppings/meal deal
}

export interface OrderItem {
  menuItemId: number;
  name: string;
  basePrice: number;
  quantity: number;
  toppings?: { name: string; price: number }[];
  mealDeal?: string | null;
  mealDealPrice?: number;
  totalPrice: number;
}

export interface OrderData {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  orderType: "delivery" | "collection";
  deliveryAddress?: string;
  deliveryFee: number;
  subtotal: number;
  total: number;
  items: OrderItem[];
  notes?: string;
}
