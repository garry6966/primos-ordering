import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import ClosedBanner from "@/components/ClosedBanner";
import OpenClosedBadge from "@/components/OpenClosedBadge";
import { trpc } from "@/lib/trpc";
import { Star } from "lucide-react";
import ReviewSummary from "@/components/ReviewSummary";

/* ─── Slide data ─── */
const SLIDES = [
  {
    bgClass: "hp-slide-bg-1",
    eyebrow: "Edinburgh's Finest",
    headlineLines: ["BURGERS", "PIZZA", "LOADED FRIES", "PARMESANS"],
    headlineRed: [false, true, false, true],
    sub: "",
    ctas: [
      { href: "/menu", label: "Order Now", primary: true },
      { href: "#menu", label: "See the Menu", primary: false },
    ],
  },
  {
    bgClass: "hp-slide-bg-2",
    eyebrow: "Signature Burgers",
    headlineLines: ["SMASHED", "TO", "PERFECTION"],
    headlineRed: [false, false, true],
    sub: "",
    ctas: [{ href: "/menu?cat=beef-burgers", label: "View Burgers", primary: true }],
  },
  {
    bgClass: "hp-slide-bg-3",
    eyebrow: "Fresh Pizzas",
    headlineLines: ["FRESH DOUGH", "REAL", "INGREDIENTS"],
    headlineRed: [false, true, false],
    sub: "Hand-stretched pizzas. San Marzano tomatoes. Made fresh on the premises — every single time.",
    ctas: [{ href: "/menu?cat=pizza", label: "View Pizzas", primary: true }],
  },
  {
    bgClass: "hp-slide-bg-4",
    eyebrow: "Desserts & Shakes",
    headlineLines: ["FINISH", "SWEET"],
    headlineRed: [false, true],
    sub: "Lotus Dream. Black Magic. Bueno Vamos. Waffles. Milkcakes. The kind of desserts you don't share.",
    ctas: [{ href: "/menu?cat=desserts", label: "View Desserts", primary: true }],
  },
];

const CATEGORIES = [
  { slug: "beef-burgers", label: "Burgers", bgClass: "hp-cat-bg-burgers" },
  { slug: "pizza", label: "Pizza", bgClass: "hp-cat-bg-pizza" },
  { slug: "parmesans", label: "Parmesans", bgClass: "hp-cat-bg-parmesans" },
  { slug: "kebabs", label: "Kebabs", bgClass: "hp-cat-bg-kebabs" },
  { slug: "loaded-fries", label: "Loaded Fries", bgClass: "hp-cat-bg-fries" },
  { slug: "wraps", label: "Wraps", bgClass: "hp-cat-bg-wraps" },
  { slug: "sides", label: "Sides", bgClass: "hp-cat-bg-sides" },
  { slug: "milkshakes", label: "Milkshakes", bgClass: "hp-cat-bg-shakes" },
  { slug: "desserts", label: "Desserts & Waffles", bgClass: "hp-cat-bg-desserts" },
];

const WHY_CARDS = [
  { icon: "🔥", title: "Fresh Ingredients", text: "No frozen shortcuts. Every burger is smashed fresh, every pizza hand-stretched on the day. Real food, real flavour." },
  { icon: "⚡", title: "Fast Delivery", text: "Hot food at your door — not just warm food. We move fast because cold takeaway is a crime." },
  { icon: "🍕", title: "Made to Order", text: "Nothing sits under a heat lamp here. Your order goes straight from kitchen to you, every time." },
  { icon: "📍", title: "Edinburgh's Own", text: "Rooted in Edinburgh. Built for Edinburgh. This is local street food done with proper pride." },
];

const MARQUEE_ITEMS = ["Burgers","Pizza","Parmesans","Kebabs","Loaded Fries","Milkshakes","Desserts","Waffles","Wraps","Made Fresh Daily"];
const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

function ReviewsSection() {
  const { data: reviews } = trpc.reviews.list.useQuery();
  if (!reviews || reviews.length === 0) return null;

  return (
    <section className="hp-section" style={{ background: "var(--hp-off-white)" }}>
      <div>
        <span className="hp-section-eyebrow hp-reveal">Customer Reviews</span>
        <h2 className="hp-section-title hp-reveal" style={{ color: "var(--hp-black)" }}>WHAT PEOPLE<br />ARE SAYING.</h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.5rem", marginTop: "2.5rem" }}>
        {reviews.slice(0, 6).map((review) => (
          <div key={review.id} className="hp-reveal" style={{ background: "#fff", borderRadius: "12px", padding: "1.5rem", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #eee" }}>
            <div style={{ display: "flex", gap: "2px", marginBottom: "0.75rem" }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} style={{ width: "18px", height: "18px", fill: i < review.rating ? "#facc15" : "#e5e7eb", color: i < review.rating ? "#facc15" : "#e5e7eb" }} />
              ))}
            </div>
            <p style={{ fontSize: "0.95rem", color: "#333", lineHeight: "1.5", marginBottom: "1rem" }}>"{review.comment}"</p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: "var(--hp-fd)", fontWeight: 700, fontStyle: "italic", fontSize: "1rem", color: "var(--hp-black)" }}>{review.customerName}</span>
              <span style={{ fontSize: "0.75rem", color: "var(--hp-grey)" }}>{new Date(review.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ textAlign: "center", marginTop: "2rem" }}>
        <Link href="/reviews" className="hp-btn-dark" style={{ display: "inline-block" }}>Leave a Review</Link>
      </div>
    </section>
  );
}

export default function Home() {
  const [current, setCurrent] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const [, navigate] = useLocation();
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef(0);

  const goTo = (index: number) => setCurrent((index + SLIDES.length) % SLIDES.length);

  const resetAuto = () => {
    if (autoRef.current) clearInterval(autoRef.current);
    autoRef.current = setInterval(() => setCurrent(c => (c + 1) % SLIDES.length), 5000);
  };

  useEffect(() => {
    autoRef.current = setInterval(() => setCurrent(c => (c + 1) % SLIDES.length), 5000);
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { goTo(current + 1); resetAuto(); }
      if (e.key === "ArrowLeft") { goTo(current - 1); resetAuto(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [current]);

  useEffect(() => {
    const els = document.querySelectorAll(".hp-reveal");
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("hp-visible"); obs.unobserve(e.target); } }),
      { threshold: 0.12 }
    );
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const handleCatClick = (e: React.MouseEvent<HTMLAnchorElement>, slug: string) => {
    e.preventDefault();
    navigate(`/menu?cat=${slug}`);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,600;0,700;0,800;0,900;1,700;1,800;1,900&family=Barlow:wght@400;500;600&display=swap');
        :root{--hp-red:#E8000D;--hp-red-dark:#B8000A;--hp-black:#0A0A0A;--hp-black-2:#111111;--hp-white:#FFFFFF;--hp-off-white:#F5F5F5;--hp-grey:#888888;--hp-grey-light:#DDDDDD;--hp-fd:'Barlow Condensed',sans-serif;--hp-fb:'Barlow',sans-serif;}
        .hp-root{font-family:var(--hp-fb);background:var(--hp-white);color:var(--hp-black);overflow-x:hidden;}
        /* NAV */
        .hp-nav{position:fixed;top:0;left:0;right:0;z-index:1000;display:flex;align-items:center;justify-content:space-between;padding:0 5vw;height:64px;background:rgba(10,10,10,0.95);backdrop-filter:blur(8px);border-bottom:1px solid rgba(232,0,13,0.2);}
        .hp-nav-logo{font-family:var(--hp-fd);font-weight:900;font-style:italic;font-size:2rem;color:var(--hp-red);letter-spacing:-0.02em;text-decoration:none;line-height:1;}
        .hp-nav-links{display:flex;align-items:center;gap:2rem;list-style:none;}
        .hp-nav-links a{font-family:var(--hp-fd);font-weight:700;font-size:0.85rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--hp-white);text-decoration:none;transition:color 0.2s;}
        .hp-nav-links a:hover{color:var(--hp-red);}
        .hp-nav-cta{background:var(--hp-red)!important;color:var(--hp-white)!important;padding:0.5rem 1.2rem;font-family:var(--hp-fd)!important;font-weight:800!important;font-style:italic!important;font-size:0.9rem!important;letter-spacing:0.08em!important;text-transform:uppercase;text-decoration:none;transition:background 0.2s,transform 0.15s!important;display:inline-block;}
        .hp-nav-cta:hover{background:var(--hp-red-dark)!important;transform:skewX(-2deg);}
        .hp-hamburger{display:none;flex-direction:column;gap:5px;cursor:pointer;background:none;border:none;padding:4px;}
        .hp-hamburger span{display:block;width:24px;height:2px;background:var(--hp-white);transition:all 0.3s;}
        /* HERO */
        .hp-hero{position:relative;height:100svh;min-height:560px;overflow:hidden;background:var(--hp-black);}
        .hp-slide{position:absolute;inset:0;display:flex;align-items:center;justify-content:flex-start;padding:0 8vw;opacity:0;transition:opacity 0.8s ease;pointer-events:none;}
        .hp-slide.hp-active{opacity:1;pointer-events:all;}
        .hp-slide-bg{position:absolute;inset:0;background-size:cover;background-position:center;transform:scale(1.05);transition:transform 6s ease;}
        .hp-slide.hp-active .hp-slide-bg{transform:scale(1);}
        .hp-slide-overlay{position:absolute;inset:0;background:linear-gradient(105deg,rgba(10,10,10,0.88) 0%,rgba(10,10,10,0.55) 55%,rgba(10,10,10,0.2) 100%);}
        .hp-slide-content{position:relative;z-index:2;max-width:680px;}
        .hp-slide-eyebrow{display:inline-block;font-family:var(--hp-fd);font-weight:700;font-size:0.75rem;letter-spacing:0.25em;text-transform:uppercase;color:var(--hp-red);margin-bottom:1rem;border-left:3px solid var(--hp-red);padding-left:0.75rem;}
        .hp-slide-headline{font-family:var(--hp-fd);font-weight:900;font-style:italic;font-size:clamp(3rem,8vw,7rem);line-height:0.9;color:var(--hp-white);text-transform:uppercase;letter-spacing:-0.02em;margin-bottom:1.25rem;}
        .hp-slide-headline .hp-hl-red{color:var(--hp-red);}
        .hp-slide-sub{font-family:var(--hp-fb);font-size:clamp(0.95rem,2vw,1.15rem);font-weight:400;color:rgba(255,255,255,0.75);line-height:1.6;max-width:420px;margin-bottom:2rem;}
        .hp-slide-ctas{display:flex;gap:1rem;flex-wrap:wrap;}
        .hp-btn-primary{display:inline-block;background:var(--hp-red);color:var(--hp-white);font-family:var(--hp-fd);font-weight:900;font-style:italic;font-size:1rem;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;padding:0.85rem 2rem;transition:background 0.2s,transform 0.15s;clip-path:polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%);}
        .hp-btn-primary:hover{background:var(--hp-red-dark);transform:translateY(-2px);}
        .hp-btn-ghost{display:inline-block;background:transparent;color:var(--hp-white);font-family:var(--hp-fd);font-weight:700;font-style:italic;font-size:1rem;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;padding:0.85rem 2rem;border:2px solid rgba(255,255,255,0.4);transition:border-color 0.2s,color 0.2s;clip-path:polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%);}
        .hp-btn-ghost:hover{border-color:var(--hp-white);}
        .hp-btn-dark{display:inline-block;background:var(--hp-black);color:var(--hp-white);font-family:var(--hp-fd);font-weight:900;font-style:italic;font-size:1rem;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;padding:0.85rem 2rem;transition:background 0.2s;white-space:nowrap;clip-path:polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%);}
        .hp-btn-dark:hover{background:#1a1a1a;}
        /* Slide BGs */
        .hp-slide-bg-1{background:linear-gradient(105deg,rgba(10,10,10,0.7) 0%,rgba(10,10,10,0.1) 100%),url('https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1600&q=80') center/cover;}
        .hp-slide-bg-2{background:linear-gradient(105deg,rgba(10,10,10,0.7) 0%,rgba(10,10,10,0.1) 100%),url('https://images.unsplash.com/photo-1550547660-d9450f859349?w=1600&q=80') center/cover;}
        .hp-slide-bg-3{background:linear-gradient(105deg,rgba(10,10,10,0.7) 0%,rgba(10,10,10,0.1) 100%),url('https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1600&q=80') center/cover;}
        .hp-slide-bg-4{background:linear-gradient(105deg,rgba(10,10,10,0.7) 0%,rgba(10,10,10,0.1) 100%),url('https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=1600&q=80') center/cover;}
        /* Slider controls */
        .hp-slider-nav{position:absolute;bottom:2rem;left:8vw;z-index:10;display:flex;align-items:center;gap:0.5rem;}
        .hp-slider-dot{width:28px;height:3px;background:rgba(255,255,255,0.3);cursor:pointer;transition:background 0.3s,width 0.3s;border:none;}
        .hp-slider-dot.hp-active{background:var(--hp-red);width:48px;}
        .hp-slider-arrows{position:absolute;bottom:1.75rem;right:5vw;z-index:10;display:flex;gap:0.5rem;}
        .hp-slider-arrow{width:44px;height:44px;border:2px solid rgba(255,255,255,0.3);background:transparent;color:var(--hp-white);font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:border-color 0.2s,background 0.2s;}
        .hp-slider-arrow:hover{border-color:var(--hp-red);background:var(--hp-red);}
        .hp-slide-counter{position:absolute;top:50%;right:5vw;transform:translateY(-50%);z-index:10;font-family:var(--hp-fd);font-weight:900;font-style:italic;color:rgba(255,255,255,0.15);font-size:8rem;line-height:1;pointer-events:none;user-select:none;}
        /* MARQUEE */
        .hp-marquee-strip{background:var(--hp-red);overflow:hidden;white-space:nowrap;padding:0.6rem 0;border-top:3px solid var(--hp-red-dark);border-bottom:3px solid var(--hp-red-dark);}
        .hp-top-ticker{position:fixed;top:64px;left:0;right:0;z-index:999;background:var(--hp-red);overflow:hidden;white-space:nowrap;padding:0.6rem 0;border-bottom:3px solid var(--hp-red-dark);}
        .hp-marquee-track{display:inline-flex;animation:hp-marquee 22s linear infinite;}
        .hp-marquee-track span{font-family:var(--hp-fd);font-weight:900;font-style:italic;font-size:0.95rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--hp-white);padding:0 2rem;}
        .hp-marquee-track .hp-dot{color:rgba(255,255,255,0.5);padding:0 0.5rem;font-style:normal;}
        @keyframes hp-marquee{from{transform:translateX(0);}to{transform:translateX(-50%);}}
        /* SECTIONS */
        .hp-section{padding:5rem 5vw;}
        .hp-section-eyebrow{font-family:var(--hp-fd);font-weight:700;font-size:0.75rem;letter-spacing:0.25em;text-transform:uppercase;color:var(--hp-red);border-left:3px solid var(--hp-red);padding-left:0.75rem;margin-bottom:1rem;display:inline-block;}
        .hp-section-title{font-family:var(--hp-fd);font-weight:900;font-style:italic;font-size:clamp(2.5rem,5vw,4.5rem);text-transform:uppercase;line-height:0.92;letter-spacing:-0.02em;color:var(--hp-black);}
        .hp-section-title.hp-light{color:var(--hp-white);}
        /* CATEGORIES */
        .hp-categories-section{background:var(--hp-off-white);}
        .hp-categories-header{text-align:center;margin-bottom:3rem;}
        .hp-categories-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1px;background:var(--hp-grey-light);border:1px solid var(--hp-grey-light);}
        .hp-category-card{position:relative;aspect-ratio:1/1;overflow:hidden;background:var(--hp-black);cursor:pointer;text-decoration:none;display:block;}
        .hp-category-card-bg{position:absolute;inset:0;background-size:cover;background-position:center;transition:transform 0.5s ease;filter:brightness(0.55) saturate(1.1);}
        .hp-category-card:hover .hp-category-card-bg{transform:scale(1.08);filter:brightness(0.4) saturate(1.2);}
        .hp-cat-bg-burgers{background-image:url('https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80');}
        .hp-cat-bg-pizza{background-image:url('https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80');}
        .hp-cat-bg-parmesans{background-image:url('https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?w=600&q=80');}
        .hp-cat-bg-kebabs{background-image:url('https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=600&q=80');}
        .hp-cat-bg-fries{background-image:url('https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&q=80');}
        .hp-cat-bg-wraps{background-image:url('https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=600&q=80');}
        .hp-cat-bg-sides{background-image:url('https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=600&q=80');}
        .hp-cat-bg-shakes{background-image:url('https://images.unsplash.com/photo-1541658016709-82535e94bc69?w=600&q=80');}
        .hp-cat-bg-desserts{background-image:url('https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&q=80');}
        .hp-category-card-label{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:1.25rem;z-index:2;}
        .hp-category-card-name{font-family:var(--hp-fd);font-weight:900;font-style:italic;font-size:1.35rem;text-transform:uppercase;color:var(--hp-white);letter-spacing:0.02em;text-align:center;line-height:1;}
        .hp-category-card-arrow{width:28px;height:28px;border:2px solid transparent;border-radius:50%;display:flex;align-items:center;justify-content:center;color:transparent;font-size:0.7rem;margin-top:0.5rem;transition:all 0.3s;}
        .hp-category-card:hover .hp-category-card-arrow{border-color:var(--hp-red);color:var(--hp-white);background:var(--hp-red);}
        /* WHY */
        .hp-why-section{background:var(--hp-black);position:relative;overflow:hidden;}
        .hp-why-section::before{content:"PRIMO'S";position:absolute;font-family:var(--hp-fd);font-weight:900;font-style:italic;font-size:22vw;color:rgba(255,255,255,0.02);top:50%;left:50%;transform:translate(-50%,-50%);white-space:nowrap;pointer-events:none;user-select:none;letter-spacing:-0.02em;}
        .hp-why-header{text-align:center;margin-bottom:4rem;position:relative;z-index:1;}
        .hp-why-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:2px;background:rgba(255,255,255,0.06);position:relative;z-index:1;}
        .hp-why-card{background:var(--hp-black-2);padding:2.5rem 2rem;border-top:3px solid transparent;transition:border-color 0.3s,background 0.3s;}
        .hp-why-card:hover{border-color:var(--hp-red);background:rgba(232,0,13,0.06);}
        .hp-why-icon{font-size:2rem;margin-bottom:1.25rem;display:block;}
        .hp-why-card-title{font-family:var(--hp-fd);font-weight:800;font-style:italic;font-size:1.4rem;text-transform:uppercase;color:var(--hp-white);margin-bottom:0.6rem;line-height:1;}
        .hp-why-card-text{font-size:0.9rem;color:rgba(255,255,255,0.5);line-height:1.6;}
        /* DEAL BANNER */
        .hp-deal-banner{background:var(--hp-red);padding:3rem 5vw;display:flex;align-items:center;justify-content:space-between;gap:2rem;flex-wrap:wrap;}
        .hp-deal-text{font-family:var(--hp-fd);font-weight:900;font-style:italic;font-size:clamp(1.8rem,4vw,3.5rem);text-transform:uppercase;color:var(--hp-white);line-height:1;}
        .hp-deal-text small{display:block;font-size:0.45em;font-weight:600;font-style:normal;color:rgba(255,255,255,0.75);letter-spacing:0.1em;margin-bottom:0.25rem;}
        /* INFO */
        .hp-info-section{background:var(--hp-white);}
        .hp-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:4rem;margin-top:3rem;align-items:start;}
        .hp-info-block-title{font-family:var(--hp-fd);font-weight:800;font-style:italic;font-size:1.8rem;text-transform:uppercase;color:var(--hp-black);margin-bottom:1.25rem;padding-bottom:0.75rem;border-bottom:3px solid var(--hp-red);display:inline-block;}
        .hp-hours-row{display:flex;justify-content:space-between;align-items:center;padding:0.65rem 0;border-bottom:1px solid var(--hp-grey-light);font-size:0.95rem;}
        .hp-hours-day{font-weight:600;color:var(--hp-black);font-family:var(--hp-fd);font-style:italic;font-size:1.05rem;text-transform:uppercase;}
        .hp-hours-time{color:var(--hp-grey);}
        .hp-delivery-tiers{display:flex;flex-direction:column;gap:1rem;margin-bottom:1.5rem;}
        .hp-delivery-tier{display:flex;align-items:center;gap:1rem;padding:1rem 1.25rem;border:1px solid var(--hp-grey-light);border-left:4px solid var(--hp-red);}
        .hp-tier-price{font-family:var(--hp-fd);font-weight:900;font-style:italic;font-size:1.6rem;color:var(--hp-red);line-height:1;min-width:70px;}
        .hp-tier-info{font-size:0.9rem;color:var(--hp-grey);line-height:1.4;}
        .hp-tier-info strong{display:block;color:var(--hp-black);font-size:1rem;}
        .hp-free-badge{display:inline-flex;align-items:center;gap:0.5rem;background:var(--hp-black);color:var(--hp-white);padding:0.75rem 1.25rem;font-family:var(--hp-fd);font-weight:800;font-style:italic;font-size:1.1rem;text-transform:uppercase;letter-spacing:0.05em;border-left:4px solid var(--hp-red);}
        /* MAP */
        .hp-map-section{background:var(--hp-black);padding:0;}
        .hp-map-inner{display:grid;grid-template-columns:1fr 2fr;min-height:400px;}
        .hp-map-info{background:var(--hp-black-2);padding:3.5rem 3rem;border-right:1px solid rgba(255,255,255,0.06);display:flex;flex-direction:column;justify-content:center;}
        .hp-map-address{font-family:var(--hp-fd);font-weight:700;font-size:1.3rem;color:var(--hp-white);line-height:1.5;margin-bottom:1.5rem;}
        .hp-map-phone{font-family:var(--hp-fd);font-weight:900;font-style:italic;font-size:1.8rem;color:var(--hp-red);text-decoration:none;display:block;margin-bottom:2rem;}
        .hp-map-phone:hover{color:#ff1a26;}
        .hp-map-embed{width:100%;height:100%;min-height:400px;border:0;filter:grayscale(30%) contrast(1.05);}
        /* FOOTER */
        .hp-footer{background:var(--hp-black);border-top:1px solid rgba(255,255,255,0.06);padding:3rem 5vw 2rem;}
        .hp-footer-top{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:3rem;margin-bottom:2.5rem;padding-bottom:2.5rem;border-bottom:1px solid rgba(255,255,255,0.08);}
        .hp-footer-logo{font-family:var(--hp-fd);font-weight:900;font-style:italic;font-size:3rem;color:var(--hp-red);line-height:1;margin-bottom:0.75rem;display:block;text-decoration:none;}
        .hp-footer-tagline{font-size:0.9rem;color:rgba(255,255,255,0.4);margin-bottom:1.5rem;line-height:1.5;}
        .hp-footer-social{display:flex;gap:0.75rem;}
        .hp-social-link{width:36px;height:36px;border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.5);display:flex;align-items:center;justify-content:center;font-size:0.8rem;text-decoration:none;font-weight:700;font-family:var(--hp-fd);transition:border-color 0.2s,color 0.2s,background 0.2s;}
        .hp-social-link:hover{border-color:var(--hp-red);color:var(--hp-white);background:var(--hp-red);}
        .hp-footer-col-title{font-family:var(--hp-fd);font-weight:800;font-style:italic;font-size:1rem;text-transform:uppercase;color:var(--hp-white);letter-spacing:0.08em;margin-bottom:1rem;}
        .hp-footer-links{list-style:none;display:flex;flex-direction:column;gap:0.5rem;}
        .hp-footer-links a{color:rgba(255,255,255,0.45);text-decoration:none;font-size:0.9rem;transition:color 0.2s;}
        .hp-footer-links a:hover{color:var(--hp-red);}
        .hp-footer-bottom{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;}
        .hp-footer-copy{font-size:0.8rem;color:rgba(255,255,255,0.25);line-height:1.5;}
        .hp-allergen-notice{font-size:0.78rem;color:rgba(255,255,255,0.2);max-width:500px;text-align:right;line-height:1.5;}
        /* SCROLL REVEAL */
        .hp-reveal{opacity:0;transform:translateY(24px);transition:opacity 0.6s ease,transform 0.6s ease;}
        .hp-reveal.hp-visible{opacity:1;transform:none;}
        .hp-reveal-d1{transition-delay:0.1s;}.hp-reveal-d2{transition-delay:0.2s;}.hp-reveal-d3{transition-delay:0.3s;}
        /* MOBILE */
        @media(max-width:768px){
          .hp-nav-links{display:none;}.hp-hamburger{display:flex;}.hp-nav{height:56px;}.hp-top-ticker{top:56px;}
          .hp-nav-links.hp-open{display:flex;flex-direction:column;position:fixed;top:56px;left:0;right:0;background:var(--hp-black);padding:1.5rem 5vw 2rem;border-top:1px solid rgba(232,0,13,0.3);z-index:999;gap:1.25rem;}
          .hp-slide{padding:0 6vw;padding-bottom:6rem;}.hp-slide-counter{display:none;}.hp-slider-arrows{right:6vw;}
          .hp-categories-grid{grid-template-columns:repeat(2,1fr);}
          .hp-why-grid{grid-template-columns:1fr 1fr;}
          .hp-info-grid{grid-template-columns:1fr;gap:2.5rem;}
          .hp-map-inner{grid-template-columns:1fr;}.hp-map-embed{min-height:300px;}
          .hp-footer-top{grid-template-columns:1fr;gap:2rem;}
          .hp-allergen-notice{text-align:left;}
          .hp-deal-banner{flex-direction:column;align-items:flex-start;}
        }
        @media(max-width:480px){.hp-categories-grid{grid-template-columns:repeat(2,1fr);}.hp-why-grid{grid-template-columns:1fr;}.hp-section{padding:3.5rem 5vw;}}
        @media(prefers-reduced-motion:reduce){.hp-slide,.hp-slide-bg,.hp-reveal,.hp-marquee-track{transition:none;animation:none;}}
      `}</style>

      <div className="hp-root">
        <ClosedBanner />

        {/* NAV */}
        <nav className="hp-nav" role="navigation" aria-label="Main navigation">
          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
            <Link href="/" className="hp-nav-logo">PRIMO'S</Link>
            <OpenClosedBadge />
          </div>
          <ul className={`hp-nav-links${navOpen ? " hp-open" : ""}`}>
            <li><a href="#menu" onClick={e => { e.preventDefault(); setNavOpen(false); document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' }); }}>Menu</a></li>
            <li><a href="#info" onClick={e => { e.preventDefault(); setNavOpen(false); document.getElementById('info')?.scrollIntoView({ behavior: 'smooth' }); }}>Hours</a></li>
            <li><a href="#find-us" onClick={e => { e.preventDefault(); setNavOpen(false); document.getElementById('find-us')?.scrollIntoView({ behavior: 'smooth' }); }}>Find Us</a></li>
            <li><Link href="/reviews" onClick={() => setNavOpen(false)}>Reviews</Link></li>
            <li><Link href="/loyalty" onClick={() => setNavOpen(false)}>Loyalty</Link></li>
            <li><Link href="/menu" className="hp-nav-cta" onClick={() => setNavOpen(false)}>Order Now</Link></li>
          </ul>
          <button className="hp-hamburger" aria-label="Toggle menu" aria-expanded={navOpen} onClick={() => setNavOpen(o => !o)}>
            <span /><span /><span />
          </button>
        </nav>

        {/* TOP TICKER */}
        <div className="hp-top-ticker" aria-hidden="true">
          <div className="hp-marquee-track">
            {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].flatMap((item, i) => [
              <span key={`top-item-${i}`}>{item}</span>,
              <span key={`top-dot-${i}`} className="hp-dot">★</span>,
            ])}
          </div>
        </div>

        {/* HERO SLIDER */}
        <section
          className="hp-hero"
          aria-label="Hero slideshow"
          onTouchStart={e => { touchStartX.current = e.changedTouches[0].screenX; }}
          onTouchEnd={e => {
            const diff = touchStartX.current - e.changedTouches[0].screenX;
            if (Math.abs(diff) > 50) { goTo(diff > 0 ? current + 1 : current - 1); resetAuto(); }
          }}
        >
          {SLIDES.map((slide, i) => (
            <div key={i} className={`hp-slide${i === current ? " hp-active" : ""}`} role="group" aria-label={`Slide ${i + 1} of ${SLIDES.length}`}>
              <div className={`hp-slide-bg ${slide.bgClass}`} />
              <div className="hp-slide-overlay" />
              <div className="hp-slide-content">
                <span className="hp-slide-eyebrow">{slide.eyebrow}</span>
                <h1 className="hp-slide-headline">
                  {slide.headlineLines.map((line, j) => (
                    <span key={j} className={slide.headlineRed[j] ? "hp-hl-red" : undefined}>
                      {line}<br />
                    </span>
                  ))}
                </h1>
                <p className="hp-slide-sub">{slide.sub}</p>
                <div className="hp-slide-ctas">
                  {slide.ctas.map((cta, j) => (
                    cta.href.startsWith('#')
                      ? <a key={j} href={cta.href} className={cta.primary ? "hp-btn-primary" : "hp-btn-ghost"} onClick={e => { e.preventDefault(); document.getElementById(cta.href.slice(1))?.scrollIntoView({ behavior: 'smooth' }); }}>{cta.label}</a>
                      : <Link key={j} href={cta.href} className={cta.primary ? "hp-btn-primary" : "hp-btn-ghost"}>{cta.label}</Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
          <div className="hp-slide-counter" aria-hidden="true">{String(current + 1).padStart(2, "0")}</div>
          <div className="hp-slider-nav" role="tablist" aria-label="Slide navigation">
            {SLIDES.map((_, i) => (
              <button key={i} className={`hp-slider-dot${i === current ? " hp-active" : ""}`} role="tab" aria-selected={i === current} aria-label={`Slide ${i + 1}`} onClick={() => { goTo(i); resetAuto(); }} />
            ))}
          </div>
          <div className="hp-slider-arrows">
            <button className="hp-slider-arrow" aria-label="Previous slide" onClick={() => { goTo(current - 1); resetAuto(); }}>&#8592;</button>
            <button className="hp-slider-arrow" aria-label="Next slide" onClick={() => { goTo(current + 1); resetAuto(); }}>&#8594;</button>
          </div>
        </section>

        {/* MARQUEE */}
        <div className="hp-marquee-strip" aria-hidden="true">
          <div className="hp-marquee-track">
            {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].flatMap((item, i) => [
              <span key={`item-${i}`}>{item}</span>,
              <span key={`dot-${i}`} className="hp-dot">★</span>,
            ])}
          </div>
        </div>

        {/* MENU CATEGORIES */}
        <section className="hp-section hp-categories-section" id="menu">
          <div className="hp-categories-header hp-reveal">
            <span className="hp-section-eyebrow">The Full Menu</span>
            <h2 className="hp-section-title">WHAT ARE YOU<br />FEELING TONIGHT?</h2>
          </div>
          <div className="hp-categories-grid" role="list">
            {CATEGORIES.map((cat, i) => (
              <a
                key={cat.slug}
                href={`/menu?cat=${cat.slug}`}
                className={`hp-category-card hp-reveal${i % 4 === 1 ? " hp-reveal-d1" : i % 4 === 2 ? " hp-reveal-d2" : i % 4 === 3 ? " hp-reveal-d3" : ""}`}
                role="listitem"
                aria-label={cat.label}
                onClick={e => handleCatClick(e, cat.slug)}
              >
                <div className={`hp-category-card-bg ${cat.bgClass}`} />
                <div className="hp-category-card-label">
                  <span className="hp-category-card-name">{cat.label}</span>
                  <span className="hp-category-card-arrow" aria-hidden="true">&#8594;</span>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* WHY PRIMO'S */}
        <section className="hp-section hp-why-section">
          <div className="hp-why-header hp-reveal">
            <span className="hp-section-eyebrow">Why Primo's</span>
            <h2 className="hp-section-title hp-light">THE PRIMO'S<br />DIFFERENCE.</h2>
          </div>
          <div className="hp-why-grid">
            {WHY_CARDS.map((card, i) => (
              <div key={i} className={`hp-why-card hp-reveal${i > 0 ? ` hp-reveal-d${i}` : ""}`}>
                <span className="hp-why-icon" aria-hidden="true">{card.icon}</span>
                <h3 className="hp-why-card-title">{card.title}</h3>
                <p className="hp-why-card-text">{card.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* DEAL BANNER */}
        <div className="hp-deal-banner hp-reveal" role="complementary">
          <div className="hp-deal-text">
            <small>Standard offer</small>
            FREE DELIVERY OVER £30
          </div>
          <Link href="/menu" className="hp-btn-dark">Order Now — It's On Us</Link>
        </div>

        {/* RATING SUMMARY */}
        <ReviewSummary />

        {/* CUSTOMER REVIEWS */}
        <ReviewsSection />

        {/* HOURS & DELIVERY */}
        <section className="hp-section hp-info-section" id="info">
          <div>
            <span className="hp-section-eyebrow hp-reveal">Hours &amp; Delivery</span>
            <h2 className="hp-section-title hp-reveal" style={{ color: "var(--hp-black)" }}>WE'RE OPEN<br />EVERY DAY.</h2>
          </div>
          <div className="hp-info-grid">
            <div className="hp-reveal">
              <span className="hp-info-block-title">Opening Hours</span>
              <div role="table" aria-label="Opening hours">
                {DAYS.map(day => (
                  <div key={day} className="hp-hours-row">
                    <span className="hp-hours-day">{day}</span>
                    <span className="hp-hours-time">12:00 PM – 10:00 PM</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="hp-reveal hp-reveal-d1">
              <span className="hp-info-block-title">Delivery Info</span>
              <div className="hp-delivery-tiers">
                <div className="hp-delivery-tier">
                  <span className="hp-tier-price">£2.50</span>
                  <span className="hp-tier-info"><strong>Up to 2 Miles</strong>Fast local delivery to your door</span>
                </div>
                <div className="hp-delivery-tier">
                  <span className="hp-tier-price">£3.50</span>
                  <span className="hp-tier-info"><strong>Up to 3 Miles</strong>Still hot, still worth it</span>
                </div>
              </div>
              <div className="hp-free-badge">
                <span>🎉</span>
                <span>FREE delivery on orders over £30</span>
              </div>
            </div>
          </div>
        </section>

        {/* MAP */}
        <div className="hp-map-section" id="find-us">
          <div className="hp-map-inner">
            <div className="hp-map-info">
              <span className="hp-section-eyebrow">Find Us</span>
              <h2 className="hp-section-title hp-light" style={{ fontSize: "clamp(2rem,3.5vw,3rem)", marginBottom: "1.5rem" }}>
                COME IN.<br />OR WE'LL<br />COME TO YOU.
              </h2>
              <address style={{ fontStyle: "normal" }}>
                <p className="hp-map-address">
                  6 Groathill Road North<br />
                  Edinburgh, EH4 2SW<br />
                  Scotland
                </p>
                <a href="tel:01315634457" className="hp-map-phone">0131 563 4457</a>
              </address>
              <Link href="/menu" className="hp-btn-primary" style={{ alignSelf: "flex-start" }}>Order Online</Link>
            </div>
            <iframe
              className="hp-map-embed"
              src="https://maps.google.com/maps?q=6+Groathill+Road+North,+Edinburgh,+EH4+2SW&output=embed&z=16"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Primo's location map"
              aria-label="Google Maps showing Primo's location"
            />
          </div>
        </div>

        {/* FOOTER */}
        <footer className="hp-footer">
          <div className="hp-footer-top">
            <div>
              <Link href="/" className="hp-footer-logo">PRIMO'S</Link>
              <p className="hp-footer-tagline">Made fresh. Served bold.<br />Edinburgh's finest street food — delivered.</p>
              <div className="hp-footer-social" aria-label="Social media links">
                <a href="#" className="hp-social-link" aria-label="Instagram">IG</a>
                <a href="#" className="hp-social-link" aria-label="Facebook">FB</a>
                <a href="#" className="hp-social-link" aria-label="TikTok">TK</a>
              </div>
            </div>
            <div>
              <p className="hp-footer-col-title">Menu</p>
              <ul className="hp-footer-links">
                {CATEGORIES.map(cat => (
                  <li key={cat.slug}><a href={`/menu?cat=${cat.slug}`} onClick={e => handleCatClick(e, cat.slug)}>{cat.label}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="hp-footer-col-title">Info</p>
              <ul className="hp-footer-links">
                <li><a href="#info">Opening Hours</a></li>
                <li><a href="#info">Delivery Info</a></li>
                <li><a href="#find-us">Find Us</a></li>
                <li><a href="tel:01315634457">0131 563 4457</a></li>
                <li><a href="mailto:orderprimos@gmail.com">orderprimos@gmail.com</a></li>
              </ul>
            </div>
          </div>
          <div className="hp-footer-bottom">
            <p className="hp-footer-copy">
              © 2025 Primo's. All rights reserved.<br />
              <a href="https://orderprimosfood.com" style={{ color: "rgba(255,255,255,0.2)", textDecoration: "none" }}>orderprimosfood.com</a>
            </p>
            <p className="hp-allergen-notice">
              Allergen information available on request. Some of our products contain gluten, dairy, eggs, nuts, and other allergens. Please inform staff of any dietary requirements before ordering.
            </p>
          </div>
        </footer>
      </div>

    </>
  );
}
