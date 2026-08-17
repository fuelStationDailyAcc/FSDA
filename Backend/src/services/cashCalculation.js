/**
 * Station cash summary calculation layer.
 * Adjustable via payment method flags rather than hardcoded Paytm/GPay columns.
 *
 * Formula (matches handwritten daily sheet):
 *   Total Cash   = Total Sale − Credit − Online − Other Non-Cash − Expenses
 *   Closing Cash = Total Cash − Cash Taken − Manual Online (and similar)
 */

/**
 * @param {object} input
 * @param {number} input.totalFuelSalePaise
 * @param {Array<{ amountPaise: number, reducesCash: boolean, isCashTaken: boolean, methodType: string }>} input.collections
 * @param {number} input.totalExpensePaise
 * @param {number} input.cashTakenPaise
 * @param {number|null} input.actualClosingCashPaise
 */
export function calculateCashSummary(input) {
    const totalFuelSalePaise = Number(input.totalFuelSalePaise || 0);
    const totalExpensePaise = Number(input.totalExpensePaise || 0);
    const cashTakenPaise = Number(input.cashTakenPaise || 0);
    const actualClosingCashPaise =
        input.actualClosingCashPaise === null || input.actualClosingCashPaise === undefined
            ? null
            : Number(input.actualClosingCashPaise);

    const collections = input.collections || [];

    let creditPaise = 0;
    let onlinePaise = 0;
    let otherNonCashPaise = 0;
    let cashTakenFromMethodsPaise = 0;
    const breakdown = [];

    for (const row of collections) {
        const amount = Number(row.amountPaise || 0);
        breakdown.push({
            paymentMethodId: row.paymentMethodId,
            name: row.name,
            methodType: row.methodType,
            amountPaise: amount,
            reducesCash: !!row.reducesCash,
            isCashTaken: !!row.isCashTaken,
        });

        if (row.isCashTaken) {
            cashTakenFromMethodsPaise += amount;
            continue;
        }

        if (!row.reducesCash) continue;

        const type = String(row.methodType || "").toLowerCase();
        if (type === "credit") creditPaise += amount;
        else if (type === "online" || type === "card" || type === "upi" || type === "bank") {
            onlinePaise += amount;
        } else otherNonCashPaise += amount;
    }

    const effectiveCashTaken = cashTakenPaise + cashTakenFromMethodsPaise;

    const totalCashPaise =
        totalFuelSalePaise -
        creditPaise -
        onlinePaise -
        otherNonCashPaise -
        totalExpensePaise;

    const expectedClosingCashPaise = totalCashPaise - effectiveCashTaken;

    const differencePaise =
        actualClosingCashPaise === null
            ? null
            : actualClosingCashPaise - expectedClosingCashPaise;

    const pendingPaise =
        actualClosingCashPaise === null
            ? Math.max(0, expectedClosingCashPaise)
            : Math.max(0, actualClosingCashPaise - expectedClosingCashPaise);
    const advancePaise =
        actualClosingCashPaise === null
            ? Math.max(0, -expectedClosingCashPaise)
            : Math.max(0, expectedClosingCashPaise - actualClosingCashPaise);

    return {
        totalFuelSalePaise,
        creditPaise,
        onlinePaise,
        otherNonCashPaise,
        totalExpensePaise,
        totalCashPaise,
        cashTakenPaise: effectiveCashTaken,
        expectedClosingCashPaise,
        actualClosingCashPaise,
        differencePaise,
        pendingPaise,
        advancePaise,
        breakdown,
    };
}

export function calculateLedgerRunningBalance(transactions, openingBalancePaise = 0) {
    let balance = Number(openingBalancePaise || 0);
    return transactions.map((txn) => {
        const amount = Number(txn.amountPaise || 0);
        if (String(txn.type).toUpperCase() === "CREDIT") {
            balance += amount;
        } else {
            balance -= amount;
        }
        return { ...txn, balancePaise: balance };
    });
}
