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

test("short rooms below 18 ft cap seating to 1 row with notice and recommend tier by area", () => {
  const rec14 = calculateRoomRecommendation({ lengthFt: 14, widthFt: 12, seatingRows: 2 });
  assert.equal(rec14.effectiveRows, 1);
  assert.ok(rec14.rowCapNotice && rec14.rowCapNotice.includes("18 ft"));
  assert.equal(rec14.recommendedConfigId, "5.1");

  const rec17 = calculateRoomRecommendation({ lengthFt: 17, widthFt: 16, seatingRows: 2 });
  assert.equal(rec17.effectiveRows, 1);
  assert.ok(rec17.rowCapNotice);
});

test("extreme and non-finite inputs clamp cleanly without NaN and preserve 100in floor for >=12ft widths", () => {
  const nanRec = calculateRoomRecommendation({ lengthFt: Number.NaN, widthFt: Number.POSITIVE_INFINITY, seatingRows: 2 });
  assert.equal(nanRec.lengthFt, 24);
  assert.equal(nanRec.widthFt, 16);

  // Every width >= 12 ft stays >= 100 in even in shallow 12-14 ft rooms
  for (const input of [
    { lengthFt: 12, widthFt: 12, seatingRows: 1 },
    { lengthFt: 12, widthFt: 24, seatingRows: 1 },
    { lengthFt: 14, widthFt: 16, seatingRows: 1 },
  ]) {
    const rec = calculateRoomRecommendation(input);
    assert.ok(rec.recommendedScreenIn >= 100 && rec.recommendedScreenIn <= 200, `${input.lengthFt}x${input.widthFt} gave ${rec.recommendedScreenIn}`);
  }

  // Only extreme < 12 ft width may dip below 100 in to protect tower clearance
  const tiny = calculateRoomRecommendation({ lengthFt: 4, widthFt: 3, seatingRows: 2 });
  assert.equal(tiny.lengthFt, 12);
  assert.equal(tiny.widthFt, 10);
  assert.ok(tiny.totalSeats >= 2);
  assert.ok(tiny.recommendedScreenIn >= 90 && tiny.recommendedScreenIn <= 100);

  const huge = calculateRoomRecommendation({ lengthFt: 99, widthFt: 50, seatingRows: 2 });
  assert.equal(huge.lengthFt, 32);
  assert.equal(huge.widthFt, 24);
  assert.ok(huge.recommendedScreenIn <= 200);
});

test("narrow 10ft, compact 2-row 18ft, and default 24x16 preserve screen/riser/subwoofer clearances", () => {
  for (const input of [
    { lengthFt: 32, widthFt: 10, seatingRows: 2 },
    { lengthFt: 24, widthFt: 12, seatingRows: 2 },
    { lengthFt: 18, widthFt: 16, seatingRows: 2 },
    { lengthFt: 20, widthFt: 18, seatingRows: 2 },
    { lengthFt: 24, widthFt: 16, seatingRows: 2 },
    { lengthFt: 12, widthFt: 24, seatingRows: 1 },
  ]) {
    const rec = calculateRoomRecommendation(input);
    const layout = computeRoomLayout(input);

    // Front L/R inner edges (cabinet halfWidth 0.19m) clear the screen frame edge
    const screenHalfFrameM = layout.screenWidthM / 2 + 0.08;
    const towerInnerEdgeX = Math.abs(layout.speakers.L.pos3d[0]) - 0.19;
    assert.ok(towerInnerEdgeX >= screenHalfFrameM - 0.02, `${input.lengthFt}x${input.widthFt}: tower ${towerInnerEdgeX} vs frame ${screenHalfFrameM}`);

    // Center speaker sits cleanly below screen bottom bezel
    const screenBottomY = layout.screenCenterY - layout.screenHeightM / 2;
    assert.ok(screenBottomY > layout.speakers.C.pos3d[1] + 0.12);

    // 2-row riser and seat footprints stay completely inside walls and clear SUB2 (0.31m half-size)
    const row2Seats = layout.seats.filter(s => s.rowIndex === 1);
    if (row2Seats.length > 0) {
      const z2 = row2Seats[0].zMeters;
      assert.ok(z2 - 0.39 >= layout.riserZStartM, `${input.lengthFt}x${input.widthFt}: row2 overhangs riser`);
      assert.ok(z2 + 0.39 <= layout.lengthM / 2 - 0.38, `${input.lengthFt}x${input.widthFt}: row2 too close to rear wall`);
      const sub2 = layout.speakers.SUB2.pos3d;
      const outerSeat = row2Seats[row2Seats.length - 1];
      const xClear = Math.abs(sub2[0] - outerSeat.xMeters) >= 0.31 + 0.42 - 0.02;
      const zClear = Math.abs(sub2[2] - outerSeat.zMeters) >= 0.31 + 0.39 - 0.02;
      assert.ok(xClear || zClear, `${input.lengthFt}x${input.widthFt}: SUB2 intersects outer row 2 seat`);
    }

    // Proportional 2D CAD coords strictly inside viewBox
    assert.ok(layout.cadRoomRect.x > 0 && layout.cadRoomRect.x + layout.cadRoomRect.w < 120);
    assert.ok(layout.cadRoomRect.y > 0 && layout.cadRoomRect.y + layout.cadRoomRect.h < 120);
    const cadAspect = layout.cadRoomRect.w / layout.cadRoomRect.h;
    const realAspect = rec.widthFt / rec.lengthFt;
    assert.ok(Math.abs(cadAspect - realAspect) < 0.02);
  }
});

test("recommendation tier boundaries match 220 / 320 / 380 sq ft thresholds", () => {
  assert.equal(calculateRoomRecommendation({ lengthFt: 18, widthFt: 12, seatingRows: 1 }).recommendedConfigId, "5.1"); // 216
  assert.equal(calculateRoomRecommendation({ lengthFt: 16, widthFt: 14, seatingRows: 1 }).recommendedConfigId, "5.1.2"); // 224
  assert.equal(calculateRoomRecommendation({ lengthFt: 20, widthFt: 16, seatingRows: 2 }).recommendedConfigId, "5.1.2"); // 320
  assert.equal(calculateRoomRecommendation({ lengthFt: 22, widthFt: 16, seatingRows: 2 }).recommendedConfigId, "7.2.2"); // 352
  assert.equal(calculateRoomRecommendation({ lengthFt: 24, widthFt: 16, seatingRows: 2 }).recommendedConfigId, "7.2.4"); // 384
});

test("mergeConsultationNote preserves both leading and trailing custom customer text across re-syncs", () => {
  const note1 = formatConsultationNote({
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
  const note2 = formatConsultationNote({
    lengthFt: 26,
    widthFt: 18,
    rows: 2,
    totalSeats: 10,
    screenIn: 160,
    throwDistFt: 24.2,
    configId: "7.2.4",
    configLabel: "7.2.4 Reference Spatial",
    amplification: "Marantz AV10",
  });

  const combined = `Basement room details:\n\n${note1}\n\nPlease call me after 5pm IST.`;
  const updated = mergeConsultationNote(combined, note2);
  assert.ok(updated.includes("Basement room details:"));
  assert.ok(updated.includes("Please call me after 5pm IST."));
  assert.ok(updated.includes("26 × 18 ft") && !updated.includes("24 × 16 ft"));

  assert.equal(ROOM_CONFIGS.length, 4);
});
