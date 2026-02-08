# Carrier Integration

A TypeScript multi-carrier shipping rate aggregation service with extensible architecture.

## Features

- **Extensible architecture**: Capability-based interfaces for adding carriers and operations
- **UPS Rate API v2403**: OAuth 2.0 authentication, rate requests with caching
- **Rate aggregation**: Query multiple carriers in parallel with error handling
- **Type-safe**: Full TypeScript with Zod schemas
- **Tested**: Comprehensive test suite with Vitest

## Architecture

### Capability-Based Design

The system uses capability interfaces instead of a monolithic carrier interface. Carriers implement only the capabilities they support:

```typescript
// Base carrier interface
interface ICarrier {
  readonly name: string;
}

// Capability interfaces
interface IRateProvider extends ICarrier {
  getRates(origin: string, destination: string, weight: number): Promise<RateQuote>;
}

interface ITrackingProvider extends ICarrier {
  track(trackingNumber: string): Promise<TrackingInfo>;
}

interface ILabelProvider extends ICarrier {
  createLabel(shipment: ShipmentRequest): Promise<LabelResponse>;
}
```

**Benefits:**
- Add new carriers without modifying existing code
- Add new operations without breaking existing functionality
- Type-safe capability checking
- Services accept only carriers with required capabilities

### Project Structure

```
├── src/                    # Carrier-agnostic domain layer
│   ├── carriers/          # Capability interfaces (IRateProvider, etc.)
│   ├── models/            # Domain models (RateQuote, TrackingInfo)
│   └── services/          # Capability services (RateService, etc.)
├── infra/                 # Carrier-specific implementations
│   ├── auth/             # Carrier authentication (ups-auth.ts)
│   ├── carriers/         # Carrier implementations
│   │   └── ups/          # UPS-specific code
│   │       ├── ups-carrier.ts       # Implements IRateProvider
│   │       ├── ups-rate-request.ts  # UPS API types
│   │       ├── ups-rate-response.ts # UPS API types
│   │       └── ups-mapper.ts        # UPS ↔ domain conversion
│   └── http/             # Shared HTTP client
├── config/               # Environment config
└── __tests__/           # Test files
```

## Setup

### Install dependencies

```bash
pnpm install
```

### Configure environment

Create `.env`:

```env
UPS_API_BASE_URL=https://wwwcie.ups.com
UPS_CLIENT_ID=your_client_id
UPS_CLIENT_SECRET=your_client_secret
UPS_SHIPPER_NUMBER=your_shipper_number
```

Get credentials from [UPS Developer Portal](https://developer.ups.com).

## Usage

### Basic rate request

```typescript
import { UpsCarrier } from "./infra/carriers/ups/ups-carrier.js";
import { env } from "./config/env.js";

const carrier = new UpsCarrier({
  auth: {
    clientId: env.UPS_CLIENT_ID!,
    clientSecret: env.UPS_CLIENT_SECRET!,
    baseUrl: env.UPS_API_BASE_URL!,
  },
  shipperNumber: env.UPS_SHIPPER_NUMBER!,
});

const quote = await carrier.getRates("21093", "30005", 10);
console.log(quote);
// {
//   serviceCode: "03",
//   serviceName: "UPS Ground",
//   totalPrice: 25.5,
//   currency: "USD",
//   breakdown: { basePrice: 25.5, fuelSurcharge: 2.5, ... }
// }
```

### Multi-carrier service

```typescript
import { RateService } from "./src/services/rate-service.js";
import { UpsCarrier } from "./infra/carriers/ups/ups-carrier.js";
import { env } from "./config/env.js";

const rateService = new RateService({
  providers: {
    ups: new UpsCarrier({
      auth: {
        clientId: env.UPS_CLIENT_ID!,
        clientSecret: env.UPS_CLIENT_SECRET!,
        baseUrl: env.UPS_API_BASE_URL!,
      },
      shipperNumber: env.UPS_SHIPPER_NUMBER!,
    }),
  },
});

const { quotes, errors } = await rateService.getRates("21093", "30005", 10);
// quotes: [{ carrier: "ups", quote: { ... } }]
// errors: [] (if any carriers failed)
```

### Single carrier

```typescript
const quote = await rateService.getRatesFromProvider("ups", "21093", "30005", 10);
```

## Testing

Run all tests:

```bash
pnpm test
```

Watch mode:

```bash
pnpm test
```

UI mode:

```bash
pnpm test:ui
```

Coverage:

```bash
pnpm test:coverage
```

### Test Structure

**Unit Tests** (`__tests__/infra/`, `__tests__/src/`)
- `fetch-client.test.ts` – HTTP client (17 tests)
- `ups-auth.test.ts` – OAuth token caching (9 tests)
- `ups-mapper.test.ts` – Request builder & response mapper (15 tests)
- `ups-carrier.test.ts` – UPS carrier (7 tests)
- `rate-service.test.ts` – Multi-carrier service (11 tests)

**Integration Tests** (`__tests__/integration/`)
- `ups-carrier-integration.test.ts` – End-to-end flow with realistic payloads (12 tests)

**71 tests total, all passing.**

### Integration Test Coverage

The integration tests verify end-to-end behavior using stubbed HTTP with realistic UPS API payloads:

✓ **Request payload correctness**
  - Domain models → UPS API request structure
  - All required UPS fields present
  - Proper headers (OAuth, transactionSrc, transId)

✓ **Response parsing & normalization**
  - Successful responses → normalized `RateQuote`
  - Negotiated vs. standard rates
  - Multiple rated shipments (Shop API)
  - International shipments (different currencies)
  - Missing data handling

✓ **Auth token lifecycle**
  - Token acquisition
  - Token reuse across requests
  - Refresh on expiry (via fake timers)

✓ **Error handling**
  - `401 Unauthorized` – structured error
  - `400 Bad Request` – validation errors
  - `500 Internal Server Error`
  - Malformed JSON responses
  - Network failures/timeouts
  - Missing `RatedShipment` in response

All tests use realistic payloads from UPS documentation with stubbed HTTP layer.

## Extensibility

### Adding a New Carrier

Example: Adding FedEx alongside UPS without modifying existing code.

**1. Create carrier implementation** (`infra/carriers/fedex/fedex-carrier.ts`):

```typescript
import { IRateProvider } from "@/carriers/carrier.interface.js";
import { RateQuote } from "@/models/rate-quote.js";

export class FedExCarrier implements IRateProvider {
  readonly name = "FedEx";
  
  async getRates(origin: string, destination: string, weight: number): Promise<RateQuote> {
    // Build FedEx-specific request
    const fedexRequest = buildFedExRateRequest({ origin, destination, weight });
    
    // Call FedEx API
    const response = await this.client.post<FedExRateResponse>("/rate/v1/rates", fedexRequest);
    
    // Map to generic RateQuote
    return mapFedExResponseToQuote(response);
  }
}
```

**2. Use alongside existing carriers:**

```typescript
const rateService = new RateService({
  providers: {
    ups: new UpsCarrier({ ... }),
    fedex: new FedExCarrier({ ... }),  // ← Add without touching UPS code
  },
});

const result = await rateService.getRates("12345", "67890", 10);
// result.quotes contains quotes from both UPS and FedEx
```

**No changes required to:**
- UPS carrier code
- RateService
- Domain models
- Existing tests

### Adding a New Operation

Example: Adding tracking capability to an existing carrier.

**1. Extend carrier with new capability:**

```typescript
export class UpsCarrier implements IRateProvider, ITrackingProvider {
  readonly name = "UPS";
  
  // Existing rate capability (unchanged)
  async getRates(...): Promise<RateQuote> { /* ... */ }
  
  // NEW: Tracking capability
  async track(trackingNumber: string): Promise<TrackingInfo> {
    const response = await this.client.get<UpsTrackingResponse>(
      `/api/track/v1/details/${trackingNumber}`
    );
    return mapUpsTrackingResponse(response);
  }
}
```

**2. Create specialized service:**

```typescript
const trackingService = new TrackingService({
  providers: { ups }  // Only accepts ITrackingProvider
});

const tracking = await trackingService.track("1Z999AA10123456784");
```

**Benefits:**
- Rate functionality unaffected
- Each capability tested independently
- Type-safe - services only accept carriers with required capability
- Can add tracking to UPS first, FedEx later

### Type-Safe Capability Checking

```typescript
function supportsTracking(carrier: ICarrier): carrier is ITrackingProvider {
  return "track" in carrier;
}

const carrier = new UpsCarrier({ ... });

if (supportsTracking(carrier)) {
  // TypeScript knows carrier has .track() method
  await carrier.track("1Z999AA10123456784");
}
```

## Adding a new carrier (Legacy Pattern)

For simple rate-only carriers, you can follow this pattern:

1. **Define types** in `infra/carriers/<carrier>/`:
   - `<carrier>-rate-request.ts` – API request types
   - `<carrier>-rate-response.ts` – API response types

2. **Implement mapper** in `<carrier>-mapper.ts`:
   - `buildRequestBody()` – maps origin/destination/weight → API request
   - `mapResponseToQuote()` – maps API response → `RateQuote`

3. **Implement carrier** in `<carrier>-carrier.ts`:
   - `implements IRateProvider`
   - `getRates(origin, destination, weight): Promise<RateQuote>`

4. **Add to service**:

```typescript
const rateService = new RateService({
  providers: {
    ups: upsCarrier,
    newCarrier: new NewCarrier({ ... }),
  },
});
```

## Scripts

- `pnpm build` – Compile TypeScript
- `pnpm test` – Run tests
- `pnpm test:ui` – Open Vitest UI
- `pnpm test:coverage` – Generate coverage report

## Tech Stack

- **TypeScript 5.9** (strict mode, ESM)
- **Vitest 4.0** (testing)
- **Zod 4.3** (schemas)
- **Node 20+** (native fetch, crypto.randomUUID)

## License

ISC
