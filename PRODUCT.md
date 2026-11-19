# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(Windows desktop app: Electron wraps the Next.js server. It is designed as one web UI at desktop window sizes, minimum 1000×660.)

## Users

- **Reception staff:** keep the app open all shift on the counter PC and register member check-ins quickly while people arrive.
- **The owner:** reviews members, payments, sales, metrics and the audit log after the shift.
- One login per installation; only one person uses the app at a time.

## Product Purpose

Runs the daily operation of Olimpo GYM, a new general-fitness gym:

- check-in at the counter, plus attendance;
- members (sign-up, edit, deactivate);
- plans and membership payments;
- counter sales and inventory;
- metrics, backups, and an audit log nobody can edit.

Success means reception never makes a member wait, and the owner always knows who is paid up, who is about to expire, and what was sold.

## Positioning

The app is built for one specific gym, not a generic SaaS. It runs fully on the gym's own computer: a local SQLite database, no monthly costs, and no internet needed. It should feel like Olimpo's own tool, not a rented product.

## Operating Context

- **Counter search:** members are found by name, phone or member number. F2 jumps to the counter.
- **Check-in rules:** a member without a valid membership enters only as an exception with a reason. A check-in can be undone within 10 minutes, and a second check-in by the same member within 2 hours is blocked.
- **Backups:** a .zip every day, with an optional copy to Drive, OneDrive or USB.
- **Payments:** cash or bank transfer only (no card terminal).
- **Attendance:** only check-ins are recorded, not check-outs, so the app never claims who is "inside" right now.
- **Membership dates:** a membership is valid through its last day. Renewing early never loses days. "Por vencer" means 7 days or fewer left.

## Capabilities and Constraints

- Stack: Next.js 15, TypeScript and Tailwind CSS 4 inside Electron, with SQLite and clean-architecture layers.
- Language: Spanish (Mexico), MXN currency, America/Mexico_City time zone.
- Every member needs a phone number. Birth date and photo are optional.
- Fingerprint attendance (optional): HID DigitalPersona U.are.U 4500 reader through the free HID Authentication Device Client; enrollment in the member's file with signed consent.
- Out of scope for now: barcode attendance, WhatsApp reminders (manual or automatic), card payments, check-out tracking.

## Brand Commitments

- **Name:** Olimpo GYM.
- **Logo:** an engraved-style eagle head with "OLIMPO" arched above and "GYM" below. The original is an embroidered patch in white thread on black. Vector files are in `docs/logo/`: full logo, eagle-only isotype, and currentColor/white/black/patch variants.
- **Brand colors:** red and black. The user says red must be used sparingly because it tires the eyes.
- **Previous attempts the user rejected:**
  - Red with black looked "horrible";
  - white with red looked like "página de gobierno";
  - several directions looked "diseñadas con IA";
  - a heavy decorative style was called "tosco y genérico".
- **What the user wants:** something original, creative, unique and professional that still makes the red-and-black brand and the logo work.

## Evidence on Hand

- The real logo (embroidered photo plus traced SVGs in `docs/logo/`).
- Proposal and interview documents in `docs/`.
- There is no real member data yet; the gym had not opened as of September 2026. Never fabricate testimonials, member counts or business figures as facts. Sample data in mockups must read as sample data.

## Product Principles

1. **Speed at the counter first.** The check-in path beats everything else on screen.
2. **Status at a glance.** Paid, about to expire or expired must be readable from across the counter without reading a sentence.
3. **Calm for an 8-hour shift.** Nothing on screen should tire the eyes; color carries meaning, not decoration.
4. **It is Olimpo's tool.** Identity comes from the gym's own mark and voice, not from generic dashboard patterns.

## Accessibility & Inclusion

- Readable at arm's length on a counter monitor.
- Status never relies on color alone.
- WCAG AA contrast.
