/** Shared repair device profiles, conditional pre-repair checklists, post-QC lists, and color helpers. */

export type ChecklistValue = "yes" | "no" | "na" | "";

export interface ChecklistItem {
  category: string;
  item: string;
  value: ChecklistValue;
  autoSet?: boolean;
  /** True when the item requires the device to boot / power ON to verify. */
  powerDependent?: boolean;
}

export interface DeviceColorSwatch {
  name: string;
  hex: string;
}

export interface DeviceModelOption {
  id?: string;
  brand: string;
  device_type: string;
  name: string;
  series?: string | null;
  color_options: DeviceColorSwatch[];
  storage_options: string[];
  sort_order?: number;
}

export type DeviceProfileKey = "mobile" | "tablet" | "laptop" | "desktop" | "watch" | "general";

export const POWER_GATE_ITEM = "Device turns ON";

const LEGACY_POWER_DEPENDENT_CATEGORIES = new Set([
  "Audio",
  "Camera",
  "Network",
  "Hardware",
  "Input",
  "Ports",
  "Cooling",
  "Display",
  "Display & Biometrics",
  "Display & Input",
  "Audio & Cameras",
  "Audio, Camera & Thermal",
  "Audio, Camera & Cooling",
  "Connectivity & Hardware",
  "Ports, Battery & Wireless",
  "Ports & Network",
  "Display & Sensors",
  "Audio, Charging & Wireless",
  "Functional Diagnostics",
]);

const ALWAYS_PHYSICAL_ITEMS = new Set([
  POWER_GATE_ITEM,
  "Draws charging / power current",
  "Battery charges",
  "Display damaged / scratches",
  "Monitor included (physical damage)",
  "Display hinge intact",
  "Screen / glass free of cracks & scratches",
  "Frame / chassis free of dents or bends",
  "Back glass / enclosure intact",
  "Camera lens glass intact",
  "Liquid indicator clean (no moisture signs)",
  "External screws & seals intact",
  "Top lid & display hinge intact",
  "Bottom case & palmrest intact",
  "Port openings clean & undamaged",
  "No visible liquid spill or corrosion",
  "Glass panel & display bezel intact",
  "Stand / VESA mount & chassis intact",
  "No liquid or thermal scorch marks",
  "Crystal / display glass intact",
  "Case body, lugs & sensor back intact",
  "Digital Crown rotates & clicks freely",
  "Outer enclosure / lens / panel intact",
  "Input / output ports physically intact",
  "Clean exterior (no liquid / burn marks)",
  "Warranty seals & screws intact",
]);

export function resolveDeviceProfile(deviceType: string): DeviceProfileKey {
  const lower = (deviceType || "").trim().toLowerCase();
  if (!lower) return "mobile";
  if (lower.includes("watch")) return "watch";
  if (lower.includes("ipad") || lower.includes("tablet") || /\btab\b/.test(lower)) return "tablet";
  if (
    lower.includes("macbook") ||
    lower.includes("laptop") ||
    lower.includes("notebook") ||
    lower.includes("ultrabook")
  ) {
    return "laptop";
  }
  if (
    lower.includes("imac") ||
    lower.includes("mac mini") ||
    lower.includes("mac studio") ||
    lower.includes("mac pro") ||
    lower.includes("desktop") ||
    /\bpc\b/.test(lower) ||
    lower.includes("computer") ||
    lower.includes("all-in-one")
  ) {
    return "desktop";
  }
  if (
    lower.includes("iphone") ||
    lower.includes("mobile") ||
    lower.includes("phone") ||
    lower.includes("android")
  ) {
    return "mobile";
  }
  return "general";
}

export function isPowerDependentChecklistItem(
  item: Pick<ChecklistItem, "category" | "item" | "powerDependent">,
): boolean {
  if (typeof item.powerDependent === "boolean") return item.powerDependent;
  if (item.category === "Accessories" || item.category === "Accessories & Locks" || item.category === "Physical Condition") {
    return false;
  }
  if (ALWAYS_PHYSICAL_ITEMS.has(item.item)) return false;
  if (item.item === "Device turns OFF") return true;
  if (item.category === "Power" && item.item !== POWER_GATE_ITEM && item.item !== "Battery charges") {
    return true;
  }
  return LEGACY_POWER_DEPENDENT_CATEGORIES.has(item.category);
}

export function isDevicePoweredOffChecklist(items: ChecklistItem[]): boolean {
  const gate = items.find(c => c.item === POWER_GATE_ITEM);
  return gate?.value === "no";
}

export function applyPowerStateToChecklist(items: ChecklistItem[]): {
  checklist: ChecklistItem[];
  deviceIsOff: boolean;
} {
  const isOff = isDevicePoweredOffChecklist(items);
  if (isOff) {
    return {
      deviceIsOff: true,
      checklist: items.map(item => {
        if (isPowerDependentChecklistItem(item) && (item.value === "" || item.autoSet)) {
          return { ...item, value: "na" as const, autoSet: true, powerDependent: true };
        }
        return item;
      }),
    };
  }

  return {
    deviceIsOff: false,
    checklist: items.map(item =>
      item.autoSet ? { ...item, value: "" as const, autoSet: false } : item,
    ),
  };
}

export function summarizeChecklist(items: ChecklistItem[]) {
  const isOff = isDevicePoweredOffChecklist(items);
  const passed = items.filter(i => i.value === "yes");
  const faulty = items.filter(i => i.value === "no");
  const na = items.filter(i => i.value === "na");
  const autoSkipped = items.filter(i => i.autoSet && i.value === "na");
  const physicalFlags = faulty.filter(i => !isPowerDependentChecklistItem(i));
  const functionalFlags = faulty.filter(i => isPowerDependentChecklistItem(i));
  const pending = items.filter(i => i.value === "");
  return {
    isOff,
    total: items.length,
    completed: items.length - pending.length,
    passedCount: passed.length,
    faultyCount: faulty.length,
    naCount: na.length,
    autoSkippedCount: autoSkipped.length,
    pendingCount: pending.length,
    physicalFlags,
    functionalFlags,
  };
}

const mk = (category: string, item: string, powerDependent: boolean): ChecklistItem => ({
  category,
  item,
  value: "",
  powerDependent,
});

const PROFILE_PRE_CHECKLISTS: Record<DeviceProfileKey, ChecklistItem[]> = {
  mobile: [
    mk("Power & Charging", "Device turns ON", false),
    mk("Power & Charging", "Draws charging / power current", false),
    mk("Physical Condition", "Screen / glass free of cracks & scratches", false),
    mk("Physical Condition", "Frame / chassis free of dents or bends", false),
    mk("Physical Condition", "Back glass / enclosure intact", false),
    mk("Physical Condition", "Camera lens glass intact", false),
    mk("Physical Condition", "Liquid indicator clean (no moisture signs)", false),
    mk("Physical Condition", "External screws & seals intact", false),
    mk("Display & Biometrics", "Display image clear (no lines / dead pixels)", true),
    mk("Display & Biometrics", "Touch / Haptic Touch working", true),
    mk("Display & Biometrics", "Face ID / Touch ID working", true),
    mk("Audio & Cameras", "Earpiece speaker working", true),
    mk("Audio & Cameras", "Loudspeaker working", true),
    mk("Audio & Cameras", "Microphone (calls & voice) working", true),
    mk("Audio & Cameras", "Front camera working", true),
    mk("Audio & Cameras", "Rear camera & flash working", true),
    mk("Connectivity & Hardware", "Wi-Fi working", true),
    mk("Connectivity & Hardware", "Bluetooth working", true),
    mk("Connectivity & Hardware", "Cellular signal / SIM read working", true),
    mk("Connectivity & Hardware", "Side, volume & ring/action buttons working", true),
    mk("Connectivity & Hardware", "Vibration / Taptic Engine working", true),
    mk("Accessories & Locks", "Find My / Activation Lock disabled", false),
    mk("Accessories & Locks", "SIM tray / SIM card received", false),
    mk("Accessories & Locks", "Cover / Case received", false),
    mk("Accessories & Locks", "Charger / Cable received", false),
  ],
  tablet: [
    mk("Power & Charging", "Device turns ON", false),
    mk("Power & Charging", "Draws charging / power current", false),
    mk("Physical Condition", "Screen / glass free of cracks & scratches", false),
    mk("Physical Condition", "Frame / chassis free of dents or bends", false),
    mk("Physical Condition", "Back glass / enclosure intact", false),
    mk("Physical Condition", "Liquid indicator clean (no moisture signs)", false),
    mk("Physical Condition", "External screws & seals intact", false),
    mk("Display & Biometrics", "Display image clear (no lines / dead pixels)", true),
    mk("Display & Biometrics", "Touch & Stylus / Apple Pencil working", true),
    mk("Display & Biometrics", "Face ID / Touch ID working", true),
    mk("Audio & Cameras", "Speakers (stereo / quad) working", true),
    mk("Audio & Cameras", "Microphone working", true),
    mk("Audio & Cameras", "Front camera working", true),
    mk("Audio & Cameras", "Rear camera working", true),
    mk("Connectivity & Hardware", "Wi-Fi working", true),
    mk("Connectivity & Hardware", "Bluetooth working", true),
    mk("Connectivity & Hardware", "Cellular / eSIM data working (if equipped)", true),
    mk("Connectivity & Hardware", "USB-C / Lightning port & buttons working", true),
    mk("Accessories & Locks", "Find My / Activation Lock disabled", false),
    mk("Accessories & Locks", "Keyboard folio / cover received", false),
    mk("Accessories & Locks", "Apple Pencil / Stylus received", false),
    mk("Accessories & Locks", "Charger / Cable received", false),
  ],
  laptop: [
    mk("Power & Charging", "Device turns ON", false),
    mk("Power & Charging", "Draws charging / MagSafe / USB-C current", false),
    mk("Physical Condition", "Screen / glass free of cracks & scratches", false),
    mk("Physical Condition", "Top lid & display hinge intact", false),
    mk("Physical Condition", "Bottom case & palmrest intact", false),
    mk("Physical Condition", "Port openings clean & undamaged", false),
    mk("Physical Condition", "No visible liquid spill or corrosion", false),
    mk("Physical Condition", "External screws & seals intact", false),
    mk("Display & Input", "Display panel & backlight clear", true),
    mk("Display & Input", "Keyboard (all keys & backlight) working", true),
    mk("Display & Input", "Trackpad & click / Force Touch working", true),
    mk("Display & Input", "Touch ID / Power button working", true),
    mk("Audio, Camera & Thermal", "Built-in speakers working", true),
    mk("Audio, Camera & Thermal", "Microphone array working", true),
    mk("Audio, Camera & Thermal", "FaceTime HD / Webcam working", true),
    mk("Audio, Camera & Thermal", "Fan noise & thermal behavior normal", true),
    mk("Ports, Battery & Wireless", "Wi-Fi working", true),
    mk("Ports, Battery & Wireless", "Bluetooth working", true),
    mk("Ports, Battery & Wireless", "USB-C / Thunderbolt / HDMI / SD ports working", true),
    mk("Ports, Battery & Wireless", "Audio jack (3.5mm) working", true),
    mk("Ports, Battery & Wireless", "Battery holds charge & cycle health checked", true),
    mk("Accessories & Locks", "Find My Mac / Activation / EFI Lock disabled", false),
    mk("Accessories & Locks", "MagSafe / USB-C charger & cable received", false),
    mk("Accessories & Locks", "Laptop sleeve / bag / dongles received", false),
  ],
  desktop: [
    mk("Power & Charging", "Device turns ON", false),
    mk("Power & Charging", "Power supply / standby indicator draws current", false),
    mk("Physical Condition", "Glass panel & display bezel intact", false),
    mk("Physical Condition", "Stand / VESA mount & chassis intact", false),
    mk("Physical Condition", "Port openings clean & undamaged", false),
    mk("Physical Condition", "No liquid or thermal scorch marks", false),
    mk("Physical Condition", "External screws & seals intact", false),
    mk("Display & Input", "Display / monitor video output clear", true),
    mk("Display & Input", "Keyboard paired / working", true),
    mk("Display & Input", "Mouse / Trackpad paired / working", true),
    mk("Audio, Camera & Cooling", "Speakers / audio output working", true),
    mk("Audio, Camera & Cooling", "Microphone working", true),
    mk("Audio, Camera & Cooling", "FaceTime HD / Studio camera working", true),
    mk("Audio, Camera & Cooling", "Fan noise & cooling thermals normal", true),
    mk("Ports & Network", "Wi-Fi working", true),
    mk("Ports & Network", "Bluetooth working", true),
    mk("Ports & Network", "Ethernet (RJ45) port working", true),
    mk("Ports & Network", "Thunderbolt / USB / HDMI ports working", true),
    mk("Accessories & Locks", "Find My Mac / Activation Lock disabled", false),
    mk("Accessories & Locks", "Power cord received", false),
    mk("Accessories & Locks", "Keyboard & Mouse / Trackpad received", false),
    mk("Accessories & Locks", "Original box / transport wrap noted", false),
  ],
  watch: [
    mk("Power & Charging", "Device turns ON", false),
    mk("Power & Charging", "Draws magnetic charging current", false),
    mk("Physical Condition", "Crystal / display glass intact", false),
    mk("Physical Condition", "Case body, lugs & sensor back intact", false),
    mk("Physical Condition", "Digital Crown rotates & clicks freely", false),
    mk("Display & Sensors", "Display & Always-On image clear", true),
    mk("Display & Sensors", "Touch screen working", true),
    mk("Display & Sensors", "Digital Crown & Side button working", true),
    mk("Display & Sensors", "Optical heart-rate sensors working", true),
    mk("Audio, Charging & Wireless", "Speaker & microphone working", true),
    mk("Audio, Charging & Wireless", "Taptic Engine haptics working", true),
    mk("Audio, Charging & Wireless", "Wi-Fi / Bluetooth pairing working", true),
    mk("Accessories & Locks", "Find My / Activation Lock disabled", false),
    mk("Accessories & Locks", "Watch band / strap received", false),
    mk("Accessories & Locks", "Magnetic charging puck received", false),
  ],
  general: [
    mk("Power & Charging", "Device turns ON", false),
    mk("Power & Charging", "Draws power / standby LED responds", false),
    mk("Physical Condition", "Outer enclosure / lens / panel intact", false),
    mk("Physical Condition", "Input / output ports physically intact", false),
    mk("Physical Condition", "Clean exterior (no liquid / burn marks)", false),
    mk("Physical Condition", "Warranty seals & screws intact", false),
    mk("Functional Diagnostics", "Primary display / status output working", true),
    mk("Functional Diagnostics", "Audio / optical output working", true),
    mk("Functional Diagnostics", "Controls / physical buttons / remote working", true),
    mk("Functional Diagnostics", "Network / HDMI / signal ports working", true),
    mk("Functional Diagnostics", "Fans & thermal operation normal", true),
    mk("Accessories & Locks", "Power adapter / cable received", false),
    mk("Accessories & Locks", "Remote / carry case / accessories received", false),
  ],
};

export function getChecklistForDevice(deviceType: string): ChecklistItem[] {
  const profile = resolveDeviceProfile(deviceType);
  return PROFILE_PRE_CHECKLISTS[profile].map(c => ({ ...c }));
}

const POST_REPAIR_BY_PROFILE: Record<DeviceProfileKey, string[]> = {
  mobile: [
    "Device powers ON",
    "Display working",
    "Touch & haptics working",
    "Face ID / Touch ID working",
    "Earpiece & loudspeaker working",
    "Microphone working",
    "Front & rear cameras working",
    "Wi-Fi, Bluetooth & cellular working",
    "Charging working",
    "Repaired parts verified",
    "Device cleaned & final condition verified",
  ],
  tablet: [
    "Device powers ON",
    "Display working",
    "Touch & Stylus / Pencil working",
    "Biometrics working",
    "Speakers & microphone working",
    "Front & rear cameras working",
    "Wi-Fi & Bluetooth working",
    "Charging & buttons working",
    "Repaired parts verified",
    "Device cleaned & final condition verified",
  ],
  laptop: [
    "Device powers ON",
    "Display & hinge verified",
    "Keyboard & Trackpad working",
    "Touch ID / power button working",
    "Speakers & microphone working",
    "Webcam working",
    "Wi-Fi & Bluetooth working",
    "USB-C / Thunderbolt / HDMI ports & battery charging verified",
    "Thermals & fan noise normal",
    "Repaired parts verified",
    "Device cleaned & final condition verified",
  ],
  desktop: [
    "Device powers ON",
    "Display / monitor output verified",
    "Keyboard & mouse / trackpad working",
    "Speakers & microphone working",
    "Webcam working (if built-in)",
    "Wi-Fi, Ethernet & Bluetooth working",
    "Thunderbolt / USB ports working",
    "Thermals & fan noise normal",
    "Repaired parts verified",
    "Device cleaned & final condition verified",
  ],
  watch: [
    "Device powers ON",
    "Display & touch working",
    "Digital Crown & side button working",
    "Sensors & Taptic Engine working",
    "Speaker, mic & charging working",
    "Pairing & wireless working",
    "Repaired parts verified",
    "Device cleaned & final condition verified",
  ],
  general: [
    "Device powers ON",
    "Primary display / output verified",
    "Audio / optical output working",
    "Controls & remote working",
    "Network / signal ports working",
    "Thermals & fan noise normal",
    "Repaired parts verified",
    "Device cleaned & final condition verified",
  ],
};

export function getPostRepairChecklistForDevice(deviceType: string): { item: string; value: string }[] {
  const profile = resolveDeviceProfile(deviceType);
  return POST_REPAIR_BY_PROFILE[profile].map(item => ({ item, value: "" }));
}

export function inferAppleDeviceTypeFromModel(modelName: string): string | null {
  const m = modelName.toLowerCase();
  if (m.includes("iphone")) return "iPhone";
  if (m.includes("ipad")) return "iPad";
  if (m.includes("macbook")) return "MacBook";
  if (m.includes("imac")) return "iMac";
  if (m.includes("watch")) return "Apple Watch";
  if (m.includes("mac mini") || m.includes("mac studio") || m.includes("mac pro")) return "Mac mini / Studio";
  return null;
}

const KNOWN_FINISH_HEX: Record<string, string> = {
  "desert titanium": "#C5A888",
  "natural titanium": "#9A958E",
  "white titanium": "#F2F1EC",
  "black titanium": "#2B2B2D",
  "blue titanium": "#3C4B5E",
  ultramarine: "#5B76D6",
  teal: "#5FA6A4",
  "sky blue": "#A9C3D8",
  "space black": "#252527",
  "space gray": "#6E7073",
  midnight: "#232A34",
  starlight: "#F0ECE3",
  silver: "#E3E4E6",
  gold: "#E5D4B3",
  graphite: "#454547",
  "deep purple": "#4E3E59",
  "alpine green": "#4F604F",
  "sierra blue": "#9AB4C7",
  "pacific blue": "#324D5C",
  "(product)red": "#C82333",
  black: "#232325",
  white: "#F5F5F7",
  blue: "#5B84B1",
  green: "#649B88",
  pink: "#EFA5C8",
  yellow: "#E8B954",
  orange: "#E27A4E",
  purple: "#8376A8",
};

export function resolveColorSwatchHex(colorName: string, catalogSwatches?: DeviceColorSwatch[]): string | null {
  const clean = colorName.trim().toLowerCase();
  if (!clean) return null;
  const fromCatalog = catalogSwatches?.find(s => s.name.trim().toLowerCase() === clean);
  if (fromCatalog?.hex) return fromCatalog.hex;
  return KNOWN_FINISH_HEX[clean] ?? null;
}

export function normalizeColorOptions(raw: unknown): DeviceColorSwatch[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(item => {
      if (typeof item === "string") {
        return { name: item, hex: resolveColorSwatchHex(item) ?? "#94A3B8" };
      }
      if (item && typeof item === "object" && "name" in item) {
        const entry = item as { name?: unknown; hex?: unknown };
        const name = String(entry.name || "").trim();
        if (!name) return null;
        return {
          name,
          hex: typeof entry.hex === "string" && entry.hex ? entry.hex : (resolveColorSwatchHex(name) ?? "#94A3B8"),
        };
      }
      return null;
    })
    .filter((v): v is DeviceColorSwatch => v !== null);
}

export function normalizeStorageOptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(v => String(v || "").trim()).filter(Boolean);
}
