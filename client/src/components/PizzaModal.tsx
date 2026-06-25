import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { nanoid } from "nanoid";
import type { CartItem } from "@shared/types";

interface PizzaModalProps {
  item: { id: number; name: string; price: string };
  toppings: { id: number; name: string; price: string }[];
  onClose: () => void;
  onAdd: (item: CartItem) => void;
}

export default function PizzaModal({ item, toppings, onClose, onAdd }: PizzaModalProps) {
  const [selectedToppings, setSelectedToppings] = useState<Set<number>>(new Set());

  const basePrice = parseFloat(item.price);
  const toppingsTotal = toppings
    .filter(t => selectedToppings.has(t.id))
    .reduce((sum, t) => sum + parseFloat(t.price), 0);
  const totalPrice = basePrice + toppingsTotal;

  const toggleTopping = (id: number) => {
    setSelectedToppings(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    const selected = toppings
      .filter(t => selectedToppings.has(t.id))
      .map(t => ({ id: t.id, name: t.name, price: parseFloat(t.price) }));

    onAdd({
      id: nanoid(),
      menuItemId: item.id,
      name: item.name,
      basePrice,
      quantity: 1,
      toppings: selected.length > 0 ? selected : undefined,
      totalPrice,
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{item.name}</DialogTitle>
          <p className="text-[#E31837] font-bold text-lg">£{basePrice.toFixed(2)}</p>
        </DialogHeader>

        <div className="mt-4">
          <h4 className="font-semibold text-sm text-gray-700 mb-3">Extra Toppings</h4>
          <div className="space-y-2">
            {toppings.map(topping => (
              <label
                key={topping.id}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedToppings.has(topping.id)}
                    onCheckedChange={() => toggleTopping(topping.id)}
                  />
                  <span className="text-sm font-medium">{topping.name}</span>
                </div>
                <span className="text-sm text-gray-500">
                  {parseFloat(topping.price) > 0 ? `+£${parseFloat(topping.price).toFixed(2)}` : "Free"}
                </span>
              </label>
            ))}
          </div>
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
