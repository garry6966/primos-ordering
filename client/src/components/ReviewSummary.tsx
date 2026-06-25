import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

/* ─── Partial-star SVG renderer ─── */
function StarIcon({ fill = 1, size = 28 }: { fill?: number; size?: number }) {
  const id = `star-grad-${Math.random().toString(36).slice(2, 7)}`;
  const pct = Math.max(0, Math.min(1, fill)) * 100;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset={`${pct}%`} stopColor="#FACC15" />
          <stop offset={`${pct}%`} stopColor="#D1D5DB" />
        </linearGradient>
      </defs>
      <polygon
        points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
        fill={`url(#${id})`}
        stroke="#FACC15"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── Row of 5 stars with partial fill ─── */
function StarRow({ rating, size = 28 }: { rating: number; size?: number }) {
  return (
    <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon key={n} fill={Math.max(0, Math.min(1, rating - (n - 1)))} size={size} />
      ))}
    </div>
  );
}

/* ─── Main component ─── */
export default function ReviewSummary() {
  const { data: reviews, isLoading } = trpc.reviews.listAllApproved.useQuery();

  /* ── Skeleton while loading ── */
  if (isLoading) {
    return (
      <section className="rs-section" aria-label="Customer ratings summary">
        <style>{CSS}</style>
        <div className="rs-inner">
          <div className="rs-skeleton" />
        </div>
      </section>
    );
  }

  /* ── No reviews yet ── */
  if (!reviews || reviews.length === 0) {
    return (
      <section className="rs-section" aria-label="Customer ratings summary">
        <style>{CSS}</style>
        <div className="rs-inner">
          <div className="rs-empty">
            <span className="rs-empty-icon" aria-hidden="true">⭐</span>
            <p className="rs-empty-title">No reviews yet — be the first!</p>
            <p className="rs-empty-sub">Tried our food? Let us know what you think.</p>
            <Link href="/reviews" className="rs-cta">Leave a Review</Link>
          </div>
        </div>
      </section>
    );
  }

  /* ── Compute stats ── */
  const total = reviews.length;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  const avg = sum / total;
  const avgDisplay = avg.toFixed(1);

  const breakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach((r) => {
    const star = Math.round(r.rating) as 1 | 2 | 3 | 4 | 5;
    if (star >= 1 && star <= 5) breakdown[star]++;
  });

  const pct = (count: number) =>
    total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <section className="rs-section hp-reveal" aria-label="Customer ratings summary">
      <style>{CSS}</style>
      <div className="rs-inner">
        {/* Header */}
        <div className="rs-header hp-reveal">
          <span className="hp-section-eyebrow">Customer Ratings</span>
          <h2 className="hp-section-title" style={{ color: "var(--hp-black)" }}>
            WHAT OUR<br />CUSTOMERS SAY.
          </h2>
        </div>

        {/* Card */}
        <div className="rs-card hp-reveal hp-reveal-d1">
          {/* Left: big score */}
          <div className="rs-score-block">
            <div className="rs-big-number" aria-label={`Average rating ${avgDisplay} out of 5`}>
              {avgDisplay}
            </div>
            <StarRow rating={avg} size={30} />
            <p className="rs-review-count">
              Based on <strong>{total}</strong> {total === 1 ? "review" : "reviews"}
            </p>
            <Link href="/reviews" className="rs-cta rs-cta-inline">
              Leave a Review
            </Link>
          </div>

          {/* Divider */}
          <div className="rs-divider" aria-hidden="true" />

          {/* Right: breakdown bars */}
          <div className="rs-breakdown" role="list" aria-label="Star rating breakdown">
            {([5, 4, 3, 2, 1] as const).map((star) => {
              const count = breakdown[star];
              const percent = pct(count);
              return (
                <div
                  key={star}
                  className="rs-bar-row"
                  role="listitem"
                  aria-label={`${star} star: ${count} review${count !== 1 ? "s" : ""}, ${percent}%`}
                >
                  {/* Star label */}
                  <div className="rs-bar-label">
                    <span className="rs-bar-star-num">{star}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
                      <polygon
                        points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
                        fill="#FACC15"
                        stroke="#FACC15"
                        strokeWidth="0.5"
                      />
                    </svg>
                  </div>

                  {/* Bar track */}
                  <div className="rs-bar-track" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                    <div
                      className="rs-bar-fill"
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  {/* Count */}
                  <span className="rs-bar-count">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Scoped CSS ─── */
const CSS = `
  .rs-section {
    background: var(--hp-off-white);
    padding: 5rem 5vw;
  }
  .rs-inner {
    max-width: 900px;
    margin: 0 auto;
  }
  .rs-header {
    margin-bottom: 2.5rem;
  }
  .rs-card {
    display: flex;
    align-items: stretch;
    gap: 0;
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.07);
    border: 1px solid #eee;
    overflow: hidden;
  }

  /* ── Score block ── */
  .rs-score-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2.5rem 3rem;
    gap: 0.75rem;
    min-width: 220px;
    background: var(--hp-black);
    flex-shrink: 0;
  }
  .rs-big-number {
    font-family: var(--hp-fd);
    font-weight: 900;
    font-style: italic;
    font-size: clamp(4rem, 8vw, 6rem);
    color: #fff;
    line-height: 1;
    letter-spacing: -0.02em;
  }
  .rs-review-count {
    font-size: 0.85rem;
    color: rgba(255,255,255,0.5);
    text-align: center;
    margin: 0;
    line-height: 1.4;
  }
  .rs-review-count strong {
    color: rgba(255,255,255,0.85);
    font-weight: 700;
  }

  /* ── CTA button ── */
  .rs-cta {
    display: inline-block;
    background: var(--hp-red, #E31837);
    color: #fff;
    font-family: var(--hp-fd);
    font-weight: 900;
    font-style: italic;
    font-size: 0.9rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    text-decoration: none;
    padding: 0.65rem 1.5rem;
    transition: background 0.2s, transform 0.15s;
    clip-path: polygon(5px 0%, 100% 0%, calc(100% - 5px) 100%, 0% 100%);
    margin-top: 0.25rem;
    white-space: nowrap;
  }
  .rs-cta:hover {
    background: var(--hp-red-dark, #B8000A);
    transform: translateY(-1px);
  }

  /* ── Divider ── */
  .rs-divider {
    width: 1px;
    background: #eee;
    flex-shrink: 0;
  }

  /* ── Breakdown ── */
  .rs-breakdown {
    flex: 1;
    padding: 2.5rem 2.5rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.85rem;
  }
  .rs-bar-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .rs-bar-label {
    display: flex;
    align-items: center;
    gap: 3px;
    min-width: 36px;
    flex-shrink: 0;
  }
  .rs-bar-star-num {
    font-family: var(--hp-fd);
    font-weight: 700;
    font-size: 0.9rem;
    color: var(--hp-black);
    line-height: 1;
  }
  .rs-bar-track {
    flex: 1;
    height: 10px;
    background: #f0f0f0;
    border-radius: 999px;
    overflow: hidden;
  }
  .rs-bar-fill {
    height: 100%;
    background: var(--hp-red, #E31837);
    border-radius: 999px;
    transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
    min-width: 0;
  }
  .rs-bar-count {
    font-family: var(--hp-fd);
    font-weight: 700;
    font-size: 0.85rem;
    color: var(--hp-grey, #888);
    min-width: 24px;
    text-align: right;
    flex-shrink: 0;
  }

  /* ── Empty state ── */
  .rs-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
    background: #fff;
    border-radius: 16px;
    border: 1px solid #eee;
    box-shadow: 0 4px 24px rgba(0,0,0,0.05);
  }
  .rs-empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    display: block;
  }
  .rs-empty-title {
    font-family: var(--hp-fd);
    font-weight: 800;
    font-style: italic;
    font-size: 1.6rem;
    text-transform: uppercase;
    color: var(--hp-black);
    margin: 0 0 0.5rem;
    line-height: 1.1;
  }
  .rs-empty-sub {
    font-size: 0.95rem;
    color: var(--hp-grey, #888);
    margin: 0 0 1.5rem;
  }

  /* ── Skeleton ── */
  .rs-skeleton {
    height: 200px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: rs-shimmer 1.5s infinite;
    border-radius: 16px;
  }
  @keyframes rs-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* ── Responsive ── */
  @media (max-width: 640px) {
    .rs-section { padding: 3.5rem 5vw; }
    .rs-card {
      flex-direction: column;
    }
    .rs-score-block {
      padding: 2rem 1.5rem;
      min-width: unset;
      border-radius: 0;
    }
    .rs-divider {
      width: 100%;
      height: 1px;
    }
    .rs-breakdown {
      padding: 1.75rem 1.5rem;
    }
    .rs-cta-inline {
      display: none;
    }
  }
`;
