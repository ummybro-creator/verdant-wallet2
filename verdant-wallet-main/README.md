# Velvato — Earnings Wallet

A mobile-first fintech web application for managing wallet balance, daily income plans, VIP investment plans, team referrals, deposits, and withdrawals. Built with TanStack Start (SSR React), TanStack Router (file-based routing), TanStack Query, Supabase, and Tailwind CSS v4.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Features](#features)
- [Database Schema](#database-schema)
- [Setup & Running Locally](#setup--running-locally)
- [Environment Variables](#environment-variables)
- [Routing](#routing)
- [Key Architecture Decisions](#key-architecture-decisions)

---

## Project Overview

Velvato is a mobile-first investment/earnings wallet app where users:

1. Register with a phone number and referral code
2. Recharge their wallet via UPI
3. Purchase daily income or VIP investment plans
4. Earn daily commissions + referral commissions (3 levels)
5. Withdraw earnings (requires an active VIP plan)
6. Track team referrals and commission income

Admins get a full dashboard to manage users, approve/reject deposits and withdrawals, and configure app settings.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [TanStack Start](https://tanstack.com/start) (SSR React) |
| Routing | [TanStack Router](https://tanstack.com/router) (file-based) |
| Data fetching | [TanStack Query](https://tanstack.com/query) v5 |
| Backend / Auth / DB | [Supabase](https://supabase.com) (PostgreSQL + Auth + RPC) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) |
| Animations | [Motion](https://motion.dev) (Framer Motion v12) |
| UI primitives | [shadcn/ui](https://ui.shadcn.com) (Radix UI) — selectively used |
| Forms | [React Hook Form](https://react-hook-form.com) + [Zod](https://zod.dev) |
| State | [Zustand](https://zustand-demo.pmnd.rs) |
| QR codes | [qrcode](https://www.npmjs.com/package/qrcode) |
| Toast notifications | [Sonner](https://sonner.emilkowal.ski) |
| Icons | [Lucide React](https://lucide.dev) |
| Analytics | Facebook Meta Pixel |
| Package manager | Bun |
| Language | TypeScript 5 |

---

## Project Structure

```
src/
├── assets/               # Static images (logo, product, banners)
│   └── index.ts          # Exports logoSrc, productSrc, bannerSlides
│
├── components/
│   ├── layout/           # App-level layout components
│   │   ├── MobileShell.tsx     # Centered 520px wrapper + auth guard + animations
│   │   ├── Header.tsx          # Sticky green header with back button + title
│   │   ├── BottomNavigation.tsx # 4-tab animated bottom nav (Home/Share/Team/My)
│   │   └── InfoPage.tsx        # Reusable layout for About/Privacy/Terms pages
│   │
│   ├── ui/               # shadcn/ui components (Radix primitives)
│   │   ├── accordion.tsx       # Used by product detail page FAQ
│   │   ├── switch.tsx          # Used by settings page (dark mode toggle)
│   │   ├── sonner.tsx          # Global toast provider (used in __root)
│   │   └── ...                 # Other shadcn components (installed, not all used)
│   │
│   └── ui-kit/           # Custom design-system components
│       ├── Button.tsx          # PrimaryButton, SecondaryButton, Button (CVA variants)
│       ├── Card.tsx            # Card, SectionTitle, StatisticCard
│       ├── Input.tsx           # Input, PasswordInput, PhoneInput
│       ├── WalletCard.tsx      # Green gradient balance card
│       ├── ProductCard.tsx     # Plan card (image + 4 stat boxes + buy button)
│       ├── AmountInput.tsx     # ₹ prefixed numeric input + PercentageButtons
│       ├── Countdown.tsx       # Real-time H:MM:SS animated countdown
│       ├── CopyButton.tsx      # Clipboard copy with toast + check icon
│       ├── Tabs.tsx            # Animated tab bar with motion indicator
│       ├── ListRow.tsx         # Profile menu row (icon, title, chevron)
│       ├── Skeleton.tsx        # CardSkeleton, Loading, EmptyState
│       └── HomeWelcomeModal.tsx # Session-once launch announcement modal
│
├── features/
│   └── auth/
│       └── AuthScreen.tsx      # Login + Register screen with animated tab switcher
│
├── hooks/
│   ├── useAuthGuard.ts         # Redirects to /auth/login if not authenticated
│   └── use-mobile.tsx          # useIsMobile() — returns true if width < 768px
│
├── integrations/
│   └── supabase/
│       ├── client.ts           # Browser Supabase client (publishable key)
│       ├── client.server.ts    # Server Supabase client (service role key)
│       ├── auth-attacher.ts    # Client middleware: attaches Bearer token to server calls
│       ├── auth-middleware.ts  # Server middleware: validates JWT, sets userId in context
│       └── types.ts            # Auto-generated TypeScript types for all DB tables/RPCs
│
├── lib/
│   ├── utils.ts                # cn() — clsx + tailwind-merge
│   ├── meta-pixel.ts           # Facebook Pixel init + track helpers
│   ├── error-capture.ts        # console.error wrapper for SSR error capture
│   ├── error-page.ts           # renderErrorPage() — HTML 500 error page string
│   └── lovable-error-reporting.ts # Forwards errors to Lovable editor dev tools
│
├── routes/                     # TanStack Router file-based routes (see Routing section)
│
├── services/
│   ├── api.ts                  # All Supabase queries (hooks), types, and helpers
│   └── plans.ts                # Static commission level constants
│
├── utils/
│   └── format.ts               # INR(n) and INR2(n) — Indian rupee formatters
│
├── router.tsx                  # Creates QueryClient + router instance
├── routeTree.gen.ts            # Auto-generated route tree (do not edit manually)
├── start.ts                    # TanStack Start entry: registers middlewares
└── server.ts                   # SSR server wrapper: error normalisation
```

---

## Features

### Authentication
- **Phone-based auth**: Phone number converted to `phone@coolio.app` for Supabase email auth (no SMS OTP needed)
- **Registration**: Phone, password, withdrawal password, optional referral code
- **Login**: Phone + password
- **Auth guard**: All protected pages redirect to `/auth/login` if not logged in
- **Remember me**: Browser localStorage session persistence

### Wallet
- Real-time balance display (total balance, recharge balance, income)
- Deposit and withdraw buttons
- Last 5 transactions shown inline

### Recharge (Deposit)
- Preset amount grid (configured by admin)
- Custom amount input
- UPI payment method selector
- Navigates to `/payment` page with a 9-minute countdown session
- Generates UPI QR code dynamically
- User submits UTR (transaction reference) to confirm payment
- Admin approves/rejects in admin panel

### Withdrawal
- Requires an **active VIP plan** (enforced at database level)
- Quick percentage buttons (25% / 50% / 75% / Max)
- Tax deduction shown live (configurable tax % via admin settings)
- Withdrawal password required for confirmation
- Admin approves/rejects in admin panel

### Investment Plans
- **Daily Income Plans**: Fixed daily return for N days
- **VIP Plans**: Higher-tier plans that also unlock withdrawal capability
- Plans fetched from Supabase `plans` table
- Plan purchase deducts from `deposit_balance` (recharged funds only)

### Team & Referrals
- 3-level referral commission system (configurable via admin: default 10% / 3% / 1%)
- Team stats: total recharge, total members
- Masked member list per level
- Referral link + invite code sharing (WhatsApp, Telegram, native share)

### Transactions
- Filterable history: Recharge / Withdraw / Purchase / Income / Referral
- Colour-coded status badges (green=success, yellow=pending, red=failed/rejected)

### Profile
- View and edit personal info (name, email, bank, UPI)
- Change login password / withdrawal password
- App settings (dark mode, notifications)
- Notification centre with unread badge
- Transaction history, purchase records
- Support (live chat bot, Telegram, email)
- About, Privacy Policy, Terms of Service pages

### Admin Panel (`/admin`)
- Protected by `user_roles` table (role = "admin")
- **Stats**: 9 aggregated KPI cards from `admin_stats()` RPC
- **Activity**: User payment page visit log
- **Deposits**: Approve/reject deposits (credits wallet on approval)
- **Withdrawals**: Approve/reject withdrawal requests (refunds on rejection)
- **Users**: Search, adjust balance, block/unblock
- **Settings**: Edit all app settings (UPI ID, min amounts, tax %, commission rates, presets, URLs)

### Chat Bot
- Keyword-based bot recognising: recharge, withdraw, UTR, telegram queries
- Quick question chips for common queries

### Meta Pixel Tracking
Events tracked: `Login`, `CompleteRegistration`, `ViewContent`, `Purchase`, `InitiateCheckout`, `Subscribe`, `DepositSubmitted`, `WithdrawalSubmitted`

---

## Database Schema

### Tables

| Table | Purpose |
|---|---|
| `profiles` | User profile: phone, balance, deposit_balance, income, bank/UPI details, invite code, VIP status |
| `plans` | Investment plans: price, daily return, duration, kind (daily/vip) |
| `purchases` | Active plan purchases with start/end dates and daily earnings |
| `transactions` | All money movements: type, amount, status |
| `deposits` | Recharge requests with UTR, awaiting admin review |
| `withdrawals` | Withdrawal requests awaiting admin approval |
| `payment_requests` | Records UPI payment page visits (expires after 9 min) |
| `notifications` | In-app notifications per user |
| `app_settings` | Singleton config row: UPI ID, min amounts, tax %, commission rates, presets |
| `user_roles` | Role-based access control (admin / user) |

### Key RPCs (Stored Procedures)

| RPC | What it does |
|---|---|
| `buy_plan(_plan_id)` | Deducts deposit_balance, creates purchase, distributes referral commissions |
| `request_withdrawal(_amount, _password)` | Validates VIP plan + password, creates withdrawal record |
| `create_payment_request(_amount)` | Logs payment page visit, expires old ones |
| `admin_review_deposit(_id, _approve)` | Credits balance on approval |
| `admin_review_withdrawal(_id, _approve)` | Refunds on rejection |
| `admin_adjust_balance(_user_id, _amount, _note)` | Manual balance adjustment |
| `admin_stats()` | Returns aggregated dashboard metrics JSON |
| `my_team()` | Returns team stats + masked member list for current user |
| `has_role(_user_id, _role)` | Boolean role check |

---

## Setup & Running Locally

### Prerequisites
- [Node.js](https://nodejs.org) 20+ (or [Bun](https://bun.sh))
- A Supabase project with the migrations applied

### Install dependencies

```sh
# Using Bun (recommended)
bun install

# Or using npm
npm install
```

### Configure environment variables

Copy `.env` and fill in your Supabase credentials (see [Environment Variables](#environment-variables) below). The `.env` file is already present in the repo with the project's Supabase credentials.

### Run dev server

```sh
bun run dev
# or
npm run dev
```

The app runs on **http://localhost:5000**

### Build for production

```sh
bun run build
# or
npm run build
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (client-side) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable API key (client-side) |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ID (client-side) |
| `SUPABASE_URL` | Supabase project URL (server-side SSR) |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (server-side) |
| `SUPABASE_PROJECT_ID` | Supabase project ID (server-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for admin server operations (never expose to client) |

> The `VITE_` prefixed vars are accessible in browser code. The non-prefixed ones are SSR-only.

---

## Routing

All routes live in `src/routes/` using TanStack Router's file-based convention. The route tree is auto-generated into `src/routeTree.gen.ts`.

| Route | Page |
|---|---|
| `/` | Login screen (redirects to `/auth/login` behaviour) |
| `/auth/login` | Login |
| `/auth/register` | Register |
| `/register` | Legacy register alias (keeps old referral links working) |
| `/home` | Home — banner slider, shortcuts, plan tabs |
| `/wallet` | Wallet — balance, stats, recent transactions |
| `/recharge` | Recharge — preset amounts, UPI method |
| `/payment` | Payment — UPI QR code, UTR submission, countdown |
| `/withdraw` | Withdraw — amount, tax preview, password |
| `/product` | All plans listing |
| `/product/$id` | Plan detail — stats, FAQ, buy button |
| `/records` | Active purchases with progress bars |
| `/transactions` | Transaction history with filters |
| `/team` | Team stats, invite code, member list |
| `/share` | Share referral link, commission cards |
| `/chat` | Keyword bot support chat |
| `/admin` | Admin dashboard (admin only) |
| `/profile` | Profile home |
| `/profile/account` | Edit personal + bank info |
| `/profile/bank` | Bank account form |
| `/profile/security` | Change login password |
| `/profile/withdraw-password` | Change withdrawal password |
| `/profile/settings` | Dark mode, notifications, language |
| `/profile/notifications` | Notification centre |
| `/profile/history` | Purchase history |
| `/profile/support` | Support contacts |
| `/profile/about` | About Velvato |
| `/profile/privacy` | Privacy policy |
| `/profile/terms` | Terms of service |
| `/profile/download` | APK download |
| `/profile/logout` | Sign out |
| `/not-found` | 404 page |

---

## Key Architecture Decisions

### Phone Auth via Fake Email
Supabase Auth doesn't support phone-only auth without SMS/OTP. The app converts phone numbers to `phone@coolio.app` (e.g. `9876543210@coolio.app`) before passing to Supabase. This lets users authenticate with just a phone number + password.

### Deposit Balance vs Balance
Users have two balances:
- **`deposit_balance`**: Only recharged funds. This is the only source for purchasing plans.
- **`balance`**: Total withdrawable balance (deposit + earned income after purchases).

### Withdrawal Gate
A user **must have an active VIP plan** to withdraw. This is enforced at the database level in the `request_withdrawal` RPC, not just the frontend.

### SSR + Client Auth Split
- `src/integrations/supabase/client.ts` — Browser client using publishable key
- `src/integrations/supabase/client.server.ts` — Server client using service role key
- `auth-attacher.ts` — Client middleware that adds `Authorization: Bearer <token>` to all TanStack Start server function calls
- `auth-middleware.ts` — Server middleware that validates the JWT and injects `userId` + `claims` into server context

### Meta Pixel
The Facebook Pixel ID (`1658175685927115`) is hardcoded in `src/lib/meta-pixel.ts`. Initialised in `__root.tsx` and fires events on key user actions throughout the app.

---

*Built with [Lovable](https://lovable.dev). Project ID: `1fa9263f-0457-4b94-9517-cf2670b965bd`*
