/** Curated device brands, device types, and Apple ecosystem catalog (models + finishes + storage). */

export interface DeviceColorOption {
  name: string;
  hex: string;
}

export interface DeviceModelSeed {
  brand: string;
  device_type: string;
  name: string;
  series: string;
  color_options: DeviceColorOption[];
  storage_options: string[];
  sort_order: number;
}

export const DEFAULT_DEVICE_BRANDS: readonly string[] = [
  "Apple",
  "Samsung",
  "OnePlus",
  "Google",
  "Xiaomi",
  "Vivo",
  "Nothing",
  "Dell",
  "HP",
  "Lenovo",
  "Asus",
  "MSI",
  "Sony",
  "Other",
];

export const DEFAULT_DEVICE_TYPES: readonly string[] = [
  "iPhone",
  "iPad",
  "MacBook",
  "iMac",
  "Mac mini / Studio",
  "Apple Watch",
  "Mobile",
  "Tablet",
  "Laptop",
  "Desktop",
  "Audio / AVR",
  "Projector",
  "Other",
];

export const DEFAULT_SERVICE_CHARGE_CATEGORIES: ReadonlyArray<readonly [name: string, charge: number]> = [
  ["iPhone", 750],
  ["iPad", 1200],
  ["MacBook", 3500],
  ["iMac", 4500],
  ["Android", 500],
  ["Laptop", 2600],
  ["Tablet", 1000],
  ["Other", 500],
];

const c = (name: string, hex: string): DeviceColorOption => ({ name, hex });

const IPHONE_16_PRO_COLORS = [
  c("Desert Titanium", "#C5A888"),
  c("Natural Titanium", "#9A958E"),
  c("White Titanium", "#F2F1EC"),
  c("Black Titanium", "#2B2B2D"),
];

const IPHONE_16_COLORS = [
  c("Ultramarine", "#5B76D6"),
  c("Teal", "#5FA6A4"),
  c("Pink", "#EFA5C8"),
  c("White", "#F5F5F7"),
  c("Black", "#232325"),
];

const IPHONE_15_PRO_COLORS = [
  c("Natural Titanium", "#9A958E"),
  c("Blue Titanium", "#3C4B5E"),
  c("White Titanium", "#EFECE6"),
  c("Black Titanium", "#2C2D30"),
];

const IPHONE_15_COLORS = [
  c("Blue", "#D6E4EC"),
  c("Pink", "#F3D5DE"),
  c("Yellow", "#F4EBBE"),
  c("Green", "#DCE6D5"),
  c("Black", "#2B2B2E"),
];

const IPHONE_14_PRO_COLORS = [
  c("Deep Purple", "#4E3E59"),
  c("Gold", "#E5D4B3"),
  c("Silver", "#ECEEEF"),
  c("Space Black", "#252527"),
];

const IPHONE_14_COLORS = [
  c("Midnight", "#232A34"),
  c("Starlight", "#F0ECE3"),
  c("Blue", "#94ADC5"),
  c("Purple", "#DFD5EA"),
  c("Yellow", "#F8E16C"),
  c("(PRODUCT)RED", "#C82333"),
];

const IPHONE_13_PRO_COLORS = [
  c("Alpine Green", "#4F604F"),
  c("Sierra Blue", "#9AB4C7"),
  c("Graphite", "#454547"),
  c("Gold", "#EBDEC4"),
  c("Silver", "#ECEEEF"),
];

const IPHONE_13_COLORS = [
  c("Midnight", "#232A34"),
  c("Starlight", "#F0ECE3"),
  c("Blue", "#376186"),
  c("Pink", "#F2D8D5"),
  c("Green", "#394C38"),
  c("(PRODUCT)RED", "#BA1F2D"),
];

const IPHONE_12_PRO_COLORS = [
  c("Pacific Blue", "#324D5C"),
  c("Graphite", "#454547"),
  c("Gold", "#EBDEC4"),
  c("Silver", "#ECEEEF"),
];

const IPHONE_12_COLORS = [
  c("Black", "#232325"),
  c("White", "#F5F5F7"),
  c("Blue", "#28537B"),
  c("Green", "#CFE3D4"),
  c("Purple", "#C5B4E3"),
  c("(PRODUCT)RED", "#C82333"),
];

const IPHONE_11_COLORS = [
  c("Black", "#232325"),
  c("White", "#F5F5F7"),
  c("Green", "#C7E0D5"),
  c("Yellow", "#F5DF7B"),
  c("Purple", "#D5C8E4"),
  c("(PRODUCT)RED", "#C82333"),
];

const IPAD_PRO_M4_COLORS = [
  c("Space Black", "#272729"),
  c("Silver", "#E3E4E6"),
];

const IPAD_PRO_M2_COLORS = [
  c("Space Gray", "#6E7073"),
  c("Silver", "#E3E4E6"),
];

const IPAD_AIR_M_COLORS = [
  c("Space Gray", "#6E7073"),
  c("Starlight", "#F0ECE3"),
  c("Blue", "#8FA8BE"),
  c("Purple", "#BDB7D3"),
];

const IPAD_10_COLORS = [
  c("Blue", "#4D7DA7"),
  c("Pink", "#DF6F89"),
  c("Yellow", "#EBD15C"),
  c("Silver", "#E3E4E6"),
];

const MACBOOK_AIR_M_COLORS = [
  c("Sky Blue", "#A9C3D8"),
  c("Midnight", "#232933"),
  c("Starlight", "#EFEBE2"),
  c("Silver", "#E3E4E6"),
  c("Space Gray", "#717376"),
];

const MACBOOK_AIR_M1_COLORS = [
  c("Space Gray", "#717376"),
  c("Silver", "#E3E4E6"),
  c("Gold", "#E5D1B8"),
];

const MACBOOK_PRO_APPLE_SILICON_COLORS = [
  c("Space Black", "#242426"),
  c("Silver", "#E3E4E6"),
  c("Space Gray", "#717376"),
];

const IMAC_24_COLORS = [
  c("Blue", "#5B84B1"),
  c("Green", "#649B88"),
  c("Pink", "#D8707C"),
  c("Silver", "#E3E4E6"),
  c("Yellow", "#E8B954"),
  c("Orange", "#E27A4E"),
  c("Purple", "#8376A8"),
];

const RAW_APPLE_MODELS: Omit<DeviceModelSeed, "brand" | "sort_order">[] = [
  // iPhone
  { device_type: "iPhone", series: "iPhone 16 Series", name: "iPhone 16 Pro Max", color_options: IPHONE_16_PRO_COLORS, storage_options: ["256 GB", "512 GB", "1 TB"] },
  { device_type: "iPhone", series: "iPhone 16 Series", name: "iPhone 16 Pro", color_options: IPHONE_16_PRO_COLORS, storage_options: ["128 GB", "256 GB", "512 GB", "1 TB"] },
  { device_type: "iPhone", series: "iPhone 16 Series", name: "iPhone 16 Plus", color_options: IPHONE_16_COLORS, storage_options: ["128 GB", "256 GB", "512 GB"] },
  { device_type: "iPhone", series: "iPhone 16 Series", name: "iPhone 16", color_options: IPHONE_16_COLORS, storage_options: ["128 GB", "256 GB", "512 GB"] },
  { device_type: "iPhone", series: "iPhone 16 Series", name: "iPhone 16e", color_options: [c("Black", "#232325"), c("White", "#F5F5F7")], storage_options: ["128 GB", "256 GB", "512 GB"] },

  { device_type: "iPhone", series: "iPhone 15 Series", name: "iPhone 15 Pro Max", color_options: IPHONE_15_PRO_COLORS, storage_options: ["256 GB", "512 GB", "1 TB"] },
  { device_type: "iPhone", series: "iPhone 15 Series", name: "iPhone 15 Pro", color_options: IPHONE_15_PRO_COLORS, storage_options: ["128 GB", "256 GB", "512 GB", "1 TB"] },
  { device_type: "iPhone", series: "iPhone 15 Series", name: "iPhone 15 Plus", color_options: IPHONE_15_COLORS, storage_options: ["128 GB", "256 GB", "512 GB"] },
  { device_type: "iPhone", series: "iPhone 15 Series", name: "iPhone 15", color_options: IPHONE_15_COLORS, storage_options: ["128 GB", "256 GB", "512 GB"] },

  { device_type: "iPhone", series: "iPhone 14 Series", name: "iPhone 14 Pro Max", color_options: IPHONE_14_PRO_COLORS, storage_options: ["128 GB", "256 GB", "512 GB", "1 TB"] },
  { device_type: "iPhone", series: "iPhone 14 Series", name: "iPhone 14 Pro", color_options: IPHONE_14_PRO_COLORS, storage_options: ["128 GB", "256 GB", "512 GB", "1 TB"] },
  { device_type: "iPhone", series: "iPhone 14 Series", name: "iPhone 14 Plus", color_options: IPHONE_14_COLORS, storage_options: ["128 GB", "256 GB", "512 GB"] },
  { device_type: "iPhone", series: "iPhone 14 Series", name: "iPhone 14", color_options: IPHONE_14_COLORS, storage_options: ["128 GB", "256 GB", "512 GB"] },

  { device_type: "iPhone", series: "iPhone 13 Series", name: "iPhone 13 Pro Max", color_options: IPHONE_13_PRO_COLORS, storage_options: ["128 GB", "256 GB", "512 GB", "1 TB"] },
  { device_type: "iPhone", series: "iPhone 13 Series", name: "iPhone 13 Pro", color_options: IPHONE_13_PRO_COLORS, storage_options: ["128 GB", "256 GB", "512 GB", "1 TB"] },
  { device_type: "iPhone", series: "iPhone 13 Series", name: "iPhone 13", color_options: IPHONE_13_COLORS, storage_options: ["128 GB", "256 GB", "512 GB"] },
  { device_type: "iPhone", series: "iPhone 13 Series", name: "iPhone 13 mini", color_options: IPHONE_13_COLORS, storage_options: ["128 GB", "256 GB", "512 GB"] },

  { device_type: "iPhone", series: "iPhone 12 & Legacy", name: "iPhone 12 Pro Max", color_options: IPHONE_12_PRO_COLORS, storage_options: ["128 GB", "256 GB", "512 GB"] },
  { device_type: "iPhone", series: "iPhone 12 & Legacy", name: "iPhone 12 Pro", color_options: IPHONE_12_PRO_COLORS, storage_options: ["128 GB", "256 GB", "512 GB"] },
  { device_type: "iPhone", series: "iPhone 12 & Legacy", name: "iPhone 12", color_options: IPHONE_12_COLORS, storage_options: ["64 GB", "128 GB", "256 GB"] },
  { device_type: "iPhone", series: "iPhone 12 & Legacy", name: "iPhone 11", color_options: IPHONE_11_COLORS, storage_options: ["64 GB", "128 GB", "256 GB"] },
  { device_type: "iPhone", series: "iPhone 12 & Legacy", name: "iPhone SE (3rd Gen)", color_options: [c("Midnight", "#232A34"), c("Starlight", "#F0ECE3"), c("(PRODUCT)RED", "#C82333")], storage_options: ["64 GB", "128 GB", "256 GB"] },

  // iPad
  { device_type: "iPad", series: "iPad Pro", name: 'iPad Pro 13" (M4)', color_options: IPAD_PRO_M4_COLORS, storage_options: ["256 GB", "512 GB", "1 TB", "2 TB"] },
  { device_type: "iPad", series: "iPad Pro", name: 'iPad Pro 11" (M4)', color_options: IPAD_PRO_M4_COLORS, storage_options: ["256 GB", "512 GB", "1 TB", "2 TB"] },
  { device_type: "iPad", series: "iPad Pro", name: 'iPad Pro 12.9" (M2 / M1)', color_options: IPAD_PRO_M2_COLORS, storage_options: ["128 GB", "256 GB", "512 GB", "1 TB", "2 TB"] },
  { device_type: "iPad", series: "iPad Pro", name: 'iPad Pro 11" (M2 / M1)', color_options: IPAD_PRO_M2_COLORS, storage_options: ["128 GB", "256 GB", "512 GB", "1 TB", "2 TB"] },

  { device_type: "iPad", series: "iPad Air", name: 'iPad Air 13" (M3 / M2)', color_options: IPAD_AIR_M_COLORS, storage_options: ["128 GB", "256 GB", "512 GB", "1 TB"] },
  { device_type: "iPad", series: "iPad Air", name: 'iPad Air 11" (M3 / M2)', color_options: IPAD_AIR_M_COLORS, storage_options: ["128 GB", "256 GB", "512 GB", "1 TB"] },
  { device_type: "iPad", series: "iPad Air", name: "iPad Air (5th Gen)", color_options: [c("Space Gray", "#6E7073"), c("Starlight", "#F0ECE3"), c("Pink", "#DF9FA9"), c("Purple", "#B5B0CE"), c("Blue", "#8FA8BE")], storage_options: ["64 GB", "256 GB"] },

  { device_type: "iPad", series: "iPad Standard", name: "iPad (10th Gen)", color_options: IPAD_10_COLORS, storage_options: ["64 GB", "256 GB"] },
  { device_type: "iPad", series: "iPad Standard", name: "iPad (9th Gen)", color_options: IPAD_PRO_M2_COLORS, storage_options: ["64 GB", "256 GB"] },

  { device_type: "iPad", series: "iPad mini", name: "iPad mini (A17 Pro / 7th Gen)", color_options: IPAD_AIR_M_COLORS, storage_options: ["128 GB", "256 GB", "512 GB"] },
  { device_type: "iPad", series: "iPad mini", name: "iPad mini (6th Gen)", color_options: [c("Space Gray", "#6E7073"), c("Pink", "#E5B9C0"), c("Purple", "#B5B0CE"), c("Starlight", "#F0ECE3")], storage_options: ["64 GB", "256 GB"] },

  // MacBook
  { device_type: "MacBook", series: "MacBook Pro", name: 'MacBook Pro 16" (M4 / M3 / M2 / M1)', color_options: MACBOOK_PRO_APPLE_SILICON_COLORS, storage_options: ["512 GB SSD", "1 TB SSD", "2 TB SSD", "4 TB SSD", "8 TB SSD"] },
  { device_type: "MacBook", series: "MacBook Pro", name: 'MacBook Pro 14" (M4 / M3 / M2 / M1)', color_options: MACBOOK_PRO_APPLE_SILICON_COLORS, storage_options: ["512 GB SSD", "1 TB SSD", "2 TB SSD", "4 TB SSD"] },
  { device_type: "MacBook", series: "MacBook Pro", name: 'MacBook Pro 13" (M2 / M1)', color_options: IPAD_PRO_M2_COLORS, storage_options: ["256 GB SSD", "512 GB SSD", "1 TB SSD", "2 TB SSD"] },
  { device_type: "MacBook", series: "MacBook Pro", name: 'MacBook Pro 16" / 15" / 13" (Intel)', color_options: IPAD_PRO_M2_COLORS, storage_options: ["256 GB SSD", "512 GB SSD", "1 TB SSD"] },

  { device_type: "MacBook", series: "MacBook Air", name: 'MacBook Air 15" (M4 / M3 / M2)', color_options: MACBOOK_AIR_M_COLORS, storage_options: ["256 GB SSD", "512 GB SSD", "1 TB SSD", "2 TB SSD"] },
  { device_type: "MacBook", series: "MacBook Air", name: 'MacBook Air 13" (M4 / M3 / M2)', color_options: MACBOOK_AIR_M_COLORS, storage_options: ["256 GB SSD", "512 GB SSD", "1 TB SSD", "2 TB SSD"] },
  { device_type: "MacBook", series: "MacBook Air", name: 'MacBook Air 13" (M1)', color_options: MACBOOK_AIR_M1_COLORS, storage_options: ["256 GB SSD", "512 GB SSD", "1 TB SSD"] },
  { device_type: "MacBook", series: "MacBook Air", name: 'MacBook Air 13" (Intel Retina)', color_options: MACBOOK_AIR_M1_COLORS, storage_options: ["128 GB SSD", "256 GB SSD", "512 GB SSD"] },

  // iMac
  { device_type: "iMac", series: "iMac Apple Silicon", name: 'iMac 24" (M4)', color_options: IMAC_24_COLORS, storage_options: ["256 GB SSD", "512 GB SSD", "1 TB SSD", "2 TB SSD"] },
  { device_type: "iMac", series: "iMac Apple Silicon", name: 'iMac 24" (M3)', color_options: IMAC_24_COLORS, storage_options: ["256 GB SSD", "512 GB SSD", "1 TB SSD", "2 TB SSD"] },
  { device_type: "iMac", series: "iMac Apple Silicon", name: 'iMac 24" (M1)', color_options: IMAC_24_COLORS, storage_options: ["256 GB SSD", "512 GB SSD", "1 TB SSD", "2 TB SSD"] },
  { device_type: "iMac", series: "iMac Intel", name: 'iMac 27" Retina 5K (Intel)', color_options: [c("Silver", "#E3E4E6")], storage_options: ["256 GB SSD", "512 GB SSD", "1 TB Fusion/SSD", "2 TB SSD"] },
  { device_type: "iMac", series: "iMac Intel", name: 'iMac 21.5" (Intel)', color_options: [c("Silver", "#E3E4E6")], storage_options: ["256 GB SSD", "512 GB SSD", "1 TB HDD/Fusion"] },
  { device_type: "iMac", series: "iMac Intel", name: 'iMac Pro 27"', color_options: [c("Space Gray", "#686A6E")], storage_options: ["1 TB SSD", "2 TB SSD", "4 TB SSD"] },
];

export const DEFAULT_APPLE_MODELS: readonly DeviceModelSeed[] = RAW_APPLE_MODELS.map((entry, idx) => ({
  brand: "Apple",
  ...entry,
  sort_order: idx + 1,
}));
