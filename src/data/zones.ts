import { CityName } from "./scenarios";

export type ZoneTrait = "gym" | "premium" | "family" | "tech" | "foodie" | "corporate" | "value" | "working";

export interface PinZone {
  name: string;
  traits: ZoneTrait[];
}

// Zones now keyed by STATE name. Only metros have detailed zone data.
export const CITY_ZONES: Partial<Record<CityName, PinZone[]>> = {
  Karnataka: [
    { name: "Koramangala", traits: ["gym", "premium"] },
    { name: "Indiranagar", traits: ["foodie", "premium"] },
    { name: "HSR Layout", traits: ["family", "gym"] },
    { name: "Whitefield", traits: ["tech", "family"] },
    { name: "Bellandur", traits: ["tech", "working"] },
  ],
  Maharashtra: [
    { name: "Bandra", traits: ["premium", "foodie"] },
    { name: "Andheri", traits: ["foodie"] },
    { name: "Powai", traits: ["tech", "premium"] },
    { name: "Lower Parel", traits: ["corporate", "premium"] },
    { name: "Borivali", traits: ["family", "value"] },
  ],
  Delhi: [
    { name: "Connaught Place", traits: ["corporate", "premium"] },
    { name: "Lajpat Nagar", traits: ["family", "value"] },
    { name: "Dwarka", traits: ["family"] },
    { name: "Noida Sector 18", traits: ["corporate", "working"] },
    { name: "Gurgaon DLF", traits: ["premium", "corporate"] },
  ],
  Telangana: [
    { name: "Jubilee Hills", traits: ["premium"] },
    { name: "Gachibowli", traits: ["tech", "premium", "gym"] },
    { name: "HITEC City", traits: ["tech", "gym"] },
    { name: "Banjara Hills", traits: ["premium"] },
    { name: "Kondapur", traits: ["tech", "family"] },
  ],
};

export function zoneAffinity(profileId: string, traits: ZoneTrait[]): number {
  const has = (t: ZoneTrait) => traits.includes(t);
  switch (profileId) {
    case "fuelup": return has("gym") ? 2.5 : 0.4;
    case "glow":
      if (has("premium")) return 2.0;
      if (has("tech")) return 1.3;
      if (has("value")) return 0.5;
      return 1.0;
    case "tinybuddy":
      if (has("family")) return 2.2;
      if (has("corporate")) return 0.6;
      return 1.0;
    case "munchbox":
      if (has("foodie")) return 1.8;
      if (has("working") || has("corporate")) return 1.5;
      if (has("family")) return 1.2;
      return 1.0;
    case "henlo":
      if (has("premium") || has("family")) return 1.8;
      return 1.0;
    case "pawlife":
      if (has("premium") && (has("gym") || has("foodie"))) return 2.0;
      if (has("premium")) return 1.8;
      return 0.5;
    case "vitaboost":
      if (has("premium")) return 1.5;
      if (has("tech")) return 1.3;
      return 0.7;
    default: return 1.0;
  }
}
