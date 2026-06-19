"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type PromoSubscriptionState = {
  plan: "free" | "plus";
  status: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
} | null;

type PromoCodeCardProps = {
  subscription: PromoSubscriptionState;
  onSubscriptionUpdate: (subscription: NonNullable<PromoSubscriptionState>) => void;
  title?: string;
  body?: string;
};

export function PromoCodeCard({
  subscription,
  onSubscriptionUpdate,
  title = "Promo or Beta Code",
  body = "Have a beta tester or incentive code? Redeem it here to unlock Plus access without checkout."
}: PromoCodeCardProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isPlusActive = subscription?.plan === "plus" && (subscription.status === "active" || subscription.status === "trialing");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setError("Auth is not configured.");
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      const token = session?.access_token ?? "";
      if (!token) {
        setError("Sign in again to redeem a code.");
        return;
      }

      const response = await fetch("/api/promo/redeem", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ code })
      });

      const body = (await response.json()) as {
        error?: string;
        message?: string;
        subscription?: NonNullable<PromoSubscriptionState>;
      };

      if (!response.ok || !body.subscription) {
        throw new Error(body.error ?? "Could not redeem code.");
      }

      onSubscriptionUpdate(body.subscription);
      setMessage(body.message ?? "Code applied.");
      setCode("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not redeem code.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sidebar-section promo-code-card">
      <div className="promo-code-header">
        <h4>{title}</h4>
        {isPlusActive ? <span className="promo-code-badge">Plus Active</span> : null}
      </div>
      <p className="promo-code-copy">{body}</p>

      <form className="promo-code-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="ENTER CODE"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={80}
        />
        <button type="submit" className="btn-upgrade-now" disabled={submitting || code.trim().length === 0}>
          {submitting ? "Applying..." : isPlusActive ? "Apply Code" : "Redeem Code"}
        </button>
      </form>

      {message ? <p className="promo-code-success">{message}</p> : null}
      {error ? <p className="promo-code-error">{error}</p> : null}
    </div>
  );
}
