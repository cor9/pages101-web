"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { PromoCodeCard } from "@/components/dashboard/PromoCodeCard";
import {
  AUDITION_FORMATS,
  AUDITION_FORMAT_LABELS,
  AUDITION_OUTCOMES,
  AUDITION_OUTCOME_LABELS,
  AUDITION_PROJECT_TYPES,
  AUDITION_PROJECT_TYPE_LABELS,
  AUDITION_RECEIVED_FROM,
  AUDITION_RECEIVED_FROM_LABELS,
  AUDITION_ROLE_SIZES,
  AUDITION_ROLE_SIZE_LABELS,
  AUDITION_STAGES,
  AUDITION_STAGE_LABELS,
  buildNotesPreview,
  calculateCurrentYearStats,
  formatPercent,
  isActivePlusSubscription,
  isPrep101Eligible,
  sortAuditionsNewestFirst,
  type AuditionOutcome,
  type AuditionPayload,
  type AuditionRecord,
  type CareerTrackerPerformer,
  type CareerTrackerResponse,
  type CareerTrackerSubscription
} from "@/lib/career-tracker";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type AuditionFormState = {
  page_id: string;
  project: string;
  role: string;
  casting_contact: string;
  project_type: (typeof AUDITION_PROJECT_TYPES)[number] | "";
  role_size: (typeof AUDITION_ROLE_SIZES)[number] | "";
  audition_date: string;
  format: (typeof AUDITION_FORMATS)[number] | "";
  audition_stage: (typeof AUDITION_STAGES)[number] | "";
  outcome: AuditionOutcome | "";
  received_from: (typeof AUDITION_RECEIVED_FROM)[number] | "";
  received_from_detail: string;
  notes: string;
};

type AuditionModalProps = {
  audition: AuditionRecord | null;
  defaultPerformerId: string;
  performers: CareerTrackerPerformer[];
  castingContactSuggestions: string[];
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (payload: AuditionPayload, auditionId: string | null) => Promise<void>;
};

function PreparationWidget({ audition, compact = false }: { audition: AuditionRecord; compact?: boolean }) {
  return (
    <div className={`career-prepare-widget ${compact ? "career-prepare-widget--compact" : ""}`}>
      <div className="career-prepare-header">
        <div>
          <p className="career-prepare-eyebrow">Prepare This Audition</p>
          <h3>{compact ? "Ecosystem Support" : audition.project}</h3>
          <p className="career-prepare-meta">
            {audition.performer_name}
            {audition.role ? ` · ${audition.role}` : ""}
            {audition.audition_date ? ` · ${formatAuditionDate(audition.audition_date)}` : ""}
          </p>
        </div>
      </div>

      <div className="career-prepare-grid">
        <article className="career-tool-card">
          <div className="career-tool-logo-wrap">
            <Image src="/reader101-logo.png" alt="Reader101" width={220} height={52} className="career-tool-logo career-tool-logo--reader" />
          </div>
          <p className="career-tool-copy">
            Give your reader scene-specific coaching. Help parents know exactly how to support the performance during rehearsal and self tapes.
          </p>
          <a href="https://reader101.site" target="_blank" rel="noreferrer" className="career-tool-button career-tool-button--reader">
            Reader101 Card
          </a>
        </article>

        <article className="career-tool-card">
          <div className="career-tool-logo-wrap">
            <Image src="/preplogo.png" alt="Prep101" width={180} height={60} className="career-tool-logo career-tool-logo--prep" />
          </div>
          <p className="career-tool-copy">
            Build a complete audition preparation guide. Analyze the character, relationships, objectives, subtext, and key acting choices.
          </p>
          <a href="https://prep101.site" target="_blank" rel="noreferrer" className="career-tool-button">
            Prep101 Guide
          </a>
        </article>
      </div>
    </div>
  );
}

function createEmptyFormState(defaultPerformerId: string): AuditionFormState {
  return {
    page_id: defaultPerformerId,
    project: "",
    role: "",
    casting_contact: "",
    project_type: "",
    role_size: "",
    audition_date: "",
    format: "",
    audition_stage: "initial",
    outcome: "pending",
    received_from: "",
    received_from_detail: "",
    notes: ""
  };
}

function buildFormState(audition: AuditionRecord | null, defaultPerformerId: string): AuditionFormState {
  if (!audition) {
    return createEmptyFormState(defaultPerformerId);
  }

  return {
    page_id: audition.page_id,
    project: audition.project,
    role: audition.role ?? "",
    casting_contact: audition.casting_contact ?? "",
    project_type: audition.project_type ?? "",
    role_size: audition.role_size ?? "",
    audition_date: audition.audition_date ?? "",
    format: audition.format ?? "",
    audition_stage: audition.audition_stage ?? "",
    outcome: audition.outcome ?? "",
    received_from: audition.received_from ?? "",
    received_from_detail: audition.received_from_detail ?? "",
    notes: audition.notes ?? ""
  };
}

function formatAuditionDate(date: string | null) {
  if (!date) {
    return "—";
  }

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function normalizeAuditionPayload(form: AuditionFormState): AuditionPayload {
  return {
    page_id: form.page_id,
    project: form.project.trim(),
    role: form.role || null,
    casting_contact: form.casting_contact || null,
    project_type: form.project_type || null,
    role_size: form.role_size || null,
    audition_date: form.audition_date || null,
    format: form.format || null,
    audition_stage: form.audition_stage || null,
    outcome: form.outcome || null,
    received_from: form.received_from || null,
    received_from_detail: form.received_from_detail || null,
    notes: form.notes || null
  };
}

function AuditionModal({
  audition,
  defaultPerformerId,
  performers,
  castingContactSuggestions,
  saving,
  error,
  onClose,
  onSave
}: AuditionModalProps) {
  const [form, setForm] = useState<AuditionFormState>(() => buildFormState(audition, defaultPerformerId));

  useEffect(() => {
    setForm(buildFormState(audition, defaultPerformerId));
  }, [audition, defaultPerformerId]);

  const prepEligible = isPrep101Eligible({
    audition_date: form.audition_date || null,
    outcome: form.outcome || null
  });

  const handleChange = <TKey extends keyof AuditionFormState>(key: TKey, value: AuditionFormState[TKey]) => {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSave(normalizeAuditionPayload(form), audition?.id ?? null);
  };

  return (
    <div className="career-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="career-modal-card" role="dialog" aria-modal="true" aria-labelledby="audition-modal-title" onClick={(event) => event.stopPropagation()}>
        <div className="career-modal-header">
          <div>
            <p className="career-modal-eyebrow">Career Tracker</p>
            <h3 id="audition-modal-title">{audition ? "Edit Audition" : "Add Audition"}</h3>
          </div>
          <button type="button" className="career-modal-close" onClick={onClose} aria-label="Close audition modal">
            ×
          </button>
        </div>

        <div className="career-manager-tips">
          <h4>101 Manager Tips</h4>
          <p><strong>Notes:</strong> Track what worked. Did you make a bold choice? Did the casting director give a redirect? Future you will thank present you.</p>
          <p><strong>Casting Contact:</strong> Logging casting offices consistently helps you identify who keeps bringing your performer back.</p>
          <p><strong>Outcome:</strong> Updating outcomes allows Pages101 to calculate callback and booking rates.</p>
        </div>

        <form onSubmit={handleSubmit} className="career-modal-form">
          <label className="career-field">
            <span>Performer</span>
            <select value={form.page_id} onChange={(event) => handleChange("page_id", event.target.value)} required>
              <option value="" disabled>Select a performer</option>
              {performers.map((performer) => (
                <option key={performer.id} value={performer.id}>
                  {performer.display_name}
                </option>
              ))}
            </select>
          </label>

          <label className="career-field">
            <span>Project</span>
            <input
              type="text"
              value={form.project}
              onChange={(event) => handleChange("project", event.target.value)}
              required
            />
          </label>

          <label className="career-field">
            <span>Role</span>
            <input
              type="text"
              value={form.role}
              onChange={(event) => handleChange("role", event.target.value)}
            />
          </label>

          <label className="career-field">
            <span>Casting Contact</span>
            <input
              type="text"
              value={form.casting_contact}
              list="casting-contact-suggestions"
              onChange={(event) => handleChange("casting_contact", event.target.value)}
            />
            <datalist id="casting-contact-suggestions">
              {castingContactSuggestions.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
          </label>

          <label className="career-field">
            <span>Project Type</span>
            <select value={form.project_type} onChange={(event) => handleChange("project_type", event.target.value as AuditionFormState["project_type"])}>
              <option value="">Select project type</option>
              {AUDITION_PROJECT_TYPES.map((projectType) => (
                <option key={projectType} value={projectType}>
                  {AUDITION_PROJECT_TYPE_LABELS[projectType]}
                </option>
              ))}
            </select>
          </label>

          <label className="career-field">
            <span>Role Size</span>
            <select value={form.role_size} onChange={(event) => handleChange("role_size", event.target.value as AuditionFormState["role_size"])}>
              <option value="">Select role size</option>
              {AUDITION_ROLE_SIZES.map((roleSize) => (
                <option key={roleSize} value={roleSize}>
                  {AUDITION_ROLE_SIZE_LABELS[roleSize]}
                </option>
              ))}
            </select>
          </label>

          <label className="career-field">
            <span>Audition Date</span>
            <input
              type="date"
              value={form.audition_date}
              onChange={(event) => handleChange("audition_date", event.target.value)}
            />
          </label>

          <fieldset className="career-radio-group">
            <legend>Format</legend>
            <div className="career-radio-options">
              {AUDITION_FORMATS.map((format) => (
                <label key={format} className="career-radio-option">
                  <input
                    type="radio"
                    name="audition-format"
                    checked={form.format === format}
                    onChange={() => handleChange("format", format)}
                  />
                  <span>{AUDITION_FORMAT_LABELS[format]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="career-field">
            <span>Audition Stage</span>
            <select value={form.audition_stage} onChange={(event) => handleChange("audition_stage", event.target.value as AuditionFormState["audition_stage"])}>
              <option value="">Select audition stage</option>
              {AUDITION_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {AUDITION_STAGE_LABELS[stage]}
                </option>
              ))}
            </select>
          </label>

          <label className="career-field">
            <span>Outcome</span>
            <select value={form.outcome} onChange={(event) => handleChange("outcome", event.target.value as AuditionFormState["outcome"])}>
              <option value="">Select outcome</option>
              {AUDITION_OUTCOMES.map((outcome) => (
                <option key={outcome} value={outcome}>
                  {AUDITION_OUTCOME_LABELS[outcome]}
                </option>
              ))}
            </select>
          </label>

          {prepEligible ? (
            <PreparationWidget
              compact
              audition={{
                id: audition?.id ?? "draft",
                user_id: audition?.user_id ?? "",
                page_id: form.page_id,
                project: form.project || "Pending Audition",
                role: form.role || null,
                casting_contact: form.casting_contact || null,
                project_type: form.project_type || null,
                role_size: form.role_size || null,
                audition_date: form.audition_date || null,
                format: form.format || null,
                audition_stage: form.audition_stage || null,
                outcome: form.outcome || null,
                received_from: form.received_from || null,
                received_from_detail: form.received_from_detail || null,
                notes: form.notes || null,
                created_at: audition?.created_at ?? new Date().toISOString(),
                updated_at: audition?.updated_at ?? new Date().toISOString(),
                performer_name: performers.find((performer) => performer.id === form.page_id)?.display_name ?? "Performer"
              }}
            />
          ) : null}

          <label className="career-field">
            <span>Received From</span>
            <select value={form.received_from} onChange={(event) => handleChange("received_from", event.target.value as AuditionFormState["received_from"])}>
              <option value="">Select source</option>
              {AUDITION_RECEIVED_FROM.map((receivedFrom) => (
                <option key={receivedFrom} value={receivedFrom}>
                  {AUDITION_RECEIVED_FROM_LABELS[receivedFrom]}
                </option>
              ))}
            </select>
          </label>

          <label className="career-field">
            <span>Source Details</span>
            <input
              type="text"
              value={form.received_from_detail}
              placeholder="Coast to Coast, CESD, Direct Email"
              onChange={(event) => handleChange("received_from_detail", event.target.value)}
            />
          </label>

          <label className="career-field">
            <span>Notes</span>
            <textarea
              value={form.notes}
              rows={5}
              onChange={(event) => handleChange("notes", event.target.value)}
            />
          </label>

          {error ? <p className="career-form-error">{error}</p> : null}

          <div className="career-modal-actions">
            <button type="button" className="btn-form-cancel" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-form-submit" disabled={saving}>
              {saving ? "Saving..." : audition ? "Save Changes" : "Create Audition"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CareerTrackerDashboard() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditions, setAuditions] = useState<AuditionRecord[]>([]);
  const [performers, setPerformers] = useState<CareerTrackerPerformer[]>([]);
  const [subscription, setSubscription] = useState<CareerTrackerSubscription>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [modalAudition, setModalAudition] = useState<AuditionRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [performerFilter, setPerformerFilter] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("");
  const [projectTypeFilter, setProjectTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  const fetchCareerTracker = useCallback(async () => {
    if (!supabase) {
      return;
    }

    const {
      data: { session }
    } = await supabase.auth.getSession();

    const token = session?.access_token ?? "";
    if (!token) {
      router.push("/");
      return;
    }

    const response = await fetch("/api/career-tracker", {
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });

    const body = (await response.json()) as CareerTrackerResponse | { error?: string };
    if (!response.ok) {
      throw new Error("error" in body ? body.error ?? "Failed to load career tracker." : "Failed to load career tracker.");
    }

    const data = body as CareerTrackerResponse;
    setAuditions(sortAuditionsNewestFirst(data.auditions));
    setPerformers(data.performers);
    setSubscription(data.subscription);
    setPageError(null);
  }, [router, supabase]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const client = supabase;

    async function load() {
      const { data } = await client.auth.getUser();
      if (!data.user) {
        router.push("/");
        if (!cancelled) {
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setUser(data.user);
      }

      try {
        await fetchCareerTracker();
      } catch (error) {
        if (!cancelled) {
          setPageError(error instanceof Error ? error.message : "Failed to load career tracker.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    const {
      data: { subscription: authSubscription }
    } = client.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        router.push("/");
        return;
      }

      setUser(session.user);
      void fetchCareerTracker().catch((error) => {
        setPageError(error instanceof Error ? error.message : "Failed to load career tracker.");
      });
    });

    return () => {
      cancelled = true;
      authSubscription.unsubscribe();
    };
  }, [fetchCareerTracker, router, supabase]);

  const handleSignOut = async () => {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    router.push("/");
  };

  const handleUpgrade = () => {
    if (!user) return;
    const paymentLink = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || "https://buy.stripe.com/3cI7sL4lVaPR9QFccy2wV0m";
    const url = new URL(paymentLink);
    url.searchParams.set("client_reference_id", user.id);
    if (user.email) {
      url.searchParams.set("prefilled_email", user.email);
    }
    window.location.href = url.toString();
  };

  const handleManageBilling = async () => {
    if (!supabase || !user) {
      return;
    }

    setBillingLoading(true);

    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      const token = session?.access_token ?? "";
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const body = (await response.json()) as { url?: string; error?: string };
      if (body.url) {
        window.location.href = body.url;
      } else {
        alert(body.error ?? "Failed to open Billing Customer Portal.");
      }
    } catch (error) {
      console.error("Billing portal session request failed:", error);
      alert("Failed to connect to billing server.");
    } finally {
      setBillingLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setModalAudition(null);
    setModalError("");
    setModalOpen(true);
  };

  const handleOpenEdit = (audition: AuditionRecord) => {
    setModalAudition(audition);
    setModalError("");
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    if (modalSaving) {
      return;
    }

    setModalOpen(false);
    setModalAudition(null);
    setModalError("");
  };

  const saveAudition = async (payload: AuditionPayload, auditionId: string | null) => {
    if (!supabase) {
      return;
    }

    setModalSaving(true);
    setModalError("");

    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      const token = session?.access_token ?? "";
      const response = await fetch(auditionId ? `/api/career-tracker/${auditionId}` : "/api/career-tracker", {
        method: auditionId ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const body = (await response.json()) as AuditionRecord | { error?: string };
      if (!response.ok) {
        throw new Error("error" in body ? body.error ?? "Failed to save audition." : "Failed to save audition.");
      }

      const savedAudition = body as AuditionRecord;
      setAuditions((current) => {
        const next = auditionId
          ? current.map((audition) => (audition.id === savedAudition.id ? savedAudition : audition))
          : [savedAudition, ...current];

        return sortAuditionsNewestFirst(next);
      });

      setModalOpen(false);
      setModalAudition(null);
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "Failed to save audition.");
    } finally {
      setModalSaving(false);
    }
  };

  const handleDeleteAudition = async (audition: AuditionRecord) => {
    if (!supabase) {
      return;
    }

    const confirmed = window.confirm(`Delete ${audition.performer_name}'s audition for ${audition.project}?`);
    if (!confirmed) {
      return;
    }

    setDeletingId(audition.id);

    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      const token = session?.access_token ?? "";
      const response = await fetch(`/api/career-tracker/${audition.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const body = response.status === 204 ? null : (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to delete audition.");
      }

      setAuditions((current) => current.filter((currentAudition) => currentAudition.id !== audition.id));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete audition.");
    } finally {
      setDeletingId(null);
    }
  };

  const isPlusActive = isActivePlusSubscription(subscription);
  const hasStripeBilling = Boolean(subscription?.stripe_customer_id);
  const auditionLimit = isPlusActive ? null : 5;
  const isLimitReached = !isPlusActive && auditions.length >= 5;
  const stats = useMemo(() => calculateCurrentYearStats(auditions), [auditions]);
  const prepEligibleAuditions = useMemo(
    () => sortAuditionsNewestFirst(auditions.filter((audition) => isPrep101Eligible(audition))),
    [auditions]
  );
  const castingContactSuggestions = useMemo(
    () => Array.from(new Set(auditions.map((audition) => audition.casting_contact).filter((value): value is string => Boolean(value)))).sort(),
    [auditions]
  );

  const filteredAuditions = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return sortAuditionsNewestFirst(
      auditions.filter((audition) => {
        if (performerFilter && audition.page_id !== performerFilter) {
          return false;
        }

        if (outcomeFilter && audition.outcome !== outcomeFilter) {
          return false;
        }

        if (projectTypeFilter && audition.project_type !== projectTypeFilter) {
          return false;
        }

        if (dateFrom && (!audition.audition_date || audition.audition_date < dateFrom)) {
          return false;
        }

        if (dateTo && (!audition.audition_date || audition.audition_date > dateTo)) {
          return false;
        }

        if (!searchTerm) {
          return true;
        }

        return [
          audition.project,
          audition.role,
          audition.casting_contact,
          audition.notes
        ]
          .filter((value): value is string => Boolean(value))
          .some((value) => value.toLowerCase().includes(searchTerm));
      })
    );
  }, [auditions, dateFrom, dateTo, outcomeFilter, performerFilter, projectTypeFilter, search]);

  const resetFilters = () => {
    setPerformerFilter("");
    setOutcomeFilter("");
    setProjectTypeFilter("");
    setDateFrom("");
    setDateTo("");
    setSearch("");
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          color: "var(--ink-soft)"
        }}>
          <p>Loading your career tracker...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <DashboardHeader activeTab="career-tracker" userEmail={user?.email} onSignOut={handleSignOut} />

      <main className="dashboard-container">
        <div className="dashboard-columns">
          <section className="dashboard-main-col" aria-label="Career Tracker Section">
            <div className="col-header">
              <div>
                <h2>Career Tracker</h2>
                <p className="career-subtitle">Track auditions, callbacks, avail checks, and bookings across your performers.</p>
              </div>
              <button
                disabled={isLimitReached || performers.length === 0}
                onClick={handleOpenCreate}
                className={`btn-add-performer ${isLimitReached || performers.length === 0 ? "disabled" : ""}`}
              >
                + Add Audition
              </button>
            </div>

            {!isPlusActive && isLimitReached ? (
              <div className="career-upgrade-banner">
                <p>You’ve logged 5 of 5 auditions. Upgrade to Plus for unlimited audition tracking.</p>
                <button type="button" className="btn-upgrade-now" onClick={handleUpgrade}>
                  Upgrade to Plus
                </button>
              </div>
            ) : null}

            {pageError ? <p className="form-error-msg">{pageError}</p> : null}

            <div className="career-stats-grid">
              <article className="career-stat-card">
                <span>Auditions</span>
                <strong>{stats.auditions}</strong>
                <small>Current year</small>
              </article>
              <article className="career-stat-card">
                <span>Callbacks</span>
                <strong>{stats.callbacks}</strong>
                <small>Callback stage or later</small>
              </article>
              <article className="career-stat-card">
                <span>Avail Checks</span>
                <strong>{stats.availChecks}</strong>
                <small>Current year</small>
              </article>
              <article className="career-stat-card">
                <span>Bookings</span>
                <strong>{stats.bookings}</strong>
                <small>Current year</small>
              </article>
              <article className="career-stat-card">
                <span>Callback Rate</span>
                <strong>{formatPercent(stats.callbackRate)}</strong>
                <small>Callback stage or later ÷ auditions</small>
              </article>
              <article className="career-stat-card">
                <span>Booking Rate</span>
                <strong>{formatPercent(stats.bookingRate)}</strong>
                <small>Bookings ÷ auditions</small>
              </article>
            </div>

            {prepEligibleAuditions.length > 0 ? (
              <div className="career-pending-widgets">
                {prepEligibleAuditions.map((audition) => (
                  <PreparationWidget key={audition.id} audition={audition} />
                ))}
              </div>
            ) : null}

            <div className="creation-card career-filters-card">
              <div className="career-filters-header">
                <h3>Filters</h3>
                <button type="button" className="career-clear-filters" onClick={resetFilters}>
                  Clear
                </button>
              </div>
              <div className="career-filters-grid">
                <label className="career-field">
                  <span>Performer</span>
                  <select value={performerFilter} onChange={(event) => setPerformerFilter(event.target.value)}>
                    <option value="">All performers</option>
                    {performers.map((performer) => (
                      <option key={performer.id} value={performer.id}>
                        {performer.display_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="career-field">
                  <span>Outcome</span>
                  <select value={outcomeFilter} onChange={(event) => setOutcomeFilter(event.target.value)}>
                    <option value="">All outcomes</option>
                    {AUDITION_OUTCOMES.map((outcome) => (
                      <option key={outcome} value={outcome}>
                        {AUDITION_OUTCOME_LABELS[outcome]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="career-field">
                  <span>Project Type</span>
                  <select value={projectTypeFilter} onChange={(event) => setProjectTypeFilter(event.target.value)}>
                    <option value="">All project types</option>
                    {AUDITION_PROJECT_TYPES.map((projectType) => (
                      <option key={projectType} value={projectType}>
                        {AUDITION_PROJECT_TYPE_LABELS[projectType]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="career-field">
                  <span>Date From</span>
                  <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                </label>
                <label className="career-field">
                  <span>Date To</span>
                  <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
                </label>
                <label className="career-field career-field--search">
                  <span>Search</span>
                  <input
                    type="search"
                    placeholder="Project, role, casting contact, notes"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
              </div>
            </div>

            {performers.length === 0 ? (
              <div className="empty-state-card">
                <div className="empty-state-icon">🎭</div>
                <h3>Create a performer first</h3>
                <p>Auditions are tied to performer pages, so add a performer profile before using Career Tracker.</p>
                <Link href="/dashboard" className="btn-hero-primary" style={{ marginTop: "16px", display: "inline-flex" }}>
                  Go to Performers
                </Link>
              </div>
            ) : auditions.length === 0 ? (
              <div className="empty-state-card">
                <div className="empty-state-icon">🗂️</div>
                <h3>No auditions logged yet</h3>
                <p>Start tracking auditions, callbacks, and bookings to build a clearer picture of your performer&apos;s momentum.</p>
                <button type="button" className="btn-hero-primary" style={{ marginTop: "16px" }} onClick={handleOpenCreate}>
                  Log Your First Audition
                </button>
              </div>
            ) : (
              <div className="career-table-card">
                <div className="career-table-wrap">
                  <table className="career-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Performer</th>
                        <th>Project</th>
                        <th>Role</th>
                        <th>Casting Contact</th>
                        <th>Project Type</th>
                        <th>Stage</th>
                        <th>Outcome</th>
                        <th>Notes Preview</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAuditions.map((audition) => (
                        <tr key={audition.id}>
                          <td>{formatAuditionDate(audition.audition_date)}</td>
                          <td>
                            <Link href={`/dashboard?page=${audition.page_id}`} className="career-performer-link">
                              {audition.performer_name}
                            </Link>
                          </td>
                          <td>{audition.project}</td>
                          <td>{audition.role ?? "—"}</td>
                          <td>{audition.casting_contact ?? "—"}</td>
                          <td>{audition.project_type ? AUDITION_PROJECT_TYPE_LABELS[audition.project_type] : "—"}</td>
                          <td>{audition.audition_stage ? AUDITION_STAGE_LABELS[audition.audition_stage] : "—"}</td>
                          <td>
                            {audition.outcome ? (
                              <span className={`career-outcome-badge career-outcome-badge--${audition.outcome}`}>
                                {AUDITION_OUTCOME_LABELS[audition.outcome]}
                              </span>
                            ) : "—"}
                          </td>
                          <td>
                            <div className="career-notes-cell">
                              <span>{buildNotesPreview(audition.notes)}</span>
                              <div className="career-row-actions">
                                <button type="button" className="career-row-button" onClick={() => handleOpenEdit(audition)}>
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="career-row-button career-row-button--danger"
                                  onClick={() => handleDeleteAudition(audition)}
                                  disabled={deletingId === audition.id}
                                >
                                  {deletingId === audition.id ? "Deleting..." : "Delete"}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredAuditions.length === 0 ? (
                  <p className="career-no-results">No auditions match the current filters.</p>
                ) : null}
              </div>
            )}
          </section>

          <aside className="dashboard-sidebar" aria-label="Account details">
            <div className="sidebar-section plan-card">
              <h3>Plan & Settings</h3>

              <div className="plan-summary">
                <span className="plan-label">Current Plan:</span>
                <span className={`plan-badge ${isPlusActive ? "plan-plus" : "plan-free"}`}>
                  {isPlusActive ? "Plus Tier" : "Free Tier"}
                </span>
              </div>

              <div className="limits-progress">
                <div className="limits-header">
                  <span>Audition tracking:</span>
                  <strong>{isPlusActive ? `${auditions.length} logged` : `${auditions.length} / 5 auditions`}</strong>
                </div>
                <div className="progress-bar-container">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${Math.min(100, isPlusActive ? 100 : (auditions.length / (auditionLimit ?? 1)) * 100)}%`
                    }}
                  ></div>
                </div>
              </div>

              {isPlusActive ? (
                <div className="plus-active-box">
                  <p className="plus-features-note">✓ Unlimited audition tracking &bull; ✓ Custom Domains &bull; ✓ Prestige/Splash templates</p>
                  {hasStripeBilling ? (
                    <button onClick={handleManageBilling} disabled={billingLoading} className="btn-manage-billing">
                      {billingLoading ? "Loading..." : "Manage Subscription"}
                    </button>
                  ) : (
                    <p className="promo-code-success">Plus is active on this account via access code.</p>
                  )}
                </div>
              ) : (
                <div className="upgrade-upsell-box">
                  <h4>Upgrade to Plus</h4>
                  <p>Keep your family&apos;s tracker growing without limits.</p>
                  <ul>
                    <li>&bull; Unlimited audition tracking</li>
                    <li>&bull; Manage up to 4 sibling profiles</li>
                    <li>&bull; Access Splash & Prestige templates</li>
                    <li>&bull; Unlimited headshots and demo clips</li>
                  </ul>
                  <button onClick={handleUpgrade} disabled={billingLoading} className="btn-upgrade-now">
                    Upgrade for $49/year
                  </button>
                </div>
              )}
            </div>

            <div className="sidebar-section tips-box">
              <h4>Tracking Guidance</h4>
              <p>Consistent outcome updates make callback and booking rates meaningful, especially when your performer is juggling multiple submissions at once.</p>
              <p>Use notes to capture redirects, what worked in the room, and which casting offices keep bringing your performer back.</p>
            </div>

            <PromoCodeCard
              subscription={subscription}
              onSubscriptionUpdate={(nextSubscription) => setSubscription(nextSubscription)}
              body="Have a beta tester or incentive code? Redeem it here to unlock or extend Plus access without going through checkout."
            />
          </aside>
        </div>
      </main>

      {modalOpen ? (
        <AuditionModal
          audition={modalAudition}
          defaultPerformerId={performers[0]?.id ?? ""}
          performers={performers}
          castingContactSuggestions={castingContactSuggestions}
          saving={modalSaving}
          error={modalError}
          onClose={handleCloseModal}
          onSave={saveAudition}
        />
      ) : null}
    </div>
  );
}
