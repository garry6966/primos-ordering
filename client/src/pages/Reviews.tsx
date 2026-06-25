import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Header from "@/components/Header";
import { Link, useSearch } from "wouter";
import { Star, Send, CheckCircle, MessageSquare } from "lucide-react";
import { toast } from "sonner";

function StarRating({ rating, onRate, size = "lg" }: { rating: number; onRate: (r: number) => void; size?: "sm" | "lg" }) {
  const [hover, setHover] = useState(0);
  const sizeClass = size === "lg" ? "w-10 h-10" : "w-5 h-5";

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onRate(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="transition-transform hover:scale-110 active:scale-95"
        >
          <Star
            className={`${sizeClass} transition-colors ${
              star <= (hover || rating)
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function DisplayStars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${
            star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

export default function Reviews() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const prefillOrder = params.get("order") || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [orderNumber, setOrderNumber] = useState(prefillOrder);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: approvedReviews } = trpc.reviews.list.useQuery();

  const submitReview = trpc.reviews.submit.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Thank you for your review!");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to submit review");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error("Please select a star rating");
      return;
    }
    if (comment.length < 5) {
      toast.error("Please write at least a short comment");
      return;
    }
    submitReview.mutate({
      customerName: name,
      customerEmail: email || "",
      orderNumber: orderNumber || "",
      rating,
      comment,
    });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container py-12">
          <div className="max-w-md mx-auto text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h1>
            <p className="text-gray-600 mb-6">
              Your review has been submitted and will appear on our site once approved. We really appreciate your feedback!
            </p>
            <Link href="/">
              <Button className="bg-[#E31837] hover:bg-[#c01530] text-white font-bold">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Reviews</h1>
            <p className="text-gray-600">
              See what our customers say, or leave your own review!
            </p>
          </div>

          {/* Approved Reviews Section */}
          {approvedReviews && approvedReviews.length > 0 && (
            <div className="mb-10">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#E31837]" />
                Customer Reviews
              </h2>
              <div className="space-y-4">
                {approvedReviews.map((review) => (
                  <div key={review.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <DisplayStars rating={review.rating} />
                      <span className="text-xs text-gray-400">
                        {new Date(review.createdAt).toLocaleDateString("en-GB")}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">"{review.comment}"</p>
                    <p className="text-xs font-medium text-gray-500">— {review.customerName}</p>

                    {/* Restaurant reply */}
                    {review.reply && (
                      <div className="mt-3 ml-4 pl-3 border-l-2 border-[#E31837]/30 bg-red-50/50 rounded-r-lg p-3">
                        <p className="text-xs font-semibold text-[#E31837] mb-1">Primos Restaurant replied:</p>
                        <p className="text-sm text-gray-700">{review.reply}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Review Submission Form */}
          <div className="max-w-lg mx-auto">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-1">Leave a Review</h2>
              <p className="text-sm text-gray-600">
                Tell us about your experience at Primo's. Your feedback helps us improve!
              </p>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
              {/* Star Rating */}
              <div className="text-center">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  How would you rate your experience?
                </label>
                <div className="flex justify-center">
                  <StarRating rating={rating} onRate={setRating} />
                </div>
                {rating > 0 && (
                  <p className="text-sm text-gray-500 mt-2">
                    {rating === 5 && "Amazing! 🎉"}
                    {rating === 4 && "Great! 😊"}
                    {rating === 3 && "Good 👍"}
                    {rating === 2 && "Could be better 😐"}
                    {rating === 1 && "Sorry to hear that 😔"}
                  </p>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  First Name *
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your first name"
                  required
                  className="bg-gray-50"
                />
              </div>

              {/* Email (optional) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Email <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="bg-gray-50"
                />
              </div>

              {/* Order Number (optional) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Order Number <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <Input
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="PRM-XXXXXX"
                  className="bg-gray-50"
                />
              </div>

              {/* Comment */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Your Review *
                </label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tell us what you thought about your order..."
                  rows={4}
                  required
                  minLength={5}
                  maxLength={1000}
                  className="bg-gray-50 resize-none"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{comment.length}/1000</p>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={submitReview.isPending || rating === 0 || !name || comment.length < 5}
                className="w-full bg-[#E31837] hover:bg-[#c01530] text-white font-bold py-5 text-base"
              >
                {submitReview.isPending ? (
                  "Submitting..."
                ) : (
                  <span className="flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Submit Review
                  </span>
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
