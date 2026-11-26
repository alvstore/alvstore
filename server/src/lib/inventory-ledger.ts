import type { Prisma } from "@prisma/client";

export type StockDecision = "deduct_out" | "restore_in" | "noop";

export interface StockPlanInput {
  docType: "invoice" | "challan";
  deductStock: boolean;
  stockDeductedAt: Date | string | null;
  stockReversedAt: Date | string | null;
  linkedAlreadyDeducted: boolean;
  jobSheetId?: string | null;
  challanType?: string | null;
  targetStatus?: string | null;
  explicitMode?: "deduct" | "reverse";
}

const CHALLAN_DISPATCHED_STATES = new Set(["dispatched", "in_transit", "out_for_delivery", "delivered", "sent"]);
const CHALLAN_RETURN_STATES = new Set(["returned", "cancelled"]);

export function planDocumentStockAction(input: StockPlanInput): StockDecision {
  if (!input.deductStock) return "noop";

  // Never alter showroom inventory for customer-owned repair handovers
  if (input.jobSheetId) return "noop";

  if (input.docType === "invoice") {
    if (input.explicitMode === "reverse" || input.targetStatus === "cancelled") {
      return input.stockDeductedAt && !input.stockReversedAt ? "restore_in" : "noop";
    }
    if (input.stockDeductedAt || input.linkedAlreadyDeducted) return "noop";
    return "deduct_out";
  }

  const status = (input.targetStatus || "").toLowerCase();
  const cType = (input.challanType || "delivery").toLowerCase();

  // Sales returns add stock back in once when received (`delivered`)
  if (cType === "sales_return") {
    if (status === "delivered" && !input.stockReversedAt) return "restore_in";
    return "noop";
  }

  if (input.explicitMode === "reverse" || CHALLAN_RETURN_STATES.has(status)) {
    return input.stockDeductedAt && !input.stockReversedAt ? "restore_in" : "noop";
  }

  if (CHALLAN_DISPATCHED_STATES.has(status)) {
    if (input.stockDeductedAt || input.linkedAlreadyDeducted) return "noop";
    return "deduct_out";
  }

  return "noop";
}

export async function syncDocumentStock(
  tx: Prisma.TransactionClient,
  opts: {
    docType: "invoice" | "challan";
    docId: string;
    targetStatus?: string | null;
    explicitMode?: "deduct" | "reverse";
    userId?: string | null;
    note?: string;
  }
): Promise<{ action: StockDecision; itemsUpdated: number }> {
  if (opts.docType === "invoice") {
    const inv = await tx.invoices.findUnique({
      where: { id: opts.docId },
      include: {
        rl_invoice_items_invoice_id: true,
        rl_delivery_challans_invoice_id: { select: { id: true, stock_deducted_at: true, stock_reversed_at: true } },
      },
    });
    if (!inv) throw new Error("Invoice not found");

    const linkedAlreadyDeducted = inv.rl_delivery_challans_invoice_id.some(
      (ch) => ch.stock_deducted_at !== null && ch.stock_reversed_at === null
    );
    const action = planDocumentStockAction({
      docType: "invoice",
      deductStock: inv.deduct_stock,
      stockDeductedAt: inv.stock_deducted_at,
      stockReversedAt: inv.stock_reversed_at,
      linkedAlreadyDeducted,
      jobSheetId: inv.job_sheet_id,
      targetStatus: opts.targetStatus ?? inv.status,
      explicitMode: opts.explicitMode,
    });
    if (action === "noop") return { action, itemsUpdated: 0 };

    const catalogItems = inv.rl_invoice_items_invoice_id.filter((i) => Boolean(i.product_id) && (i.quantity ?? 0) > 0);
    for (const item of catalogItems) {
      const qty = Math.max(0, Number(item.quantity || 0));
      if (!qty || !item.product_id) continue;
      if (action === "deduct_out") {
        // trg_update_stock_on_movement updates products.stock_quantity atomically on INSERT into stock_movements
        await tx.stockMovements.create({
          data: {
            product_id: item.product_id,
            type: "out",
            quantity: qty,
            reference: inv.invoice_number || inv.id,
            notes: opts.note || `Invoice deduction (${inv.invoice_number})`,
            created_by: opts.userId ?? null,
          },
        });
      } else {
        // trg_update_stock_on_movement updates products.stock_quantity atomically on INSERT into stock_movements
        await tx.stockMovements.create({
          data: {
            product_id: item.product_id,
            type: "in",
            quantity: qty,
            reference: inv.invoice_number || inv.id,
            notes: opts.note || `Invoice cancellation restore (${inv.invoice_number})`,
            created_by: opts.userId ?? null,
          },
        });
      }
    }

    await tx.invoices.update({
      where: { id: inv.id },
      data: action === "deduct_out" ? { stock_deducted_at: new Date() } : { stock_reversed_at: new Date() },
    });
    return { action, itemsUpdated: catalogItems.length };
  }

  const ch = await tx.deliveryChallans.findUnique({
    where: { id: opts.docId },
    include: {
      rl_delivery_challan_items: true,
      r_invoices: { select: { id: true, stock_deducted_at: true, stock_reversed_at: true } },
    },
  });
  if (!ch) throw new Error("Delivery challan not found");

  const linkedAlreadyDeducted = Boolean(ch.r_invoices?.stock_deducted_at && !ch.r_invoices?.stock_reversed_at);
  const action = planDocumentStockAction({
    docType: "challan",
    deductStock: ch.deduct_stock,
    stockDeductedAt: ch.stock_deducted_at,
    stockReversedAt: ch.stock_reversed_at,
    linkedAlreadyDeducted,
    jobSheetId: ch.job_sheet_id,
    challanType: ch.challan_type,
    targetStatus: opts.targetStatus ?? ch.status,
    explicitMode: opts.explicitMode,
  });
  if (action === "noop") return { action, itemsUpdated: 0 };

  const catalogItems = ch.rl_delivery_challan_items.filter((i) => Boolean(i.product_id) && (i.quantity ?? 0) > 0);
  for (const item of catalogItems) {
    const qty = Math.max(0, Number(item.quantity || 0));
    if (!qty || !item.product_id) continue;
    if (action === "deduct_out") {
      // trg_update_stock_on_movement updates products.stock_quantity atomically on INSERT into stock_movements
      await tx.stockMovements.create({
        data: {
          product_id: item.product_id,
          type: "out",
          quantity: qty,
          reference: ch.challan_number || ch.id,
          notes: opts.note || `Delivery challan dispatch (${ch.challan_number})`,
          created_by: opts.userId ?? null,
        },
      });
    } else {
      // trg_update_stock_on_movement updates products.stock_quantity atomically on INSERT into stock_movements
      await tx.stockMovements.create({
        data: {
          product_id: item.product_id,
          type: "in",
          quantity: qty,
          reference: ch.challan_number || ch.id,
          notes: opts.note || `Delivery challan return/cancel (${ch.challan_number})`,
          created_by: opts.userId ?? null,
        },
      });
    }
  }

  await tx.deliveryChallans.update({
    where: { id: ch.id },
    data: action === "deduct_out" ? { stock_deducted_at: new Date() } : { stock_reversed_at: new Date() },
  });
  return { action, itemsUpdated: catalogItems.length };
}
