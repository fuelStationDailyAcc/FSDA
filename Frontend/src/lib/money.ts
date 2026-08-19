/** Indian numbering: ₹1,25,000.00 style for paise integers. */
export function formatINR(paise: number | null | undefined, showPaise = false): string {
  if (paise === null || paise === undefined || Number.isNaN(Number(paise))) {
    return "—"
  }
  const sign = Number(paise) < 0 ? "-" : ""
  const abs = Math.abs(Number(paise))
  const rupees = Math.floor(abs / 100)
  const fraction = abs % 100
  const formatted = formatIndianNumber(rupees)
  if (showPaise || fraction !== 0) {
    return `${sign}₹${formatted}.${String(fraction).padStart(2, "0")}`
  }
  return `${sign}₹${formatted}`
}

/** Drop paise: ₹1.70 becomes ₹1. */
export function formatINRFloor(paise: number | null | undefined): string {
  if (paise === null || paise === undefined || Number.isNaN(Number(paise))) {
    return "—"
  }
  const n = Number(paise)
  const sign = n < 0 ? "-" : ""
  const rupees = Math.floor(Math.abs(n) / 100)
  return `${sign}₹${formatIndianNumber(rupees)}`
}

export function formatIndianNumber(n: number): string {
  const s = Math.floor(Math.abs(n)).toString()
  if (s.length <= 3) return s
  const last3 = s.slice(-3)
  const rest = s.slice(0, -3)
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}`
}

export function paiseToInput(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return ""
  return (Number(paise) / 100).toFixed(2).replace(/\.00$/, "")
}

export function formatRate(paise: number): string {
  if (!paise) return "—"
  return `₹${(paise / 100).toFixed(2)}`
}

export function parseLitres(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""))
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 1000) / 1000
}

export function calcLitres(newReading: string | number, oldReading: string | number): number {
  return Math.round((parseLitres(newReading) - parseLitres(oldReading)) * 1000) / 1000
}

export function calcNetLitres(litres: string | number, testingLitres: string | number): number {
  return Math.round((parseLitres(litres) - parseLitres(testingLitres)) * 1000) / 1000
}

export function calcFuelSalePaise(netLitres: number, ratePaise: number): number {
  const ml = Math.round(Number(netLitres) * 1000)
  const rate = BigInt(Math.round(Number(ratePaise) || 0))
  const product = BigInt(ml) * rate
  const q = product / 1000n
  const r = product % 1000n
  return Number(r >= 500n ? q + 1n : q)
}

export function calcFuelProfitPaise(netLitres: number, profitPaise: number): number {
  return calcFuelSalePaise(netLitres, profitPaise)
}

export function formatLitres(n: number): string {
  if (!Number.isFinite(n)) return "—"
  return String(Math.round(n * 1000) / 1000)
}

export function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  const yy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  return `${yy}-${mm}-${dd}`
}

export function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}
