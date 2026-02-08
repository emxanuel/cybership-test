import { RateQuote } from "../models/rate-quote";

export interface ICarrier {
  getRates(origin: string, destination: string, weight: number): Promise<RateQuote>
}