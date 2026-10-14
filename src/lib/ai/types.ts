import { z } from 'zod';

/** De AI-diensten waarmee een gebruiker zijn eigen sleutel kan koppelen. */
export type AiProviderName = 'anthropic' | 'openai' | 'gemini';

export const AI_PROVIDERS: AiProviderName[] = ['anthropic', 'openai', 'gemini'];

/**
 * Wat de AI uit een mail haalt: de klant, een voorstel voor de offerte, en wat
 * er nog ontbreekt. Een lege tekst betekent "niet gevonden" — liever leeg dan
 * verzonnen.
 */
export const QuoteProposalSchema = z.object({
  customer: z.object({
    first_name: z.string(),
    middle_name: z.string(),
    last_name: z.string(),
    company_name: z.string(),
    email: z.string(),
    phone: z.string(),
    street_address: z.string(),
    postal_code: z.string(),
    city: z.string(),
  }),
  quote: z.object({
    /** De titel van het blok, zoals "PVC visgraatvloer leggen" */
    title: z.string(),
    /** Een korte inleiding aan de klant */
    intro: z.string(),
    items: z.array(
      z.object({
        description: z.string(),
        quantity: z.number(),
        /** Zoals m², uur of stuks; leeg als het om één post gaat */
        unit: z.string(),
        /** Prijs per eenheid excl. btw, alleen op basis van eerdere offertes */
        price: z.number().nullable(),
        /** Waar de prijs vandaan komt, zoals "Offerte 2026-0012: € 42 per m²" */
        price_basis: z.string(),
      })
    ),
  }),
  /** Wat er nog nodig is voor een goede offerte */
  missing: z.array(z.string()),
  /** Een antwoord aan de klant dat om die gegevens vraagt; leeg als er niets ontbreekt */
  reply_draft: z.string(),
});

export type QuoteProposal = z.infer<typeof QuoteProposalSchema>;

/** Een regel uit een eerdere offerte, om prijzen op te baseren. */
export interface PastQuoteLine {
  description: string;
  unit: string | null;
  price: number;
  quoteNumber: string | null;
}

/** Alles wat de AI meekrijgt om een mail om te zetten. */
export interface QuoteRequestInput {
  /** Het gesprek als platte tekst, oudste bericht eerst */
  transcript: string;
  companyName: string;
  userName: string;
  /** De klant als die al bekend is, op e-mailadres gevonden */
  knownCustomer: Record<string, string> | null;
  pastLines: PastQuoteLine[];
}

/** Wat elke AI-dienst moet kunnen. */
export interface AiProvider {
  /** Controleert of de sleutel werkt; gooit een leesbare fout als dat niet zo is */
  verifyKey(apiKey: string): Promise<void>;
  proposeQuote(apiKey: string, input: QuoteRequestInput): Promise<QuoteProposal>;
}

/** De sleutel werkt niet (meer); opnieuw invullen is nodig. */
export class AiKeyError extends Error {}
