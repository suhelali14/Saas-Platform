# Native App Specification

## Platform & stack decision

**React Native (Expo) for the consumer app**, single codebase for iOS +
Android. Rationale: small team needs to ship one product across both
platforms fast; Expo removes most native-build friction for an early-stage
team; ecosystem support for push notifications, maps, and payments (all
needed here) is mature. Flutter is a reasonable alternative if the team has
existing Dart expertise — otherwise React Native's larger hiring pool and
shared TypeScript types with the backend/business-portal (also
TypeScript) is the deciding factor. Native Swift/Kotlin is not justified at
this stage — no feature here requires it, and it doubles build cost.

**Business Portal is a responsive web app (Next.js), not native**, at
least through Phase 3. Business owners primarily manage this from a desk
or a mobile browser occasionally; a native app for the business side is
premature until usage data says otherwise.

## Screen map

```
Onboarding
 ├─ Splash / value prop (3 screens max)
 ├─ Location permission + city selection
 └─ Phone/OTP or Google/Apple sign-in

Home
 └─ "What do you need?" input (text now, voice mic icon reserved for later)
     └─ Suggested prompts for the active city/verticals (helps first-time
        users understand what the box is for)

Intent Clarification (conditional)
 └─ Chat-style single follow-up question when the agent's confidence is low
     (see 04-multi-agent-design.md) — shown as chips/quick-replies, not a
     full chat UI, to keep it fast

Results
 ├─ Structured filter summary (editable chips: budget, location radius,
 │   timing) shown above results so the user can correct a misparse
 ├─ Ranked result cards (3-5): business name, offer, price, distance,
 │   rating/verified-transaction count, one-line "why this matches"
 └─ "Ask a question" quick action per card (routes into agent thread)

Compare
 └─ Side-by-side of 2-3 selected cards

Business Profile
 ├─ Photos, description, offers, availability calendar/slots
 ├─ Reviews (verified-transaction badge distinguished from unverified)
 └─ CTA: Book/Buy in-app, or "Contact business" (tracked referral) for
     categories without in-app checkout yet

Booking / Checkout
 ├─ Slot/date selection (where applicable)
 ├─ Payment (via payment aggregator SDK)
 └─ Confirmation + calendar add

Order/Booking Status
 └─ Status timeline, business contact, cancellation/refund flow

Open Requests (Phase 3+)
 ├─ Post a request (higher-consideration categories: photographer,
 │   contractor, event services)
 └─ Feed of proposals received per request, compare, accept

Rewards / Wallet (Phase 4+)
 ├─ Referral link/code, credits balance, redemption history

Profile / Settings
 ├─ Saved preferences, past requests, payment methods, notification prefs
 └─ Privacy controls: what intent history is stored, delete/export data

Notifications
 └─ Match found, business responded, booking confirmed, offer expiring
```

## Current implementation (Phase 1)

What's actually built in `apps/mobile`, as of
[14-mvp-implementation-plan.md](14-mvp-implementation-plan.md) M1/M2/M4/M5,
plus a design/architecture pass and a consistency/responsiveness pass on
top of it:

- **Navigation:** bottom tabs (Home, Explore, Activity, Profile), each
  owning its own stack. `Home → Results → BusinessProfile`,
  `Activity → Results → BusinessProfile`, and `Explore → Results →
  BusinessProfile` share the same two pushed screens
  (`src/navigation/types.ts`'s `SharedStackParamList`), not duplicated.
  Every tab root screen sets `headerShown: false` and renders its own
  header — this is load-bearing, not cosmetic: without it, react-navigation's
  native header stacks on top of the screen's own header (a real bug this
  pass found and fixed). Pushed detail screens (Results, BusinessProfile,
  Preferences, InviteFriends, ChangePassword) keep the native header and
  don't render their own. `Compare`, `Booking/Checkout`,
  `Order/Booking Status`, `Open Requests`, `Rewards/Wallet` (beyond a
  referral code), and real `Notifications` are not built yet — correctly
  out of scope until their backing services exist (Phase 2-4 per
  [07-roadmap-phases.md](07-roadmap-phases.md)).
- **Screens live:** Onboarding (3-slide intro) → Welcome → Login/Register/
  Continue as Guest → Home (intent box, category shortcuts, real recent
  searches, real business list — all from the API, no placeholder arrays),
  Explore (category-filtered business browsing, real data), Results
  (now a chat thread, not a static results page — see "Conversational
  refinement" below), Business Profile (read-only — no functional
  contact CTA yet, deliberately: a button with nothing behind it is worse
  than no button until Phase 2's transaction flow exists), Activity
  (request history with working client-side search), Profile (account +
  menu → Preferences, Change Password, Customer Support via real
  `mailto:`, Logout), Preferences (the structured `UserProfile` from doc
  13, surfaced as "your AI preferences"), Change Password (real endpoint),
  Invite Friends (a real, per-user referral code derived server-side, not
  a hardcoded string — full reward tracking/payout is still Phase 4 per
  [08-business-model-gtm.md](08-business-model-gtm.md)'s referral loop,
  not built yet, so the screen doesn't promise a reward amount it can't
  pay out).
- **Design system:** `src/theme/tokens.ts` (colors, spacing, radius,
  typography, shadows) is the single source for the app's look, pulled
  from the real Figma file (see below) — screens pull from it rather than
  hardcoding values. `src/components/` (Button, Card, Badge,
  ScreenContainer, TextField, AppLogo, LoadingState/EmptyState/ErrorState)
  is the shared component library.
- **Consistent safe-area handling:** `ScreenContainer` takes an `edges`
  prop (default `["bottom"]`, for screens with a native header already
  consuming the top inset; tab-root screens pass
  `edges={["top","bottom"]}` since they have no native header). Every
  screen uses `ScreenContainer` (or, for `FlatList`-based screens,
  `ScreenContainer scroll={false}`) — a few screens previously imported it
  and then rendered a raw `View`/`ScrollView` instead, which this pass
  fixed. `useWindowDimensions()` replaced one-time `Dimensions.get()`
  calls (Onboarding, Invite Friends) so sizing actually responds to
  rotation/fold instead of freezing at whatever the screen size was on
  first render.
- **Data layer:** `@tanstack/react-query` for every server-data screen —
  declarative loading/error states instead of hand-rolled `useState` per
  screen, plus caching. The submit-intent mutation primes the results
  query cache with its own response (`src/hooks/useSubmitIntent.ts`), so
  navigating straight to Results after submitting renders instantly
  instead of re-fetching what was just received.
- **Auth:** anonymous-device (docs/14 M5) plus real email/password
  register/login — see Cross-cutting concerns below, not yet upgraded to
  phone/OTP.
- **No hardcoded/placeholder data:** every list on Home, Explore, Activity,
  and Results renders real API data. There were several fake-data
  regressions from an earlier pass reusing unmodified template content
  (a hardcoded "4.8" rating and "2.5km" distance on every match card, two
  hardcoded "recent searches," two hardcoded "trending" business cards, a
  hardcoded referral promo code, and an entire Explore tab that was
  unmodified AI-chat-app template content unrelated to what Intently
  does) — all replaced with real data or removed. Distance specifically
  is removed rather than faked: no geolocation feature exists yet
  (`IntentRequest.location` and `Business.location` are in the schema but
  nothing populates or compares them today).

- **Conversational refinement:** `ResultsScreen` (`src/screens/ResultsScreen.tsx`)
  is a chat thread, not a scroll-and-forget results page — see doc 04's
  "Conversational refinement" for the backend flow. It renders the
  `IntentMessage` thread as chat bubbles (`src/components/ChatBubble.tsx`)
  with the current match list pinned after the latest turn, a fixed input
  bar (`KeyboardAvoidingView` + `useHeaderHeight()` from
  `@react-navigation/elements`, since Results keeps its native header),
  and `src/hooks/useSendIntentMessage.ts` for the refinement mutation
  (same cache-priming pattern as `useSubmitIntent`). A clarifying question
  from the agent is just the next assistant bubble — there's no separate
  clarification banner anymore.

## Key UX principles

- **The intent box is the product.** Nothing on the home screen should
  compete with it for attention — no ad-like banners, no infinite feed.
- **Never show a black-box result.** Always show the structured
  interpretation of the request above results, editable, so trust is
  earned even when the parse is imperfect.
- **Curate, don't dump.** 3-5 ranked results, not an exhaustive list — the
  brainstorm's own instinct here (this is a decision engine, not a search
  engine) is correct and should be enforced as a hard UI constraint.
- **Distinguish organic vs. promoted results** the moment priority bidding
  ships (Phase 4) — a clear "Promoted" label, never disguised.
- **Every screen that shows a business claim (price, availability) reflects
  live backend data** — no cached/stale claims that could embarrass the
  platform when a user shows up and the offer is gone.

## Cross-cutting technical concerns

- **Auth:** anonymous-device auth (docs/14 M5) plus real email/password
  register/login now — three ways in: Login, Sign Up, or Continue as
  Guest, gated by a splash screen while the session is checked. Phone/OTP
  and Google/Apple sign-in are still future upgrades (no SMS/OAuth
  provider configured yet).
- **Design system source:** the auth screens (Splash, Welcome, Login,
  Register) and the shared components they use (`Button`, `TextField`,
  `AppLogo`) were rebuilt against a real Figma file
  (figma.com/design/0rCDlmCaVlIGUaa3OMKe7M — an AI-chat-app template
  named "BrainBox" in the file itself, not this product; only the parts
  that map to features Intently actually has were pulled in — see
  [10-tech-stack-decisions.md](10-tech-stack-decisions.md) for the MCP
  setup). Real Poppins font (`@expo-google-fonts/poppins`), real colors
  (`src/theme/tokens.ts`), real spacing/radius pulled via the Figma MCP
  server, not approximated. Deliberately left out: Google/Facebook
  buttons and "Forgot password" — both are in the source design but
  have no backend behind them yet, and a button with nothing behind it
  is worse than no button. The file's Onboarding carousel and all
  chat/AI-assistant screens exist in Figma but weren't pulled in — they
  don't correspond to anything Intently does.
- **Push notifications:** required for the "business responded" and
  "offer expiring" moments — these are core to conversion, not a
  nice-to-have; implement early (Phase 1-2, not deferred).
- **Offline/poor-connectivity handling:** intent submission should queue
  and retry; this matters for a India-first, mobile-network-variable
  launch.
- **Analytics instrumentation:** every step of the funnel
  (intent submitted → results shown → result opened → compared → booked)
  instrumented from day one — this funnel *is* the north-star metric (see
  [08-business-model-gtm.md](08-business-model-gtm.md)).
- **Maps/location:** Google Maps SDK (or Mapbox if cost becomes a concern
  at scale) for distance calculation and business location display.
- **Payments:** Razorpay (or similar India-licensed aggregator) SDK
  integration for in-app checkout; see
  [10-tech-stack-decisions.md](10-tech-stack-decisions.md).

## What's explicitly deferred (do not build in the native app early)

- Voice input (mic icon reserved in UI, not wired up until Phase 3+).
- Creator content feed/discovery UI (Phase 4).
- Any agent-to-agent "autonomous negotiation" UI (Phase 5).
- Native business-side app (web portal covers this through Phase 3).
