# ShinePages builder — field report (0018.05.20 a₿)
Competitive anatomy from a live walk of Love's builder account. Companion to
docs/plasmic-gap-map.md — the small-business corner of the triangle.
Full detail in the audit transcripts; this is the durable digest.

## Automation feature checklist (their trigger/action vocabulary = our future rails)
TRIGGERS (21): list add/remove · member-group add/remove · tag add/remove ·
property changed · email open · email link click · purchase · order status ·
abandoned cart · goal reached · page visit · reaction · poll option ·
video started/portion/completed · circle enrolled · circle content completed.
ACTIONS (17): delay · if/else · send email · notify address · tag add/remove ·
property update · list add/remove · circle enroll/unenroll · member-group
add/remove · add note · delete contact · unsubscribe · start another
automation · trigger a webhook.
Editor: vertical node graph, "+" between nodes, if/else lanes, goal-as-exit,
per-flow email analytics funnel. Traps to lint against: flows saveable with
ZERO triggers (inert, no warning); dirty-state modal defaults to SAVE.

## ORGANIZED (adopt/adapt)
- Two-tier insert: atomic widgets + composed BLOCK TEMPLATES (categorized
  full-screen gallery) + user-saved blocks clipboard. Ours must preview
  templates IN the brand's tokens, not stock.
- Global Styling = real token system (palette tokens + type scale + per-device
  typography + staged Cancel/Confirm). Our brand board beats it with
  provenance + cartridges; steal their "Global Column" (shared synced region)
  for footers/legal nav.
- Funnels view: pages-as-ordered-steps with fused analytics (visitors,
  conversion %, goals, upsell slots) — the standout screen.
- Contact activity timeline (orders/tags/forms/appointments per contact).
- Product → member group → tag spine (commerce feeds CRM feeds automations).
- Page access levels (Public/Password/Members) + editable SYSTEM PAGES group.
- In-product Training Center sequenced to the product's own IA.
- Editable Phone View + "match desktop and mobile" escape hatch.
- Popup display-rule engine (timing/frequency/page targeting).

## CLUMSY (deliberately avoid)
- Style logic scattered across FOUR places with no winner indication — the
  exact trap our provenance inspector kills.
- Trash icon one pixel from the settings gear; accordion rows shift under the
  cursor; flat 22-page list, no folders; silent duplicate pages with
  misleading names; slug drift unflagged; dead widget refs render as red
  errors on LIVE pages ("Booking does not exist") with no builder lint.
- Preview "Show in new tab" destabilizes the login session (twice observed).
- Inline AI is pointwise (text toolbar + SEO sparkle) with zero site awareness.

## What they have that we don't (honest gap list → future lanes)
1. CRM spine (contacts/tags/timeline) 2. member groups + gated pages +
member login system pages 3. email campaigns/automations infra 4. native
booking (events/operators/schedule/calendar widget) 5. funnel analytics
6. subscriptions/abandoned-cart/UTM 7. community circles w/ video-watch
triggers 8. training center 9. popup rules 10. restore-deleted-site,
saved-blocks clipboard, focal-point crop, per-product checkout questions.
Fleet counters already in hand: BTCPay/Square rails (payments), Matrix rooms
(community), nostr (identity/social), rails lint (their missing lint), Number
One (site-aware AI vs their pointwise sparkle).
