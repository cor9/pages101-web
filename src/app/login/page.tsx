"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  formatCooldown,
  getMagicLinkCooldownRemaining,
  isMagicLinkRateLimitError,
  MAGIC_LINK_RATE_LIMIT_COOLDOWN_MS,
  MAGIC_LINK_SUCCESS_COOLDOWN_MS,
  setMagicLinkCooldown
} from "@/lib/auth/magic-link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [cooldownMs, setCooldownMs] = useState(0);
  
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    setCooldownMs(getMagicLinkCooldownRemaining(email));

    if (!email.trim()) return;

    const timer = window.setInterval(() => {
      setCooldownMs(getMagicLinkCooldownRemaining(email));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [email]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setErrorMessage("Supabase is not configured.");
      setStatus("error");
      return;
    }

    const remainingMs = getMagicLinkCooldownRemaining(email);
    if (remainingMs > 0) {
      setErrorMessage(`Please wait ${formatCooldown(remainingMs)} before requesting another link.`);
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: 'https://pages.childactor101.com/auth/callback?next=/dashboard'
      }
    });

    if (error) {
      if (isMagicLinkRateLimitError(error)) {
        setMagicLinkCooldown(email, MAGIC_LINK_RATE_LIMIT_COOLDOWN_MS);
        setCooldownMs(MAGIC_LINK_RATE_LIMIT_COOLDOWN_MS);
        setErrorMessage(`Too many sign-in emails were requested. Please wait ${formatCooldown(MAGIC_LINK_RATE_LIMIT_COOLDOWN_MS)} and try again.`);
      } else {
        setErrorMessage(error.message);
      }
      setStatus("error");
    } else {
      setMagicLinkCooldown(email, MAGIC_LINK_SUCCESS_COOLDOWN_MS);
      setCooldownMs(MAGIC_LINK_SUCCESS_COOLDOWN_MS);
      setStatus("success");
    }
  }

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      backgroundColor: "#F5EFE6",
      padding: "24px"
    }}>
      <div style={{
        background: "#fff",
        padding: "48px 32px",
        borderRadius: "16px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.05)",
        maxWidth: "400px",
        width: "100%",
        textAlign: "center"
      }}>
        <h1 style={{
          fontFamily: "var(--font-fraunces), Fraunces, Georgia, serif",
          fontStyle: "italic",
          fontSize: "32px",
          margin: "0 0 32px 0",
          color: "#222"
        }}>
          Pages101
        </h1>

        {status === "success" ? (
          <p style={{ margin: 0, fontSize: "16px", color: "#555" }}>
            Check your email — your link is on the way.
          </p>
        ) : (
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                border: "1px solid #ccc",
                fontSize: "16px",
                width: "100%",
                boxSizing: "border-box"
              }}
            />
            <button
              type="submit"
              disabled={status === "loading" || cooldownMs > 0}
              style={{
                backgroundColor: "var(--marquee, #c8553d)",
                color: "#fff",
                padding: "12px 16px",
                borderRadius: "8px",
                border: "none",
                fontSize: "16px",
                fontWeight: "600",
                cursor: status === "loading" || cooldownMs > 0 ? "not-allowed" : "pointer",
                opacity: status === "loading" || cooldownMs > 0 ? 0.7 : 1,
                width: "100%"
              }}
            >
              {status === "loading" ? "Sending..." : cooldownMs > 0 ? `Wait ${formatCooldown(cooldownMs)}` : "Send login link"}
            </button>
            <p style={{
              margin: 0,
              fontSize: "14px",
              color: "#666"
            }}>
              We&apos;ll email you a link — no password needed.
            </p>
            {status === "error" && (
              <p style={{ color: "var(--marquee-deep, #b5271c)", fontSize: "14px", margin: "8px 0 0 0" }}>
                {errorMessage}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
