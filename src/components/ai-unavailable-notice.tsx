"use client";

import { useEffect, useState } from "react";
import { AlertCircle, WifiOff } from "lucide-react";

interface AIUnavailableNoticeProps {
  apiError?: string | null;
}

export function AIUnavailableNotice({ apiError }: AIUnavailableNoticeProps) {
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

  if (!isOffline && !apiError) return null;

  if (isOffline) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-yellow-400 bg-yellow-50 p-4 text-sm text-yellow-900 dark:bg-yellow-950 dark:text-yellow-100">
        <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          AI features are unavailable while offline. Connect to the internet to generate cards.
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        {apiError ??
          "AI service is not configured. Set OPENROUTER_API_KEY in your .env.local or configure a custom AI provider in Settings."}
      </span>
    </div>
  );
}
