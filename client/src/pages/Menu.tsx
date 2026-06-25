import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import Header from "@/components/Header";
import CartDrawer from "@/components/CartDrawer";
import ClosedBanner from "@/components/ClosedBanner";
import PizzaModal from "@/components/PizzaModal";
import BurgerModal from "@/components/BurgerModal";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Plus, ShoppingBag, Tag, Info } from "lucide-react";
import { nanoid } from "nanoid";
import { useLocation, useSearch } from "wouter";

export default function Menu() {
  const { data: categories } = trpc.menu.getCategories.useQuery();
  const { data: allItems } = trpc.menu.getAllItems.useQuery();
  const { data: toppings } = trpc.menu.getPizzaToppings.useQuery();
  const { data: activeOffer } = trpc.offers.getActive.useQuery();
  const { addItem, subtotal, itemCount } = useCart();
  const [, navigate] = useLocation();

  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const initialCat = searchParams.get("cat") || "pizza";
  const [activeCategory, setActiveCategory] = useState<string>(initialCat);

  // When categories load, ensure the requested category is valid
  useEffect(() => {
    if (categories && categories.length > 0) {
      const catParam = new URLSearchParams(window.location.search).get("cat");
      if (catParam && categories.find(c => c.slug === catParam)) {
        scrollToCategory(catParam);
      }
    }
  }, [categories]);
  const [cartOpen, setCartOpen] = useState(false);
  const [pizzaModalItem, setPizzaModalItem] = useState<any>(null);
  const [burgerModalItem, setBurgerModalItem] = useState<any>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const activeCat = categories?.find(c => c.slug === activeCategory);
  // Filter out unavailable items
  const categoryItems = allItems?.filter(item => item.categoryId === activeCat?.id && item.available) || [];

  const handleAddToCart = (item: any) => {
    // Pizza category - show toppings modal
    if (activeCat?.slug === "pizza") {
      setPizzaModalItem(item);
      return;
    }
    // Burger category - show meal deal modal
    if (activeCat?.slug === "beef-burgers") {
      setBurgerModalItem(item);
      return;
    }
    // Regular item - add directly
    addItem({
      id: nanoid(),
      menuItemId: item.id,
      name: item.name,
      basePrice: parseFloat(item.price),
      quantity: 1,
      totalPrice: parseFloat(item.price),
    });
  };

  const scrollToCategory = (slug: string) => {
    setActiveCategory(slug);
    // Scroll tab into view
    if (tabsRef.current) {
      const tab = tabsRef.current.querySelector(`[data-slug="${slug}"]`);
      if (tab) {
        tab.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <ClosedBanner />
      <Header onCartClick={() => setCartOpen(true)} />

      {/* Active Offer Banner */}
      {activeOffer && (
        <div className="bg-gradient-to-r from-[#E31837] to-[#ff4d6a] text-white py-3 px-4">
          <div className="container flex items-center justify-center gap-2">
            <Tag className="w-5 h-5" />
            <span className="font-bold text-sm md:text-base">
              {activeOffer.name} — {activeOffer.discountPercent}% OFF your entire order!
            </span>
          </div>
        </div>
      )}

      {/* Allergen Notice */}
      <div className="bg-red-50 border-y border-red-100">
        <div className="container py-2.5 px-4">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-[#E31837] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-700 leading-snug">
              <span className="font-semibold text-[#E31837]">Allergen Information: </span>
              If you have a food allergy or intolerance, please contact us on{" "}
              <a href="tel:01315634457" className="font-semibold text-[#E31837] hover:underline whitespace-nowrap">0131 563 4457</a>{" "}
              before placing your order.
            </p>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="sticky top-16 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div
          ref={tabsRef}
          className="flex overflow-x-auto no-scrollbar gap-1 px-4 py-3"
          style={{ scrollbarWidth: "none" }}
        >
          {categories?.map(cat => (
            <button
              key={cat.slug}
              data-slug={cat.slug}
              onClick={() => scrollToCategory(cat.slug)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                activeCategory === cat.slug
                  ? "bg-[#E31837] text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Category Description */}
      {activeCat?.description && (
        <div className="container pt-4 pb-2">
          <p className="text-sm text-gray-500 italic">{activeCat.description}</p>
        </div>
      )}

      {/* Menu Items */}
      <div className="container py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {categoryItems.map(item => {
            const originalPrice = parseFloat(item.price);
            const discountedPrice = activeOffer
              ? originalPrice * (1 - activeOffer.discountPercent / 100)
              : originalPrice;

            return (
              <div
                key={item.id}
                className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow flex justify-between items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-base">{item.name}</h3>
                  {item.description && (
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    {activeOffer ? (
                      <>
                        <span className="text-sm text-gray-400 line-through">£{originalPrice.toFixed(2)}</span>
                        <span className="font-bold text-[#E31837]">£{discountedPrice.toFixed(2)}</span>
                      </>
                    ) : (
                      <span className="font-bold text-[#E31837]">£{originalPrice.toFixed(2)}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleAddToCart(item)}
                  className="flex-shrink-0 w-9 h-9 bg-[#E31837] hover:bg-[#c01530] text-white rounded-full flex items-center justify-center transition-all transform active:scale-90"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Cart Button */}
      {itemCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-6 md:max-w-sm">
          <Button
            onClick={() => navigate("/checkout")}
            className="w-full bg-[#E31837] hover:bg-[#c01530] text-white font-bold py-6 rounded-xl shadow-xl flex items-center justify-between px-6"
          >
            <span className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              <span>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
            </span>
            <span>£{subtotal.toFixed(2)}</span>
          </Button>
        </div>
      )}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />

      {/* Pizza Toppings Modal */}
      {pizzaModalItem && (
        <PizzaModal
          item={pizzaModalItem}
          toppings={toppings || []}
          onClose={() => setPizzaModalItem(null)}
          onAdd={(cartItem) => {
            addItem(cartItem);
            setPizzaModalItem(null);
          }}
        />
      )}

      {/* Burger Meal Deal Modal */}
      {burgerModalItem && (
        <BurgerModal
          item={burgerModalItem}
          onClose={() => setBurgerModalItem(null)}
          onAdd={(cartItem) => {
            addItem(cartItem);
            setBurgerModalItem(null);
          }}
        />
      )}
    </div>
  );
}
