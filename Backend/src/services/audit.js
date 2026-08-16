import { query } from "../db/index.js";

export async function writeAudit({ entityType, entityId, action, userId, details }, client) {
    const runner = client ? client.query.bind(client) : query;
    await runner(
        `INSERT INTO audit_logs (entity_type, entity_id, action, user_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [entityType, entityId || null, action, userId || null, details ? JSON.stringify(details) : null]
    );
}
