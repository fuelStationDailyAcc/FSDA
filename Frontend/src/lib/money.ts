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
