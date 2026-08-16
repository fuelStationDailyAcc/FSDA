/** Money helpers — store amounts as integer paise (₹1 = 100 paise). */

export function toPaise(rupees) {
    if (rupees === null || rupees === undefined || rupees === "") return 0;
    const n = typeof rupees === "number" ? rupees : Number(String(rupees).replace(/,/g, ""));
    if (!Number.isFinite(n)) {
        throw new Error("Invalid money amount");
    }
    return Math.round(n * 100);
}

export function fromPaise(paise) {
    const n = Number(paise || 0);
    return n / 100;
}

export function parseLitres(value) {
    if (value === null || value === undefined || value === "") return 0;
    const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
    if (!Number.isFinite(n)) {
        throw new Error("Invalid litre value");
    }
    return Math.round(n * 1000) / 1000;
}

/**
 * Fuel sale in paise: netLitres × ratePaise, rounded to nearest paise.
 * Avoids float drift by working in millilitres × paise then dividing.
 */
export function calcFuelSalePaise(netLitres, ratePaise) {
    const ml = Math.round(Number(netLitres) * 1000);
    const rate = BigInt(Math.round(Number(ratePaise) || 0));
    const product = BigInt(ml) * rate;
    // (ml * ratePaise) / 1000, round half-up
    const q = product / 1000n;
    const r = product % 1000n;
    return Number(r >= 500n ? q + 1n : q);
}

export function calcLitres(newReading, oldReading) {
    const litres = parseLitres(newReading) - parseLitres(oldReading);
    return Math.round(litres * 1000) / 1000;
}

export function calcNetLitres(litres, testingLitres) {
    const net = parseLitres(litres) - parseLitres(testingLitres);
    return Math.round(net * 1000) / 1000;
}

export function sumPaise(values) {
    return values.reduce((acc, v) => acc + Number(v || 0), 0);
}
