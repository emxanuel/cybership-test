import { IRateProvider } from "@/carriers/carrier.interface.js";
import type { RateQuote } from "@/models/rate-quote.js";
import type { RateRequestInput } from "@/models/rate-request.js";

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
  providers: Record<string, IRateProvider>;
}

/**
 * Service for aggregating shipping rates from multiple carriers.
 * Only works with carriers that implement IRateProvider.
 */
export class RateService {
  constructor(private readonly config: RateServiceConfig) {}

  async getRates(request: RateRequestInput): Promise<RateServiceResult> {
    const { providers } = this.config;
    const entries = Object.entries(providers);
    if (entries.length === 0) {
      return { quotes: [] };
    }

    const results = await Promise.allSettled(
      entries.map(async ([name, provider]) => {
        const quote = await provider.getRates(request);
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


  async getRatesFromProvider(
    providerName: string,
    request: RateRequestInput
  ): Promise<RateQuote> {
    const provider = this.config.providers[providerName];
    if (!provider) {
      throw new Error(`Unknown rate provider: ${providerName}`);
    }
    return provider.getRates(request);
  }
}
