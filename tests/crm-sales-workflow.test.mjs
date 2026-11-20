import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { root } from "../tools/check-ui.mjs";

async function importTranspiled(file) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      jsx: ts.JsxEmit.React,
    },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

test("Customer metadata serialization and parsing roundtrips cleanly", async () => {
  const { parseCustomerMetadata, serializeCustomerNotes } = await importTranspiled(
    "src/lib/customer-metadata.ts"
  );

  // 1. VIP + Credit Limit + Notes
  const serialized = serializeCustomerNotes("Payment on 15th of every month.", true, "₹50,000");
  assert.equal(serialized, "[VIP] [Credit: ₹50,000]\nPayment on 15th of every month.");

  const parsed = parseCustomerMetadata(serialized, "08AAAAA0000A1Z5");
  assert.equal(parsed.customerType, "B2B");
  assert.equal(parsed.isVIP, true);
  assert.equal(parsed.creditLimit, "₹50,000");
  assert.equal(parsed.cleanNotes, "Payment on 15th of every month.");

  // 2. Retail customer without GST or VIP
  const retailParsed = parseCustomerMetadata("Friendly customer", null);
  assert.equal(retailParsed.customerType, "B2C");
  assert.equal(retailParsed.isVIP, false);
  assert.equal(retailParsed.creditLimit, null);
  assert.equal(retailParsed.cleanNotes, "Friendly customer");

  // 3. Null / empty notes
  const emptyParsed = parseCustomerMetadata(null, null);
  assert.equal(emptyParsed.customerType, "B2C");
  assert.equal(emptyParsed.isVIP, false);
  assert.equal(emptyParsed.creditLimit, null);
  assert.equal(emptyParsed.cleanNotes, "");
});

test("Date inputs in sales and quotation screens explicitly shrink labels to prevent dd/mm/yyyy collisions", () => {
  const quotationSrc = fs.readFileSync(path.join(root, "src/screens/QuotationAdd.tsx"), "utf8");
  const invoiceSrc = fs.readFileSync(path.join(root, "src/screens/InvoiceAdd.tsx"), "utf8");
  const jobSheetSrc = fs.readFileSync(path.join(root, "src/screens/JobSheetCreate.tsx"), "utf8");

  // QuotationAdd date fields
  assert.match(quotationSrc, /<TextField[\s\S]*?type="date"[\s\S]*?value=\{dateIssued\}[\s\S]*?shrink:\s*true/);
  assert.match(quotationSrc, /<TextField[\s\S]*?type="date"[\s\S]*?value=\{validUntil\}[\s\S]*?shrink:\s*true/);

  // InvoiceAdd date fields
  assert.match(invoiceSrc, /<TextField[\s\S]*?type="date"[\s\S]*?value=\{dateIssued\}[\s\S]*?shrink:\s*true/);
  assert.match(invoiceSrc, /<TextField[\s\S]*?type="date"[\s\S]*?value=\{dueDate\}[\s\S]*?shrink:\s*true/);

  // JobSheetCreate date field
  assert.match(jobSheetSrc, /<TextField[\s\S]*?type="date"[\s\S]*?value=\{form\.estimated_completion\}[\s\S]*?shrink:\s*true/);
});

test("Customer autocomplete does not force controlled empty inputValue and searches phone/email/gst", () => {
  const quotationSrc = fs.readFileSync(path.join(root, "src/screens/QuotationAdd.tsx"), "utf8");
  const invoiceSrc = fs.readFileSync(path.join(root, "src/screens/InvoiceAdd.tsx"), "utf8");

  // Autocomplete must NOT pass inputValue={customerSearchInput} as that blanks out the selected customer
  assert.doesNotMatch(quotationSrc, /<Autocomplete[^>]*inputValue=\{customerSearchInput\}/);
  assert.doesNotMatch(invoiceSrc, /<Autocomplete[^>]*inputValue=\{customerSearchInput\}/);

  // Must stringify phone and gst_number in createFilterOptions
  assert.match(quotationSrc, /stringify:[^}]*phone/);
  assert.match(quotationSrc, /stringify:[^}]*gst_number/);
  assert.match(invoiceSrc, /stringify:[^}]*phone/);
  assert.match(invoiceSrc, /stringify:[^}]*gst_number/);

  // Must carry typedName into action item
  assert.match(quotationSrc, /typedName:\s*trimmed/);
  assert.match(invoiceSrc, /typedName:\s*trimmed/);
});

test("CustomerProfile routes repair tickets to valid /repairs/[id] routes", () => {
  const profileSrc = fs.readFileSync(path.join(root, "src/screens/CustomerProfile.tsx"), "utf8");
  assert.match(profileSrc, /navigate\(`\/repairs\/\$\{job\.id\}`\)/);
  assert.doesNotMatch(profileSrc, /navigate\(`\/job\//);
});

test("JobSheetCreate provides quick customer creation dialog", () => {
  const jobSheetSrc = fs.readFileSync(path.join(root, "src/screens/JobSheetCreate.tsx"), "utf8");
  assert.match(jobSheetSrc, /CustomerQuickDialog/);
  assert.match(jobSheetSrc, /\+ Add Customer/);
});
