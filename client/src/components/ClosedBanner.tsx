import { Clock } from "lucide-react";

export function useIsOpen(): boolean {
  const now = new Date();
  const hours = now.getHours();
  // Open 12pm (12) to 10pm (22)
  return hours >= 12 && hours < 22;
}

export default function ClosedBanner() {
  const isOpen = useIsOpen();

  if (isOpen) return null;

  return (
    <div className="bg-gray-900 text-white py-3 px-4 text-center">
      <div className="flex items-center justify-center gap-2">
        <Clock className="w-4 h-4" />
        <span className="font-medium text-sm">
          We're currently closed. We open daily from 12pm – 10pm.
        </span>
      </div>
    </div>
  );
}
