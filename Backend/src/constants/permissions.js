export const PERMISSION_AREAS = ["accounts", "ledger", "settings"];
export const PERMISSION_ACTIONS = ["read", "write"];

export const EMPTY_PERMISSIONS = {
    accounts: { read: false, write: false },
    ledger: { read: false, write: false },
    settings: { read: false, write: false },
};

export const DEFAULT_STAFF_PERMISSIONS = {
    accounts: { read: true, write: true },
    ledger: { read: true, write: false },
    settings: { read: false, write: false },
};

export const FULL_PERMISSIONS = {
    accounts: { read: true, write: true },
    ledger: { read: true, write: true },
    settings: { read: true, write: true },
};

export function normalizePermissions(input, fallback = EMPTY_PERMISSIONS) {
    const source = input && typeof input === "object" ? input : {};
    const next = {
        accounts: {
            read: Boolean(source.accounts?.read ?? fallback.accounts.read),
            write: Boolean(source.accounts?.write ?? fallback.accounts.write),
        },
        ledger: {
            read: Boolean(source.ledger?.read ?? fallback.ledger.read),
            write: Boolean(source.ledger?.write ?? fallback.ledger.write),
        },
        settings: {
            read: Boolean(source.settings?.read ?? fallback.settings.read),
            write: Boolean(source.settings?.write ?? fallback.settings.write),
        },
    };

    for (const area of PERMISSION_AREAS) {
        if (next[area].write) next[area].read = true;
    }

    return next;
}

export function isOwner(user) {
    if (!user) return false;
    if (user.ownerId) return false;
    const role = String(user.role || "").toLowerCase();
    if (role === "staff") return false;
    return role === "admin" || role === "manager" || !role;
}

export function hasPermission(user, key) {
    if (!user || !key) return false;
    if (isOwner(user)) return true;

    const [area, action] = String(key).split(".");
    if (!PERMISSION_AREAS.includes(area) || !PERMISSION_ACTIONS.includes(action)) {
        return false;
    }

    const permissions = normalizePermissions(user.permissions);
    return Boolean(permissions[area]?.[action]);
}
