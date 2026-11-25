import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const compileUrl = (filePath) => {
  const source = fs.readFileSync(filePath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
};

const {
  calculateRoomRecommendation,
  computeRoomLayout,
  formatConsultationNote,
  mergeConsultationNote,
  ROOM_CONFIGS,
} = await import(compileUrl("src/components/studio/room-calculator.ts"));

test("default 24x16 ft 2-row room resolves to 150in screen, 8 seats, and 7.2.4 Reference", () => {
  const rec = calculateRoomRecommendation({ lengthFt: 24, widthFt: 16, seatingRows: 2 });
  assert.equal(rec.lengthFt, 24);
  assert.equal(rec.widthFt, 16);
  assert.equal(rec.effectiveRows, 2);
  assert.equal(rec.rowCapNotice, null);
  assert.equal(rec.areaSqFt, 384);
  assert.equal(rec.seatsPerRow, 4);
  assert.equal(rec.totalSeats, 8);
  assert.equal(rec.recommendedScreenIn, 150);
  assert.equal(rec.recommendedConfigId, "7.2.4");
  assert.equal(rec.throwDistFt, 22.2);
  assert.ok(rec.viewingAngleDeg >= 38 && rec.viewingAngleDeg <= 45);
});

test("short rooms below 16 ft cap seating to 1 row with notice and recommend 5.1", () => {
  const rec = calculateRoomRecommendation({ lengthFt: 14, widthFt: 12, seatingRows: 2 });
  assert.equal(rec.effectiveRows, 1);
  assert.ok(rec.rowCapNotice && rec.rowCapNotice.includes("16 ft"));
  assert.equal(rec.recommendedConfigId, "5.1");
  assert.ok(rec.totalSeats >= 2);
});

test("extreme and non-finite inputs clamp cleanly without NaN or degenerate dimensions", () => {
  const nanRec = calculateRoomRecommendation({ lengthFt: Number.NaN, widthFt: Number.POSITIVE_INFINITY, seatingRows: 2 });
  assert.equal(nanRec.lengthFt, 24);
  assert.equal(nanRec.widthFt, 16);

  const tiny = calculateRoomRecommendation({ lengthFt: 4, widthFt: 3, seatingRows: 2 });
  assert.equal(tiny.lengthFt, 12);
  assert.equal(tiny.widthFt, 10);
  assert.ok(tiny.totalSeats >= 2);
  assert.ok(tiny.recommendedScreenIn >= 90 && tiny.recommendedScreenIn <= 200);

  const huge = calculateRoomRecommendation({ lengthFt: 99, widthFt: 50, seatingRows: 2 });
  assert.equal(huge.lengthFt, 32);
  assert.equal(huge.widthFt, 24);
  assert.ok(huge.recommendedScreenIn <= 200);
});

test("narrow 32x10 and wide 12x24 rooms preserve screen width clearance and speaker bounds", () => {
  for (const input of [
    { lengthFt: 32, widthFt: 10, seatingRows: 2 },
    { lengthFt: 12, widthFt: 24, seatingRows: 1 },
  ]) {
    const rec = calculateRoomRecommendation(input);
    const layout = computeRoomLayout(input);

    assert.ok(rec.screenWidthFt <= rec.widthFt * 0.72 + 0.05);
    assert.ok(Math.abs(layout.speakers.L.pos3d[0]) < layout.widthM / 2);
    assert.ok(Math.abs(layout.speakers.R.pos3d[0]) < layout.widthM / 2);

    // Center speaker sits cleanly below screen bottom bezel
    const screenBottomY = layout.screenCenterY - layout.screenHeightM / 2;
    assert.ok(screenBottomY > layout.speakers.C.pos3d[1] + 0.12);

    // Parametric 2D CAD coordinates remain inside SVG 0..120 viewBox
    assert.ok(layout.cadRoomRect.x > 0 && layout.cadRoomRect.x + layout.cadRoomRect.w < 120);
    assert.ok(layout.cadRoomRect.y > 0 && layout.cadRoomRect.y + layout.cadRoomRect.h < 120);
  }
});

test("ROOM_CONFIGS catalog contains accurate channel counts and mergeConsultationNote preserves custom user notes", () => {
  assert.deepEqual(
    ROOM_CONFIGS.map(c => [c.id, c.speakers.length]),
    [
      ["5.1", 6],
      ["5.1.2", 8],
      ["7.2.2", 11],
      ["7.2.4", 13],
    ],
  );

  const note = formatConsultationNote({
    lengthFt: 24,
    widthFt: 16,
    rows: 2,
    totalSeats: 8,
    screenIn: 150,
    throwDistFt: 22.2,
    configId: "7.2.4",
    configLabel: "7.2.4 Reference Spatial",
    amplification: "Marantz AV10",
  });

  assert.equal(mergeConsultationNote("", note), note);
  const replaced = mergeConsultationNote(note, note.replace("150″", "160″"));
  assert.ok(replaced.includes("160″") && !replaced.includes("150″"));

  const preserved = mergeConsultationNote("East facing basement with pocket doors.\n\n" + note, note.replace("24 × 16", "26 × 18"));
  assert.ok(preserved.startsWith("East facing basement with pocket doors."));
  assert.ok(preserved.includes("26 × 18"));
});
