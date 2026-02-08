# Carrier Integration Service

A TypeScript multi-carrier shipping rate aggregation service for UPS with extensible architecture.

## Design Decisions

### Capability-Based Architecture

I chose a capability-based interface system rather than a monolithic carrier interface. Instead of forcing all carriers to implement every operation, carriers implement only the capabilities they support (`IRateProvider`, `ITrackingProvider`, `ILabelProvider`, etc.).

**Benefits:**
- Add new carriers without modifying existing code
- Add new operations (tracking, labels) to existing carriers without breaking rate functionality
- Type-safe capability checking - services only accept carriers with required capabilities
- Clear separation between what a carrier *is* and what it *can do*

### Clean Separation of Concerns

**Domain layer** (`src/`): Carrier-agnostic interfaces, models, and services
- `carriers/carrier.interface.ts` - Capability interfaces
- `models/` - Generic domain models (`RateQuote`, `RateRequestInput`)
- `services/rate-service.ts` - Multi-carrier orchestration

**Infrastructure layer** (`infra/`): Carrier-specific implementations
- `carriers/ups/` - UPS-specific code (API types, mappers, carrier implementation)
- `auth/ups-auth.ts` - OAuth 2.0 token lifecycle management
- `http/fetch-client.ts` - Shared HTTP client with error handling

This separation ensures adding FedEx requires zero changes to UPS code or domain models.

### Input Validation Before External Calls

All rate requests are validated using Zod schemas before making any API calls. This catches invalid data early, provides clear error messages, and prevents unnecessary API calls. Validation covers address fields, package constraints, weight/dimension units, and required fields.

### OAuth Token Management

UPS OAuth tokens are cached and automatically refreshed when expired. The `UpsOAuthManager` handles acquisition, caching, and refresh transparently - the caller never needs to think about auth.

### Comprehensive Testing Strategy

**Unit tests** for each component in isolation with mocked dependencies.

**Integration tests** verify end-to-end flow using stubbed HTTP responses with realistic UPS API payloads. This validates:
- Request building from domain models
- Response parsing and normalization
- Auth token lifecycle (acquisition, reuse, refresh)
- Error handling (4xx, 5xx, malformed responses, network failures)
- Input validation

All 77 tests pass.

### Type Safety

Strong TypeScript types throughout with Zod runtime validation schemas. Path aliases (`@/*`) for clean imports. ESM module system with `NodeNext` resolution.

## How to Run

### Prerequisites

- Node.js 20+
- pnpm

### Setup

1. Install dependencies:

```bash
pnpm install
```

2. Create `.env` file:

```env
UPS_API_BASE_URL=https://wwwcie.ups.com
UPS_CLIENT_ID=your_client_id
UPS_CLIENT_SECRET=your_client_secret
UPS_SHIPPER_NUMBER=your_shipper_number
```

Get credentials from [UPS Developer Portal](https://developer.ups.com).

### Run Tests

```bash
pnpm test              # Run all tests
pnpm test:ui           # Open Vitest UI
pnpm test:coverage     # Generate coverage report
```

### Build

```bash
pnpm build             # Compile TypeScript
```

### Usage Example

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

const { quotes, errors } = await rateService.getRates({
  origin: {
    addressLine1: "123 Main St",
    city: "Baltimore",
    state: "MD",
    postalCode: "21093",
    country: "US",
  },
  destination: {
    addressLine1: "456 Oak Ave",
    city: "Atlanta",
    state: "GA",
    postalCode: "30005",
    country: "US",
  },
  packages: [
    {
      weight: 10,
      weightUnit: "LB",
      dimensions: {
        length: 10,
        width: 10,
        height: 10,
        unit: "IN",
      },
    },
  ],
  serviceLevel: "GROUND", // Optional
});

console.log(quotes);
// [{ carrier: "ups", quote: { serviceCode: "03", serviceName: "UPS Ground", totalPrice: 25.5, currency: "USD" } }]
```

## What I Would Improve Given More Time

### Multi-Package Support

Currently `UpsCarrier.getRates()` only processes the first package. Extend to handle multiple packages properly, including carrier-specific multi-package rules.

### Rate Caching

Add Redis or in-memory caching for rate quotes with TTL (e.g., 5 minutes). Many rate requests are duplicates - caching would reduce API calls and improve performance.

### Retry Logic with Exponential Backoff

Add automatic retry for transient failures (network timeouts, 5xx errors) with exponential backoff and jitter. UPS rate limiting would benefit from smart retry logic.

### Observability

- Structured logging (Winston/Pino) with correlation IDs
- Metrics (Prometheus) for API call duration, error rates, cache hit rates
- OpenTelemetry tracing for distributed request tracking

### Enhanced Error Handling

- Carrier-specific error code mapping (UPS error codes → human-readable messages)
- Partial success handling (some carriers succeed, others fail)
- Circuit breaker pattern to avoid cascading failures

### API Rate Limiting

Implement request rate limiting per carrier to stay within API quotas. Track usage and throttle requests proactively.

### Performance Optimizations

- HTTP/2 connection pooling for carrier APIs
- Batch requests where supported by carrier APIs
- Parallel execution optimization (currently uses `Promise.allSettled`, could tune concurrency)

### Input Validation Enhancements

- Address verification API integration
- Weight/dimension validation against carrier maximums
- Service level validation per carrier (e.g., UPS doesn't support all service codes for all routes)