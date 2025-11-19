"use client";

import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    $crisp: any[];
    CRISP_WEBSITE_ID: string;
  }
}

/**
 * Crisp Chat Widget Integration
 *
 * This component initializes the Crisp chat widget globally with:
 * - User authentication data (for support tracking)
 * - Contextual information (current page, workspace)
 * - Appearance customization (colors, position)
 * - AI Bot configuration (knowledge base, behavior)
 *
 * Crisp Website ID: 7acdaf6a-3b6a-4089-bd4e-d611e6362313
 *
 * The Crisp AI bot will be configured in the Crisp dashboard to answer
 * questions based on the JustoAI help portal content.
 */
export function CrispChat() {
  const { user } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    // Only load Crisp on client-side and prevent duplicate initialization
    if (typeof window === "undefined") return;
    if (window.$crisp) return;

    // Initialize Crisp global variables
    window.$crisp = [];
    window.CRISP_WEBSITE_ID = "7acdaf6a-3b6a-4089-bd4e-d611e6362313";

    // Load Crisp script
    const script = document.createElement("script");
    script.src = "https://client.crisp.chat/l.js";
    script.async = true;
    script.defer = true;

    // Add to head
    document.head.appendChild(script);

    // Cleanup function (optional - Crisp persists across page navigations)
    return () => {
      // Note: We intentionally do NOT remove the Crisp widget on unmount
      // because it should persist across page navigations in the SPA
    };
  }, []);

  // Update user data when auth state changes or page changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.$crisp) return;

    // Set user data if authenticated
    if (user) {
      window.$crisp.push(["set", "user:email", [user.email]]);
      window.$crisp.push(["set", "user:nickname", [user.name]]);

      // Set custom data
      window.$crisp.push(["set", "session:data", {
        userId: user.id,
        workspaceName: user.workspaces?.[0]?.workspace?.name || "Default",
        userRole: "authenticated",
      }]);

      // Set segments for better bot targeting
      window.$crisp.push(["set", "session:segments", ["authenticated", "customer"]]);
    } else {
      // For unauthenticated users
      window.$crisp.push(["set", "session:segments", ["visitor"]]);
    }

    // Set current page context
    window.$crisp.push(["set", "session:data", {
      currentPage: pathname,
      timestamp: new Date().toISOString(),
    }]);
  }, [user, pathname]);

  // Configure Crisp appearance and behavior
  useEffect(() => {
    if (typeof window === "undefined" || !window.$crisp) return;

    // Set theme colors to match JustoAI branding
    window.$crisp.push(["set", "chatbox:settings", {
      color: "#0A2A5B", // JustoAI primary blue
      position: "br", // Bottom right
      theme: "light",
    }]);

    // Configure widget visibility
    window.$crisp.push(["set", "session:data", {
      helpChannel: "main",
      supportTier: user ? "customer" : "visitor",
    }]);
  }, [user]);

  return null;
}
