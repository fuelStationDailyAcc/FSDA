import { AuditLog } from "../models/auditLog.model.js";
import { isValidObjectId } from "../db/helpers.js";

export async function writeAudit({ entityType, entityId, action, userId, details }) {
    await AuditLog.create({
        entityType,
        entityId: isValidObjectId(entityId) ? entityId : null,
        action,
        userId: isValidObjectId(userId) ? userId : null,
        details: details || null,
    });
}
