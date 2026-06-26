import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Lock, ChefHat, Clock, Truck, Store, Volume2, VolumeX, Star, Check, X, Plus, Trash2, Edit2, Tag, UtensilsCrossed, MessageSquare, Sparkles, Send, Timer } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

/** Safely convert ANY value to a renderable string. Prevents React error #310. */
function s(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function Kitchen() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [debugSection, setDebugSection] = useState(0);

  const loginMutation = trpc.kitchen.login.useMutation();
  const { data: orders, isError: ordersError, isLoading: ordersLoading } = trpc.orders.list.useQuery(undefined, {
    enabled: authenticated,
    refetchInterval: 5000,
    retry: 3,
  });

  const { data: pendingReviews } = trpc.reviews.listPending.useQuery(undefined, {
    enabled: authenticated,
    refetchInterval: 30000,
  });

  const { data: approvedReviews } = trpc.reviews.listAllApproved.useQuery(undefined, {
    enabled: authenticated,
    refetchInterval: 30000,
  });

  const { data: menuCategories } = trpc.menu.getCategories.useQuery(undefined, {
    enabled: authenticated,
  });

  const { data: allMenuItems } = trpc.menu.getAllItems.useQuery(undefined, {
    enabled: authenticated,
  });

  const { data: offersList } = trpc.offers.list.useQuery(undefined, {
    enabled: authenticated,
  });

  const { data: deliverySettingsData } = trpc.delivery.getSettings.useQuery(undefined, {
    enabled: authenticated,
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await loginMutation.mutateAsync({ password });
      if (result.success) {
        setAuthenticated(true);
        setError("");
      } else {
        setError("Incorrect password");
      }
    } catch (err: any) {
      setError(typeof err?.message === "string" ? err.message : "Login failed");
    }
  };

  if (!authenticated) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h1>Kitchen Dashboard - Login</h1>
        <form onSubmit={handleLogin}>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter kitchen password"
            style={{ padding: "8px", marginRight: "8px" }}
          />
          <button type="submit" style={{ padding: "8px 16px" }}>Login</button>
        </form>
        {error && <p style={{ color: "red" }}>{s(error)}</p>}
      </div>
    );
  }

  // Process orders
  const allOrders = Array.isArray(orders) ? orders : [];
  const pendingAcceptanceOrders = allOrders.filter(o => o.status === "pending_acceptance");
  const activeOrders = allOrders.filter(o => ["new", "preparing", "ready"].includes(o.status));
  const completedOrders = allOrders.filter(o => ["delivered", "collected", "rejected"].includes(o.status));

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Kitchen Debug Mode</h1>
      <p>Current section level: {debugSection}</p>
      <button onClick={() => setDebugSection(prev => prev + 1)} style={{ padding: "8px 16px", marginRight: "8px", background: "green", color: "white" }}>
        Add Next Section
      </button>
      <button onClick={() => setDebugSection(0)} style={{ padding: "8px 16px", background: "red", color: "white" }}>
        Reset
      </button>
      <hr style={{ margin: "20px 0" }} />

      {/* Section 0: Just data counts */}
      <div style={{ background: "#f0f0f0", padding: "10px", marginBottom: "10px" }}>
        <strong>Section 0 - Data Counts:</strong>
        <span> Orders: {s(allOrders.length)}</span>
        <span> | Pending: {s(pendingAcceptanceOrders.length)}</span>
        <span> | Active: {s(activeOrders.length)}</span>
        <span> | Completed: {s(completedOrders.length)}</span>
        <span> | Reviews: {s(pendingReviews?.length)}</span>
        <span> | Menu: {s(allMenuItems?.length)}</span>
        <span> | Offers: {s(offersList?.length)}</span>
      </div>

      {/* Section 1: Render order fields as text */}
      {debugSection >= 1 && (
        <div style={{ background: "#e8f5e9", padding: "10px", marginBottom: "10px" }}>
          <strong>Section 1 - Order Fields (text only):</strong>
          {allOrders.map((order, i) => (
            <div key={i} style={{ border: "1px solid #ccc", padding: "5px", margin: "5px 0" }}>
              <span>#{s(order.orderNumber)} | </span>
              <span>Status: {s(order.status)} | </span>
              <span>Name: {s(order.customerName)} | </span>
              <span>Phone: {s(order.customerPhone)} | </span>
              <span>Type: {s(order.orderType)} | </span>
              <span>Total: £{Number(order.total || 0).toFixed(2)} | </span>
              <span>Created: {s(order.createdAt)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Section 2: Render order items */}
      {debugSection >= 2 && (
        <div style={{ background: "#e3f2fd", padding: "10px", marginBottom: "10px" }}>
          <strong>Section 2 - Order Items:</strong>
          {allOrders.map((order, i) => {
            const items = Array.isArray(order.items) ? order.items : [];
            return (
              <div key={i} style={{ border: "1px solid #ccc", padding: "5px", margin: "5px 0" }}>
                <span>#{s(order.orderNumber)} items: </span>
                {items.map((item: any, j: number) => (
                  <span key={j}>[{s(item.quantity)}x {s(item.name)} £{Number(item.totalPrice || 0).toFixed(2)}] </span>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Section 3: Render with Badge component */}
      {debugSection >= 3 && (
        <div style={{ background: "#fff3e0", padding: "10px", marginBottom: "10px" }}>
          <strong>Section 3 - Badge Component Test:</strong>
          <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginTop: "5px" }}>
            <Badge>Test Badge</Badge>
            <Badge variant="outline">Outline Badge</Badge>
            <Badge className="bg-red-500 text-white">Red Badge</Badge>
            {allOrders.map((order, i) => (
              <Badge key={i} variant="outline">{s(order.status)}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Section 4: Render with Button component */}
      {debugSection >= 4 && (
        <div style={{ background: "#fce4ec", padding: "10px", marginBottom: "10px" }}>
          <strong>Section 4 - Button Component Test:</strong>
          <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginTop: "5px" }}>
            <Button size="sm">Test Button</Button>
            <Button size="sm" variant="outline">Outline</Button>
            <Button size="sm" className="bg-green-600 text-white">
              <Check className="w-4 h-4 mr-1" /> Accept
            </Button>
          </div>
        </div>
      )}

      {/* Section 5: Full order card with all components */}
      {debugSection >= 5 && (
        <div style={{ background: "#f3e5f5", padding: "10px", marginBottom: "10px" }}>
          <strong>Section 5 - Full Order Card:</strong>
          {allOrders.slice(0, 1).map((order, i) => {
            const items = Array.isArray(order.items) ? (order.items as any[]) : [];
            return (
              <div key={i} style={{ border: "2px solid #9c27b0", padding: "10px", margin: "5px 0", borderRadius: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "monospace", fontWeight: "bold" }}>{s(order.orderNumber)}</span>
                  <Badge className="bg-blue-100 text-blue-800 border border-blue-200">
                    {s(order.status)}
                  </Badge>
                </div>
                <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                  <Clock className="w-3 h-3" style={{ display: "inline" }} />
                  <span> {s(new Date(order.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }))} | </span>
                  {order.orderType === "delivery" ? (
                    <span><Truck className="w-3 h-3" style={{ display: "inline" }} /> Delivery</span>
                  ) : (
                    <span><Store className="w-3 h-3" style={{ display: "inline" }} /> Collection</span>
                  )}
                </div>
                <div style={{ marginTop: "8px" }}>
                  {items.map((item: any, j: number) => (
                    <div key={j} style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                      <span>{s(item.quantity)}x {s(item.name)}</span>
                      <span>£{(Number(item.totalPrice || 0) * Number(item.quantity || 0)).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>
                  <p><strong>Name:</strong> {s(order.customerName)}</p>
                  <p><strong>Phone:</strong> {s(order.customerPhone)}</p>
                  {order.deliveryAddress && <p><strong>Address:</strong> {s(order.deliveryAddress)}</p>}
                  {order.notes && <p><strong>Notes:</strong> {s(order.notes)}</p>}
                </div>
                <div style={{ marginTop: "8px", fontWeight: "bold" }}>
                  Total: £{Number(order.total || 0).toFixed(2)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Section 6: Reviews rendering */}
      {debugSection >= 6 && (
        <div style={{ background: "#e8eaf6", padding: "10px", marginBottom: "10px" }}>
          <strong>Section 6 - Reviews:</strong>
          <p>Pending: {s(pendingReviews?.length || 0)}</p>
          <p>Approved: {s(approvedReviews?.length || 0)}</p>
          {approvedReviews?.map((review: any, i: number) => (
            <div key={i} style={{ border: "1px solid #ccc", padding: "5px", margin: "5px 0" }}>
              <span>Rating: {s(review.rating)} | </span>
              <span>Comment: {s(review.comment)} | </span>
              <span>By: {s(review.customerName)} | </span>
              <span>Reply: {s(review.reply)} | </span>
              <span>Date: {s(review.createdAt)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Section 7: Menu items */}
      {debugSection >= 7 && (
        <div style={{ background: "#e0f7fa", padding: "10px", marginBottom: "10px" }}>
          <strong>Section 7 - Menu:</strong>
          <p>Categories: {s(menuCategories?.length || 0)}</p>
          {menuCategories?.map((cat: any, i: number) => {
            const catItems = allMenuItems?.filter((item: any) => item.categoryId === cat.id) || [];
            return (
              <div key={i} style={{ margin: "5px 0" }}>
                <strong>{s(cat.name)} ({catItems.length} items)</strong>
                {catItems.slice(0, 3).map((item: any, j: number) => (
                  <span key={j}> | {s(item.name)} £{Number(item.price || 0).toFixed(2)}</span>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Section 8: Offers */}
      {debugSection >= 8 && (
        <div style={{ background: "#fff8e1", padding: "10px", marginBottom: "10px" }}>
          <strong>Section 8 - Offers:</strong>
          {offersList?.map((offer: any, i: number) => (
            <div key={i}>
              <span>{s(offer.name)} - {s(offer.discountPercent)}% OFF - Active: {s(offer.active)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
