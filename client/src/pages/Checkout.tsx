import { useState, useEffect, useRef } from "react";
import { useCart } from "@/contexts/CartContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Header from "@/components/Header";
import CartDrawer from "@/components/CartDrawer";
import ClosedBanner, { useIsOpen } from "@/components/ClosedBanner";
import { useLocation } from "wouter";
import { ArrowLeft, Truck, Store, Minus, Plus, Trash2, Stamp, Gift, Tag, MapPin, Loader2, AlertCircle, CreditCard, Banknote } from "lucide-react";
import { toast } from "sonner";

export default function Checkout() {
  const { items, subtotal, clearCart, removeItem, updateQuantity } = useCart();
  const [, navigate] = useLocation();
  const [cartOpen, setCartOpen] = useState(false);
  const isOpen = useIsOpen();

  const [orderType, setOrderType] = useState<"delivery" | "collection">("delivery");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [redeemStamps, setRedeemStamps] = useState(false);
  const [loyaltyChecked, setLoyaltyChecked] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash">("card");

  // Delivery auto-detection state
  const [deliveryCalcLoading, setDeliveryCalcLoading] = useState(false);
  const [deliveryCalcResult, setDeliveryCalcResult] = useState<{
    distance: number;
    fee: number;
    withinRadius: boolean;
    freeDeliveryThreshold: number;
  } | null>(null);
  const [deliveryCalcError, setDeliveryCalcError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Active offer query
  const { data: activeOffer } = trpc.offers.getActive.useQuery();

  // Loyalty stamps check
  const { data: loyalty, refetch: refetchLoyalty } = trpc.loyalty.check.useQuery(
    { email },
    { enabled: loyaltyChecked && email.includes("@") }
  );

  // Check loyalty when email changes (debounced)
  useEffect(() => {
    if (email.includes("@")) {
      const timer = setTimeout(() => {
        setLoyaltyChecked(true);
        refetchLoyalty();
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setLoyaltyChecked(false);
      setRedeemStamps(false);
    }
  }, [email]);

  // Auto-detect delivery fee when address changes (debounced 1 second)
  useEffect(() => {
    if (orderType !== "delivery") return;
    if (!address.trim() || address.trim().length < 5) {
      setDeliveryCalcResult(null);
      setDeliveryCalcError(null);
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      setDeliveryCalcLoading(true);
      setDeliveryCalcError(null);
      setDeliveryCalcResult(null);

      try {
        const response = await fetch("/api/delivery/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: address.trim() }),
        });
        const data = await response.json();

        if (!response.ok) {
          setDeliveryCalcError(data.error || "Failed to calculate delivery fee");
        } else {
          setDeliveryCalcResult(data);
          if (!data.withinRadius) {
            setDeliveryCalcError("Sorry, we don't deliver to your area");
          }
        }
      } catch (err: any) {
        setDeliveryCalcError("Failed to calculate delivery fee. Please try again.");
      } finally {
        setDeliveryCalcLoading(false);
      }
    }, 1000);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [address, orderType]);

  // Delivery fee calculation
  let deliveryFee = 0;
  if (orderType === "delivery" && deliveryCalcResult) {
    if (deliveryCalcResult.withinRadius) {
      if (subtotal >= deliveryCalcResult.freeDeliveryThreshold) {
        deliveryFee = 0;
      } else {
        deliveryFee = deliveryCalcResult.fee;
      }
    }
  }

  const loyaltyDiscount = redeemStamps && loyalty?.canRedeem ? 10 : 0;
  const offerDiscount = activeOffer ? subtotal * (activeOffer.discountPercent / 100) : 0;
  const offerDiscountRounded = Math.round(offerDiscount * 100) / 100;
  const total = Math.max(0, subtotal + deliveryFee - loyaltyDiscount - offerDiscountRounded);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isOpen) {
      toast.error("Sorry, we're currently closed. We open daily from 12pm – 10pm.");
      return;
    }

    if (items.length === 0) {
      toast.error("Your basket is empty!");
      return;
    }

    if (!name.trim() || !phone.trim()) {
      toast.error("Please fill in your name and phone number.");
      return;
    }

    if (orderType === "delivery" && !address.trim()) {
      toast.error("Please enter your delivery address.");
      return;
    }

    if (orderType === "delivery" && !deliveryCalcResult) {
      toast.error("Please wait for delivery fee calculation to complete.");
      return;
    }

    if (orderType === "delivery" && deliveryCalcResult && !deliveryCalcResult.withinRadius) {
      toast.error("Sorry, we don't deliver to your area. Please choose collection instead.");
      return;
    }

    setSubmitting(true);
    try {
      const orderPayload = {
        customerName: name.trim(),
        customerPhone: phone.trim(),
        customerEmail: email.trim() || undefined,
        orderType,
        deliveryAddress: orderType === "delivery" ? address.trim() : undefined,
        deliveryFee,
        subtotal,
        total,
        items: items.map(item => ({
          menuItemId: item.menuItemId,
          name: item.name,
          basePrice: item.basePrice,
          quantity: item.quantity,
          toppings: item.toppings?.map(t => ({ name: t.name, price: t.price })),
          mealDeal: item.mealDeal || null,
          mealDealPrice: item.mealDealPrice,
          totalPrice: item.totalPrice,
        })),
        notes: notes.trim() || undefined,
        redeemStamps: redeemStamps && loyalty?.canRedeem ? true : false,
        discountPercent: activeOffer?.discountPercent || 0,
        discountAmount: offerDiscountRounded,
      };

      if (paymentMethod === "cash") {
        // Cash order — submit directly, no Stripe
        const response = await fetch("/api/orders/cash", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderPayload),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to place order");
        }

        clearCart();
        navigate(`/confirmation/${data.orderNumber}`);
      } else {
        // Card order — redirect to Stripe Checkout (existing flow)
        const response = await fetch("/api/stripe/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderPayload),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to create payment session");
        }

        clearCart();
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to proceed to payment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <ClosedBanner />
      <Header onCartClick={() => setCartOpen(true)} />

      <div className="container py-6 max-w-2xl">
        <button
          onClick={() => navigate("/menu")}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to menu
        </button>

        <h1 className="text-2xl font-bold mb-6">Checkout</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Order Type Toggle */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h2 className="font-semibold mb-3">Order Type</h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOrderType("delivery")}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 font-medium transition-all ${
                  orderType === "delivery"
                    ? "border-[#E31837] bg-red-50 text-[#E31837]"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                <Truck className="w-5 h-5" />
                Delivery
              </button>
              <button
                type="button"
                onClick={() => setOrderType("collection")}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 font-medium transition-all ${
                  orderType === "collection"
                    ? "border-[#E31837] bg-red-50 text-[#E31837]"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                <Store className="w-5 h-5" />
                Collection
              </button>
            </div>
          </div>

          {/* Customer Details */}
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
            <h2 className="font-semibold">Your Details</h2>
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your full name"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="07xxx xxxxxx"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="email">Email (for loyalty stamps & order updates)</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="mt-1"
              />
              <p className="text-xs text-gray-400 mt-1">Provide your email to earn loyalty stamps on orders over £30</p>
            </div>

            {/* Loyalty stamps display */}
            {loyaltyChecked && loyalty && loyalty.stamps > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Stamp className="w-4 h-4 text-amber-700" />
                  <span className="text-sm font-semibold text-amber-900">
                    You have {loyalty.stamps}/10 loyalty stamps!
                  </span>
                </div>
                {loyalty.canRedeem && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={redeemStamps}
                      onChange={e => setRedeemStamps(e.target.checked)}
                      className="w-4 h-4 rounded border-amber-300 text-[#E31837] focus:ring-[#E31837]"
                    />
                    <span className="text-sm text-amber-800 font-medium flex items-center gap-1">
                      <Gift className="w-3.5 h-3.5" />
                      Redeem 10 stamps for £10 off this order
                    </span>
                  </label>
                )}
                {!loyalty.canRedeem && (
                  <p className="text-xs text-amber-700">
                    {10 - loyalty.stamps} more stamp{10 - loyalty.stamps === 1 ? "" : "s"} until your £10 reward!
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Delivery Address */}
          {orderType === "delivery" && (
            <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
              <h2 className="font-semibold">Delivery Address</h2>
              <div>
                <Textarea
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Enter your full delivery address including postcode"
                  required
                  className="mt-1"
                  rows={3}
                />
              </div>

              {/* Delivery fee auto-detection result */}
              {deliveryCalcLoading && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                  <span className="text-sm text-blue-700">Calculating delivery fee...</span>
                </div>
              )}

              {!deliveryCalcLoading && deliveryCalcError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span className="text-sm text-red-700 font-medium">{deliveryCalcError}</span>
                </div>
              )}

              {!deliveryCalcLoading && deliveryCalcResult && deliveryCalcResult.withinRadius && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-800 font-medium">
                      {deliveryCalcResult.distance.toFixed(1)} miles from restaurant —{" "}
                      {subtotal >= deliveryCalcResult.freeDeliveryThreshold ? (
                        <span className="text-green-600 font-bold">FREE delivery!</span>
                      ) : (
                        <>Delivery fee: <span className="font-bold">£{deliveryCalcResult.fee.toFixed(2)}</span></>
                      )}
                    </span>
                  </div>
                  {subtotal < deliveryCalcResult.freeDeliveryThreshold && (
                    <p className="text-xs text-green-600 mt-1 ml-6">
                      Free delivery on orders over £{deliveryCalcResult.freeDeliveryThreshold.toFixed(0)}!
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Order Notes */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h2 className="font-semibold mb-2">Order Notes (optional)</h2>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any special instructions..."
              rows={2}
            />
          </div>

          {/* Order Summary */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h2 className="font-semibold mb-3">Order Summary</h2>
            <div className="space-y-2">
              {items.map(item => (
                <div key={item.id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{item.name}</span>
                      {item.toppings && item.toppings.length > 0 && (
                        <span className="text-xs text-gray-400">
                          (+{item.toppings.length} toppings)
                        </span>
                      )}
                    </div>
                    {item.mealDeal && (
                      <span className="text-xs text-[#E31837]">
                        {item.mealDeal === "chips_drink" ? "Meal Deal" : "Premium Meal Deal"}
                      </span>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-medium">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="ml-2 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <span className="text-sm font-bold">
                    £{(item.totalPrice * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t mt-3 pt-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>£{subtotal.toFixed(2)}</span>
              </div>
              {orderType === "delivery" && (
                <div className="flex justify-between text-sm">
                  <span>Delivery fee</span>
                  <span className={deliveryFee === 0 ? "text-green-600 font-medium" : ""}>
                    {deliveryCalcLoading ? "..." : deliveryFee === 0 ? "FREE" : `£${deliveryFee.toFixed(2)}`}
                  </span>
                </div>
              )}
              {offerDiscountRounded > 0 && (
                <div className="flex justify-between text-sm text-[#E31837] font-medium">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5" />
                    {activeOffer?.name} ({activeOffer?.discountPercent}% off)
                  </span>
                  <span>-£{offerDiscountRounded.toFixed(2)}</span>
                </div>
              )}
              {loyaltyDiscount > 0 && (
                <div className="flex justify-between text-sm text-green-600 font-medium">
                  <span className="flex items-center gap-1">
                    <Gift className="w-3.5 h-3.5" />
                    Loyalty reward
                  </span>
                  <span>-£{loyaltyDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>Total</span>
                <span>£{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Loyalty info for non-email users */}
          {!email && (total - deliveryFee) >= 30 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <Stamp className="w-5 h-5 text-amber-700 mx-auto mb-1" />
              <p className="text-sm text-amber-800 font-medium">
                Add your email above to earn a loyalty stamp on this order!
              </p>
              <p className="text-xs text-amber-600 mt-0.5">10 stamps = £10 off</p>
            </div>
          )}

          {/* Payment Method Selector */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h2 className="font-semibold mb-3">Payment Method</h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod("card")}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 font-medium transition-all ${
                  paymentMethod === "card"
                    ? "border-[#E31837] bg-red-50 text-[#E31837]"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                <CreditCard className="w-5 h-5" />
                Pay by Card
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("cash")}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 font-medium transition-all ${
                  paymentMethod === "cash"
                    ? "border-[#E31837] bg-red-50 text-[#E31837]"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                <Banknote className="w-5 h-5" />
                Pay Cash
              </button>
            </div>
            {paymentMethod === "cash" && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                Please have the exact amount ready. Payment will be collected on {orderType === "delivery" ? "delivery" : "collection"}.
              </p>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={submitting || items.length === 0 || (orderType === "delivery" && (!deliveryCalcResult || !deliveryCalcResult.withinRadius))}
            className="w-full bg-[#E31837] hover:bg-[#c01530] text-white font-bold py-6 text-base rounded-xl shadow-lg disabled:opacity-50"
          >
            {submitting
              ? (paymentMethod === "cash" ? "Placing order..." : "Redirecting to payment...")
              : (paymentMethod === "cash" ? `Place Order — £${total.toFixed(2)}` : `Pay Now — £${total.toFixed(2)}`)}
          </Button>
        </form>
      </div>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
