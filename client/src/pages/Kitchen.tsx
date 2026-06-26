import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";

export default function Kitchen() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const loginMutation = trpc.kitchen.login.useMutation();
  const { data: orders, refetch, isError: ordersError } = trpc.orders.list.useQuery(undefined, {
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
        {error && <p style={{ color: "red" }}>{String(error)}</p>}
      </div>
    );
  }

  return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      <h1>Kitchen Dashboard - Authenticated</h1>
      <p>Orders loaded: {orders ? String(orders.length) : "loading..."}</p>
      <p>Reviews: {pendingReviews ? String(pendingReviews.length) : "loading..."}</p>
      <p>Menu items: {allMenuItems ? String(allMenuItems.length) : "loading..."}</p>
      <p>Offers: {offersList ? String(offersList.length) : "loading..."}</p>
      <p>If you see this with data counts, the hooks and data are fine.</p>
      <p>The crash is in the JSX rendering of the full dashboard.</p>
    </div>
  );
}
