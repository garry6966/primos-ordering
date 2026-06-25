import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Header from "@/components/Header";
import { Stamp, Gift, ArrowRight } from "lucide-react";

export default function Loyalty() {
  const [email, setEmail] = useState("");
  const [searched, setSearched] = useState(false);

  const { data: loyalty, isLoading, refetch } = trpc.loyalty.check.useQuery(
    { email },
    { enabled: searched && email.includes("@") }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.includes("@")) {
      setSearched(true);
      refetch();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container py-8 px-4">
        <div className="max-w-lg mx-auto">
          {/* Hero */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Stamp className="w-8 h-8 text-[#E31837]" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Loyalty Stamps</h1>
            <p className="text-gray-600 max-w-sm mx-auto">
              Earn stamps when you spend £30 or more (after discounts, excluding delivery). Collect 10 stamps and get <strong>£10 off</strong> your next order!
            </p>
          </div>

          {/* How it works */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="font-bold text-gray-900 mb-4">How It Works</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-[#E31837]">1</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Order over £30</p>
                  <p className="text-xs text-gray-500">Spend £30+ after discounts (excluding delivery)</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-[#E31837]">2</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Earn a stamp</p>
                  <p className="text-xs text-gray-500">Provide your email at checkout to collect stamps</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-[#E31837]">3</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Redeem at 10 stamps</p>
                  <p className="text-xs text-gray-500">Get £10 off automatically at checkout</p>
                </div>
              </div>
            </div>
          </div>

          {/* Check stamps form */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-bold text-gray-900 mb-4">Check Your Stamps</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email Address
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setSearched(false); }}
                  placeholder="Enter the email you order with"
                  required
                  className="bg-gray-50"
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading || !email.includes("@")}
                className="w-full bg-[#E31837] hover:bg-[#c01530] text-white font-bold py-5"
              >
                {isLoading ? "Checking..." : "Check My Stamps"}
              </Button>
            </form>

            {/* Results */}
            {searched && loyalty && (
              <div className="mt-6 pt-6 border-t border-gray-100">
                <div className="text-center">
                  {/* Stamp progress */}
                  <div className="flex justify-center gap-1.5 mb-4 flex-wrap">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                          i < loyalty.stamps
                            ? "bg-[#E31837] border-[#E31837] text-white"
                            : "bg-gray-50 border-gray-200 text-gray-300"
                        }`}
                      >
                        <Stamp className="w-4 h-4" />
                      </div>
                    ))}
                  </div>

                  <p className="text-2xl font-bold text-gray-900">
                    {loyalty.stamps}/10 stamps
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Total stamps earned: {loyalty.totalStampsEarned}
                  </p>

                  {loyalty.canRedeem ? (
                    <div className="mt-4 p-4 bg-green-50 rounded-xl border border-green-200">
                      <div className="flex items-center justify-center gap-2 text-green-700 font-bold">
                        <Gift className="w-5 h-5" />
                        <span>You can redeem £10 off!</span>
                      </div>
                      <p className="text-xs text-green-600 mt-1">
                        Your discount will be applied automatically at checkout.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 mt-3">
                      {loyalty.stamps === 0
                        ? "Start collecting stamps by spending £30+ (after discounts)!"
                        : `${10 - loyalty.stamps} more stamp${10 - loyalty.stamps === 1 ? "" : "s"} until your £10 reward!`}
                    </p>
                  )}
                </div>
              </div>
            )}

            {searched && loyalty && loyalty.stamps === 0 && loyalty.totalStampsEarned === 0 && (
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-500">No stamps found for this email yet.</p>
                <p className="text-xs text-gray-400 mt-1">Make sure you use the same email when ordering.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
