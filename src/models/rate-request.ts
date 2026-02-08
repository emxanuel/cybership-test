export interface RateRequestInput {
  origin: string;
  destination: string;
  weight: number;
  /** Optional dimensions (e.g. inches). Carrier may ignore or use for rating. */
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    unit?: "in" | "cm";
  };
  currency?: string;
}
