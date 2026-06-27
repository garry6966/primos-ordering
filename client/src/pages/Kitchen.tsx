import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Lock, ChefHat, Clock, Truck, Store, Volume2, VolumeX, Star, Check, X, Plus, Trash2, Edit2, Tag, UtensilsCrossed, MessageSquare, Sparkles, Send, Timer, Printer } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

/** Format daily number as #001, #002, etc. Falls back to order number if no daily number */
function formatDailyNumber(order: any): string {
  if (order.dailyNumber != null) {
    return `#${String(order.dailyNumber).padStart(3, "0")}`;
  }
  return order.orderNumber;
}

/** Print a receipt for an order using a hidden iframe */
function printReceipt(order: any) {
  const orderItems = Array.isArray(order.items) ? (order.items as any[]) : [];
  const dailyNum = formatDailyNumber(order);
  const orderTime = new Date(typeof order.createdAt === "object" ? String(order.createdAt) : order.createdAt)
    .toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const orderDate = new Date(typeof order.createdAt === "object" ? String(order.createdAt) : order.createdAt)
    .toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Order ${dailyNum}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Courier New', monospace;
          width: 80mm;
          padding: 4mm;
          font-size: 12px;
          line-height: 1.4;
        }
        .order-number {
          text-align: center;
          font-size: 32px;
          font-weight: bold;
          padding: 8px 0;
          border-bottom: 2px dashed #000;
          margin-bottom: 8px;
        }
        .order-type {
          text-align: center;
          font-size: 16px;
          font-weight: bold;
          text-transform: uppercase;
          padding: 4px 0;
          margin-bottom: 8px;
        }
        .section {
          border-bottom: 1px dashed #000;
          padding: 6px 0;
          margin-bottom: 6px;
        }
        .item-row {
          display: flex;
          justify-content: space-between;
          padding: 2px 0;
        }
        .item-name { font-weight: bold; }
        .item-extras { padding-left: 12px; font-size: 11px; color: #333; }
        .total-row {
          display: flex;
          justify-content: space-between;
          font-size: 16px;
          font-weight: bold;
          padding: 8px 0;
          border-top: 2px dashed #000;
          margin-top: 8px;
        }
        .info-label { font-weight: bold; }
        .notes {
          background: #f0f0f0;
          padding: 6px;
          margin-top: 6px;
          border: 1px solid #ccc;
          font-weight: bold;
        }
        .time-info { text-align: center; font-size: 11px; color: #555; margin-top: 8px; }
        @media print {
          body { width: 80mm; }
          @page { size: 80mm auto; margin: 0; }
        }
      </style>
    </head>
    <body>
      <div class="order-number">${dailyNum}</div>
      <div class="order-type">${order.orderType === "delivery" ? "🚗 DELIVERY" : "🏪 COLLECTION"}</div>

      <div class="section">
        <div><span class="info-label">Customer:</span> ${order.customerName}</div>
        <div><span class="info-label">Phone:</span> ${order.customerPhone}</div>
        ${order.deliveryAddress ? `<div><span class="info-label">Address:</span> ${order.deliveryAddress}</div>` : ""}
      </div>

      <div class="section">
        ${orderItems.map((item: any) => `
          <div class="item-row">
            <span class="item-name">${item.quantity}x ${item.name}</span>
            <span>£${(Number(item.totalPrice || 0) * Number(item.quantity || 1)).toFixed(2)}</span>
          </div>
          ${Array.isArray(item.toppings) && item.toppings.length > 0 ? `<div class="item-extras">+ ${item.toppings.map((t: any) => typeof t === "string" ? t : t?.name || "").filter(Boolean).join(", ")}</div>` : ""}
          ${item.mealDeal && typeof item.mealDeal === "string" ? `<div class="item-extras">${item.mealDeal === "chips_drink" ? "Meal Deal (Chips + Drink)" : "Meal Deal (Chips + Shake)"}</div>` : ""}
        `).join("")}
      </div>

      ${order.notes ? `<div class="notes">⚠️ NOTES: ${order.notes}</div>` : ""}

      <div class="total-row">
        <span>TOTAL</span>
        <span>£${Number(order.total || 0).toFixed(2)}</span>
      </div>

      <div class="time-info">
        Ordered: ${orderTime} — ${orderDate}
      </div>
    </body>
    </html>
  `;

  // Use a hidden iframe to print
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.top = "-10000px";
  iframe.style.left = "-10000px";
  iframe.style.width = "80mm";
  iframe.style.height = "0";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (iframeDoc) {
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();
    // Wait for content to render, then print
    setTimeout(() => {
      iframe.contentWindow?.print();
      // Clean up after printing
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 250);
  }
}

const STATUS_FLOW = ["pending_acceptance", "new", "preparing", "ready", "delivered", "collected"] as const;
type OrderStatus = (typeof STATUS_FLOW)[number] | "rejected";

const AUTO_REJECT_MINUTES = 15;

function CountdownTimer({ createdAt }: { createdAt: Date | string }) {
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    const created = new Date(createdAt).getTime();
    const deadline = created + AUTO_REJECT_MINUTES * 60 * 1000;
    return Math.max(0, Math.floor((deadline - Date.now()) / 1000));
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const created = new Date(createdAt).getTime();
      const deadline = created + AUTO_REJECT_MINUTES * 60 * 1000;
      const remaining = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  if (timeLeft <= 0) {
    return (
      <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-red-600">
        <Timer className="w-3 h-3" />
        <span>Auto-rejected</span>
      </div>
    );
  }

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isUrgent = timeLeft < 120;

  return (
    <div className={`mt-1 flex items-center gap-1 text-xs font-semibold ${isUrgent ? "text-red-600 animate-pulse" : "text-orange-600"}`}>
      <Timer className="w-3 h-3" />
      <span>Auto-reject in {minutes}:{seconds.toString().padStart(2, "0")}</span>
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  pending_acceptance: "Awaiting Acceptance",
  new: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  delivered: "Delivered",
  collected: "Collected",
  rejected: "Rejected",
};

const STATUS_COLORS: Record<string, string> = {
  pending_acceptance: "bg-orange-100 text-orange-800 border-orange-200",
  new: "bg-blue-100 text-blue-800 border-blue-200",
  preparing: "bg-yellow-100 text-yellow-800 border-yellow-200",
  ready: "bg-green-100 text-green-800 border-green-200",
  delivered: "bg-gray-100 text-gray-800 border-gray-200",
  collected: "bg-gray-100 text-gray-800 border-gray-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
};

function getNextStatus(current: string, orderType: string): string | null {
  if (current === "new") return "preparing";
  if (current === "preparing") return "ready";
  if (current === "ready") return orderType === "delivery" ? "delivered" : "collected";
  return null;
}

export default function Kitchen() {
  // === ALL HOOKS MUST BE BEFORE ANY EARLY RETURN ===
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const alertIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevOrderCountRef = useRef(0);

  const [activeTab, setActiveTab] = useState<"orders" | "reviews" | "menu" | "offers" | "delivery">("orders");

  // Delivery settings state
  const [deliveryMaxRadius, setDeliveryMaxRadius] = useState("");
  const [deliveryFreeThreshold, setDeliveryFreeThreshold] = useState("");
  const [deliveryTiers, setDeliveryTiers] = useState<Array<{ maxMiles: number; fee: number }>>([]);
  const [newTierMiles, setNewTierMiles] = useState("");
  const [newTierFee, setNewTierFee] = useState("");
  const [deliverySettingsLoaded, setDeliverySettingsLoaded] = useState(false);

  // Menu management state
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemCategory, setNewItemCategory] = useState<number>(0);
  const [newItemImage, setNewItemImage] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatSlug, setNewCatSlug] = useState("");

  // Offers state
  const [newOfferName, setNewOfferName] = useState("");
  const [newOfferPercent, setNewOfferPercent] = useState("");

  const loginMutation = trpc.kitchen.login.useMutation();
  const { data: orders, refetch, isError: ordersError, isLoading: ordersLoading } = trpc.orders.list.useQuery(undefined, {
    enabled: authenticated,
    refetchInterval: 5000,
    retry: 3,
  });
  const updateStatus = trpc.orders.updateStatus.useMutation();

  const { data: pendingReviews, refetch: refetchReviews } = trpc.reviews.listPending.useQuery(undefined, {
    enabled: authenticated,
    refetchInterval: 30000,
  });
  const { data: approvedReviews, refetch: refetchApproved } = trpc.reviews.listAllApproved.useQuery(undefined, {
    enabled: authenticated,
    refetchInterval: 30000,
  });
  const moderateReview = trpc.reviews.moderate.useMutation();
  const replyToReviewMutation = trpc.reviews.replyToReview.useMutation();
  const generateReplyMutation = trpc.reviews.generateReviewReply.useMutation();

  // Review reply state
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(() => {
    return localStorage.getItem("primos_auto_reply") === "true";
  });
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");

  // Menu management queries
  const { data: menuCategories, refetch: refetchCategories } = trpc.menu.getCategories.useQuery(undefined, {
    enabled: authenticated,
  });
  const { data: allMenuItems, refetch: refetchMenuItems } = trpc.menu.getAllItems.useQuery(undefined, {
    enabled: authenticated,
  });
  const createItemMutation = trpc.menu.createItem.useMutation();
  const updateItemMutation = trpc.menu.updateItem.useMutation();
  const deleteItemMutation = trpc.menu.deleteItem.useMutation();
  const createCategoryMutation = trpc.menu.createCategory.useMutation();
  const deleteCategoryMutation = trpc.menu.deleteCategory.useMutation();

  // Offers queries
  const { data: offersList, refetch: refetchOffers } = trpc.offers.list.useQuery(undefined, {
    enabled: authenticated,
  });
  const createOfferMutation = trpc.offers.create.useMutation();
  const toggleOfferMutation = trpc.offers.toggle.useMutation();
  const deleteOfferMutation = trpc.offers.delete.useMutation();

  // Delivery settings queries
  const { data: deliverySettingsData, refetch: refetchDeliverySettings } = trpc.delivery.getSettings.useQuery(undefined, {
    enabled: authenticated,
  });
  const updateDeliverySettingsMutation = trpc.delivery.updateSettings.useMutation();

  // === Continuous alert sound for pending orders ===
  const playAlertBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      // Loud double beep
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.frequency.value = 880;
      osc1.type = "square";
      gain1.gain.value = 0.5;
      osc1.start(ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc1.stop(ctx.currentTime + 0.15);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 1100;
      osc2.type = "square";
      gain2.gain.value = 0.5;
      osc2.start(ctx.currentTime + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc2.stop(ctx.currentTime + 0.35);

      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.frequency.value = 880;
      osc3.type = "square";
      gain3.gain.value = 0.5;
      osc3.start(ctx.currentTime + 0.4);
      gain3.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.55);
      osc3.stop(ctx.currentTime + 0.55);
    } catch (e) {
      // Audio not available
    }
  }, [soundEnabled]);

  const stopAlert = useCallback(() => {
    if (alertIntervalRef.current) {
      clearInterval(alertIntervalRef.current);
      alertIntervalRef.current = null;
    }
  }, []);

  // Effect to manage alert sound based on order count
  useEffect(() => {
    if (!orders || !authenticated) {
      stopAlert();
      return;
    }

    const pendingAcceptanceCount = orders.filter(o => o.status === "pending_acceptance").length;

    if (pendingAcceptanceCount > 0) {
      if (!alertIntervalRef.current) {
        playAlertBeep();
        alertIntervalRef.current = setInterval(playAlertBeep, 2000);
      }
    } else {
      stopAlert();
    }

    // Play a one-off sound if new "new" orders arrive
    const currentNewCount = orders.filter(o => o.status === "new").length;
    if (currentNewCount > prevOrderCountRef.current) {
      playAlertBeep();
    }
    prevOrderCountRef.current = currentNewCount;

    return () => stopAlert();
  }, [orders, authenticated, playAlertBeep, stopAlert]);

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await loginMutation.mutateAsync({ password });
    if (result.success) {
      setAuthenticated(true);
      setError("");
    } else {
      setError("Invalid password");
    }
  };

  const handleUpdateStatus = async (orderId: number, status: OrderStatus) => {
    try {
      await updateStatus.mutateAsync({ id: orderId, status });
      refetch();
    } catch (err) {
      console.error("Update status failed:", err);
    }
  };

  const handleAcceptOrder = async (orderId: number) => {
    try {
      await updateStatus.mutateAsync({ id: orderId, status: "new" });
      refetch();
    } catch (err) {
      console.error("Accept order failed:", err);
    }
  };

  const handleRejectOrder = async (orderId: number) => {
    try {
      await updateStatus.mutateAsync({ id: orderId, status: "rejected" });
      refetch();
    } catch (err) {
      console.error("Reject order failed:", err);
    }
  };

  // Load delivery settings into local state when data arrives
  useEffect(() => {
    if (deliverySettingsData && !deliverySettingsLoaded) {
      setDeliveryMaxRadius(String(deliverySettingsData.maxRadiusMiles || ""));
      setDeliveryFreeThreshold(String(deliverySettingsData.freeDeliveryThreshold || ""));
      setDeliveryTiers(
        typeof deliverySettingsData.tiers === "string"
          ? JSON.parse(deliverySettingsData.tiers)
          : deliverySettingsData.tiers || []
      );
      setDeliverySettingsLoaded(true);
    }
  }, [deliverySettingsData, deliverySettingsLoaded]);

  const handleAddTier = () => {
    if (!newTierMiles || !newTierFee) return;
    const miles = parseFloat(newTierMiles);
    const fee = parseFloat(newTierFee);
    const updated = [...deliveryTiers, { maxMiles: miles, fee }].sort((a, b) => a.maxMiles - b.maxMiles);
    setDeliveryTiers(updated);
    setNewTierMiles("");
    setNewTierFee("");
  };

  const handleRemoveTier = (index: number) => {
    setDeliveryTiers(deliveryTiers.filter((_, i) => i !== index));
  };

  const handleSaveDeliverySettings = async () => {
    try {
      await updateDeliverySettingsMutation.mutateAsync({
        maxRadiusMiles: deliveryMaxRadius,
        freeDeliveryThreshold: deliveryFreeThreshold,
        tiers: deliveryTiers,
      });
      refetchDeliverySettings();
    } catch (err) {
      console.error("Save delivery settings failed:", err);
    }
  };

  const handleEditItem = (item: any) => {
    setEditingItem(item.id);
    setEditName(item.name);
    setEditDesc(item.description || "");
    setEditPrice(item.price);
  };

  const handleSaveItem = async (id: number) => {
    try {
      await updateItemMutation.mutateAsync({
        id,
        name: editName,
        description: editDesc,
        price: editPrice,
      });
      setEditingItem(null);
      refetchMenuItems();
    } catch (err) {
      console.error("Save item failed:", err);
    }
  };

  const handleToggleAvailable = async (id: number, current: boolean) => {
    try {
      await updateItemMutation.mutateAsync({ id, available: !current });
      refetchMenuItems();
    } catch (err) {
      console.error("Toggle availability failed:", err);
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    try {
      await deleteItemMutation.mutateAsync({ id });
      refetchMenuItems();
    } catch (err) {
      console.error("Delete item failed:", err);
    }
  };

  const handleAddItem = async () => {
    try {
      await createItemMutation.mutateAsync({
        categoryId: newItemCategory,
        name: newItemName,
        description: newItemDesc,
        price: newItemPrice,
        imageUrl: newItemImage,
      });
      setShowAddItem(false);
      setNewItemName("");
      setNewItemDesc("");
      setNewItemPrice("");
      setNewItemImage("");
      refetchMenuItems();
    } catch (err) {
      console.error("Add item failed:", err);
    }
  };

  const handleAddCategory = async () => {
    try {
      await createCategoryMutation.mutateAsync({
        name: newCatName,
        slug: newCatSlug,
      });
      setShowAddCategory(false);
      setNewCatName("");
      setNewCatSlug("");
      refetchCategories();
    } catch (err) {
      console.error("Add category failed:", err);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm("Are you sure? This will not delete items in the category, but they will be unassigned.")) return;
    try {
      await deleteCategoryMutation.mutateAsync({ id });
      refetchCategories();
    } catch (err) {
      console.error("Delete category failed:", err);
    }
  };

  const handleCreateOffer = async () => {
    try {
      await createOfferMutation.mutateAsync({
        name: newOfferName,
        discountPercent: parseInt(newOfferPercent),
      });
      setNewOfferName("");
      setNewOfferPercent("");
      refetchOffers();
    } catch (err) {
      console.error("Create offer failed:", err);
    }
  };

  const handleToggleOffer = async (id: number, active: boolean) => {
    try {
      await toggleOfferMutation.mutateAsync({ id, active });
      refetchOffers();
    } catch (err) {
      console.error("Toggle offer failed:", err);
    }
  };

  const handleDeleteOffer = async (id: number) => {
    if (!confirm("Delete this offer?")) return;
    try {
      await deleteOfferMutation.mutateAsync({ id });
      refetchOffers();
    } catch (err) {
      console.error("Delete offer failed:", err);
    }
  };

  const handleModerateReview = async (id: number, status: "approved" | "rejected") => {
    try {
      await moderateReview.mutateAsync({ id, status });
      refetchReviews();
      refetchApproved();
    } catch (err) {
      console.error("Moderate review failed:", err);
    }
  };

  const handleReplyToReview = async (reviewId: number) => {
    if (!replyText.trim()) return;
    try {
      await replyToReviewMutation.mutateAsync({ reviewId, reply: replyText });
      setReplyingTo(null);
      setReplyText("");
      refetchApproved();
    } catch (err) {
      console.error("Reply failed:", err);
    }
  };

  const handleGenerateReply = async (review: any) => {
    try {
      const { reply } = await generateReplyMutation.mutateAsync({
        reviewText: review.comment,
        customerName: review.customerName,
        starRating: review.rating,
      });
      setReplyText(reply);
    } catch (err) {
      console.error("Generate reply failed:", err);
    }
  };

  const toggleAutoReply = (enabled: boolean) => {
    setAutoReplyEnabled(enabled);
    localStorage.setItem("primos_auto_reply", String(enabled));
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border-t-4 border-[#E31837]">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-[#E31837] rounded-2xl flex items-center justify-center rotate-3 shadow-lg">
              <Lock className="text-white w-8 h-8" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-center mb-2 italic">PRIMO'S KITCHEN</h1>
          <p className="text-gray-500 text-center mb-8">Enter password to access dashboard</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 text-lg text-center"
              autoFocus
            />
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <Button type="submit" className="w-full h-12 bg-[#E31837] hover:bg-[#c01530] text-white font-bold text-lg shadow-md">
              Login
            </Button>
          </form>
        </div>
      </div>
    );
  }

  const pendingAcceptanceOrders = orders?.filter(o => o.status === "pending_acceptance") || [];
  const activeOrders = orders?.filter(o => ["new", "preparing", "ready"].includes(o.status)) || [];
  const completedOrders = orders?.filter(o => ["delivered", "collected", "rejected"].includes(o.status)).reverse() || [];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="container px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#E31837] rounded-lg flex items-center justify-center -rotate-3">
              <ChefHat className="text-white w-6 h-6" />
            </div>
            <h1 className="font-black italic text-xl hidden sm:block">PRIMO'S KITCHEN</h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-full transition-colors ${soundEnabled ? "text-green-600 bg-green-50" : "text-gray-400 bg-gray-100"}`}
              title={soundEnabled ? "Sound enabled" : "Sound muted"}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            <div className="h-8 w-[1px] bg-gray-200 hidden sm:block"></div>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              {(["orders", "reviews", "menu", "offers", "delivery"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                    activeTab === tab ? "bg-white text-[#E31837] shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="container px-4 py-6">
        {activeTab === "orders" && (
          <div className="space-y-8">
            {/* 1. Pending Acceptance Section (The "Waiting" Queue) */}
            {pendingAcceptanceOrders.length > 0 && (
              <>
                <h2 className="font-bold text-lg mb-4 text-orange-700 flex items-center gap-2">
                  <span className="inline-block w-3 h-3 bg-orange-500 rounded-full animate-pulse"></span>
                  New Orders — Accept or Reject ({pendingAcceptanceOrders.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  {pendingAcceptanceOrders.map(order => {
                    const orderItems = Array.isArray(order.items) ? (order.items as any[]) : [];
                    return (
                      <div key={order.id} className="bg-white rounded-xl shadow-md overflow-hidden border-2 border-orange-300 animate-pulse-border">
                        {/* Order Header */}
                        <div className="p-4 border-b border-orange-100 bg-orange-50">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono font-bold text-lg text-[#E31837]">{formatDailyNumber(order)}</span>
                            <Badge className={`${STATUS_COLORS["pending_acceptance"]} border`}>
                              NEW ORDER
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(typeof order.createdAt === "object" ? String(order.createdAt) : order.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                            <span className="mx-1">|</span>
                            {order.orderType === "delivery" ? (
                              <span className="flex items-center gap-1"><Truck className="w-3 h-3" /> Delivery</span>
                            ) : (
                              <span className="flex items-center gap-1"><Store className="w-3 h-3" /> Collection</span>
                            )}
                          </div>
                          {/* Auto-rejection countdown */}
                          <CountdownTimer createdAt={typeof order.createdAt === "object" ? (order.createdAt as any).toISOString?.() || String(order.createdAt) : String(order.createdAt)} />
                        </div>

                        {/* Order Items */}
                        <div className="p-4 space-y-1.5">
                          {orderItems.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <div>
                                <span className="font-medium">{item.quantity}x {item.name}</span>
                                {Array.isArray(item.toppings) && item.toppings.length > 0 && (
                                  <p className="text-xs text-gray-400 ml-4">
                                    + {item.toppings.map((t: any) => (typeof t === "string" ? t : t?.name || "")).filter(Boolean).join(", ")}
                                  </p>
                                )}
                                {item.mealDeal && typeof item.mealDeal === "string" && (
                                  <p className="text-xs text-[#E31837] ml-4">
                                    {item.mealDeal === "chips_drink" ? "Meal Deal (Chips + Drink)" : "Meal Deal (Chips + Shake)"}
                                  </p>
                                )}
                              </div>
                              <span className="text-gray-600">£{(Number(item.totalPrice || 0) * Number(item.quantity || 0)).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>

                        {/* Customer Info */}
                        <div className="px-4 pb-3 text-xs text-gray-500 space-y-0.5">
                          <p><strong>Name:</strong> {order.customerName}</p>
                          <p><strong>Phone:</strong> {order.customerPhone}</p>
                          {order.deliveryAddress && <p><strong>Address:</strong> {order.deliveryAddress}</p>}
                          {order.notes && <p><strong>Notes:</strong> {order.notes}</p>}
                        </div>

                        {/* Total & Accept/Reject Buttons */}
                        <div className="p-4 bg-orange-50 border-t border-orange-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg">£{Number(order.total || 0).toFixed(2)}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => printReceipt(order)}
                              className="border-gray-300 text-gray-600 hover:bg-gray-100 px-2"
                              title="Print receipt"
                            >
                              <Printer className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleAcceptOrder(order.id)}
                              className="bg-green-600 hover:bg-green-700 text-white font-bold px-4"
                            >
                              <Check className="w-4 h-4 mr-1" /> Accept
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleRejectOrder(order.id)}
                              variant="outline"
                              className="border-red-300 text-red-600 hover:bg-red-50 font-bold px-4"
                            >
                              <X className="w-4 h-4 mr-1" /> Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* 2. Active Orders Section (Accepted and being prepared) */}
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5 text-gray-400" />
              Active Orders ({activeOrders.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeOrders.map((order) => {
                const orderItems = Array.isArray(order.items) ? (order.items as any[]) : [];
                const nextStatus = getNextStatus(order.status, order.orderType) as OrderStatus | null;

                return (
                  <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono font-bold text-lg">{formatDailyNumber(order)}</span>
                          <Badge className={`${STATUS_COLORS[order.status]} border`}>
                            {STATUS_LABELS[order.status] || order.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(typeof order.createdAt === "object" ? String(order.createdAt) : order.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                          <span className="mx-1">|</span>
                          {order.orderType === "delivery" ? (
                            <span className="flex items-center gap-1 text-[#E31837] font-medium"><Truck className="w-3 h-3" /> Delivery</span>
                          ) : (
                            <span className="flex items-center gap-1 text-blue-600 font-medium"><Store className="w-3 h-3" /> Collection</span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => printReceipt(order)}
                        className="border-gray-300 text-gray-600 hover:bg-gray-100"
                      >
                        <Printer className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Items */}
                    <div className="p-4 flex-1 space-y-1.5">
                      {orderItems.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <div>
                            <span className="font-medium">{item.quantity}x {item.name}</span>
                            {Array.isArray(item.toppings) && item.toppings.length > 0 && (
                              <p className="text-xs text-gray-400 ml-4">
                                + {item.toppings.map((t: any) => (typeof t === "string" ? t : t?.name || "")).filter(Boolean).join(", ")}
                              </p>
                            )}
                            {item.mealDeal && typeof item.mealDeal === "string" && (
                              <p className="text-xs text-[#E31837] ml-4">
                                {item.mealDeal === "chips_drink" ? "Meal Deal (Chips + Drink)" : "Meal Deal (Chips + Shake)"}
                              </p>
                            )}
                          </div>
                          <span className="text-gray-600">£{(Number(item.totalPrice || 0) * Number(item.quantity || 0)).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Customer Info */}
                    <div className="px-4 pb-3 text-xs text-gray-500 space-y-0.5">
                      <p><strong>Name:</strong> {order.customerName}</p>
                      <p><strong>Phone:</strong> {order.customerPhone}</p>
                      {order.deliveryAddress && <p><strong>Address:</strong> {order.deliveryAddress}</p>}
                      {order.notes && <p><strong>Notes:</strong> {order.notes}</p>}
                    </div>

                    {/* Footer / Actions */}
                    <div className="p-4 bg-gray-50 border-t mt-auto">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-lg">£{Number(order.total || 0).toFixed(2)}</span>
                      </div>

                      {nextStatus ? (
                        <Button
                          onClick={() => handleUpdateStatus(order.id, nextStatus)}
                          className="w-full bg-[#E31837] hover:bg-[#c01530] text-white font-bold h-10 shadow-sm"
                        >
                          Mark {STATUS_LABELS[nextStatus] || nextStatus}
                        </Button>
                      ) : (
                        <div className="text-center text-sm font-bold text-green-600 py-2">
                          Ready for {order.orderType === "delivery" ? "Delivery" : "Collection"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {activeOrders.length === 0 && (
                <div className="col-span-full py-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
                  <UtensilsCrossed className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                  <p className="text-gray-400 font-medium">No active orders</p>
                </div>
              )}
            </div>

            {/* 3. Completed Orders Section */}
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2 text-gray-400 mt-12">
              <Check className="w-5 h-5" />
              Recently Completed
            </h2>
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="divide-y">
                {completedOrders.slice(0, 10).map((order) => (
                  <div key={order.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <span className="font-mono font-bold text-gray-400">{formatDailyNumber(order)}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-700">{order.customerName} — £{Number(order.total || 0).toFixed(2)}</span>
                          <Badge className={`${STATUS_COLORS[order.status]} border text-[10px] py-0 px-1.5 h-4`}>
                            {STATUS_LABELS[order.status] || order.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-400">
                          {order.orderType} · {new Date(typeof order.createdAt === "object" ? String(order.createdAt) : order.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => printReceipt(order)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <Printer className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                {completedOrders.length === 0 && (
                  <div className="p-8 text-center text-gray-400 text-sm">No completed orders yet today</div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "reviews" && (
          <div className="space-y-8">
            {/* Pending Reviews */}
            <div>
              <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-orange-500" />
                Pending Moderation ({pendingReviews?.length || 0})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingReviews?.map((review) => (
                  <div key={review.id} className="bg-white rounded-xl p-4 shadow-sm border-2 border-orange-100">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-4 h-4 ${i < review.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}`} />
                        ))}
                      </div>
                      <span className="text-xs text-gray-400">{new Date(typeof review.createdAt === "object" ? String(review.createdAt) : review.createdAt).toLocaleDateString("en-GB")}</span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">"{review.comment}"</p>
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-xs text-gray-500">
                        <span className="font-medium text-gray-700">{review.customerName}</span>
                        {review.orderNumber && <span className="ml-2">Order: {review.orderNumber}</span>}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleModerateReview(review.id, "rejected")}
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleModerateReview(review.id, "approved")}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          Approve
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {(!pendingReviews || pendingReviews.length === 0) && (
                  <div className="col-span-full py-8 text-center bg-white rounded-xl border border-dashed text-gray-400">
                    No reviews waiting for moderation
                  </div>
                )}
              </div>
            </div>

            {/* Approved Reviews & Replies */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  Approved Reviews
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-500 uppercase">Auto-Reply (AI)</span>
                  <button
                    onClick={() => toggleAutoReply(!autoReplyEnabled)}
                    className={`w-10 h-5 rounded-full relative transition-colors ${autoReplyEnabled ? "bg-[#E31837]" : "bg-gray-300"}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${autoReplyEnabled ? "left-5.5" : "left-0.5"}`}></span>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {approvedReviews?.map((review) => (
                  <div key={review.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-3.5 h-3.5 ${i < review.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}`} />
                        ))}
                        <span className="ml-2 text-xs text-gray-400">{new Date(typeof review.createdAt === "object" ? String(review.createdAt) : review.createdAt).toLocaleDateString("en-GB")}</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 mb-1">"{review.comment}"</p>
                    <p className="text-xs text-gray-500 mb-3">— {review.customerName}</p>

                    {review.reply ? (
                      <div className="bg-gray-50 rounded-lg p-3 border-l-4 border-gray-200">
                        <div className="flex items-center gap-1.5 mb-1">
                          <ChefHat className="w-3 h-3 text-gray-400" />
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Your Reply</span>
                        </div>
                        <p className="text-sm text-gray-700">{review.reply}</p>
                        {review.repliedAt && (
                          <p className="text-xs text-gray-400 mt-1">{new Date(String(review.repliedAt)).toLocaleDateString("en-GB")}</p>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2">
                        {replyingTo === review.id ? (
                          <div className="space-y-2">
                            <Textarea
                              placeholder="Write your reply..."
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              className="text-sm min-h-[80px]"
                            />
                            <div className="flex justify-between items-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleGenerateReply(review)}
                                disabled={generateReplyMutation.isPending}
                                className="text-xs h-8 gap-1.5"
                              >
                                <Sparkles className="w-3 h-3 text-purple-500" />
                                {generateReplyMutation.isPending ? "Thinking..." : "Generate AI Reply"}
                              </Button>
                              <div className="flex gap-2">
                                <Button size="sm" variant="ghost" onClick={() => setReplyingTo(null)}>Cancel</Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleReplyToReview(review.id)}
                                  disabled={replyToReviewMutation.isPending || !replyText.trim()}
                                  className="bg-[#E31837] text-white h-8"
                                >
                                  <Send className="w-3 h-3 mr-1.5" /> Post Reply
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setReplyingTo(review.id);
                              if (autoReplyEnabled) handleGenerateReply(review);
                            }}
                            className="text-xs h-8 text-gray-500 hover:text-[#E31837] hover:bg-red-50"
                          >
                            <MessageSquare className="w-3 h-3 mr-1.5" /> Reply to Review
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "menu" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Menu Management</h2>
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowAddCategory(true)}
                  variant="outline"
                  size="sm"
                  className="border-gray-300"
                >
                  <Plus className="w-4 h-4 mr-1" /> Category
                </Button>
                <Button
                  onClick={() => setShowAddItem(true)}
                  size="sm"
                  className="bg-gray-800 text-white"
                >
                  <Plus className="w-4 h-4 mr-1" /> Item
                </Button>
              </div>
            </div>

            {/* Add Category Form */}
            {showAddCategory && (
              <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-gray-800 mb-4 animate-in fade-in slide-in-from-top-2">
                <h3 className="font-bold mb-3">Add New Category</h3>
                <div className="flex gap-3 flex-wrap items-end">
                  <div className="flex-1 min-w-[150px]">
                    <label className="text-xs text-gray-500 mb-1 block">Name</label>
                    <Input
                      placeholder="e.g. Burgers"
                      value={newCatName}
                      onChange={e => {
                        setNewCatName(e.target.value);
                        setNewCatSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-[150px]">
                    <label className="text-xs text-gray-500 mb-1 block">URL Slug</label>
                    <Input placeholder="e.g. burgers" value={newCatSlug} onChange={e => setNewCatSlug(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setShowAddCategory(false)}>Cancel</Button>
                    <Button onClick={handleAddCategory} className="bg-gray-800 text-white" disabled={!newCatName || !newCatSlug}>Add</Button>
                  </div>
                </div>
              </div>
            )}

            {/* Add Item Form */}
            {showAddItem && (
              <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-gray-800 mb-4 animate-in fade-in slide-in-from-top-2">
                <h3 className="font-bold mb-3">Add New Menu Item</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Category</label>
                    <select
                      className="w-full h-10 px-3 rounded-md border border-gray-200 text-sm"
                      value={newItemCategory}
                      onChange={e => setNewItemCategory(Number(e.target.value))}
                    >
                      <option value={0}>Select Category</option>
                      {menuCategories?.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Item Name</label>
                    <Input placeholder="e.g. Margherita" value={newItemName} onChange={e => setNewItemName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Price (£)</label>
                    <Input placeholder="e.g. 9.50" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Description</label>
                    <Input placeholder="e.g. Tomato sauce, mozzarella, basil" value={newItemDesc} onChange={e => setNewItemDesc(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Image URL (Optional)</label>
                    <Input placeholder="https://..." value={newItemImage} onChange={e => setNewItemImage(e.target.value)} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setShowAddItem(false)}>Cancel</Button>
                  <Button onClick={handleAddItem} className="bg-gray-800 text-white" disabled={!newItemName || !newItemPrice || !newItemCategory}>Create Item</Button>
                </div>
              </div>
            )}

            {/* Categories List */}
            <div className="space-y-8">
              {menuCategories?.map(category => {
                const categoryItems = allMenuItems?.filter(item => item.categoryId === category.id) || [];
                return (
                  <div key={category.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
                      <h3 className="font-bold text-md text-gray-800">{category.name} ({categoryItems.length})</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCategory(category.id)}
                        className="text-gray-400 hover:text-red-500 h-8 px-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="divide-y">
                      {categoryItems.map(item => (
                        <div key={item.id} className={`p-4 flex items-center gap-4 ${!item.available ? "bg-gray-50 opacity-60" : ""}`}>
                          <div className="w-12 h-12 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden border">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300">
                                <UtensilsCrossed className="w-6 h-6" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            {editingItem === item.id ? (
                              <div className="space-y-2">
                                <Input
                                  value={editName}
                                  onChange={e => setEditName(e.target.value)}
                                  className="h-8 text-sm font-bold"
                                  placeholder={item.name}
                                />
                                <Input
                                  value={editDesc}
                                  onChange={e => setEditDesc(e.target.value)}
                                  className="h-8 text-xs"
                                  placeholder={item.description || "No description"}
                                />
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{item.name}</span>
                                  {!item.available && <Badge variant="outline" className="text-[10px] h-4 py-0">OFF</Badge>}
                                </div>
                                {item.description && <p className="text-xs text-gray-400 truncate max-w-[200px]">{item.description}</p>}
                              </>
                            )}
                          </div>

                          <div className="w-20 text-right">
                            {editingItem === item.id ? (
                              <Input
                                value={editPrice}
                                onChange={e => setEditPrice(e.target.value)}
                                className="h-8 text-sm text-right font-bold"
                                placeholder={item.price}
                              />
                            ) : (
                              <span className="font-bold">£{item.price}</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            {editingItem === item.id ? (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => setEditingItem(null)} className="h-8 w-8 p-0">
                                  <X className="w-4 h-4" />
                                </Button>
                                <Button size="sm" onClick={() => handleSaveItem(item.id)} className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700 text-white">
                                  <Check className="w-4 h-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleToggleAvailable(item.id, item.available)}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${item.available ? "text-green-600 hover:bg-green-50" : "text-gray-400 hover:bg-gray-100"}`}
                                  title={item.available ? "Mark as sold out" : "Mark as available"}
                                >
                                  {item.available ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={() => handleEditItem(item)}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"
                                  title="Edit item"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50"
                                  title="Delete item"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                      {categoryItems.length === 0 && (
                        <div className="p-8 text-center text-gray-400 text-sm">No items in this category</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "delivery" && (
          <div className="max-w-2xl mx-auto">
            <h2 className="font-bold text-lg mb-4">Delivery Settings</h2>

            <div className="bg-white rounded-xl shadow-sm border p-6 space-y-6">
              {/* Radius and Free Threshold */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Maximum Delivery Radius (Miles)</label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.5"
                      value={deliveryMaxRadius}
                      onChange={e => setDeliveryMaxRadius(e.target.value)}
                      className="pl-8"
                    />
                    <Truck className="w-4 h-4 text-gray-400 absolute left-2.5 top-3" />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Customers outside this radius cannot order for delivery.</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Free Delivery Threshold (£)</label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="1"
                      value={deliveryFreeThreshold}
                      onChange={e => setDeliveryFreeThreshold(e.target.value)}
                      className="pl-8"
                    />
                    <Tag className="w-4 h-4 text-gray-400 absolute left-2.5 top-3" />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Orders above this amount get free delivery (overrides tiers).</p>
                </div>
              </div>

              {/* Delivery Tiers */}
              <div className="border-t pt-6">
                <h3 className="font-bold text-md mb-3 flex items-center gap-2">
                  Delivery Tiers
                  <Badge variant="outline" className="font-normal text-[10px]">{deliveryTiers.length} Tiers</Badge>
                </h3>
                <p className="text-sm text-gray-500 mb-4">Set delivery fees based on distance. The first matching tier will be used.</p>

                <div className="space-y-2 mb-4">
                  {deliveryTiers.map((tier, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center text-xs font-bold text-gray-400 border">
                        {idx + 1}
                      </div>
                      <span className="text-sm font-medium flex-1">Up to <strong>{tier.maxMiles}</strong> miles</span>
                      <span className="font-bold text-[#E31837]">£{tier.fee.toFixed(2)}</span>
                      <button
                        onClick={() => handleRemoveTier(idx)}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {deliveryTiers.length === 0 && (
                    <div className="p-4 text-center text-gray-400 text-sm italic">No delivery tiers defined.</div>
                  )}
                </div>

                {/* Add new tier */}
                <div className="flex gap-2 items-end flex-wrap">
                  <div className="w-32">
                    <label className="text-xs text-gray-500 mb-1 block">Max Miles</label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0.1"
                      value={newTierMiles}
                      onChange={e => setNewTierMiles(e.target.value)}
                      placeholder="e.g. 2"
                    />
                  </div>
                  <div className="w-32">
                    <label className="text-xs text-gray-500 mb-1 block">Fee (£)</label>
                    <Input
                      type="number"
                      step="0.50"
                      min="0"
                      value={newTierFee}
                      onChange={e => setNewTierFee(e.target.value)}
                      placeholder="e.g. 2.50"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleAddTier}
                    className="bg-gray-800 hover:bg-gray-700 text-white"
                    disabled={!newTierMiles || !newTierFee}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Tier
                  </Button>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleSaveDeliverySettings}
                className="w-full bg-[#E31837] hover:bg-[#c01530] text-white font-bold py-3"
                disabled={updateDeliverySettingsMutation.isPending}
              >
                {updateDeliverySettingsMutation.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </div>
        )}

        {activeTab === "offers" && (
          <div>
            <h2 className="font-bold text-lg mb-4">Offers & Discounts</h2>
            <p className="text-sm text-gray-500 mb-4">Create percentage-based discounts. Only one offer can be active at a time. Active offers are shown to customers at checkout.</p>

            {/* Create Offer Form */}
            <div className="bg-white rounded-xl p-4 shadow-sm mb-6 border">
              <h3 className="font-semibold mb-3">Create New Offer</h3>
              <div className="flex gap-3 flex-wrap items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs text-gray-500 mb-1 block">Offer Name</label>
                  <Input
                    placeholder="e.g. Summer Special"
                    value={newOfferName}
                    onChange={e => setNewOfferName(e.target.value)}
                  />
                </div>
                <div className="w-32">
                  <label className="text-xs text-gray-500 mb-1 block">Discount %</label>
                  <Input
                    type="number"
                    placeholder="e.g. 10"
                    min="1"
                    max="100"
                    value={newOfferPercent}
                    onChange={e => setNewOfferPercent(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleCreateOffer}
                  className="bg-[#E31837] hover:bg-[#c01530] text-white"
                  disabled={!newOfferName || !newOfferPercent}
                >
                  <Plus className="w-4 h-4 mr-1" /> Create
                </Button>
              </div>
            </div>

            {/* Offers List */}
            {(!offersList || offersList.length === 0) ? (
              <div className="bg-white rounded-xl p-8 text-center text-gray-400">
                <Tag className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No offers created yet</p>
                <p className="text-sm">Create your first offer above</p>
              </div>
            ) : (
              <div className="space-y-3">
                {offersList.map(offer => (
                  <div key={offer.id} className={`bg-white rounded-xl p-4 shadow-sm border-2 ${offer.active ? "border-green-400 bg-green-50" : "border-gray-200"}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-lg">{offer.name}</span>
                        <span className="ml-3 text-2xl font-black text-[#E31837]">{offer.discountPercent}% OFF</span>
                        {offer.active && (
                          <Badge className="ml-3 bg-green-600 text-white">ACTIVE</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleToggleOffer(offer.id, !offer.active)}
                          className={`w-12 h-6 rounded-full relative transition-colors ${offer.active ? "bg-green-500" : "bg-gray-300"}`}
                        >
                          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${offer.active ? "left-6" : "left-0.5"}`}></span>
                        </button>
                        <button
                          onClick={() => handleDeleteOffer(offer.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                          title="Delete offer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
