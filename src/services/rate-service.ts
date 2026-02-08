import type { ICarrier } from "@/carriers/carrier.interface.js";
import type { RateQuote } from "@/models/rate-quote.js";

export interface CarrierQuote {
  carrier: string;
  quote: RateQuote;
}

export interface CarrierError {
  carrier: string;
  error: Error;
}

export interface RateServiceResult {
  quotes: CarrierQuote[];
  errors?: CarrierError[];
}

export interface RateServiceConfig {
  carriers: Record<string, ICarrier>;
}

export class RateService {
  constructor(private readonly config: RateServiceConfig) {}

  async getRates(
    origin: string,
    destination: string,
    weight: number
  ): Promise<RateServiceResult> {
    const { carriers } = this.config;
    const entries = Object.entries(carriers);
    if (entries.length === 0) {
      return { quotes: [] };
    }

    const results = await Promise.allSettled(
      entries.map(async ([name, carrier]) => {
        const quote = await carrier.getRates(origin, destination, weight);
        return { carrier: name, quote };
      })
    );

    const quotes: CarrierQuote[] = [];
    const errors: CarrierError[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i]!;
      const name = entries[i]![0];
      if (result.status === "fulfilled") {
        quotes.push({ carrier: name, quote: result.value.quote });
      } else {
        errors.push({ carrier: name, error: result.reason });
      }
    }

    return errors.length > 0 ? { quotes, errors } : { quotes };
  }


  async getRatesFromCarrier(
    carrierName: string,
    origin: string,
    destination: string,
    weight: number
  ): Promise<RateQuote> {
    const carrier = this.config.carriers[carrierName];
    if (!carrier) {
      throw new Error(`Unknown carrier: ${carrierName}`);
    }
    return carrier.getRates(origin, destination, weight);
  }
}
