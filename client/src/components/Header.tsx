import { ShoppingBag, User, Stamp } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { Link, useLocation } from "wouter";

export default function Header({ onCartClick }: { onCartClick?: () => void }) {
  const { itemCount } = useCart();
  const [location] = useLocation();

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="container flex items-center justify-between h-16">
        <Link href="/">
          <span className="logo-text text-2xl md:text-3xl cursor-pointer select-none">
            PRIMO'S
          </span>
        </Link>

        <nav className="flex items-center gap-2 md:gap-4">
          {location !== "/menu" && (
            <Link href="/menu">
              <span className="text-sm font-semibold text-gray-700 hover:text-[#E31837] transition-colors cursor-pointer">
                Menu
              </span>
            </Link>
          )}
          {location !== "/reviews" && (
            <Link href="/reviews">
              <span className="text-sm font-semibold text-gray-700 hover:text-[#E31837] transition-colors cursor-pointer">
                Reviews
              </span>
            </Link>
          )}
          <Link href="/loyalty">
            <span className="p-2 rounded-full hover:bg-gray-100 transition-colors cursor-pointer flex items-center gap-1" title="Loyalty Stamps">
              <Stamp className="w-5 h-5 text-gray-700" />
              <span className="text-sm font-semibold text-gray-700 hover:text-[#E31837] transition-colors">Loyalty</span>
            </span>
          </Link>
          <Link href="/account">
            <span className="p-2 rounded-full hover:bg-gray-100 transition-colors cursor-pointer flex items-center" title="My Account">
              <User className="w-5 h-5 text-gray-700" />
            </span>
          </Link>
          <button
            onClick={onCartClick}
            className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="View cart"
          >
            <ShoppingBag className="w-6 h-6 text-gray-700" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#E31837] text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {itemCount > 99 ? "99+" : itemCount}
              </span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
}
