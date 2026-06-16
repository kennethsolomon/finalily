"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const update = () => setIsOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center gap-2 bg-yellow-400 px-4 py-2 text-sm font-medium text-yellow-950">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>
        You&apos;re offline — cached content is available. AI features require an internet connection.
      </span>
    </div>
  );
}
