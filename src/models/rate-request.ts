export interface RateRequestInput {
  origin: AddressInput;
  destination: AddressInput;
  packages: PackageInfo[];
  /** Optional service level (e.g., "GROUND", "NEXT_DAY", "2DAY") */
  serviceLevel?: string;
}

export interface AddressInput {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface PackageInfo {
  weight: number;
  weightUnit?: "LB" | "KG";
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: "IN" | "CM";
  };
}
