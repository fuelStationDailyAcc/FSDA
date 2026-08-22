# PetroBook

PetroBook is a web app for **fuel station daily accounting**. It replaces the handwritten daily sheet: meter readings, cash reconciliation, credit/debit (udhaar), expenses, and end-of-day closing — with running history, profit analytics, and multi-user access for your station.

Each station is an isolated account (tenant). One owner registers a fuel station; staff can be added with limited permissions. Data is stored per station in MongoDB.

---

## The idea

Petroleum retail stations track each **accounting day** as a worksheet:

1. Record **meter readings** for MS, HSD, CNG, etc.
2. Enter **credit** given to customers and **debit** paid out.
3. Log **expenses** and **non-cash collections** (card, online, bank).
4. Reconcile **expected cash** vs what was **taken home**.
5. **Close the day** so it is locked until reopened.

PetroBook digitizes that workflow, chains meter readings across days, carries **pending/advance** cash across dates, and surfaces **profit** from litres sold × profit-per-litre minus expenses.

---

## Tech stack

| Layer | Stack |
|--------|--------|
| Frontend | React 19, TypeScript, Vite, React Router |
| Backend | Node.js, Express 5, MongoDB (Mongoose) |
| Auth | JWT (access + refresh tokens, HTTP-only cookies) |
| Deploy | Frontend: Vite build / Vercel-ready · Backend: Node API |
| PWA | `vite-plugin-pwa` — installable on phone/desktop |

---

## Project structure

```
PetroBook/
├── Backend/          # REST API (Express)
│   └── src/
│       ├── routes/       # users, accounts, staff, salaries
│       ├── services/     # daily accounts, cash calculation, audit
│       ├── models/       # MongoDB schemas
│       └── db/seed.js    # default products, payment methods, categories
├── Frontend/         # React SPA
│   └── src/
│       ├── pages/        # feature screens
│       ├── api/          # API client
│       ├── components/   # shell, modals, loader
│       └── lib/          # money formatting, permissions, reports
└── README.md
```

---

## Features

### Authentication & onboarding

- **Landing page** — public hero with sign-in link.
- **Register** — username, email, password, fuel station name. Seeds default products, payment methods, expense categories, and transaction categories for the new station.
- **Login** — username or email + password.
- **Logout** — clears session.
- **Session** — access token in `localStorage`; refresh token in secure cookie.
- **Delete account** (owner, in Settings) — permanently removes the station, all daily accounts, ledger data, products, staff, and related records.

### Dashboard (Home)

- Welcome message with station name.
- Quick links: Daily Accounts, History, Analytics, Settings.
- Owner-only links: Staff, Salaries.

### Daily Accounts

The core daily worksheet. A day is **not opened automatically** — you pick a date and click **Open Day**. The backend only creates that day’s record when you open it.

#### Opening & navigation

- **Open Day** — load/create the sheet for the selected date.
- **Date picker** with previous / next day and **Today**.
- **Status** — Open or Day Closed.
- **Save** — batch-save unsaved meter reading and cash-taken changes.
- **Print** — browser print of the current sheet.
- **Download** — CSV day report (fuel, ledger, expenses, reconciliation).

#### Fuel meter readings

- One row per **fuel product** (from Settings).
- Fields: new reading, old reading, LTR, testing litres, net litres, rate, total sale.
- **Auto-calculations**: LTR = new − old; net = LTR − testing; sale = net × rate.
- **Meter chaining** — opening reading on a new day defaults to the previous day’s closing reading; updates propagate to the next open day when readings change.
- **Add product** to the day if needed.
- **Live total fuel sales** KPI while editing (before save).

#### Credit & debit (daily ledger)

- Separate **Credit** and **Debit** sections for the day.
- Add entries with name, amount, category, date/time, notes.
- Link to **customer** (credit) or **vendor** (debit); create party on the fly.
- Name suggestions from existing customers, vendors, and past ledger names.
- Delete individual entries.
- Credit totals feed into cash reconciliation (+ credit).

#### Expenses

- Simple list: description + amount (₹).
- Running total.
- Add and delete entries.

#### Payment collections (cash summary)

- Collections grouped by **payment method** (Card, Online Payment, Bank Payment, custom methods from Settings).
- Per-method notes (e.g. card name, payment app).
- Multiple line items per method; delete individual lines.
- Methods configured with flags: reduces cash, cash taken, method type (`card`, `online`, `bank`, `credit`, `cash`, etc.).

#### KPI summary (top of sheet)

- Total fuel sales  
- Total credit  
- Total debit  
- Total expenses  
- Online collections (online/UPI only — not card or bank)  
- Closing cash (expected remaining, live-updated with fuel sales and cash taken)

#### Daily reconciliation

Cash-flow summary matching the handwritten sheet:

1. Fuel sale  
2. Credit (+)  
3. Debit (−)  
4. Online payments (−)  
5. Card (−) — separate line when amount &gt; 0  
6. Bank payment (−) — separate line when amount &gt; 0  
7. Expenses (−)  
8. **Expected cash**  
9. **Cash taken** (−) — editable field, saved on blur/enter  
10. **Remaining cash**  
11. **Pending** (green when &gt; 0) — cash still to take / shortfall  
12. **Advance** (red when &gt; 0) — over-taken cash  

**Formula (backend):**

```
Total cash = Fuel sale + Credit − Debit − Online/card/bank/UPI − Other non-cash − Expenses
Remaining cash = Total cash − Cash taken
```

Pending/advance can accumulate across prior closed days for cumulative balance.

#### Close day

- **Close Day** opens a modal with full reconciliation review.
- **Review & Close** → **Confirm Close Day** — locks the sheet, records close timestamp and user.
- Closed days are **read-only** for staff; owner/manager can **Reopen Day**.

#### Reset day

- **Reset Day** (open days only) — deletes all expenses, ledger transactions, and payment collections for that date; zeros meter sales (readings reset to old = new); clears cash taken. The day record remains in History.

#### Permissions on daily accounts

- `accounts.read` — view sheets (read-only if no write).
- `accounts.write` — edit, save, close, reset, collections, expenses, readings.

---

### History

- List of **all daily accounts** for the station.
- **Filters**: date from/to, status (all / open / closed).
- **Summary KPIs** for the filtered list: days count, fuel sales, credit, debit, expenses, closing cash.
- **Open** — navigates to Daily Accounts with that date loaded.
- **Delete** (`accounts.write`) — permanently removes the day and all related data; rechains meter readings on later days. Confirmation modal.

Row/card click does **not** open a day — only the Open button.

---

### Analytics

Profit reporting based on **litres sold × profit per litre** (from Settings) minus **daily expenses**.

- **Profit till date** — cumulative net profit across all days.
- **This month net profit** (or **filtered net profit** when date range is set).
- **Date range filter** (from / to) with clear filters.
- When filtered: gross profit, expenses, days in range.
- **Current profit rates** — table of each product’s ₹/L profit.
- **Monthly profit** — gross, expenses, net, days per month.
- **Daily profit** — gross, expenses, net per accounting date.

Note: profit rates use **current** Settings values, so changing profit/L updates historical analytics recalculations.

---

### Ledger

Customer credit (udhaar) overview.

- **Total udhaar** — sum of credit minus debit across all ledger transactions.
- **Customers** list.
- **Add customer** — name + initial credit amount (creates customer and credit transaction for today).
- **Delete customer**.
- `ledger.read` / `ledger.write` permissions.

---

### Settings

Station configuration and app preferences.

#### Appearance

- **Themes**: Orange, Light, Dark (stored per device in `localStorage`).

#### Install app (PWA)

- Install PetroBook to home screen / standalone window.
- iOS Safari instructions when browser install is unavailable.

#### Fuel products

- Add products: name, type (MS / HSD / CNG / Other), current rate (₹), profit (₹/L).
- Edit rate and profit inline.
- **Remove** — hides product from new days; past meter readings kept.
- **Restore** hidden products.

Default on signup: MS, MS2, HSD, HSD2.

#### Payment methods

- View built-in methods: Cash, Credit, Card, Online Payment, Bank Payment.
- Add custom methods (name/code, reduces cash).
- Remove custom methods.

#### Account (owner)

- **Delete account** — wipe station and all data.

`settings.read` / `settings.write` permissions.

---

### Staff (owner only)

Manage login accounts for employees.

- **Create staff** — username, password, permission checkboxes.
- **Permissions** per area:
  - **Daily Accounts** — view / edit (meter, cash, expenses, close day).
  - **Ledger** — view / edit (customers, udhaar).
  - **Settings** — view / edit (products, payment methods).
- **Edit permissions** for existing staff.
- **Reset password**.
- **Delete staff** account.

Staff users sign in with their username; they operate under the owner’s station data.

---

### Salaries (owner only)

Monthly salary register — **separate from staff login accounts** (helpers, cleaners, anyone).

- Add: name, monthly salary (₹), optional notes.
- **Edit salary** and **edit name** via prompts.
- **Remove** entry.
- KPIs: number of people, total monthly salary.

---

### Cross-cutting features

| Feature | Description |
|--------|-------------|
| **Multi-tenant** | Every record scoped by `ownerId`; staff accounts link to owner. |
| **Role model** | Owner (admin/manager) vs staff with granular permissions. |
| **Audit log** | Backend logs create/update/delete/close/reset on key entities. |
| **Idempotent transactions** | Duplicate ledger POSTs rejected via idempotency key. |
| **Money precision** | All amounts stored in paise (integer); displayed as ₹ in UI. |
| **Responsive UI** | Mobile card layouts + desktop tables; collapsible nav. |
| **PWA** | Offline-capable shell, auto-update service worker in production. |
| **Health check** | `GET /health` — API and MongoDB status. |

---

## Default data (new stations)

On registration, the backend seeds:

**Products:** MS, HSD, CNG (sample rates).

**Payment methods:** Cash, Credit, Card, Online Payment, Bank Payment.

**Expense categories:** General, Generator, Cashback, Electricity, Maintenance, Salary, Transport, Cleaning, Station Supplies, Other.

**Transaction categories:** Generator Expense, Vendor Payment, Salary, Maintenance, Cash Withdrawal, Customer Payment, Fuel Sale, Other Income, Bank Transfer Received, Other.

---

## Getting started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)

### Backend

```bash
cd Backend
cp .env.example .env   # if present; otherwise create .env
# MONGODB_URI, JWT secrets, CORS_ORIGIN, PORT
npm install
npm run dev
```

Default API: `http://localhost:8000`

### Frontend

```bash
cd Frontend
npm install
# Frontend/.env — set VITE_BACKEND_URL for local API
npm run dev
```

Default app: `http://localhost:5173`

### Production build

```bash
cd Frontend && npm run build
cd Backend && npm start
```

Set `CORS_ORIGIN` to your frontend URL(s), comma-separated.

---

## API overview

Base path: `/api/v1`

| Area | Prefix | Examples |
|------|--------|----------|
| Users | `/users` | register, login, logout, me, delete me |
| Accounts | `/accounts` | daily sheet, history, products, payment methods, ledger |
| Staff | `/staff` | CRUD staff accounts |
| Salaries | `/salaries` | CRUD salary entries |

All account routes require authentication. Permissions enforced per route (`accounts.read`, `accounts.write`, `ledger.read`, `ledger.write`, `settings.read`, `settings.write`).

---

## Day report (CSV export)

The download from Daily Accounts includes:

- Summary KPIs  
- Fuel meter readings table  
- Credit and debit sections  
- Expenses  
- Payment collections  
- Daily reconciliation block (same order as on-screen)  
- Pending and advance  

UTF-8 with BOM for Excel compatibility.

---

## License

Private project — PetroBook fuel station accounting.
