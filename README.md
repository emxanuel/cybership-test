# Carrier Integration

A TypeScript multi-carrier shipping rate aggregation service with UPS integration.

## Features

- **Multi-carrier architecture**: Pluggable carrier system via `ICarrier` interface
- **UPS Rate API v2403**: OAuth 2.0 authentication, rate requests with caching
- **Rate aggregation**: Query multiple carriers in parallel with error handling
- **Type-safe**: Full TypeScript with Zod schemas
- **Tested**: Comprehensive test suite with Vitest

## Project Structure

```
├── src/                    # Shared, carrier-agnostic code
│   ├── carriers/          # Carrier interface
│   ├── models/            # Rate quote, request types
│   └── services/          # RateService (multi-carrier)
├── infra/                 # Carrier-specific implementations
│   ├── auth/             # UPS OAuth
│   ├── carriers/ups/     # UPS carrier, mapper, types
│   └── http/             # HTTP client
├── config/               # Environment config
└── __tests__/           # Test files
    ├── infra/           # Unit tests for infra layer
    ├── integration/     # Integration tests
    └── src/             # Unit tests for services
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
  carriers: {
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
const quote = await rateService.getRatesFromCarrier("ups", "21093", "30005", 10);
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

## Adding a new carrier

1. **Define types** in `infra/carriers/<carrier>/`:
   - `<carrier>-rate-request.ts` – API request types
   - `<carrier>-rate-response.ts` – API response types

2. **Implement mapper** in `<carrier>-mapper.ts`:
   - `buildRequestBody()` – maps origin/destination/weight → API request
   - `mapResponseToQuote()` – maps API response → `RateQuote`

3. **Implement carrier** in `<carrier>-carrier.ts`:
   - `implements ICarrier`
   - `getRates(origin, destination, weight): Promise<RateQuote>`

4. **Add to service**:

```typescript
const rateService = new RateService({
  carriers: {
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
