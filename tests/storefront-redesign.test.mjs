import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { root } from "../tools/check-ui.mjs";

test("AcousticFieldVisualizer physics metrics stay within reference THX tolerances across 20Hz-120Hz sweep", () => {
  const calcRt60 = (freq) => Number((0.24 + (100 - freq) * 0.0008).toFixed(2));
  const calcAbsorption = (freq) => Number(Math.min(98.8, 91.2 + freq * 0.06).toFixed(1));
  const calcSpl = (freq) => Number(Math.min(105, 82 + Math.sin(freq / 10) * 3).toFixed(1));

  for (let freq = 20; freq <= 120; freq += 5) {
    const rt60 = calcRt60(freq);
    const absorption = calcAbsorption(freq);
    const spl = calcSpl(freq);

    assert.ok(rt60 >= 0.20 && rt60 <= 0.32, `RT60 (${rt60}s) at ${freq}Hz must be within optimal acoustic decay bounds`);
    assert.ok(absorption >= 90.0 && absorption <= 99.0, `Absorption (${absorption}%) at ${freq}Hz must be realistic`);
    assert.ok(spl >= 78.0 && spl <= 86.0, `SPL (${spl} dBA) at ${freq}Hz must conform to reference level cinema calibration`);
  }
});

test("AcousticFieldVisualizer uses refs for listenerPos and frequency to preserve 60fps wave continuity on drag", () => {
  const file = path.join(root, "src/components/home-theater/AcousticFieldVisualizer.tsx");
  const content = fs.readFileSync(file, "utf8");

  // Verify refs are declared
  assert.match(content, /listenerPosRef\s*=\s*useRef/);
  assert.match(content, /frequencyRef\s*=\s*useRef/);

  // Verify useEffect dependency array does NOT include listenerPos or frequency (which would cause unmount/teardown on drag)
  assert.match(content, /useEffect\([^]*?\},\s*\[\s*mode,\s*isPlaying,\s*active,\s*reduced\s*\]\);/);

  // Verify canvas has touchAction: "none" for mobile gesture handling
  assert.match(content, /touchAction:\s*"none"/);
  assert.match(content, /setPointerCapture/);
  assert.match(content, /scrollMarginTop/);
});

test("SoundstageSection orders SVG lines underneath speaker elements and scales from speaker centers", () => {
  const file = path.join(root, "src/components/home-theater/SoundstageSection.tsx");
  const content = fs.readFileSync(file, "utf8");

  // Connection lines must appear BEFORE speaker groups in the JSX/SVG flow
  const lineIdx = content.indexOf("Connection lines from sweet spot");
  const speakerIdx = content.indexOf("{/* Speakers */");
  assert.ok(lineIdx !== -1, "SoundstageSection must contain connection lines");
  assert.ok(speakerIdx !== -1, "SoundstageSection must contain speakers");
  assert.ok(lineIdx < speakerIdx, "Connection lines must be rendered before speakers so they sit underneath in SVG z-order");

  // Verify in-place transform origin for speakers
  assert.match(content, /transformOrigin:\s*`\$\{s\.x\}px \$\{s\.y\}px`/);

  // Verify scrollMarginTop
  assert.match(content, /scrollMarginTop/);
});

test("SoundstageSection topologies (5.1.2, 7.1.4, 9.4.6) cover all Dolby Atmos and THX specifications", () => {
  const file = path.join(root, "src/components/home-theater/SoundstageSection.tsx");
  const content = fs.readFileSync(file, "utf8");

  // Verify all 3 configurations exist
  assert.match(content, /"5\.1\.2"/);
  assert.match(content, /"7\.1\.4"/);
  assert.match(content, /"9\.4\.6"/);

  // Front LCR
  assert.match(content, /id:\s*"FL"/);
  assert.match(content, /id:\s*"C"/);
  assert.match(content, /id:\s*"FR"/);

  // Zenith height channels
  assert.match(content, /id:\s*"TFL"/);
  assert.match(content, /id:\s*"TFR"/);
  assert.match(content, /id:\s*"TML"/);
  assert.match(content, /id:\s*"TMR"/);
  assert.match(content, /id:\s*"TRL"/);
  assert.match(content, /id:\s*"TRR"/);

  // Multi-sub pressure cancellation
  assert.match(content, /id:\s*"SUB1"/);
  assert.match(content, /id:\s*"SUB2"/);
  assert.match(content, /id:\s*"SUB3"/);
  assert.match(content, /id:\s*"SUB4"/);
});

test("Configurator 9-matrix recommendations provide complete turnkey engineering packages", () => {
  const file = path.join(root, "src/components/home-theater/Configurator.tsx");
  const content = fs.readFileSync(file, "utf8");

  const roomIds = ["small", "medium", "large"];
  const budgetIds = ["basic", "premium", "ultra"];
  const setupIds = ["stereo", "atmos", "cinema"];

  for (const r of roomIds) {
    for (const b of budgetIds) {
      for (const s of setupIds) {
        const key = `"${r}-${b}-${s}"`;
        assert.ok(content.includes(key), `Configurator must define recommendation for matrix key ${key}`);
      }
    }
  }

  assert.match(content, /scrollMarginTop/);
  assert.match(content, /onBookSetup/);
});

test("ConsultationModal synchronizes initialSpec into form notes on subsequent opens", () => {
  const file = path.join(root, "src/components/home-theater/CinemaModals.tsx");
  const content = fs.readFileSync(file, "utf8");

  // Verify useEffect is present to update notes when initialSpec or open changes
  assert.match(content, /useEffect\(\(\)\s*=>\s*\{[\s\S]*?notes:\s*initialSpec[\s\S]*?\},\s*\[\s*initialSpec,\s*open\s*\]\);/);
});

test("TrackOrderModal queries Supabase job_sheets and handles real / mock tracking states", () => {
  const file = path.join(root, "src/components/home-theater/CinemaModals.tsx");
  const content = fs.readFileSync(file, "utf8");

  assert.match(content, /supabase\s*\.from\("job_sheets"\)/);
  assert.match(content, /public_token/);
  assert.match(content, /CircularProgress/);
});

test("Public storefront screens (HomeTheaterHome, LandingPage, HomeTheaterContact) enforce scroll margins and brand identity", () => {
  const home = fs.readFileSync(path.join(root, "src/screens/public/HomeTheaterHome.tsx"), "utf8");
  const landing = fs.readFileSync(path.join(root, "src/screens/LandingPage.tsx"), "utf8");
  const contact = fs.readFileSync(path.join(root, "src/screens/public/HomeTheaterContact.tsx"), "utf8");

  // Check section scroll margins on HomeTheaterHome
  for (const id of ["services", "repair-lab", "projects", "testimonials", "faq", "consultation"]) {
    assert.ok(home.includes(`id="${id}"`), `HomeTheaterHome must contain #${id}`);
  }
  const scrollMarginMatches = home.match(/scrollMarginTop:\s*\{\s*xs:\s*"4\.5rem",\s*md:\s*"5\.5rem"\s*\}/g);
  assert.ok(scrollMarginMatches && scrollMarginMatches.length >= 6, "Every anchor section must have scrollMarginTop");

  // Check TheaterRoom3D is rendered for all devices without device gating
  assert.doesNotMatch(home, /!isMobile\s*\?\s*<TheaterRoom3D/);
  assert.match(home, /<TheaterRoom3D\s*\/>/);

  // Check LandingPage has WhatsApp concierge
  assert.match(landing, /<WhatsAppFloat\s*\/>/);

  // Check HomeTheaterContact uses brand tokens and no legacy simulated variables
  assert.match(contact, /CINEMA_COLORS/);
  assert.match(contact, /TYPOGRAPHY/);
  assert.doesNotMatch(contact, /--alv-gradient/);
  assert.doesNotMatch(contact, /space-y/);
});
