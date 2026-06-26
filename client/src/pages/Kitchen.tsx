import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Lock, ChefHat, Clock, Truck, Store, Volume2, VolumeX, Star, Check, X, Plus, Trash2, Edit2, Tag, UtensilsCrossed, MessageSquare, Sparkles, Send, Timer } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

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

  const startAlert = useCallback(() => {
    if (alertIntervalRef.current) return; // Already running
    playAlertBeep(); // Play immediately
    alertIntervalRef.current = setInterval(() => {
      playAlertBeep();
    }, 2000); // Beep every 2 seconds
  }, [playAlertBeep]);

  // Check for pending_acceptance orders and manage alert
  useEffect(() => {
    if (!orders || !authenticated) return;
    const pendingOrders = orders.filter(o => o.status === "pending_acceptance");
    if (pendingOrders.length > 0 && soundEnabled) {
      startAlert();
    } else {
      stopAlert();
    }
  }, [orders, authenticated, soundEnabled, startAlert, stopAlert]);

  // Cleanup alert on unmount
  useEffect(() => {
    return () => {
      stopAlert();
    };
  }, [stopAlert]);

  // SSE for real-time updates
  useEffect(() => {
    if (!authenticated) return;

    const eventSource = new EventSource("/api/kitchen/events");
    eventSource.onmessage = () => {
      refetch();
    };
    eventSource.onerror = () => {
      // Will auto-reconnect
    };

    return () => eventSource.close();
  }, [authenticated, refetch]);

  // Check for new orders on data change (for initial beep trigger)
  useEffect(() => {
    if (orders && orders.length > prevOrderCountRef.current && prevOrderCountRef.current > 0) {
      // New order came in — alert will be handled by the pending_acceptance check above
    }
    if (orders) {
      prevOrderCountRef.current = orders.length;
    }
  }, [orders]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await loginMutation.mutateAsync({ password });
    if (result.success) {
      setAuthenticated(true);
      setError("");
    } else {
      setError("Incorrect password");
    }
  };

  const handleStatusUpdate = async (orderId: number, newStatus: string) => {
    await updateStatus.mutateAsync({ id: orderId, status: newStatus as any });
    refetch();
  };

  const handleAcceptOrder = async (orderId: number) => {
    await updateStatus.mutateAsync({ id: orderId, status: "new" });
    refetch();
  };

  const handleRejectOrder = async (orderId: number) => {
    await updateStatus.mutateAsync({ id: orderId, status: "rejected" });
    refetch();
  };

  // === EARLY RETURN (login screen) ===
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Lock className="w-7 h-7 text-[#E31837]" />
            </div>
            <h1 className="logo-text text-3xl">PRIMO'S</h1>
            <p className="text-gray-500 text-sm mt-1">Kitchen Dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter kitchen password"
              className="text-center"
              autoFocus
            />
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <Button
              type="submit"
              className="w-full bg-[#E31837] hover:bg-[#c01530] text-white font-bold py-5"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Checking..." : "Access Kitchen"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  const handleModerate = async (id: number, status: "approved" | "rejected") => {
    await moderateReview.mutateAsync({ id, status });
    refetchReviews();
    refetchApproved();

    // Auto-reply with AI if enabled and approved
    if (status === "approved" && autoReplyEnabled) {
      const review = pendingReviews?.find(r => r.id === id);
      if (review) {
        try {
          const { reply } = await generateReplyMutation.mutateAsync({
            reviewText: review.comment,
            customerName: review.customerName,
            starRating: review.rating,
          });
          await replyToReviewMutation.mutateAsync({ reviewId: id, reply });
          refetchApproved();
        } catch (e) {
          console.error("Auto-reply failed:", e);
        }
      }
    }
  };

  const handleToggleAutoReply = (enabled: boolean) => {
    setAutoReplyEnabled(enabled);
    localStorage.setItem("primos_auto_reply", enabled ? "true" : "false");
  };

  const handleSendReply = async (reviewId: number) => {
    if (!replyText.trim()) return;
    await replyToReviewMutation.mutateAsync({ reviewId, reply: replyText.trim() });
    setReplyingTo(null);
    setReplyText("");
    refetchApproved();
  };

  const handleSuggestReply = async (review: { comment: string; customerName: string; rating: number }) => {
    const { reply } = await generateReplyMutation.mutateAsync({
      reviewText: review.comment,
      customerName: review.customerName,
      starRating: review.rating,
    });
    setReplyText(reply);
  };

  // Menu management handlers
  const handleCreateItem = async () => {
    if (!newItemName || !newItemPrice || !newItemCategory) return;
    await createItemMutation.mutateAsync({
      categoryId: newItemCategory,
      name: newItemName,
      description: newItemDesc || undefined,
      price: newItemPrice,
      imageUrl: newItemImage || undefined,
    });
    setNewItemName("");
    setNewItemDesc("");
    setNewItemPrice("");
    setNewItemImage("");
    setShowAddItem(false);
    refetchMenuItems();
  };

  const handleUpdateItem = async (id: number) => {
    const updates: any = {};
    if (editName) updates.name = editName;
    if (editDesc) updates.description = editDesc;
    if (editPrice) updates.price = editPrice;
    await updateItemMutation.mutateAsync({ id, ...updates });
    setEditingItem(null);
    setEditPrice("");
    setEditName("");
    setEditDesc("");
    refetchMenuItems();
  };

  const handleToggleAvailability = async (id: number, currentAvailable: boolean) => {
    await updateItemMutation.mutateAsync({ id, available: !currentAvailable });
    refetchMenuItems();
  };

  const handleDeleteItem = async (id: number) => {
    if (!confirm("Delete this menu item?")) return;
    await deleteItemMutation.mutateAsync({ id });
    refetchMenuItems();
  };

  const handleCreateCategory = async () => {
    if (!newCatName || !newCatSlug) return;
    await createCategoryMutation.mutateAsync({
      name: newCatName,
      slug: newCatSlug,
    });
    setNewCatName("");
    setNewCatSlug("");
    setShowAddCategory(false);
    refetchCategories();
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm("Delete this category and ALL its items?")) return;
    await deleteCategoryMutation.mutateAsync({ id });
    refetchCategories();
    refetchMenuItems();
  };

  // Load delivery settings into local state when data arrives
  useEffect(() => {
    if (deliverySettingsData && !deliverySettingsLoaded) {
      setDeliveryMaxRadius(deliverySettingsData.maxRadiusMiles);
      setDeliveryFreeThreshold(deliverySettingsData.freeDeliveryThreshold);
      setDeliveryTiers(deliverySettingsData.tiers as Array<{ maxMiles: number; fee: number }>);
      setDeliverySettingsLoaded(true);
    }
  }, [deliverySettingsData, deliverySettingsLoaded]);

  // Offers handlers
  const handleCreateOffer = async () => {
    if (!newOfferName || !newOfferPercent) return;
    await createOfferMutation.mutateAsync({
      name: newOfferName,
      discountPercent: parseInt(newOfferPercent),
    });
    setNewOfferName("");
    setNewOfferPercent("");
    refetchOffers();
  };

  const handleToggleOffer = async (id: number, active: boolean) => {
    await toggleOfferMutation.mutateAsync({ id, active });
    refetchOffers();
  };

  const handleDeleteOffer = async (id: number) => {
    if (!confirm("Delete this offer?")) return;
    await deleteOfferMutation.mutateAsync({ id });
    refetchOffers();
  };

  // Delivery settings handlers
  const handleSaveDeliverySettings = async () => {
    await updateDeliverySettingsMutation.mutateAsync({
      maxRadiusMiles: deliveryMaxRadius,
      freeDeliveryThreshold: deliveryFreeThreshold,
      tiers: deliveryTiers,
    });
    refetchDeliverySettings();
    alert("Delivery settings saved!");
  };

  const handleAddTier = () => {
    if (!newTierMiles || !newTierFee) return;
    const miles = parseFloat(newTierMiles);
    const fee = parseFloat(newTierFee);
    if (isNaN(miles) || isNaN(fee) || miles <= 0 || fee < 0) return;
    setDeliveryTiers([...deliveryTiers, { maxMiles: miles, fee }].sort((a, b) => a.maxMiles - b.maxMiles));
    setNewTierMiles("");
    setNewTierFee("");
  };

  const handleDeleteTier = (index: number) => {
    setDeliveryTiers(deliveryTiers.filter((_, i) => i !== index));
  };

  const pendingAcceptanceOrders = orders?.filter(o => o.status === "pending_acceptance") || [];
  const activeOrders = orders?.filter(o => ["new", "preparing", "ready"].includes(o.status)) || [];
  const completedOrders = orders?.filter(o => o.status === "delivered" || o.status === "collected" || o.status === "rejected") || [];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Kitchen Header */}
      <header className="bg-gray-900 text-white py-3 px-4 sticky top-0 z-50">
        <div className="container flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ChefHat className="w-6 h-6" />
            <span className="logo-text text-xl">PRIMO'S</span>
            <span className="text-sm text-gray-400">Kitchen</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
              title={soundEnabled ? "Mute notifications" : "Enable notifications"}
            >
              {soundEnabled ? (
                <Volume2 className="w-5 h-5" />
              ) : (
                <VolumeX className="w-5 h-5 text-gray-500" />
              )}
            </button>
            {pendingAcceptanceOrders.length > 0 && (
              <Badge className="bg-red-500 text-white animate-pulse">
                {pendingAcceptanceOrders.length} NEW!
              </Badge>
            )}
            <Badge variant="outline" className="border-green-500 text-green-400">
              {activeOrders.length} Active
            </Badge>
          </div>
        </div>
      </header>

      <div className="container py-6">
        {/* Orders query error banner */}
        {ordersError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <strong>Could not load orders</strong> — the database may need a migration. Try refreshing, or contact support if this persists.
          </div>
        )}
        {ordersLoading && !orders && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            Loading orders…
          </div>
        )}
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
              activeTab === "orders"
                ? "bg-[#E31837] text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Orders ({pendingAcceptanceOrders.length + activeOrders.length})
          </button>
          <button
            onClick={() => setActiveTab("reviews")}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
              activeTab === "reviews"
                ? "bg-[#E31837] text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Reviews {pendingReviews && pendingReviews.length > 0 && (
              <span className="ml-1 bg-yellow-400 text-yellow-900 text-xs px-1.5 py-0.5 rounded-full">{pendingReviews.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("menu")}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
              activeTab === "menu"
                ? "bg-[#E31837] text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <span className="flex items-center gap-1"><UtensilsCrossed className="w-4 h-4" /> Menu</span>
          </button>
          <button
            onClick={() => setActiveTab("offers")}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
              activeTab === "offers"
                ? "bg-[#E31837] text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <span className="flex items-center gap-1"><Tag className="w-4 h-4" /> Offers</span>
          </button>
          <button
            onClick={() => setActiveTab("delivery")}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
              activeTab === "delivery"
                ? "bg-[#E31837] text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <span className="flex items-center gap-1"><Truck className="w-4 h-4" /> Delivery</span>
          </button>
        </div>

        {/* ========== ORDERS TAB ========== */}
        {activeTab === "orders" && (<>
          {/* Pending Acceptance Orders (need Accept/Reject) */}
          {pendingAcceptanceOrders.length > 0 && (
            <>
              <h2 className="font-bold text-lg mb-4 text-orange-700 flex items-center gap-2">
                <span className="inline-block w-3 h-3 bg-orange-500 rounded-full animate-pulse"></span>
                New Orders — Accept or Reject ({pendingAcceptanceOrders.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {pendingAcceptanceOrders.map(order => {
                  const orderItems = (order.items as any[]) || [];
                  return (
                    <div key={order.id} className="bg-white rounded-xl shadow-md overflow-hidden border-2 border-orange-300 animate-pulse-border">
                      {/* Order Header */}
                      <div className="p-4 border-b border-orange-100 bg-orange-50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono font-bold text-sm">{order.orderNumber}</span>
                          <Badge className={`${STATUS_COLORS["pending_acceptance"]} border`}>
                            NEW ORDER
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(order.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                          <span className="mx-1">|</span>
                          {order.orderType === "delivery" ? (
                            <span className="flex items-center gap-1"><Truck className="w-3 h-3" /> Delivery</span>
                          ) : (
                            <span className="flex items-center gap-1"><Store className="w-3 h-3" /> Collection</span>
                          )}
                        </div>
                        {/* Auto-rejection countdown */}
                        <CountdownTimer createdAt={order.createdAt} />
                      </div>

                      {/* Order Items */}
                      <div className="p-4 space-y-1.5">
                        {orderItems.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <div>
                              <span className="font-medium">{item.quantity}x {item.name}</span>
                              {item.toppings && item.toppings.length > 0 && (
                                <p className="text-xs text-gray-400 ml-4">
                                  + {item.toppings.map((t: any) => t.name).join(", ")}
                                </p>
                              )}
                              {item.mealDeal && (
                                <p className="text-xs text-[#E31837] ml-4">
                                  {item.mealDeal === "chips_drink" ? "Meal Deal (Chips + Drink)" : "Meal Deal (Chips + Shake)"}
                                </p>
                              )}
                            </div>
                            <span className="text-gray-600">£{(item.totalPrice * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Customer Info */}
                      <div className="px-4 pb-3 text-xs text-gray-500 space-y-0.5">
                        <p><strong>Name:</strong> {order.customerName}</p>
                        <p><strong>Phone:</strong> {order.customerPhone}</p>
                        {order.deliveryAddress && <p><strong>Address:</strong> {order.deliveryAddress}</p>}
                        {order.notes && <p><strong>Notes:</strong> {order.notes as string}</p>}
                      </div>

                      {/* Total & Accept/Reject Buttons */}
                      <div className="p-4 bg-orange-50 border-t border-orange-200 flex items-center justify-between">
                        <span className="font-bold text-lg">£{parseFloat(order.total).toFixed(2)}</span>
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

          {/* Active Orders (accepted, in progress) */}
          <h2 className="font-bold text-lg mb-4">Active Orders ({activeOrders.length})</h2>
          {activeOrders.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center text-gray-400">
              <ChefHat className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No active orders</p>
              <p className="text-sm">New orders will appear here in real-time</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {activeOrders.map(order => {
                const orderItems = (order.items as any[]) || [];
                const nextStatus = getNextStatus(order.status, order.orderType);

                return (
                  <div key={order.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                    {/* Order Header */}
                    <div className="p-4 border-b border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono font-bold text-sm">{order.orderNumber}</span>
                        <Badge className={`${STATUS_COLORS[order.status] || ""} border`}>
                          {STATUS_LABELS[order.status] || order.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(order.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                        <span className="mx-1">|</span>
                        {order.orderType === "delivery" ? (
                          <span className="flex items-center gap-1"><Truck className="w-3 h-3" /> Delivery</span>
                        ) : (
                          <span className="flex items-center gap-1"><Store className="w-3 h-3" /> Collection</span>
                        )}
                      </div>
                    </div>

                    {/* Order Items */}
                    <div className="p-4 space-y-1.5">
                      {orderItems.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <div>
                            <span className="font-medium">{item.quantity}x {item.name}</span>
                            {item.toppings && item.toppings.length > 0 && (
                              <p className="text-xs text-gray-400 ml-4">
                                + {item.toppings.map((t: any) => t.name).join(", ")}
                              </p>
                            )}
                            {item.mealDeal && (
                              <p className="text-xs text-[#E31837] ml-4">
                                {item.mealDeal === "chips_drink" ? "Meal Deal (Chips + Drink)" : "Meal Deal (Chips + Shake)"}
                              </p>
                            )}
                          </div>
                          <span className="text-gray-600">£{(item.totalPrice * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Customer Info */}
                    <div className="px-4 pb-3 text-xs text-gray-500 space-y-0.5">
                      <p><strong>Name:</strong> {order.customerName}</p>
                      <p><strong>Phone:</strong> {order.customerPhone}</p>
                      {order.deliveryAddress && <p><strong>Address:</strong> {order.deliveryAddress}</p>}
                      {order.notes && <p><strong>Notes:</strong> {order.notes as string}</p>}
                    </div>

                    {/* Total & Action */}
                    <div className="p-4 bg-gray-50 border-t flex items-center justify-between">
                      <span className="font-bold">£{parseFloat(order.total).toFixed(2)}</span>
                      {nextStatus && (
                        <Button
                          size="sm"
                          onClick={() => handleStatusUpdate(order.id, nextStatus)}
                          className="bg-[#E31837] hover:bg-[#c01530] text-white font-semibold"
                        >
                          Mark {STATUS_LABELS[nextStatus] || nextStatus}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Completed Orders */}
          {completedOrders.length > 0 && (
            <>
              <h2 className="font-bold text-lg mb-4 text-gray-500">Completed ({completedOrders.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {completedOrders.slice(-12).reverse().map(order => (
                  <div key={order.id} className="bg-white rounded-lg p-3 opacity-60">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-medium">{order.orderNumber}</span>
                      <Badge variant="outline" className="text-xs">
                        {STATUS_LABELS[order.status] || order.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {order.customerName} — £{parseFloat(order.total).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </>)}

        {/* ========== REVIEWS TAB ========== */}
        {activeTab === "reviews" && (
          <div>
            {/* Auto-reply toggle */}
            <div className="bg-white rounded-xl p-4 shadow-sm mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="font-semibold text-sm">Auto-reply with AI</p>
                  <p className="text-xs text-gray-500">Automatically generate replies when approving reviews</p>
                </div>
              </div>
              <button
                onClick={() => handleToggleAutoReply(!autoReplyEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoReplyEnabled ? "bg-purple-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoReplyEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Pending Reviews */}
            <h2 className="font-bold text-lg mb-4">Pending Reviews ({pendingReviews?.length || 0})</h2>
            {(!pendingReviews || pendingReviews.length === 0) ? (
              <div className="bg-white rounded-xl p-8 text-center text-gray-400 mb-8">
                <Star className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No pending reviews</p>
                <p className="text-sm">New reviews will appear here for approval</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {pendingReviews.map(review => (
                  <div key={review.id} className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-1 mb-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-4 h-4 ${i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
                      ))}
                    </div>
                    <p className="text-sm text-gray-700 mb-2">"{review.comment}"</p>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        <span className="font-medium text-gray-700">{review.customerName}</span>
                        {review.orderNumber && <span className="ml-2">Order: {review.orderNumber}</span>}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleModerate(review.id, "approved")}
                          className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                          title="Approve"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleModerate(review.id, "rejected")}
                          className="p-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                          title="Reject"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Approved Reviews with Replies */}
            <h2 className="font-bold text-lg mb-4">Approved Reviews ({approvedReviews?.length || 0})</h2>
            {(!approvedReviews || approvedReviews.length === 0) ? (
              <div className="bg-white rounded-xl p-8 text-center text-gray-400">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No approved reviews yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {approvedReviews.map(review => (
                  <div key={review.id} className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-1 mb-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-4 h-4 ${i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
                      ))}
                      <span className="ml-2 text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString("en-GB")}</span>
                    </div>
                    <p className="text-sm text-gray-700 mb-1">"{review.comment}"</p>
                    <p className="text-xs text-gray-500 mb-3">— {review.customerName}</p>

                    {/* Existing reply */}
                    {review.reply && (
                      <div className="ml-4 pl-3 border-l-2 border-red-200 bg-red-50 rounded-r-lg p-3 mb-2">
                        <p className="text-xs font-semibold text-[#E31837] mb-1">Primos Restaurant replied:</p>
                        <p className="text-sm text-gray-700">{review.reply}</p>
                        {review.repliedAt && (
                          <p className="text-xs text-gray-400 mt-1">{new Date(review.repliedAt).toLocaleDateString("en-GB")}</p>
                        )}
                      </div>
                    )}

                    {/* Reply controls (only if no reply yet and auto-reply is OFF) */}
                    {!review.reply && !autoReplyEnabled && (
                      <div>
                        {replyingTo === review.id ? (
                          <div className="mt-2 space-y-2">
                            <Textarea
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="Write your reply..."
                              rows={3}
                              className="text-sm resize-none"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSendReply(review.id)}
                                disabled={!replyText.trim() || replyToReviewMutation.isPending}
                                className="bg-[#E31837] hover:bg-[#c01530] text-white text-xs"
                              >
                                <Send className="w-3 h-3 mr-1" /> Send Reply
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSuggestReply(review)}
                                disabled={generateReplyMutation.isPending}
                                className="text-xs"
                              >
                                <Sparkles className="w-3 h-3 mr-1" />
                                {generateReplyMutation.isPending ? "Generating..." : "Suggest Reply"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setReplyingTo(null); setReplyText(""); }}
                                className="text-xs"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setReplyingTo(review.id); setReplyText(""); }}
                            className="mt-2 text-xs"
                          >
                            <MessageSquare className="w-3 h-3 mr-1" /> Reply
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========== MENU MANAGEMENT TAB ========== */}
        {activeTab === "menu" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-lg">Menu Management</h2>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setShowAddCategory(true)} variant="outline" className="text-sm">
                  <Plus className="w-4 h-4 mr-1" /> Add Category
                </Button>
                <Button size="sm" onClick={() => setShowAddItem(true)} className="bg-[#E31837] hover:bg-[#c01530] text-white text-sm">
                  <Plus className="w-4 h-4 mr-1" /> Add Item
                </Button>
              </div>
            </div>

            {/* Add Category Form */}
            {showAddCategory && (
              <div className="bg-white rounded-xl p-4 shadow-sm mb-4 border border-blue-200">
                <h3 className="font-semibold mb-3">Add New Category</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input
                    placeholder="Category name"
                    value={newCatName}
                    onChange={e => {
                      setNewCatName(e.target.value);
                      setNewCatSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
                    }}
                  />
                  <Input
                    placeholder="Slug (auto-generated)"
                    value={newCatSlug}
                    onChange={e => setNewCatSlug(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleCreateCategory} className="bg-green-600 hover:bg-green-700 text-white">Save</Button>
                    <Button variant="outline" onClick={() => setShowAddCategory(false)}>Cancel</Button>
                  </div>
                </div>
              </div>
            )}

            {/* Add Item Form */}
            {showAddItem && (
              <div className="bg-white rounded-xl p-4 shadow-sm mb-4 border border-green-200">
                <h3 className="font-semibold mb-3">Add New Menu Item</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <Input placeholder="Item name" value={newItemName} onChange={e => setNewItemName(e.target.value)} />
                  <Input placeholder="Price (e.g. 9.95)" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} />
                  <Input placeholder="Description (optional)" value={newItemDesc} onChange={e => setNewItemDesc(e.target.value)} />
                  <Input placeholder="Image URL (optional)" value={newItemImage} onChange={e => setNewItemImage(e.target.value)} />
                  <select
                    className="border rounded-lg px-3 py-2 text-sm"
                    value={newItemCategory}
                    onChange={e => setNewItemCategory(parseInt(e.target.value))}
                  >
                    <option value={0}>Select category...</option>
                    {menuCategories?.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <Button onClick={handleCreateItem} className="bg-green-600 hover:bg-green-700 text-white">Add Item</Button>
                    <Button variant="outline" onClick={() => setShowAddItem(false)}>Cancel</Button>
                  </div>
                </div>
              </div>
            )}

            {/* Menu Items by Category */}
            {menuCategories?.map(category => {
              const categoryItems = allMenuItems?.filter(item => item.categoryId === category.id) || [];
              return (
                <div key={category.id} className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-md text-gray-800">{category.name} ({categoryItems.length})</h3>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Delete Category
                    </button>
                  </div>
                  {categoryItems.length === 0 ? (
                    <p className="text-sm text-gray-400 ml-2">No items in this category</p>
                  ) : (
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-left px-4 py-2 font-medium text-gray-600">Item</th>
                            <th className="text-left px-4 py-2 font-medium text-gray-600">Price</th>
                            <th className="text-center px-4 py-2 font-medium text-gray-600">Available</th>
                            <th className="text-right px-4 py-2 font-medium text-gray-600">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categoryItems.map(item => (
                            <tr key={item.id} className={`border-b last:border-0 ${!item.available ? "opacity-50 bg-gray-50" : ""}`}>
                              <td className="px-4 py-3">
                                {editingItem === item.id ? (
                                  <Input
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    placeholder={item.name}
                                    className="text-sm h-8"
                                  />
                                ) : (
                                  <div>
                                    <span className="font-medium">{item.name}</span>
                                    {item.description && <p className="text-xs text-gray-400 truncate max-w-[200px]">{item.description}</p>}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {editingItem === item.id ? (
                                  <Input
                                    value={editPrice}
                                    onChange={e => setEditPrice(e.target.value)}
                                    placeholder={item.price}
                                    className="text-sm h-8 w-20"
                                  />
                                ) : (
                                  <span>£{parseFloat(item.price).toFixed(2)}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => handleToggleAvailability(item.id, item.available)}
                                  className={`w-10 h-5 rounded-full relative transition-colors ${item.available ? "bg-green-500" : "bg-gray-300"}`}
                                >
                                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${item.available ? "left-5" : "left-0.5"}`}></span>
                                </button>
                              </td>
                              <td className="px-4 py-3 text-right">
                                {editingItem === item.id ? (
                                  <div className="flex gap-1 justify-end">
                                    <Button size="sm" onClick={() => handleUpdateItem(item.id)} className="h-7 text-xs bg-green-600 text-white">Save</Button>
                                    <Button size="sm" variant="outline" onClick={() => setEditingItem(null)} className="h-7 text-xs">Cancel</Button>
                                  </div>
                                ) : (
                                  <div className="flex gap-1 justify-end">
                                    <button
                                      onClick={() => {
                                        setEditingItem(item.id);
                                        setEditName(item.name);
                                        setEditPrice(item.price);
                                        setEditDesc(item.description || "");
                                      }}
                                      className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                      title="Edit"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteItem(item.id)}
                                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ========== DELIVERY TAB ========== */}
        {activeTab === "delivery" && (
          <div>
            <h2 className="font-bold text-lg mb-4">Delivery Settings</h2>
            <p className="text-sm text-gray-500 mb-4">Configure delivery radius, free delivery threshold, and fee tiers. Changes take effect immediately for new orders.</p>

            <div className="bg-white rounded-xl p-4 shadow-sm mb-6 border space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Max Delivery Radius (miles)</label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.5"
                    value={deliveryMaxRadius}
                    onChange={e => setDeliveryMaxRadius(e.target.value)}
                    placeholder="3.0"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Free Delivery Threshold (£)</label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={deliveryFreeThreshold}
                    onChange={e => setDeliveryFreeThreshold(e.target.value)}
                    placeholder="30.00"
                  />
                  <p className="text-xs text-gray-400 mt-1">Orders above this amount get free delivery</p>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-2 block font-semibold">Delivery Fee Tiers</label>
                <p className="text-xs text-gray-400 mb-3">Fees are applied based on distance. If the customer is within a tier's max miles, that fee is charged.</p>
                {deliveryTiers.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No tiers configured. Add at least one tier below.</p>
                ) : (
                  <div className="space-y-2 mb-3">
                    {deliveryTiers.map((tier, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium flex-1">Up to <strong>{tier.maxMiles}</strong> miles</span>
                        <span className="text-sm font-bold text-[#E31837]">£{tier.fee.toFixed(2)}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteTier(idx)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

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
