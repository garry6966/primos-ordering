import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { CheckCircle, Clock, MapPin, Phone, Truck, Store, Stamp, CreditCard, XCircle, Loader2 } from "lucide-react";
import Header from "@/components/Header";

export default function Confirmation() {
  const params = useParams<{ orderNumber: string }>();
  const [, navigate] = useLocation();

  // Fetch the order details (refetch periodically in case webhook hasn't fired yet)
  const { data: orders } = trpc.orders.list.useQuery(undefined, {
    refetchInterval: 3000, // Poll every 3 seconds until payment confirmed
  });
  const order = orders?.find(o => o.orderNumber === params.orderNumber);

  const orderItems = order ? (order.items as any[]) : [];

  // Determine the display state
  const paymentStatus = order ? (order as any).paymentStatus : null;
  const orderStatus = order ? order.status : null;

  const isWaitingForAcceptance = orderStatus === "pending_acceptance" && (paymentStatus === "authorized" || paymentStatus === "pending");
  const isConfirmed = ["new", "preparing", "ready", "delivered", "collected"].includes(orderStatus || "") && paymentStatus === "paid";
  const isRejected = orderStatus === "rejected" && paymentStatus === "cancelled";
  const isPending = paymentStatus === "pending" && orderStatus === "pending_acceptance";

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="container py-8 max-w-lg">
        {/* === WAITING FOR RESTAURANT ACCEPTANCE === */}
        {isWaitingForAcceptance && !isPending && (
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center mb-4">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
            </div>

            <h1 className="text-2xl font-bold mb-2">Order Placed!</h1>
            <p className="text-gray-600 mb-1">Waiting for restaurant to confirm...</p>
            <p className="text-sm font-mono bg-gray-100 inline-block px-3 py-1 rounded-md font-bold">
              {params.orderNumber}
            </p>

            <div className="mt-4 flex items-center justify-center gap-1.5 text-orange-600 text-sm font-medium">
              <Clock className="w-4 h-4" />
              Your card has been authorized — you will only be charged once the restaurant accepts.
            </div>

            {/* Pulsing indicator */}
            <div className="mt-4 flex justify-center">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
              </span>
            </div>
          </div>
        )}

        {/* === ORDER CONFIRMED (payment captured) === */}
        {isConfirmed && (
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>

            <h1 className="text-2xl font-bold mb-2">Order Confirmed!</h1>
            <p className="text-gray-600 mb-1">Thank you for your order</p>
            <p className="text-sm font-mono bg-gray-100 inline-block px-3 py-1 rounded-md font-bold">
              {params.orderNumber}
            </p>

            <div className="mt-3 flex items-center justify-center gap-1.5 text-green-600 text-sm font-medium">
              <CreditCard className="w-4 h-4" />
              Payment confirmed
            </div>
          </div>
        )}

        {/* === ORDER REJECTED (payment cancelled) === */}
        {isRejected && (
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center mb-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>

            <h1 className="text-2xl font-bold mb-2 text-red-700">Order Not Accepted</h1>
            <p className="text-gray-600 mb-1">Sorry, we're unable to accept your order at this moment.</p>
            <p className="text-sm font-mono bg-gray-100 inline-block px-3 py-1 rounded-md font-bold">
              {params.orderNumber}
            </p>

            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 font-medium">
              Your card has NOT been charged. The hold has been released.
            </div>

            <p className="mt-3 text-sm text-gray-500">
              Please try again later or call us on 0131 563 4457.
            </p>
          </div>
        )}

        {/* === STILL PROCESSING (payment pending, webhook not fired yet) === */}
        {isPending && (
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center mb-4">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
            </div>

            <h1 className="text-2xl font-bold mb-2">Processing Payment...</h1>
            <p className="text-gray-600 mb-1">Please wait while we confirm your payment</p>
            <p className="text-sm font-mono bg-gray-100 inline-block px-3 py-1 rounded-md font-bold">
              {params.orderNumber}
            </p>

            <div className="mt-3 flex items-center justify-center gap-1.5 text-amber-600 text-sm font-medium">
              <Clock className="w-4 h-4" />
              Payment processing...
            </div>
          </div>
        )}

        {/* === FALLBACK: old orders with paymentStatus "paid" still pending === */}
        {order && !isWaitingForAcceptance && !isConfirmed && !isRejected && !isPending && (
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>

            <h1 className="text-2xl font-bold mb-2">Order Confirmed!</h1>
            <p className="text-gray-600 mb-1">Thank you for your order</p>
            <p className="text-sm font-mono bg-gray-100 inline-block px-3 py-1 rounded-md font-bold">
              {params.orderNumber}
            </p>

            {paymentStatus === "paid" && (
              <div className="mt-3 flex items-center justify-center gap-1.5 text-green-600 text-sm font-medium">
                <CreditCard className="w-4 h-4" />
                Payment confirmed
              </div>
            )}
          </div>
        )}

        {/* Order Summary */}
        {order && (
          <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
            <h2 className="font-bold mb-3">Order Summary</h2>

            <div className="flex items-center gap-2 mb-3 text-sm">
              {order.orderType === "delivery" ? (
                <span className="flex items-center gap-1 text-[#E31837] font-medium">
                  <Truck className="w-4 h-4" /> Delivery
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[#E31837] font-medium">
                  <Store className="w-4 h-4" /> Collection
                </span>
              )}
            </div>

            <div className="space-y-2 border-t pt-3">
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
                        {item.mealDeal === "chips_drink" ? "Meal Deal (Chips + Drink)" : "Meal Deal (Chips + Milkshake)"}
                      </p>
                    )}
                  </div>
                  <span className="text-gray-600 font-medium">
                    £{(item.totalPrice * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t mt-3 pt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>£{parseFloat(order.subtotal).toFixed(2)}</span>
              </div>
              {order.orderType === "delivery" && parseFloat(order.deliveryFee) > 0 && (
                <div className="flex justify-between">
                  <span>Delivery fee</span>
                  <span>£{parseFloat(order.deliveryFee).toFixed(2)}</span>
                </div>
              )}
              {order.orderType === "delivery" && parseFloat(order.deliveryFee) === 0 && (
                <div className="flex justify-between">
                  <span>Delivery fee</span>
                  <span className="text-green-600 font-medium">FREE</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-1 border-t">
                <span>Total</span>
                <span>£{parseFloat(order.total).toFixed(2)}</span>
              </div>
            </div>

            {/* Customer Details */}
            <div className="border-t mt-4 pt-3 text-sm text-gray-600 space-y-1">
              <p><strong>Name:</strong> {order.customerName}</p>
              <p><strong>Phone:</strong> {order.customerPhone}</p>
              {order.customerEmail && <p><strong>Email:</strong> {order.customerEmail}</p>}
              {order.deliveryAddress && <p><strong>Address:</strong> {order.deliveryAddress}</p>}
            </div>
          </div>
        )}

        {/* Loyalty Stamp Earned — only show when payment is confirmed */}
        {order && isConfirmed && order.customerEmail && (parseFloat(order.subtotal) - parseFloat(order.discountAmount || "0")) >= 30 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Stamp className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <p className="font-semibold text-sm text-amber-900">Loyalty Stamp Earned!</p>
              <p className="text-xs text-amber-700">You earned a stamp on this order. Collect 10 for £10 off!</p>
            </div>
          </div>
        )}

        {/* Info Cards — hide if rejected */}
        {!isRejected && (
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4 mt-4">
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Clock className="w-5 h-5 text-[#E31837] mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Estimated Time</p>
                <p className="text-sm text-gray-600">
                  {order?.orderType === "delivery" ? "35 – 50 minutes" : "20 – 30 minutes"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <MapPin className="w-5 h-5 text-[#E31837] mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Restaurant</p>
                <p className="text-sm text-gray-600">6 Groathill Road North, Edinburgh EH4 2SW</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Phone className="w-5 h-5 text-[#E31837] mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Questions?</p>
                <p className="text-sm text-gray-600">Call us on 0131 563 4457</p>
              </div>
            </div>
          </div>
        )}

        <Button
          onClick={() => navigate("/")}
          className="w-full mt-6 bg-[#E31837] hover:bg-[#c01530] text-white font-bold py-5 rounded-xl"
        >
          Back to Home
        </Button>
      </div>
    </div>
  );
}
