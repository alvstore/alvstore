import { useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  IconButton,
  MenuItem,
  Paper,
  Popover,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Button,
  CircularProgress,
} from "@mui/material";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  ImagePlus,
  Link2,
  Package,
  Trash2,
  X,
} from "lucide-react";
import { reorderListItems, uploadDocumentItemImage } from "@/lib/document-pdf-client";

export interface EditableLineItem {
  product_id: string | null;
  product_name: string;
  description: string;
  hsn_code: string;
  quantity: number;
  unit_price: number;
  discount_type: string;
  discount_value: number;
  gst_percentage: number;
  image_url?: string | null;
  sort_order?: number | null;
}

export function computeLineTotal(item: Pick<EditableLineItem, "quantity" | "unit_price" | "discount_type" | "discount_value">): number {
  const gross = Number(item.quantity || 0) * Number(item.unit_price || 0);
  const disc =
    item.discount_type === "percentage"
      ? (gross * Number(item.discount_value || 0)) / 100
      : Number(item.discount_value || 0);
  return Math.max(0, gross - disc);
}

export interface SortableLineItemsEditorProps {
  items: EditableLineItem[];
  onChange: (items: EditableLineItem[]) => void;
  allowImages?: boolean;
  showImages?: boolean;
  hidePricing?: boolean;
  readOnly?: boolean;
  uploadFolder?: string;
}

function pickImageFile(onFile: (file: File) => void) {
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = "image/png,image/jpeg,image/webp";
  picker.onchange = () => {
    const file = picker.files?.[0];
    if (file) onFile(file);
  };
  picker.click();
}

export function SortableLineItemsEditor({
  items,
  onChange,
  allowImages = false,
  showImages = true,
  hidePricing = false,
  readOnly = false,
  uploadFolder = "document-items",
}: SortableLineItemsEditorProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [urlAnchor, setUrlAnchor] = useState<{ el: HTMLElement; idx: number } | null>(null);
  const [urlDraft, setUrlDraft] = useState("");

  const displayImageCol = allowImages && showImages;

  const updateItem = (idx: number, patch: Partial<EditableLineItem>) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const removeItem = (idx: number) => {
    const next = items.filter((_, i) => i !== idx).map((it, i) => ({ ...it, sort_order: i }));
    onChange(next);
  };

  const moveItem = (fromIdx: number, toIdx: number) => {
    onChange(reorderListItems(items, fromIdx, toIdx));
  };

  const handleUpload = async (idx: number, file: File) => {
    setImageError(null);
    setUploadingIdx(idx);
    try {
      const publicUrl = await uploadDocumentItemImage(file, uploadFolder);
      updateItem(idx, { image_url: publicUrl });
    } catch (err) {
      setImageError((err as Error).message || "Failed to upload product image");
    } finally {
      setUploadingIdx(null);
    }
  };

  const openUrlPopover = (el: HTMLElement, idx: number) => {
    setUrlDraft(items[idx]?.image_url || "");
    setUrlAnchor({ el, idx });
  };

  const saveUrlDraft = () => {
    if (!urlAnchor) return;
    const trimmed = urlDraft.trim();
    updateItem(urlAnchor.idx, { image_url: trimmed || null });
    setUrlAnchor(null);
  };

  const formatMoney = (n: number) =>
    `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <Stack spacing={1.25}>
      {imageError && (
        <Alert severity="error" role="alert" onClose={() => setImageError(null)}>
          {imageError}
        </Alert>
      )}

      {items.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{
            p: 3,
            textAlign: "center",
            borderStyle: "dashed",
            borderColor: "divider",
            bgcolor: "background.default",
          }}
        >
          <Typography variant="body2" color="text.secondary">
            No items added yet. Search catalog or click &ldquo;+ Add Custom Line&rdquo; above.
          </Typography>
        </Paper>
      ) : (
        items.map((item, idx) => {
          const lineTotal = computeLineTotal(item);
          const isDropTarget = overIdx === idx && dragIdx !== null && dragIdx !== idx;
          return (
            <Paper
              key={`${item.product_id || "custom"}-${idx}`}
              variant="outlined"
              draggable={!readOnly}
              onDragStart={() => {
                if (!readOnly) setDragIdx(idx);
              }}
              onDragOver={(e) => {
                if (readOnly) return;
                e.preventDefault();
                if (overIdx !== idx) setOverIdx(idx);
              }}
              onDrop={(e) => {
                if (readOnly) return;
                e.preventDefault();
                if (dragIdx !== null && dragIdx !== idx) {
                  moveItem(dragIdx, idx);
                }
                setDragIdx(null);
                setOverIdx(null);
              }}
              onDragEnd={() => {
                setDragIdx(null);
                setOverIdx(null);
              }}
              sx={{
                p: 1.5,
                borderRadius: 2,
                borderColor: isDropTarget ? "primary.main" : "divider",
                bgcolor: dragIdx === idx ? "action.selected" : "background.paper",
                transition: "border-color 150ms ease, background-color 150ms ease",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  flexDirection: { xs: "column", md: "row" },
                  gap: 1.5,
                  alignItems: "flex-start",
                }}
              >
                {/* Drag grip + WCAG Move Up/Down */}
                <Stack
                  direction={{ xs: "row", md: "column" }}
                  spacing={0.25}
                  sx={{ alignItems: "center", justifyContent: "center" }}
                >
                  <Tooltip title={readOnly ? "Locked" : "Drag to reorder"}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "text.disabled",
                        cursor: readOnly ? "default" : "grab",
                        py: 0.25,
                      }}
                    >
                      <GripVertical size={16} />
                    </Box>
                  </Tooltip>
                  <IconButton
                    size="small"
                    disabled={readOnly || idx === 0}
                    aria-label={`Move ${item.product_name || `item ${idx + 1}`} up`}
                    onClick={() => moveItem(idx, idx - 1)}
                    sx={{ width: 26, height: 26 }}
                  >
                    <ArrowUp size={14} />
                  </IconButton>
                  <IconButton
                    size="small"
                    disabled={readOnly || idx === items.length - 1}
                    aria-label={`Move ${item.product_name || `item ${idx + 1}`} down`}
                    onClick={() => moveItem(idx, idx + 1)}
                    sx={{ width: 26, height: 26 }}
                  >
                    <ArrowDown size={14} />
                  </IconButton>
                </Stack>

                {/* Optional fixed 48x48 Product Image column */}
                {displayImageCol && (
                  <Stack spacing={0.5} sx={{ alignItems: "center" }}>
                    <Box sx={{ position: "relative" }}>
                      <Avatar
                        variant="rounded"
                        src={item.image_url || undefined}
                        alt={item.product_name || "Item image"}
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 1.5,
                          bgcolor: "action.hover",
                          border: "1px solid",
                          borderColor: "divider",
                          color: "text.secondary",
                        }}
                      >
                        <Package size={20} />
                      </Avatar>
                      {uploadingIdx === idx && (
                        <Box
                          sx={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: "rgba(255,255,255,0.72)",
                            borderRadius: 1.5,
                          }}
                        >
                          <CircularProgress size={18} />
                        </Box>
                      )}
                    </Box>
                    {!readOnly && (
                      <Stack direction="row" spacing={0.25}>
                        <Tooltip title="Upload photo (PNG/JPEG/WebP)">
                          <IconButton
                            size="small"
                            disabled={uploadingIdx === idx}
                            aria-label={`Upload image for ${item.product_name || `item ${idx + 1}`}`}
                            onClick={() => pickImageFile((file) => void handleUpload(idx, file))}
                            sx={{ p: 0.4 }}
                          >
                            <ImagePlus size={13} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Paste image URL">
                          <IconButton
                            size="small"
                            aria-label={`Set image URL for ${item.product_name || `item ${idx + 1}`}`}
                            onClick={(e) => openUrlPopover(e.currentTarget, idx)}
                            sx={{ p: 0.4 }}
                          >
                            <Link2 size={13} />
                          </IconButton>
                        </Tooltip>
                        {item.image_url && (
                          <Tooltip title="Remove photo">
                            <IconButton
                              size="small"
                              color="error"
                              aria-label={`Clear image for ${item.product_name || `item ${idx + 1}`}`}
                              onClick={() => updateItem(idx, { image_url: null })}
                              sx={{ p: 0.4 }}
                            >
                              <X size={13} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    )}
                  </Stack>
                )}

                {/* Main Responsive Content Stack (prevents horizontal clipping on 740px cards) */}
                <Stack spacing={1.25} sx={{ flex: 1, minWidth: 0, width: "100%" }}>
                  {/* Row 1: Item Name + Amount + Remove */}
                  <Box
                    sx={{
                      display: "flex",
                      flexWrap: { xs: "wrap", sm: "nowrap" },
                      gap: 1.25,
                      alignItems: "center",
                    }}
                  >
                    <TextField
                      size="small"
                      fullWidth
                      label={`#${idx + 1} Item Name`}
                      value={item.product_name}
                      disabled={readOnly}
                      slotProps={item.product_id ? undefined : { htmlInput: { "aria-label": "Custom item name" } }}
                      onChange={(e) => updateItem(idx, { product_name: e.target.value })}
                      sx={{ flex: 1, minWidth: 180 }}
                    />
                    {!hidePricing && (
                      <Box sx={{ textAlign: "right", minWidth: 88, flexShrink: 0 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.1 }}>
                          Amount
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                          {formatMoney(lineTotal)}
                        </Typography>
                      </Box>
                    )}
                    <IconButton
                      size="small"
                      color="error"
                      disabled={readOnly}
                      aria-label={`Remove ${item.product_name || `item ${idx + 1}`}`}
                      onClick={() => removeItem(idx)}
                      sx={{ flexShrink: 0 }}
                    >
                      <Trash2 size={15} />
                    </IconButton>
                  </Box>

                  {/* Row 2: Qty + Rate + Disc + GST% + HSN */}
                  <Box
                    sx={{
                      display: "grid",
                      gap: 1,
                      gridTemplateColumns: hidePricing
                        ? { xs: "1fr 1fr", sm: "90px 130px 1fr" }
                        : { xs: "1fr 1fr", sm: "72px minmax(92px, 1fr) 132px 72px 100px" },
                      alignItems: "center",
                    }}
                  >
                    <TextField
                      size="small"
                      type="number"
                      label="Qty"
                      value={item.quantity}
                      disabled={readOnly}
                      slotProps={{ htmlInput: { min: 1, step: 1 } }}
                      onChange={(e) => updateItem(idx, { quantity: Math.max(1, Number(e.target.value || 1)) })}
                    />
                    {!hidePricing ? (
                      <>
                        <TextField
                          size="small"
                          type="number"
                          label="Rate (₹)"
                          value={item.unit_price}
                          disabled={readOnly}
                          slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                          onChange={(e) => updateItem(idx, { unit_price: Math.max(0, Number(e.target.value || 0)) })}
                        />
                        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                          <Select
                            size="small"
                            value={item.discount_type || "percentage"}
                            disabled={readOnly}
                            aria-label="Discount type"
                            onChange={(e) => updateItem(idx, { discount_type: String(e.target.value) })}
                            sx={{ width: 60 }}
                          >
                            <MenuItem value="percentage">%</MenuItem>
                            <MenuItem value="fixed">₹</MenuItem>
                          </Select>
                          <TextField
                            size="small"
                            type="number"
                            label="Disc"
                            value={item.discount_value}
                            disabled={readOnly}
                            slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                            onChange={(e) => updateItem(idx, { discount_value: Math.max(0, Number(e.target.value || 0)) })}
                          />
                        </Stack>
                        <TextField
                          size="small"
                          type="number"
                          label="GST%"
                          value={item.gst_percentage}
                          disabled={readOnly}
                          slotProps={{ htmlInput: { min: 0, max: 100, step: "0.1" } }}
                          onChange={(e) => updateItem(idx, { gst_percentage: Math.max(0, Number(e.target.value || 0)) })}
                        />
                      </>
                    ) : (
                      <Typography variant="caption" color="text.secondary" sx={{ gridColumn: "span 1" }}>
                        Dispatch qty only
                      </Typography>
                    )}
                    <TextField
                      size="small"
                      label="HSN"
                      value={item.hsn_code}
                      disabled={readOnly}
                      onChange={(e) => updateItem(idx, { hsn_code: e.target.value })}
                    />
                  </Box>

                  {/* Row 3: Full-width Spec / Serial / Warranty Notes */}
                  <TextField
                    size="small"
                    fullWidth
                    multiline
                    minRows={1}
                    maxRows={3}
                    label="Specification / Notes"
                    placeholder="Serial no, specs, warranty or configuration"
                    value={item.description}
                    disabled={readOnly}
                    onChange={(e) => updateItem(idx, { description: e.target.value })}
                  />
                </Stack>
              </Box>
            </Paper>
          );
        })
      )}

      <Popover
        open={Boolean(urlAnchor)}
        anchorEl={urlAnchor?.el ?? null}
        onClose={() => setUrlAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Stack spacing={1} sx={{ p: 1.5, width: 290 }}>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            Item Thumbnail Image URL
          </Typography>
          <TextField
            size="small"
            fullWidth
            placeholder="https://... or /uploads/..."
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
          />
          <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
            <Button size="small" onClick={() => setUrlAnchor(null)}>
              Cancel
            </Button>
            <Button size="small" variant="contained" onClick={saveUrlDraft}>
              Save URL
            </Button>
          </Stack>
        </Stack>
      </Popover>
    </Stack>
  );
}
