import { supabase } from "@/integrations/supabase/client";

export interface SystemAuditInput {
  action: string;
  module: "crm" | "sales" | "repair" | "finance" | "hrm" | "inventory" | "system";
  entityType?: string;
  entityId?: string;
  details?: string;
  staffName?: string | null;
  userRole?: string | null;
}

/** Records an immutable audit trail entry without failing the caller's primary mutation. */
export async function recordSystemAudit(input: SystemAuditInput): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke("record-audit", {
      body: {
        action: input.action,
        module: input.module,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        details: input.details ?? null,
        staff_name: input.staffName ?? null,
        user_role: input.userRole ?? null,
      },
    });
    if (error) {
      console.warn("[recordSystemAudit]", error.message || error);
    }
  } catch (err) {
    console.warn("[recordSystemAudit]", err);
  }
}
