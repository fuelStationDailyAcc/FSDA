import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
    {
        entityType: { type: String, required: true },
        entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
        action: { type: String, required: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        details: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
        collection: "audit_logs",
    }
);

auditLogSchema.index({ entityType: 1, entityId: 1 });

export const AuditLog = mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);
