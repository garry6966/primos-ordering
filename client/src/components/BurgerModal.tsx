import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { nanoid } from "nanoid";
import type { CartItem } from "@shared/types";

interface BurgerModalProps {
  item: { id: number; name: string; price: string };
  onClose: () => void;
  onAdd: (item: CartItem) => void;
}

export default function BurgerModal({ item, onClose, onAdd }: BurgerModalProps) {
  const [mealDeal, setMealDeal] = useState<"none" | "chips_drink" | "chips_milkshake">("none");

  const basePrice = parseFloat(item.price);
  let totalPrice = basePrice;
  let mealDealPrice: number | undefined;

  if (mealDeal === "chips_drink") {
    totalPrice = 12.95;
    mealDealPrice = 12.95;
  } else if (mealDeal === "chips_milkshake") {
    totalPrice = 15.95;
    mealDealPrice = 15.95;
  }

  const handleAdd = () => {
    onAdd({
      id: nanoid(),
      menuItemId: item.id,
      name: item.name,
      basePrice,
      quantity: 1,
      mealDeal: mealDeal === "none" ? null : mealDeal,
      mealDealPrice,
      totalPrice,
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{item.name}</DialogTitle>
          <p className="text-[#E31837] font-bold text-lg">£{basePrice.toFixed(2)}</p>
        </DialogHeader>

        <div className="mt-4">
          <h4 className="font-semibold text-sm text-gray-700 mb-3">Make it a Meal?</h4>
          <RadioGroup value={mealDeal} onValueChange={(v) => setMealDeal(v as any)}>
            <div className="space-y-2">
              <label className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="none" id="none" />
                  <Label htmlFor="none" className="text-sm font-medium cursor-pointer">
                    Just the burger
                  </Label>
                </div>
                <span className="text-sm font-medium">£{basePrice.toFixed(2)}</span>
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="chips_drink" id="chips_drink" />
                  <Label htmlFor="chips_drink" className="text-sm font-medium cursor-pointer">
                    <span className="block">Meal Deal</span>
                    <span className="text-xs text-gray-500">+ Chips + Soft Drink</span>
                  </Label>
                </div>
                <span className="text-sm font-bold text-[#E31837]">£12.95</span>
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="chips_milkshake" id="chips_milkshake" />
                  <Label htmlFor="chips_milkshake" className="text-sm font-medium cursor-pointer">
                    <span className="block">Premium Meal Deal</span>
                    <span className="text-xs text-gray-500">+ Chips + Milkshake</span>
                  </Label>
                </div>
                <span className="text-sm font-bold text-[#E31837]">£15.95</span>
              </label>
            </div>
          </RadioGroup>
        </div>

        <div className="mt-6 border-t pt-4">
          <Button
            onClick={handleAdd}
            className="w-full bg-[#E31837] hover:bg-[#c01530] text-white font-bold py-5"
          >
            Add to Order — £{totalPrice.toFixed(2)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
