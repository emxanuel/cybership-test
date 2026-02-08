import { z } from "zod";

export const RateQuoteSchema = z.object({
  serviceCode: z.string(),
  serviceName: z.string(),

  totalPrice: z.number(),
  currency: z.string(),

  estimatedDays: z.number().optional(),
  deliveryDate: z.string().optional(),

  breakdown: z
    .object({
      basePrice: z.number().optional(),
      fuelSurcharge: z.number().optional(),
      taxes: z.number().optional(),
      other: z.number().optional(),
    })
    .optional(),
});

export type RateQuote = z.infer<typeof RateQuoteSchema>;
