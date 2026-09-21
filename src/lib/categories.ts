// The 14 police.uk street-level categories, grouped and explained for students.
// Guide text is our own; every link was checked when it was added (see LINKS).
import { LINKS, type GuideLink } from "./links";

export type CategorySlug =
  | "violent-crime" | "robbery" | "theft-from-the-person" | "public-order" | "possession-of-weapons"
  | "burglary" | "vehicle-crime" | "bicycle-theft" | "criminal-damage-arson"
  | "shoplifting" | "other-theft"
  | "anti-social-behaviour" | "drugs" | "other-crime";

export type Category = {
  slug: CategorySlug;
  label: string;
  short: string;
  group: GroupId;
  what: string;
  onTheMap: string;
  tips: string[];
  ifItHappens: string[];
  links: GuideLink[];
  newsTerm: string;
};

export type GroupId = "people" | "homes" | "theft" | "community";

export const GROUPS: { id: GroupId; label: string }[] = [
  { id: "people", label: "Against people" },
  { id: "homes", label: "Homes, bikes & cars" },
  { id: "theft", label: "Theft & shops" },
  { id: "community", label: "Community" },
];

const REPORT = [
  "In an emergency, or if it's happening now, call 999.",
  "Otherwise report it online or on 101. Coventry is West Midlands Police; Leamington, Warwick and Kenilworth are Warwickshire Police.",
];

export const CATEGORIES: Category[] = [
  {
    slug: "violent-crime",
    label: "Violence & sexual offences",
    short: "Violence",
    group: "people",
    what: "Assault of any severity, from a push to murder, plus harassment, stalking, threats, malicious messages and all sexual offences. It's the biggest category in England and Wales, and most of it isn't strangers attacking people in the street.",
    onTheMap: "Many of these happen at home or online between people who know each other, but police.uk still pins them to the nearest public point. So a hotspot often means a busy night-time street, a hospital or dense housing. It doesn't mean strangers get attacked there.",
    tips: [
      "Plan the way home before a night out, and share your live location with a friend.",
      "Use licensed taxis or book through an app, and check the plate matches before you get in.",
      "Ask for Angela at the bar if a date or a situation stops feeling right.",
      "Harassment by a partner or online counts too. You don't have to wait for it to turn physical to report it.",
    ],
    ifItHappens: [
      ...REPORT,
      "Students can also tell their university: Warwick's Report + Support or Coventry University's Case Reporting System, named or anonymously.",
      "Victim Support and Rape Crisis help for free and in confidence, whether or not you go to the police.",
    ],
    links: [],
    newsTerm: "assault",
  },
  {
    slug: "robbery",
    label: "Robbery",
    short: "Robbery",
    group: "people",
    what: "Theft using force or the threat of force: a phone snatched after a shove, a mugging, a bag taken at knifepoint. It also covers robberies of shops and petrol stations.",
    onTheMap: "Robbery is rare compared with other theft, so a handful of incidents can make an area stand out. Check the months in the area panel, because one bad month isn't a pattern.",
    tips: [
      "Keep your phone away when walking beside a road. Snatches often come from bikes and e-scooters.",
      "If someone demands your things, hand them over. A phone can be replaced.",
      "At night, take the lit, busier route even if it's a few minutes longer.",
      "Note your phone's IMEI (dial *#06#) and register it on Immobilise, so police can identify it if it's recovered.",
    ],
    ifItHappens: [...REPORT, "Block your SIM and phone with your network, and change key passwords from another device."],
    links: [],
    newsTerm: "robbery",
  },
  {
    slug: "theft-from-the-person",
    label: "Theft from the person",
    short: "Pickpocketing",
    group: "people",
    what: "Stealing directly from someone without force: pickpocketing, a phone lifted off a café table, a bag taken from the back of a chair.",
    onTheMap: "It follows crowds: the city centre, bus and rail stations, nightlife streets. High counts track footfall more than your personal risk.",
    tips: [
      "Front pocket or a zipped bag. Don't leave your phone on the table.",
      "In bars, keep your bag on your lap or looped round the chair leg.",
      "Switch on Find My or Find My Device before you need it.",
    ],
    ifItHappens: [...REPORT, "Cancel cards straight away from your banking app."],
    links: [],
    newsTerm: "pickpocket",
  },
  {
    slug: "public-order",
    label: "Public order",
    short: "Public order",
    group: "people",
    what: "Behaviour that causes fear, alarm or distress, such as threatening words or behaviour, affray, and fights where nobody is injured. It includes incidents that are racially or religiously aggravated.",
    onTheMap: "Clusters around town-centre nightlife, stations and busy shopping streets.",
    tips: [
      "Walk away from confrontations rather than engaging.",
      "If you're targeted because of who you are, report it as a hate incident. You can report through a third party if you'd rather not go to the police directly.",
    ],
    ifItHappens: REPORT,
    links: [],
    newsTerm: "disorder",
  },
  {
    slug: "possession-of-weapons",
    label: "Possession of weapons",
    short: "Weapons",
    group: "people",
    what: "Carrying a knife, bladed article, firearm or other offensive weapon in public.",
    onTheMap: "Most get recorded because police found the weapon during a stop or an operation. The counts partly show where police were active.",
    tips: [
      "Carrying a knife makes you more likely to get hurt, not less.",
      "If you know someone is carrying, you can tell Crimestoppers anonymously.",
    ],
    ifItHappens: [...REPORT, "Crimestoppers takes information anonymously: no name, no call trace."],
    links: [],
    newsTerm: "knife",
  },
  {
    slug: "burglary",
    label: "Burglary",
    short: "Burglary",
    group: "homes",
    what: "Entering a building without permission to steal or cause damage. That includes homes, student houses, sheds, garages and business premises.",
    onTheMap: "This is the one to check when you're house-hunting. Look at the streets around a property, not just its hex, and compare two or three candidate areas over 12 months.",
    tips: [
      "Lock doors and windows even when you pop out. Plenty of student-house burglaries come through unlocked doors.",
      "Keep laptops, keys and bags out of sight of windows and the letterbox.",
      "Before you sign, ask the landlord about door and window locks and an outside light.",
      "Get contents insurance. It's often cheap, and sometimes already included with your tenancy or bank account.",
    ],
    ifItHappens: [...REPORT, "Don't touch anything the burglar may have handled until police have been.", "Tell your landlord in writing, and get a crime reference number for your insurer."],
    links: [],
    newsTerm: "burglary",
  },
  {
    slug: "vehicle-crime",
    label: "Vehicle crime",
    short: "Vehicle crime",
    group: "homes",
    what: "Theft of a vehicle, theft from a vehicle, and interfering with one (trying door handles, for instance).",
    onTheMap: "Car parks and busy on-street parking light up. When the area panel says “Parking Area”, police.uk has placed the crime at a car park.",
    tips: [
      "Leave nothing on show, not even a charging cable or loose change.",
      "For keyless cars, keep the fob in a signal-blocking pouch.",
      "Park in lit, busy places, or car parks with the Park Mark award.",
    ],
    ifItHappens: REPORT,
    links: [],
    newsTerm: "car theft",
  },
  {
    slug: "bicycle-theft",
    label: "Bicycle theft",
    short: "Bike theft",
    group: "homes",
    what: "Theft of a bicycle from the street, a rack, a shed or a shared hallway.",
    onTheMap: "The numbers are low, but many bike thefts never get reported at all. Expect clusters at campus racks, station stands and the city centre.",
    tips: [
      "Use two good locks (a D-lock plus a different type) and lock the frame and a wheel to something solid.",
      "Register the frame number on a national register such as Immobilise or BikeRegister. It's how police get recovered bikes back to their owners.",
      "Photograph your bike and write down the frame number.",
      "Don't leave it in a shared hallway overnight.",
    ],
    ifItHappens: [...REPORT, "Mark it stolen on the register you used, and check local selling sites and groups."],
    links: [],
    newsTerm: "bike theft",
  },
  {
    slug: "criminal-damage-arson",
    label: "Criminal damage & arson",
    short: "Damage & arson",
    group: "homes",
    what: "Deliberately damaging property (smashed windows, damaged cars, graffiti) and deliberately setting fires.",
    onTheMap: "Spread widely across residential streets. Repeated damage on one street can be a sign of wider anti-social behaviour.",
    tips: [
      "Report damage even when it's minor. Patterns help police and the council act.",
      "Your landlord is responsible for most repairs. Tell them in writing and keep photos.",
    ],
    ifItHappens: REPORT,
    links: [],
    newsTerm: "arson",
  },
  {
    slug: "shoplifting",
    label: "Shoplifting",
    short: "Shoplifting",
    group: "theft",
    what: "Theft from shops and supermarkets.",
    onTheMap: "Dominates shopping streets and supermarkets. It tells you a lot about where shops are and very little about your own safety, so consider switching it off.",
    tips: ["Turn this off when judging an area to live in. It inflates every high street and retail park."],
    ifItHappens: REPORT,
    links: [],
    newsTerm: "shoplifting",
  },
  {
    slug: "other-theft",
    label: "Other theft",
    short: "Other theft",
    group: "theft",
    what: "Theft that doesn't fit anywhere else: unattended belongings, parcels taken from doorsteps, items taken from gardens, theft at work, leaving without paying.",
    onTheMap: "Follows busy places: hospitals, campuses, retail parks.",
    tips: [
      "Use a parcel locker or a safe-place delivery option if you're out a lot.",
      "Don't leave a laptop unattended in the library or a café, even for a minute.",
    ],
    ifItHappens: REPORT,
    links: [],
    newsTerm: "theft",
  },
  {
    slug: "anti-social-behaviour",
    label: "Anti-social behaviour",
    short: "Anti-social",
    group: "community",
    what: "Incidents that cause nuisance or distress but aren't necessarily crimes: noise, rowdy behaviour, neighbour disputes, street drinking, nuisance vehicles.",
    onTheMap: "The counts reflect how willing people are to report, as well as what actually happens. Because ASB isn't recorded as a crime, it has no outcomes.",
    tips: [
      "Your council handles noise and many neighbour problems, not just the police.",
      "Keep a diary of dates and times. It strengthens any complaint.",
      "Student neighbours count too: be the house people are glad to live next to.",
    ],
    ifItHappens: ["Report ongoing nuisance to the council: Coventry City Council, or Warwick District Council for Leamington, Warwick and Kenilworth.", ...REPORT],
    links: [],
    newsTerm: "anti-social behaviour",
  },
  {
    slug: "drugs",
    label: "Drugs",
    short: "Drugs",
    group: "community",
    what: "Possession, supply or production of illegal drugs.",
    onTheMap: "Mostly shows police activity, such as stop and search and targeted operations, rather than where drugs are used.",
    tips: [
      "Talk to FRANK for straight information on drugs and their risks.",
      "If a friend is unwell after taking something, call 999 and tell them what was taken. Paramedics are there to help.",
      "Your university's wellbeing service offers confidential support.",
    ],
    ifItHappens: ["If someone is unwell, call 999 straight away.", "You can report dealing anonymously through Crimestoppers."],
    links: [],
    newsTerm: "drugs",
  },
  {
    slug: "other-crime",
    label: "Other crime",
    short: "Other",
    group: "community",
    what: "Offences that don't fit the other categories, such as perverting the course of justice, some animal offences and a range of less common crimes.",
    onTheMap: "A mixed bag. Look at the other categories nearby for context.",
    tips: ["Scams and fraud are usually reported to the national fraud reporting service rather than to local police."],
    ifItHappens: REPORT,
    links: [],
    newsTerm: "crime",
  },
];

for (const c of CATEGORIES) c.links = LINKS.categories[c.slug] ?? [];

export const CATEGORY = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c])) as Record<CategorySlug, Category>;

export const LENSES: { id: string; label: string; hint: string; cats: CategorySlug[] }[] = [
  {
    id: "all",
    label: "Everything",
    hint: "All 14 police.uk categories",
    cats: CATEGORIES.map((c) => c.slug),
  },
  {
    id: "personal",
    label: "Personal safety",
    hint: "Crimes against people when you're out and about",
    cats: ["violent-crime", "robbery", "theft-from-the-person", "public-order", "possession-of-weapons"],
  },
  {
    id: "housing",
    label: "House hunting",
    hint: "What matters when you choose where to live",
    cats: ["burglary", "vehicle-crime", "bicycle-theft", "criminal-damage-arson", "anti-social-behaviour"],
  },
];

export function googleNewsUrl(q: string): string {
  return `https://news.google.com/search?q=${encodeURIComponent(q)}&hl=en-GB&gl=GB&ceid=GB:en`;
}
