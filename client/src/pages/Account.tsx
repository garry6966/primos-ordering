import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import { User, Package, Stamp, Clock, Truck, Store } from "lucide-react";

export default function Account() {
  const [email, setEmail] = useState("");
  const [searched, setSearched] = useState(false);

  const { data: orders, isLoading: ordersLoading } = trpc.orders.getByEmail.useQuery(
    { email },
    { enabled: searched && email.includes("@") }
  );

  const { data: loyalty, isLoading: loyaltyLoading } = trpc.loyalty.check.useQuery(
    { email },
    { enabled: searched && email.includes("@") }
  );

  const isLoading = ordersLoading || loyaltyLoading;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.includes("@")) {
      setSearched(true);
    }
  };

  const STATUS_COLORS: Record<string, string> = {
    new: "bg-blue-100 text-blue-800",
    preparing: "bg-yellow-100 text-yellow-800",
    ready: "bg-green-100 text-green-800",
    delivered: "bg-gray-100 text-gray-800",
    collected: "bg-gray-100 text-gray-800",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container py-8 px-4">
        <div className="max-w-lg mx-auto">
          {/* Hero */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-[#E31837]" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">My Account</h1>
            <p className="text-gray-600">
              View your order history and loyalty stamps
            </p>
          </div>

          {/* Email lookup */}
          {!searched && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter the email you order with"
                    required
                    className="bg-gray-50"
                    autoFocus
                  />
                  <p className="text-xs text-gray-400 mt-1.5">
                    No password needed — just enter the email you use when ordering.
                  </p>
                </div>
                <Button
                  type="submit"
                  disabled={!email.includes("@")}
                  className="w-full bg-[#E31837] hover:bg-[#c01530] text-white font-bold py-5"
                >
                  View My Account
                </Button>
              </form>
            </div>
          )}

          {/* Account details */}
          {searched && (
            <div className="space-y-6">
              {/* Loyalty summary */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Stamp className="w-5 h-5 text-[#E31837]" />
                  <h2 className="font-bold text-gray-900">Loyalty Stamps</h2>
                </div>
                {loyaltyLoading ? (
                  <div className="animate-pulse h-12 bg-gray-100 rounded-lg" />
                ) : loyalty ? (
                  <div>
                    <div className="flex justify-center gap-1.5 mb-3 flex-wrap">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                            i < loyalty.stamps
                              ? "bg-[#E31837] border-[#E31837] text-white"
                              : "bg-gray-50 border-gray-200 text-gray-300"
                          }`}
                        >
                          <Stamp className="w-3.5 h-3.5" />
                        </div>
                      ))}
                    </div>
                    <p className="text-center text-lg font-bold text-gray-900">
                      {loyalty.stamps}/10 stamps
                    </p>
                    {loyalty.canRedeem && (
                      <p className="text-center text-sm text-green-600 font-medium mt-1">
                        🎉 You can redeem £10 off your next order!
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No stamps yet. Order over £30 to start collecting!</p>
                )}
              </div>

              {/* Order history */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Package className="w-5 h-5 text-[#E31837]" />
                  <h2 className="font-bold text-gray-900">Order History</h2>
                </div>
                {ordersLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="animate-pulse h-16 bg-gray-100 rounded-lg" />
                    ))}
                  </div>
                ) : orders && orders.length > 0 ? (
                  <div className="space-y-3">
                    {orders.map((order: any) => (
                      <div key={order.id} className="border border-gray-100 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono font-bold text-sm text-gray-900">{order.orderNumber}</span>
                          <Badge className={`${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-800"} text-xs`}>
                            {order.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(order.createdAt).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                          <span className="flex items-center gap-1">
                            {order.orderType === "delivery" ? <Truck className="w-3 h-3" /> : <Store className="w-3 h-3" />}
                            {order.orderType === "delivery" ? "Delivery" : "Collection"}
                          </span>
                          <span className="ml-auto font-semibold text-gray-900">
                            £{parseFloat(order.total).toFixed(2)}
                          </span>
                        </div>
                        {/* Items summary */}
                        <div className="mt-2 text-xs text-gray-500">
                          {(order.items as any[]).map((item: any, idx: number) => (
                            <span key={idx}>
                              {idx > 0 && ", "}
                              {item.quantity}x {item.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No orders found for this email.</p>
                )}
              </div>

              {/* Change email button */}
              <div className="text-center">
                <button
                  onClick={() => { setSearched(false); setEmail(""); }}
                  className="text-sm text-[#E31837] hover:underline font-medium"
                >
                  Use a different email
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
