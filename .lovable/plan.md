

# Blank PDF Fix + Print Enhancement Plan

## Root Cause

The CSS at `src/index.css:178` has:
```css
body * { visibility: hidden; }
.print-area, .print-area * { visibility: visible; }
```

But **no component in the entire codebase** uses the `print-area` class. So when `window.print()` is called, every element is hidden -- producing a blank page.

## Fix Strategy

### 1. Fix Print CSS (`src/index.css`)

Replace the fragile `visibility: hidden` approach with a targeted hide strategy:
- Hide sidebar, header, action buttons, navigation elements
- Show `main` content area by default
- Add a `print-area` class that pages can use to scope printable content
- Force white background, black text, proper margins

### 2. Add `print-area` Class to Document Pages

Mark the printable document card with `print-area` class and mark action sidebars with `no-print`:

- **QuotationPreview.tsx**: Add `print-area` to the document Card (left column), `no-print` to action sidebar (right column)
- **InvoicePreview.tsx**: Same pattern
- **JobSheetDetail.tsx**: Add `print-area` to the main content column, `no-print` to action sidebar
- **PublicInvoice.tsx**: Add `print-area` to the card content
- **PublicQuotation.tsx**: Add `print-area` to the card content
- **PublicJobSheet.tsx**: Add `print-area` to the main card
- **DeliveryChallanPreview.tsx**: Add `print-area` to the document content
- **Payroll.tsx**: Add a dedicated print view for salary slips -- currently there's no print button but we should add one per employee showing a formatted payslip

### 3. Payroll Print Slip

Add a "Print Slip" button per paid payroll row that opens a new window with a formatted salary slip (employee name, month, basic/deductions/bonus/net, company header).

### 4. Password-Protected PDFs

Browser `window.print()` cannot generate password-protected PDFs. Two options:
- **Option A**: Create an edge function using a Deno PDF library to generate encrypted PDFs server-side
- **Option B**: Add a visible watermark ("ORIGINAL COPY -- DO NOT ALTER") on printed documents as a simpler deterrent

I will implement **Option B** (watermark) as the practical solution since true PDF password protection requires paid libraries not available in Deno edge functions.

## Files

```
EDIT:  src/index.css                         -- Fix print CSS rules
EDIT:  src/pages/QuotationPreview.tsx         -- Add print-area / no-print classes
EDIT:  src/pages/InvoicePreview.tsx           -- Add print-area / no-print classes
EDIT:  src/pages/JobSheetDetail.tsx           -- Add print-area / no-print classes
EDIT:  src/pages/PublicInvoice.tsx            -- Add print-area class
EDIT:  src/pages/PublicQuotation.tsx          -- Add print-area class
EDIT:  src/pages/PublicJobSheet.tsx           -- Add print-area class
EDIT:  src/pages/DeliveryChallanPreview.tsx   -- Add print-area / no-print classes
EDIT:  src/pages/Payroll.tsx                  -- Add print salary slip function
```

