/**
 * All public copy for the ALV Studio site in one place, so the facts an owner
 * edits (phone, hours, brands) never hide inside layout code.
 */

export const STUDIO_INFO = {
  phone: "+91 98876 01200",
  phoneHref: "tel:+919887601200",
  email: "sales@alvstore.in",
  emailHref: "mailto:sales@alvstore.in",
  locations: "Udaipur",
  address: "Shop No. 2, 229, Alok School Road, Sector 11, Hiran Magri, Udaipur, Rajasthan 313001",
  shortAddress: "Sector 11, Hiran Magri, Udaipur",
  mapsUrl:
    "https://www.google.com/maps/place/ALVStore/@24.5565502,73.6183586,13z/data=!4m10!1m2!2m1!1salvstore+udaipur!3m6!1s0x3967ef9b8c78f0ff:0xf8f768b025f591e0!8m2!3d24.5565502!4d73.6945763!15sChBhbHZzdG9yZSB1ZGFpcHVyWhIiEGFsdnN0b3JlIHVkYWlwdXKSARFlbGVjdHJvbmljc19zdG9yZeABAA!16s%2Fg%2F1tfktqnp?entry=ttu&g_ep=EgoyMDI2MTExOC4xIKXMDSoASAFQAw%3D%3D",
  hours: "Mon – Sat, 10:00 – 20:00 IST",
  hoursSunday: "Sunday by appointment",
  domain: "alvstore.in",
} as const;

/** Marks the live exhibit; drives the left-hand placards and the stage counter. */
export type Exhibit = {
  id: string;
  index: string;
  room: string;
  title: string;
  line: string;
  body: string;
  facts: { k: string; v: string }[];
  span: [number, number]; // progress range across the 3D exhibit zone
  /**
   * When the wall label is legible. Between one label's fade-out and the next
   * label's fade-in the camera is walking between rooms, and the wall is bare —
   * so a label is never up while its object is out of frame.
   */
  label: [number, number, number, number]; // fade in [a,b], fade out [c,d]
};

export const EXHIBITS: Exhibit[] = [
  {
    id: "tower",
    index: "01",
    room: "Listening room",
    title: "The tower",
    line: "Four drivers, one cabinet, voiced as a single instrument.",
    body:
      "A floor-standing three-way built the old way: heavy braced cabinet, brass-trimmed drivers, and a crossover tuned by ear in this room before it ever reaches yours. Pair it with the screen and the room disappears.",
    facts: [
      { k: "Drivers", v: "1 × 25 mm · 1 × 165 mm · 2 × 210 mm" },
      { k: "Sensitivity", v: "89 dB · 4 Ω nominal" },
      { k: "Finish", v: "Graphite lacquer, solid brass" },
    ],
    span: [0, 0.44],
    label: [0.14, 0.18, 0.3, 0.34],
  },
  {
    id: "screen",
    index: "02",
    room: "Screening room",
    title: "The screen",
    line: "Native 4K laser projection paired with a woven acoustic canvas.",
    body:
      "True home cinema immersion demands both: a native 4K laser projection engine and a woven acoustically-transparent screen. The optical engine projects DCI-P3 cinematic color, while front three-way speakers breathe directly through the screen surface so voices originate right from the actor's lips.",
    facts: [
      { k: "Projection", v: "Sony & JVC Native 4K Laser Cinema Engines" },
      { k: "Surface", v: "120″ – 220″ woven AT, motorized 2.35:1 masking" },
      { k: "Calibration", v: "ISF · DCI-P3 · HDR10+ frame-by-frame tone mapping" },
    ],
    span: [0.44, 0.72],
    label: [0.46, 0.5, 0.64, 0.68],
  },
  {
    id: "source",
    index: "03",
    room: "Reference Amplification",
    title: "The source",
    line: "Flagship Denon & Marantz amplification delivering discrete high-current power.",
    body:
      "The beating heart of every reference room: high-current toroidal power stages, discrete monolithic amplification, and Dirac Live calibration. Whether powering a delicate acoustic vinyl passage or driving explosive 9.4.6 Dolby Atmos cinema transients, Denon and Marantz separates deliver unflinching control, warmth, and microscopic musical detail.",
    facts: [
      { k: "Processing", v: "Denon AVC & Marantz Cinema Series" },
      { k: "Acoustics", v: "Dirac Live & Audyssey MultEQ XT32 Calibrated" },
      { k: "Architecture", v: "Toroidal power · Discrete monolithic topology" },
    ],
    span: [0.72, 1],
    label: [0.82, 0.86, 0.99, 1.02],
  },
];

export const COLLECTION: {
  name: string;
  detail: string;
  brand: string;
  from: string;
}[] = [
  { name: "Floor-standing loudspeakers", detail: "Three-way towers & stand-mounts", brand: "Bowers & Wilkins · KEF", from: "₹1.2 L" },
  { name: "Centre & surround", detail: "In-wall, in-ceiling, on-wall", brand: "KEF · Monitor Audio", from: "₹38 K" },
  { name: "Reference subwoofers", detail: "Sealed, ported, dual-stack", brand: "SVS · REL", from: "₹64 K" },
  { name: "4K laser projection", detail: "D-ILA, SXRD, UST", brand: "Sony · JVC", from: "₹4.0 L" },
  { name: "Projection screens", detail: "Woven AT & ALR, motorised masking", brand: "Screen Innovations", from: "₹1.1 L" },
  { name: "AV receivers & processors", detail: "9.4.6 spatial audio", brand: "Denon · Marantz · Trinnov", from: "₹1.8 L" },
  { name: "Two-channel separates", detail: "Integrated, valve, streaming DACs", brand: "McIntosh · Marantz", from: "₹2.4 L" },
  { name: "Room automation", detail: "Lighting, drapes, one-touch scenes", brand: "Crestron · Lutron", from: "₹1.8 L" },
  { name: "Acoustic treatment & fabrics", detail: "Absorption, diffusion, bass traps, stretch fabric", brand: "Vicoustic · Artnovion", from: "₹95 K" },
];

export const REPAIRS = [
  {
    title: "Dirac Live & acoustic re-calibration",
    body: "Periodic acoustic re-tuning with calibrated precision microphones as furniture, carpets, and room dynamics settle over time.",
  },
  {
    title: "Projector optical service & laser tuning",
    body: "Precision laser engine checks, prism and lens cleaning, HDR tone-mapping adjustments, and focus alignment for Sony and JVC 4K projectors.",
  },
  {
    title: "HDMI 2.1 eARC & source integration",
    body: "Continuous firmware updates, handshake optimization, 4K UHD player sync, and streaming profile integration for zero stutter.",
  },
  {
    title: "Equipment warranty & preventative care",
    body: "Direct manufacturer warranty handling for Denon, Marantz, KEF, and Bowers & Wilkins with clean power verification and rapid loaner support.",
  },
];

export const PROCESS = [
  { step: "A consultation", body: "We sit down with you, measure your room dimensions, sound behavior, and sightlines before drawing anything." },
  { step: "A drawing", body: "Seating, sightlines, 4K projector throw distance, speaker arrays, and acoustic treatment resolved on paper first." },
  { step: "A build", body: "Engineered isolation, calibrated laser optics, and a handover where every scene is tuned and walked through with you." },
];

export const NAV = [
  { label: "Exhibits", href: "#exhibits" },
  { label: "The collection", href: "#collection" },
  { label: "After-sales", href: "#lab" },
  { label: "Consultation", href: "#visit" },
] as const;