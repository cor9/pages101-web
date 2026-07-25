import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/opencall-admin";
import { generateInviteToken, buildInviteUrl } from "@/lib/opencall-admin";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// ─── Seed profile definitions ─────────────────────────────────────────────────
// 24 fictional performers covering the full test matrix. All guardian fields use
// example.com addresses (IANA reserved, never deliverable). No real children,
// real families, or copied résumé content.

const CONSENTS = {
  guardian_consent: "2026-07-28T00:00:00.000Z",
  reviewer_visibility_consent: "2026-07-28T00:00:00.000Z",
  contact_consent: "2026-07-28T00:00:00.000Z",
};

const P = "https://placehold.co"; // placeholder image base

// Media helpers — all URLs are clearly fictional test assets.
const img = (w: number, h: number, label = "Headshot") =>
  `${P}/${w}x${h}/1a1a2e/e5e7eb?text=${encodeURIComponent(label)}`;
const BROKEN_IMG = "https://seed-broken-image.example.com/404.jpg";
const BROKEN_RESUME = "https://seed-broken-resume.example.com/resume.pdf";

const LONG_NOTE =
  "This performer has been studying the craft since age four and brings a quiet intensity to every role. " +
  "Training includes scene study at the Young Actor Studio, improv with the Second City Youth Program, " +
  "and two seasons with the regional touring company of Into the Woods. Their natural comfort on camera " +
  "comes through in every audition — casting directors consistently note the ability to listen and react " +
  "rather than simply perform. Commercial credits include regional spots for a national grocery chain and " +
  "a nationally aired PSA. Theatrical credits include the lead role in a locally produced short film that " +
  "screened at three regional festivals. The family has Coogan blocked and the guardian holds an active " +
  "work permit on file. They are seeking a theatrical agent for co-star and recurring opportunities in " +
  "primetime and streaming, as well as a manager with a national client roster. Available for self-tape " +
  "turnarounds of 24 hours. Will consider relocating to Los Angeles for a significant booking. The " +
  "performer's reel has been updated as of spring 2026 and includes three commercial spots and two " +
  "dramatic scenes. Training reel available on request. No dialect coach required — native RP and " +
  "standard American both available. Musical training: voice (soprano), piano (grade 5), and jazz dance " +
  "at a competition level. This is an open call submission only; they are not actively seeking print or " +
  "hosting at this time but would consider the right opportunity on a case-by-case basis.";

type SeedProfile = {
  actor_name: string;
  birth_year: number;
  birth_month: number;
  gender: string;
  ethnicity: string[];
  city: string;
  state: string;
  country: string;
  local_hire_cities: string[];
  union_status: string;
  coogan_status: string;
  work_permit: string;
  passport: boolean;
  has_current_rep: boolean;
  current_rep_name: string | null;
  rep_context: string | null;
  seeking: string[];
  casting_platforms: string[];
  casting_profile_urls: string[];
  headshots: { type: string; url: string }[];
  resume_url: string;
  slate_url: string;
  reel_url: string | null;
  other_video_url: string | null;
  supplemental_notes: string | null;
  guardian_name: string;
  guardian_phone: string;
  note?: string; // internal edge-case label, not stored
};

const SEED_PROFILES: SeedProfile[] = [
  // ── Ages 6–9 ──────────────────────────────────────────────────────────────
  {
    // Standard: commercial + theatrical headshots, reel, short note. NYC.
    note: "standard:two-headshots",
    actor_name: "Zoe Park",
    birth_year: 2019, birth_month: 3,
    gender: "Female", ethnicity: ["asian"],
    city: "New York", state: "NY", country: "US",
    local_hire_cities: ["New York, NY"],
    union_status: "sag_member", coogan_status: "yes", work_permit: "not_required", passport: true,
    has_current_rep: true, current_rep_name: "Premier Youth Talent", rep_context: "Seeking theatrical agent to complement commercial manager.",
    seeking: ["theatrical", "commercial"],
    casting_platforms: ["actors_access"], casting_profile_urls: ["https://www.actorsaccess.com/members/seed-zoepark"],
    headshots: [
      { type: "commercial", url: img(600, 750, "Commercial") },
      { type: "theatrical", url: img(600, 750, "Theatrical") },
    ],
    resume_url: "https://example.com/seed-resume-001.pdf",
    slate_url: "https://example.com/seed-slate-001.mp4",
    reel_url: "https://example.com/seed-reel-001.mp4",
    other_video_url: null,
    supplemental_notes: "Strong dancer and singer with three years of training.",
    guardian_name: "Seed Guardian 001", guardian_phone: "555-010-0001",
  },
  {
    // ONE headshot only. No reel. LA.
    note: "edge:one-headshot,no-reel",
    actor_name: "Liam Torres",
    birth_year: 2018, birth_month: 7,
    gender: "Male", ethnicity: ["hispanic_latino"],
    city: "Los Angeles", state: "CA", country: "US",
    local_hire_cities: ["Los Angeles, CA"],
    union_status: "non_union", coogan_status: "no", work_permit: "not_required", passport: false,
    has_current_rep: false, current_rep_name: null, rep_context: null,
    seeking: ["commercial", "print"],
    casting_platforms: ["casting_networks"], casting_profile_urls: ["https://app.castingnetworks.com/talent/seed-liamtorres"],
    headshots: [{ type: "commercial", url: img(600, 750, "Commercial") }],
    resume_url: "https://example.com/seed-resume-002.pdf",
    slate_url: "https://example.com/seed-slate-002.mp4",
    reel_url: null,
    other_video_url: null,
    supplemental_notes: "First open call submission. Available for local commercial shoots.",
    guardian_name: "Seed Guardian 002", guardian_phone: "555-010-0002",
  },
  {
    // THREE headshots (commercial, theatrical, other). Chicago.
    note: "edge:three-headshots",
    actor_name: "Sofia Chen-Williams",
    birth_year: 2020, birth_month: 11,
    gender: "Female", ethnicity: ["asian", "white"],
    city: "Chicago", state: "IL", country: "US",
    local_hire_cities: ["Chicago, IL"],
    union_status: "sag_eligible", coogan_status: "yes", work_permit: "not_required", passport: true,
    has_current_rep: true, current_rep_name: "Midwest Youth Talent Group", rep_context: null,
    seeking: ["theatrical", "commercial", "musical_theater"],
    casting_platforms: ["actors_access"],
    casting_profile_urls: ["https://www.actorsaccess.com/members/seed-sofiacwilliams"],
    headshots: [
      { type: "commercial", url: img(600, 750, "Commercial") },
      { type: "theatrical", url: img(600, 750, "Theatrical") },
      { type: "other", url: img(600, 750, "Other") },
    ],
    resume_url: "https://example.com/seed-resume-003.pdf",
    slate_url: "https://example.com/seed-slate-003.mp4",
    reel_url: "https://example.com/seed-reel-003.mp4",
    other_video_url: null,
    supplemental_notes: null,
    guardian_name: "Seed Guardian 003", guardian_phone: "555-010-0003",
  },
  {
    // LONG supplemental note. Atlanta.
    note: "edge:long-note",
    actor_name: "Marcus Reed",
    birth_year: 2017, birth_month: 5,
    gender: "Male", ethnicity: ["black_african_american"],
    city: "Atlanta", state: "GA", country: "US",
    local_hire_cities: ["Atlanta, GA"],
    union_status: "non_union", coogan_status: "yes", work_permit: "not_required", passport: false,
    has_current_rep: false, current_rep_name: null, rep_context: null,
    seeking: ["theatrical", "commercial"],
    casting_platforms: ["actors_access"], casting_profile_urls: ["https://www.actorsaccess.com/members/seed-marcusreed"],
    headshots: [{ type: "commercial", url: img(600, 750, "Commercial") }],
    resume_url: "https://example.com/seed-resume-004.pdf",
    slate_url: "https://example.com/seed-slate-004.mp4",
    reel_url: "https://example.com/seed-reel-004.mp4",
    other_video_url: null,
    supplemental_notes: LONG_NOTE,
    guardian_name: "Seed Guardian 004", guardian_phone: "555-010-0004",
  },
  {
    // LANDSCAPE image (wider than tall). NYC.
    note: "edge:landscape-headshot",
    actor_name: "Avery Santos",
    birth_year: 2018, birth_month: 9,
    gender: "Non-binary", ethnicity: ["hispanic_latino"],
    city: "New York", state: "NY", country: "US",
    local_hire_cities: ["New York, NY", "Newark, NJ"],
    union_status: "sag_member", coogan_status: "yes", work_permit: "not_required", passport: true,
    has_current_rep: true, current_rep_name: "Tri-State Youth Reps", rep_context: null,
    seeking: ["theatrical", "voiceover"],
    casting_platforms: ["actors_access", "casting_networks"],
    casting_profile_urls: [
      "https://www.actorsaccess.com/members/seed-averysantos",
      "https://app.castingnetworks.com/talent/seed-averysantos",
    ],
    headshots: [
      { type: "commercial", url: img(900, 600, "Landscape+Headshot") },
    ],
    resume_url: "https://example.com/seed-resume-005.pdf",
    slate_url: "https://example.com/seed-slate-005.mp4",
    reel_url: null,
    other_video_url: null,
    supplemental_notes: "Voice-trained for VO. Strong improvisation background.",
    guardian_name: "Seed Guardian 005", guardian_phone: "555-010-0005",
  },
  {
    // LOW-RESOLUTION image. Dallas.
    note: "edge:low-res-headshot",
    actor_name: "Priya Mehta",
    birth_year: 2019, birth_month: 1,
    gender: "Female", ethnicity: ["asian"],
    city: "Dallas", state: "TX", country: "US",
    local_hire_cities: ["Dallas, TX"],
    union_status: "sag_eligible", coogan_status: "no", work_permit: "not_required", passport: false,
    has_current_rep: false, current_rep_name: null, rep_context: null,
    seeking: ["commercial", "print"],
    casting_platforms: ["casting_networks"], casting_profile_urls: ["https://app.castingnetworks.com/talent/seed-priyamehta"],
    headshots: [{ type: "commercial", url: img(120, 150, "LowRes") }],
    resume_url: "https://example.com/seed-resume-006.pdf",
    slate_url: "https://example.com/seed-slate-006.mp4",
    reel_url: null,
    other_video_url: null,
    supplemental_notes: "Print comp card available on request.",
    guardian_name: "Seed Guardian 006", guardian_phone: "555-010-0006",
  },

  // ── Ages 10–13 ────────────────────────────────────────────────────────────
  {
    // BROKEN IMAGE URL — tests the missing image fallback card and modal.
    note: "edge:broken-image",
    actor_name: "Noah Kim",
    birth_year: 2015, birth_month: 8,
    gender: "Male", ethnicity: ["asian"],
    city: "New York", state: "NY", country: "US",
    local_hire_cities: ["New York, NY"],
    union_status: "sag_member", coogan_status: "yes", work_permit: "not_required", passport: true,
    has_current_rep: false, current_rep_name: null, rep_context: null,
    seeking: ["theatrical", "commercial"],
    casting_platforms: ["actors_access"], casting_profile_urls: ["https://www.actorsaccess.com/members/seed-noahkim"],
    headshots: [{ type: "commercial", url: BROKEN_IMG }],
    resume_url: "https://example.com/seed-resume-007.pdf",
    slate_url: "https://example.com/seed-slate-007.mp4",
    reel_url: "https://example.com/seed-reel-007.mp4",
    other_video_url: null,
    supplemental_notes: "See broken image fallback.",
    guardian_name: "Seed Guardian 007", guardian_phone: "555-010-0007",
  },
  {
    // Missing reel. SEVERAL casting profiles (2 URLs). Denver.
    note: "edge:no-reel,two-casting-profiles",
    actor_name: "Isabella Moreno",
    birth_year: 2013, birth_month: 4,
    gender: "Female", ethnicity: ["hispanic_latino"],
    city: "Denver", state: "CO", country: "US",
    local_hire_cities: ["Denver, CO", "Boulder, CO"],
    union_status: "non_union", coogan_status: "yes", work_permit: "not_required", passport: false,
    has_current_rep: false, current_rep_name: null, rep_context: null,
    seeking: ["theatrical", "commercial", "voiceover"],
    casting_platforms: ["actors_access", "casting_networks"],
    casting_profile_urls: [
      "https://www.actorsaccess.com/members/seed-isabellamoreno",
      "https://app.castingnetworks.com/talent/seed-isabellamoreno",
    ],
    headshots: [
      { type: "commercial", url: img(600, 750, "Commercial") },
      { type: "theatrical", url: img(600, 750, "Theatrical") },
    ],
    resume_url: "https://example.com/seed-resume-008.pdf",
    slate_url: "https://example.com/seed-slate-008.mp4",
    reel_url: null,
    other_video_url: null,
    supplemental_notes: "Strong comedic timing. Improv study at Denver Theater Lab.",
    guardian_name: "Seed Guardian 008", guardian_phone: "555-010-0008",
  },
  {
    // Hyphenated surname. LA.
    note: "edge:hyphenated-surname",
    actor_name: "Ethan Jackson-Brown",
    birth_year: 2014, birth_month: 6,
    gender: "Male", ethnicity: ["black_african_american"],
    city: "Los Angeles", state: "CA", country: "US",
    local_hire_cities: ["Los Angeles, CA", "Burbank, CA"],
    union_status: "sag_eligible", coogan_status: "yes", work_permit: "not_required", passport: true,
    has_current_rep: true, current_rep_name: "West Coast Youth Collective", rep_context: "Has commercial manager; seeking theatrical agent.",
    seeking: ["theatrical", "commercial"],
    casting_platforms: ["actors_access"], casting_profile_urls: ["https://www.actorsaccess.com/members/seed-ejacksonbrown"],
    headshots: [
      { type: "commercial", url: img(600, 750, "Commercial") },
      { type: "theatrical", url: img(600, 750, "Theatrical") },
    ],
    resume_url: "https://example.com/seed-resume-009.pdf",
    slate_url: "https://example.com/seed-slate-009.mp4",
    reel_url: "https://example.com/seed-reel-009.mp4",
    other_video_url: null,
    supplemental_notes: "Co-star credit on national streaming drama (2025).",
    guardian_name: "Seed Guardian 009", guardian_phone: "555-010-0009",
  },
  {
    // BROKEN RESUME URL. Seattle.
    note: "edge:broken-resume",
    actor_name: "Alyssa Nguyen",
    birth_year: 2016, birth_month: 2,
    gender: "Female", ethnicity: ["asian"],
    city: "Seattle", state: "WA", country: "US",
    local_hire_cities: ["Seattle, WA"],
    union_status: "sag_member", coogan_status: "yes", work_permit: "not_required", passport: true,
    has_current_rep: false, current_rep_name: null, rep_context: null,
    seeking: ["theatrical", "commercial", "voiceover"],
    casting_platforms: ["actors_access"], casting_profile_urls: ["https://www.actorsaccess.com/members/seed-alyssanguyen"],
    headshots: [{ type: "commercial", url: img(600, 750, "Commercial") }],
    resume_url: BROKEN_RESUME,
    slate_url: "https://example.com/seed-slate-010.mp4",
    reel_url: "https://example.com/seed-reel-010.mp4",
    other_video_url: null,
    supplemental_notes: "VO credits include three national podcast ads.",
    guardian_name: "Seed Guardian 010", guardian_phone: "555-010-0010",
  },
  {
    // MULTIPLE video clips (reel_url + other_video_url). Nashville.
    note: "edge:multiple-video-clips",
    actor_name: "Caleb Fitzgerald",
    birth_year: 2015, birth_month: 10,
    gender: "Male", ethnicity: ["white"],
    city: "Nashville", state: "TN", country: "US",
    local_hire_cities: ["Nashville, TN"],
    union_status: "non_union", coogan_status: "no", work_permit: "not_required", passport: false,
    has_current_rep: true, current_rep_name: "Southern Youth Talent", rep_context: null,
    seeking: ["theatrical", "commercial", "musical_theater"],
    casting_platforms: ["actors_access"], casting_profile_urls: ["https://www.actorsaccess.com/members/seed-calebfitzgerald"],
    headshots: [
      { type: "commercial", url: img(600, 750, "Commercial") },
      { type: "theatrical", url: img(600, 750, "Theatrical") },
    ],
    resume_url: "https://example.com/seed-resume-011.pdf",
    slate_url: "https://example.com/seed-slate-011.mp4",
    reel_url: "https://example.com/seed-reel-011.mp4",
    other_video_url: "https://example.com/seed-musical-011.mp4",
    supplemental_notes: "Musical theater emphasis. Voice trained (baritone). Tap and jazz.",
    guardian_name: "Seed Guardian 011", guardian_phone: "555-010-0011",
  },
  {
    // Musical theater seeking. NO supplemental note. Chicago.
    note: "edge:no-note,musical-theater",
    actor_name: "Maya Okonkwo",
    birth_year: 2013, birth_month: 12,
    gender: "Female", ethnicity: ["black_african_american"],
    city: "Chicago", state: "IL", country: "US",
    local_hire_cities: ["Chicago, IL"],
    union_status: "sag_eligible", coogan_status: "yes", work_permit: "not_required", passport: true,
    has_current_rep: true, current_rep_name: "Chicago Stage Rep", rep_context: null,
    seeking: ["musical_theater", "theatrical"],
    casting_platforms: ["actors_access", "casting_networks"],
    casting_profile_urls: [
      "https://www.actorsaccess.com/members/seed-mayaokonkwo",
      "https://app.castingnetworks.com/talent/seed-mayaokonkwo",
    ],
    headshots: [{ type: "theatrical", url: img(600, 750, "Theatrical") }],
    resume_url: "https://example.com/seed-resume-012.pdf",
    slate_url: "https://example.com/seed-slate-012.mp4",
    reel_url: null,
    other_video_url: null,
    supplemental_notes: null,
    guardian_name: "Seed Guardian 012", guardian_phone: "555-010-0012",
  },

  // ── Ages 14–17 ────────────────────────────────────────────────────────────
  {
    // Print/modeling. MANY local-hire markets (5 cities). Phoenix.
    note: "edge:many-local-hire-markets,print",
    actor_name: "Ryan Walsh",
    birth_year: 2012, birth_month: 3,
    gender: "Male", ethnicity: ["white"],
    city: "Phoenix", state: "AZ", country: "US",
    local_hire_cities: ["Phoenix, AZ", "Tucson, AZ", "Scottsdale, AZ", "Las Vegas, NV", "Albuquerque, NM"],
    union_status: "non_union", coogan_status: "yes", work_permit: "not_required", passport: false,
    has_current_rep: false, current_rep_name: null, rep_context: null,
    seeking: ["print", "commercial"],
    casting_platforms: ["other"], casting_profile_urls: ["https://www.instagram.com/seed_ryanwalsh_actor"],
    headshots: [
      { type: "commercial", url: img(600, 750, "Commercial") },
      { type: "other", url: img(600, 750, "Print") },
    ],
    resume_url: "https://example.com/seed-resume-013.pdf",
    slate_url: "https://example.com/seed-slate-013.mp4",
    reel_url: null,
    other_video_url: null,
    supplemental_notes: "Regional print campaigns for outdoor apparel brands.",
    guardian_name: "Seed Guardian 013", guardian_phone: "555-010-0013",
  },
  {
    // Long hyphenated name. Voiceover focus. NYC.
    note: "edge:long-hyphenated-name,voiceover",
    actor_name: "Valentina Cruz-García",
    birth_year: 2010, birth_month: 6,
    gender: "Female", ethnicity: ["hispanic_latino"],
    city: "New York", state: "NY", country: "US",
    local_hire_cities: ["New York, NY"],
    union_status: "sag_member", coogan_status: "yes", work_permit: "not_required", passport: true,
    has_current_rep: true, current_rep_name: "Empire State Youth Agency", rep_context: null,
    seeking: ["voiceover", "theatrical"],
    casting_platforms: ["actors_access"], casting_profile_urls: ["https://www.actorsaccess.com/members/seed-vcruzgarcia"],
    headshots: [{ type: "commercial", url: img(600, 750, "Commercial") }],
    resume_url: "https://example.com/seed-resume-014.pdf",
    slate_url: "https://example.com/seed-slate-014.mp4",
    reel_url: "https://example.com/seed-vo-014.mp4",
    other_video_url: null,
    supplemental_notes: "Bilingual (English / Spanish). VO credits include animation and national radio.",
    guardian_name: "Seed Guardian 014", guardian_phone: "555-010-0014",
  },
  {
    // Short name. Hosting/MCing. LA.
    note: "edge:short-name,hosting",
    actor_name: "Jake Ma",
    birth_year: 2011, birth_month: 9,
    gender: "Male", ethnicity: ["asian"],
    city: "Los Angeles", state: "CA", country: "US",
    local_hire_cities: ["Los Angeles, CA"],
    union_status: "sag_eligible", coogan_status: "yes", work_permit: "not_required", passport: true,
    has_current_rep: false, current_rep_name: null, rep_context: null,
    seeking: ["hosting", "commercial"],
    casting_platforms: ["actors_access", "casting_networks"],
    casting_profile_urls: [
      "https://www.actorsaccess.com/members/seed-jakema",
      "https://app.castingnetworks.com/talent/seed-jakema",
    ],
    headshots: [
      { type: "commercial", url: img(600, 750, "Commercial") },
    ],
    resume_url: "https://example.com/seed-resume-015.pdf",
    slate_url: "https://example.com/seed-slate-015.mp4",
    reel_url: "https://example.com/seed-hosting-015.mp4",
    other_video_url: null,
    supplemental_notes: "Former host of youth YouTube channel (100k+ subscribers). Naturally teleprompter-ready.",
    guardian_name: "Seed Guardian 015", guardian_phone: "555-010-0015",
  },
  {
    // UNUSUALLY TALL image (portrait extreme). Atlanta.
    note: "edge:tall-headshot",
    actor_name: "Destiny Williams",
    birth_year: 2009, birth_month: 2,
    gender: "Female", ethnicity: ["black_african_american"],
    city: "Atlanta", state: "GA", country: "US",
    local_hire_cities: ["Atlanta, GA"],
    union_status: "sag_member", coogan_status: "yes", work_permit: "not_required", passport: true,
    has_current_rep: true, current_rep_name: "ATL Youth Talent Collective", rep_context: null,
    seeking: ["theatrical", "commercial"],
    casting_platforms: ["actors_access"], casting_profile_urls: ["https://www.actorsaccess.com/members/seed-destinywilliams"],
    headshots: [
      { type: "theatrical", url: img(300, 800, "Tall+Portrait") },
    ],
    resume_url: "https://example.com/seed-resume-016.pdf",
    slate_url: "https://example.com/seed-slate-016.mp4",
    reel_url: "https://example.com/seed-reel-016.mp4",
    other_video_url: null,
    supplemental_notes: "Drama Desk nomination for regional theater. Series regular in local youth drama.",
    guardian_name: "Seed Guardian 016", guardian_phone: "555-010-0016",
  },
  {
    // Commercial only. Single local-hire market. Houston.
    note: "edge:commercial-only,single-market",
    actor_name: "Nadia Al-Hassan",
    birth_year: 2012, birth_month: 11,
    gender: "Female", ethnicity: ["middle_eastern_north_african"],
    city: "Houston", state: "TX", country: "US",
    local_hire_cities: ["Houston, TX"],
    union_status: "non_union", coogan_status: "no", work_permit: "not_required", passport: false,
    has_current_rep: false, current_rep_name: null, rep_context: null,
    seeking: ["commercial"],
    casting_platforms: ["other"], casting_profile_urls: ["https://www.instagram.com/seed_nadiaah_actor"],
    headshots: [{ type: "commercial", url: img(600, 750, "Commercial") }],
    resume_url: "https://example.com/seed-resume-017.pdf",
    slate_url: "https://example.com/seed-slate-017.mp4",
    reel_url: null,
    other_video_url: null,
    supplemental_notes: "Three regional commercial bookings in the last 12 months.",
    guardian_name: "Seed Guardian 017", guardian_phone: "555-010-0017",
  },
  {
    // Very long multi-part name. All seeking. Chicago.
    note: "edge:long-multi-part-name,all-seeking",
    actor_name: "Lucas Park Fernandez Romano",
    birth_year: 2010, birth_month: 5,
    gender: "Male", ethnicity: ["hispanic_latino", "asian"],
    city: "Chicago", state: "IL", country: "US",
    local_hire_cities: ["Chicago, IL", "Milwaukee, WI"],
    union_status: "sag_eligible", coogan_status: "yes", work_permit: "not_required", passport: true,
    has_current_rep: true, current_rep_name: "Midwest Prestige Talent", rep_context: "Seeking additional regional rep for Midwest markets.",
    seeking: ["theatrical", "commercial", "voiceover", "musical_theater", "hosting", "print"],
    casting_platforms: ["actors_access", "casting_networks"],
    casting_profile_urls: [
      "https://www.actorsaccess.com/members/seed-lpfromano",
      "https://app.castingnetworks.com/talent/seed-lpfromano",
    ],
    headshots: [
      { type: "commercial", url: img(600, 750, "Commercial") },
      { type: "theatrical", url: img(600, 750, "Theatrical") },
    ],
    resume_url: "https://example.com/seed-resume-018.pdf",
    slate_url: "https://example.com/seed-slate-018.mp4",
    reel_url: "https://example.com/seed-reel-018.mp4",
    other_video_url: "https://example.com/seed-musical-018.mp4",
    supplemental_notes: "Trilingual (English, Spanish, Mandarin). National commercial credit (2025). Chess champion.",
    guardian_name: "Seed Guardian 018", guardian_phone: "555-010-0018",
  },

  // ── Ages 18–21 ────────────────────────────────────────────────────────────
  {
    // All seeking categories. Represented. LA.
    note: "standard:all-seeking,represented",
    actor_name: "Emma Cooper",
    birth_year: 2008, birth_month: 7,
    gender: "Female", ethnicity: ["white"],
    city: "Los Angeles", state: "CA", country: "US",
    local_hire_cities: ["Los Angeles, CA"],
    union_status: "non_union", coogan_status: "yes", work_permit: "not_required", passport: true,
    has_current_rep: true, current_rep_name: "Pacific Rim Talent", rep_context: "Seeking manager to complement theatrical agent.",
    seeking: ["theatrical", "commercial", "voiceover", "print"],
    casting_platforms: ["actors_access"], casting_profile_urls: ["https://www.actorsaccess.com/members/seed-emmacooper"],
    headshots: [
      { type: "commercial", url: img(600, 750, "Commercial") },
      { type: "theatrical", url: img(600, 750, "Theatrical") },
    ],
    resume_url: "https://example.com/seed-resume-019.pdf",
    slate_url: "https://example.com/seed-slate-019.mp4",
    reel_url: "https://example.com/seed-reel-019.mp4",
    other_video_url: null,
    supplemental_notes: "Recent guest star on streaming comedy (2026). Daytime-and-primetime range.",
    guardian_name: "Seed Guardian 019", guardian_phone: "555-010-0019",
  },
  {
    // SAG, single local-hire market. Unrepresented. NYC.
    note: "standard:sag,single-market,unrepresented",
    actor_name: "Dylan James",
    birth_year: 2005, birth_month: 4,
    gender: "Male", ethnicity: ["white"],
    city: "New York", state: "NY", country: "US",
    local_hire_cities: ["New York, NY"],
    union_status: "sag_member", coogan_status: "yes", work_permit: "not_required", passport: true,
    has_current_rep: false, current_rep_name: null, rep_context: null,
    seeking: ["theatrical", "commercial"],
    casting_platforms: ["actors_access"], casting_profile_urls: ["https://www.actorsaccess.com/members/seed-dylanjames"],
    headshots: [
      { type: "commercial", url: img(600, 750, "Commercial") },
      { type: "theatrical", url: img(600, 750, "Theatrical") },
    ],
    resume_url: "https://example.com/seed-resume-020.pdf",
    slate_url: "https://example.com/seed-slate-020.mp4",
    reel_url: "https://example.com/seed-reel-020.mp4",
    other_video_url: null,
    supplemental_notes: "SAG member via student film. Available for NYC and surrounding markets.",
    guardian_name: "Seed Guardian 020", guardian_phone: "555-010-0020",
  },
  {
    // Hyphenated surname. DC area. SAG-eligible.
    note: "edge:hyphenated-surname,dc",
    actor_name: "Bianca Osei-Mensah",
    birth_year: 2007, birth_month: 8,
    gender: "Female", ethnicity: ["black_african_american"],
    city: "Washington", state: "DC", country: "US",
    local_hire_cities: ["Washington, DC", "Baltimore, MD", "Richmond, VA"],
    union_status: "sag_eligible", coogan_status: "yes", work_permit: "not_required", passport: true,
    has_current_rep: true, current_rep_name: "Capitol Talent Group", rep_context: null,
    seeking: ["theatrical", "commercial", "hosting"],
    casting_platforms: ["actors_access", "casting_networks"],
    casting_profile_urls: [
      "https://www.actorsaccess.com/members/seed-boseimensah",
      "https://app.castingnetworks.com/talent/seed-boseimensah",
    ],
    headshots: [
      { type: "commercial", url: img(600, 750, "Commercial") },
      { type: "theatrical", url: img(600, 750, "Theatrical") },
    ],
    resume_url: "https://example.com/seed-resume-021.pdf",
    slate_url: "https://example.com/seed-slate-021.mp4",
    reel_url: "https://example.com/seed-reel-021.mp4",
    other_video_url: null,
    supplemental_notes: "Regional Emmy nomination for youth documentary host (2025).",
    guardian_name: "Seed Guardian 021", guardian_phone: "555-010-0021",
  },
  {
    // Short name. Non-binary. Unrepresented. Miami.
    note: "edge:short-name,non-binary",
    actor_name: "Alex Reyes",
    birth_year: 2006, birth_month: 3,
    gender: "Non-binary", ethnicity: ["hispanic_latino"],
    city: "Miami", state: "FL", country: "US",
    local_hire_cities: ["Miami, FL", "Fort Lauderdale, FL"],
    union_status: "non_union", coogan_status: "no", work_permit: "not_required", passport: false,
    has_current_rep: false, current_rep_name: null, rep_context: null,
    seeking: ["theatrical", "voiceover"],
    casting_platforms: ["casting_networks"], casting_profile_urls: ["https://app.castingnetworks.com/talent/seed-alexreyes"],
    headshots: [{ type: "commercial", url: img(600, 750, "Commercial") }],
    resume_url: "https://example.com/seed-resume-022.pdf",
    slate_url: "https://example.com/seed-slate-022.mp4",
    reel_url: "https://example.com/seed-reel-022.mp4",
    other_video_url: null,
    supplemental_notes: "Bilingual (English / Spanish). Voice-over demo reel features animation and commercial styles.",
    guardian_name: "Seed Guardian 022", guardian_phone: "555-010-0022",
  },
  {
    // SAG, several casting profiles, represented. LA.
    note: "edge:two-casting-profiles,represented",
    actor_name: "Megan Li",
    birth_year: 2008, birth_month: 11,
    gender: "Female", ethnicity: ["asian"],
    city: "Los Angeles", state: "CA", country: "US",
    local_hire_cities: ["Los Angeles, CA", "San Diego, CA"],
    union_status: "sag_member", coogan_status: "yes", work_permit: "not_required", passport: true,
    has_current_rep: true, current_rep_name: "Beacon Talent Management", rep_context: null,
    seeking: ["theatrical", "commercial"],
    casting_platforms: ["actors_access", "casting_networks"],
    casting_profile_urls: [
      "https://www.actorsaccess.com/members/seed-meganli",
      "https://app.castingnetworks.com/talent/seed-meganli",
    ],
    headshots: [
      { type: "commercial", url: img(600, 750, "Commercial") },
      { type: "theatrical", url: img(600, 750, "Theatrical") },
    ],
    resume_url: "https://example.com/seed-resume-023.pdf",
    slate_url: "https://example.com/seed-slate-023.mp4",
    reel_url: "https://example.com/seed-reel-023.mp4",
    other_video_url: null,
    supplemental_notes: "Series regular on regional streaming show (2025–2026). Extensive self-tape experience.",
    guardian_name: "Seed Guardian 023", guardian_phone: "555-010-0023",
  },
  {
    // All seeking, multiple videos, long note, unrepresented. Chicago.
    note: "edge:all-seeking,multiple-videos,unrepresented",
    actor_name: "Jordan Williams-Scott",
    birth_year: 2007, birth_month: 1,
    gender: "Male", ethnicity: ["black_african_american", "white"],
    city: "Chicago", state: "IL", country: "US",
    local_hire_cities: ["Chicago, IL", "Milwaukee, WI", "Indianapolis, IN"],
    union_status: "non_union", coogan_status: "yes", work_permit: "not_required", passport: true,
    has_current_rep: false, current_rep_name: null, rep_context: null,
    seeking: ["theatrical", "commercial", "voiceover", "musical_theater", "print", "hosting"],
    casting_platforms: ["actors_access", "casting_networks"],
    casting_profile_urls: [
      "https://www.actorsaccess.com/members/seed-jwilliamsscott",
      "https://app.castingnetworks.com/talent/seed-jwilliamsscott",
    ],
    headshots: [
      { type: "commercial", url: img(600, 750, "Commercial") },
      { type: "theatrical", url: img(600, 750, "Theatrical") },
    ],
    resume_url: "https://example.com/seed-resume-024.pdf",
    slate_url: "https://example.com/seed-slate-024.mp4",
    reel_url: "https://example.com/seed-reel-024.mp4",
    other_video_url: "https://example.com/seed-musical-024.mp4",
    supplemental_notes: LONG_NOTE,
    guardian_name: "Seed Guardian 024", guardian_phone: "555-010-0024",
  },
];

// ─── GET /api/opencall/admin/seed — list seed applications for an event ───────

export async function GET(request: Request) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const { serviceClient } = auth;

  const url = new URL(request.url);
  const eventId = url.searchParams.get("event_id");
  if (!eventId) {
    return NextResponse.json({ error: "event_id is required." }, { status: 400 });
  }

  const { data, error } = await serviceClient
    .from("p101_opencall_applications")
    .select("id, actor_name, gender, city, state, birth_year, union_status, has_current_rep, status, submitted_at, created_at")
    .eq("event_id", eventId)
    .eq("is_seed", true)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to load seed applications." }, { status: 500 });
  }

  return NextResponse.json({ applications: data ?? [], total: (data ?? []).length });
}

// ─── POST /api/opencall/admin/seed — create seed applications ────────────────

export async function POST(request: Request) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const { serviceClient, user } = auth;

  const body = await request.json().catch(() => ({})) as {
    event_id?: string;
    action?: "batch" | "preview_invite";
  };

  if (!body.event_id) {
    return NextResponse.json({ error: "event_id is required." }, { status: 400 });
  }

  // Verify the event exists and is a test event.
  const { data: event, error: eventError } = await serviceClient
    .from("p101_opencall_events")
    .select("id, name, is_test, year")
    .eq("id", body.event_id)
    .maybeSingle<{ id: string; name: string; is_test: boolean; year: number }>();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  if (!event.is_test) {
    return NextResponse.json({
      error: "Seed data can only be created for test events (is_test = true). Use the Gallery Preview event (year 9998)."
    }, { status: 422 });
  }

  // ── Generate preview invite ───────────────────────────────────────────────
  if (body.action === "preview_invite") {
    const { rawToken, tokenHash } = generateInviteToken();
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days

    const { error: inviteError } = await serviceClient
      .from("p101_opencall_rep_invites")
      .insert({
        event_id: body.event_id,
        rep_name: "Admin Preview",
        rep_email: user.email,
        rep_agency: "Child Actor 101 Admin",
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

    if (inviteError) {
      return NextResponse.json({ error: "Failed to create preview invite." }, { status: 500 });
    }

    return NextResponse.json({ preview_url: buildInviteUrl(rawToken) });
  }

  // ── Batch seed ────────────────────────────────────────────────────────────
  const submittedAt = new Date().toISOString();
  const rows = SEED_PROFILES.map((p) => ({
    event_id: body.event_id,
    user_id: user.id,
    is_seed: true,
    status: "submitted" as const,
    submitted_at: submittedAt,
    actor_name: p.actor_name,
    birth_year: p.birth_year,
    birth_month: p.birth_month,
    gender: p.gender,
    ethnicity: p.ethnicity,
    city: p.city,
    state: p.state,
    country: p.country,
    local_hire_cities: p.local_hire_cities,
    union_status: p.union_status,
    coogan_status: p.coogan_status,
    work_permit: p.work_permit,
    passport: p.passport,
    has_current_rep: p.has_current_rep,
    current_rep_name: p.current_rep_name,
    rep_context: p.rep_context,
    seeking: p.seeking,
    casting_platforms: p.casting_platforms,
    casting_profile_urls: p.casting_profile_urls,
    headshots: p.headshots,
    resume_url: p.resume_url,
    slate_url: p.slate_url,
    reel_url: p.reel_url,
    other_video_url: p.other_video_url,
    supplemental_notes: p.supplemental_notes,
    guardian_name: p.guardian_name,
    guardian_email: `seed+${p.actor_name.replace(/\s+/g, "").toLowerCase().slice(0, 20)}@example.com`,
    guardian_phone: p.guardian_phone,
    consents: CONSENTS,
  }));

  const { data: inserted, error: insertError } = await serviceClient
    .from("p101_opencall_applications")
    .insert(rows)
    .select("id, actor_name");

  if (insertError) {
    return NextResponse.json({ error: `Insert failed: ${insertError.message}` }, { status: 500 });
  }

  return NextResponse.json({
    created: (inserted ?? []).length,
    applications: inserted ?? [],
  }, { status: 201 });
}

// ─── DELETE /api/opencall/admin/seed — delete all seed data for an event ─────

export async function DELETE(request: Request) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const { serviceClient } = auth;

  const url = new URL(request.url);
  const eventId = url.searchParams.get("event_id");
  const confirm = url.searchParams.get("confirm");

  if (!eventId) {
    return NextResponse.json({ error: "event_id is required." }, { status: 400 });
  }
  if (confirm !== "DELETE SEED DATA") {
    return NextResponse.json({ error: "Missing confirmation. Pass confirm=DELETE+SEED+DATA." }, { status: 400 });
  }

  // Find seed application IDs for this event (for FK-safe cascade order).
  const { data: seedApps, error: findError } = await serviceClient
    .from("p101_opencall_applications")
    .select("id")
    .eq("event_id", eventId)
    .eq("is_seed", true);

  if (findError) {
    return NextResponse.json({ error: "Failed to find seed applications." }, { status: 500 });
  }

  if (!seedApps || seedApps.length === 0) {
    return NextResponse.json({ deleted: 0, message: "No seed applications found for this event." });
  }

  const seedIds = seedApps.map((r: { id: string }) => r.id);
  const counts: Record<string, number> = {};

  // 1. Delete intro requests
  const { count: introCount } = await serviceClient
    .from("p101_opencall_intro_requests")
    .delete({ count: "exact" })
    .in("application_id", seedIds);
  counts.intro_requests = introCount ?? 0;

  // 2. Delete favorites
  const { count: favCount } = await serviceClient
    .from("p101_opencall_rep_favorites")
    .delete({ count: "exact" })
    .in("application_id", seedIds);
  counts.favorites = favCount ?? 0;

  // 3. Null out access log references (on delete set null is not on this FK;
  //    we clear manually to preserve the audit log rows).
  await serviceClient
    .from("p101_opencall_access_log")
    .update({ application_id: null })
    .in("application_id", seedIds);

  // 4. Delete seed applications.
  const { count: appCount, error: deleteError } = await serviceClient
    .from("p101_opencall_applications")
    .delete({ count: "exact" })
    .in("id", seedIds)
    .eq("is_seed", true); // safety: never touch real applications

  if (deleteError) {
    return NextResponse.json({ error: `Delete failed: ${deleteError.message}` }, { status: 500 });
  }
  counts.applications = appCount ?? 0;

  return NextResponse.json({ deleted: true, counts });
}

// ─── GET /api/opencall/admin/seed/profiles — return the profile list metadata ─

// This is handled by the same route via a query param; no separate file needed.
