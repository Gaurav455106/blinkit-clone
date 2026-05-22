import { CityName } from "./scenarios";

export type ZoneTrait = "gym" | "premium" | "family" | "tech" | "foodie" | "corporate" | "value" | "working";

export interface PinZone {
  name: string;
  traits: ZoneTrait[];
}

export const CITY_ZONES: Record<CityName, PinZone[]> = {
  Bangalore: [
    { name: "Koramangala", traits: ["gym", "premium"] },
    { name: "Indiranagar", traits: ["foodie", "premium"] },
    { name: "HSR Layout", traits: ["family", "gym"] },
    { name: "Whitefield", traits: ["tech", "family"] },
    { name: "Bellandur", traits: ["tech", "working"] },
  ],
  Mumbai: [
    { name: "Bandra", traits: ["premium", "foodie"] },
    { name: "Andheri", traits: ["foodie"] },
    { name: "Powai", traits: ["tech", "premium"] },
    { name: "Lower Parel", traits: ["corporate", "premium"] },
    { name: "Borivali", traits: ["family", "value"] },
  ],
  "Delhi NCR": [
    { name: "Connaught Place", traits: ["corporate", "premium"] },
    { name: "Lajpat Nagar", traits: ["family", "value"] },
    { name: "Dwarka", traits: ["family"] },
    { name: "Noida Sector 18", traits: ["corporate", "working"] },
    { name: "Gurgaon DLF", traits: ["premium", "corporate"] },
  ],
  Hyderabad: [
    { name: "Jubilee Hills", traits: ["premium"] },
    { name: "Gachibowli", traits: ["tech", "premium", "gym"] },
    { name: "HITEC City", traits: ["tech", "gym"] },
    { name: "Banjara Hills", traits: ["premium"] },
    { name: "Kondapur", traits: ["tech", "family"] },
  ],
};

// Returns affinity multiplier for a given brand profile id + zone traits
export function zoneAffinity(profileId: string, traits: ZoneTrait[]): number {
  const has = (t: ZoneTrait) => traits.includes(t);
  switch (profileId) {
    case "fuelup": // Protein
      return has("gym") ? 2.5 : 0.4;
    case "glow": // Premium skincare
      if (has("premium")) return 2.0;
      if (has("tech")) return 1.3;
      if (has("value")) return 0.5;
      return 1.0;
    case "tinybuddy": // Baby care
      if (has("family")) return 2.2;
      if (has("corporate")) return 0.6;
      return 1.0;
    case "munchbox": // Snacks
      if (has("foodie")) return 1.8;
      if (has("working") || has("corporate")) return 1.5;
      if (has("family")) return 1.2;
      return 1.0;
    case "henlo": // Dog treats
      if (has("premium") || has("family")) return 1.8;
      return 1.0;
    case "pawlife": // Premium pet accessories
      if (has("premium") && (has("gym") || has("foodie"))) return 2.0;
      if (has("premium")) return 1.8;
      return 0.5;
    case "vitaboost":
      if (has("premium")) return 1.5;
      if (has("tech")) return 1.3;
      return 0.7;
    default:
      return 1.0;
  }
}
