import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { RECEIPT_PROMPT, buildUserPrompt, systemPrompt } from './prompt';
import { AiKeyError, QuoteProposalSchema, ReceiptReadingSchema, type AiProvider } from './types';

/**
 * Claude, met de sleutel van de gebruiker zelf.
 *
 * Opus 5.5 leest een mailgesprek betrouwbaar uit en kent het verschil tussen
 * wat er staat en wat je zou kunnen raden. Effort "medium": dit is uitlezen,
 * geen lange denkklus.
 */
const MODEL = 'claude-opus-5-5';

function client(apiKey: string) {
  return new Anthropic({ apiKey });
}

/** Een fout van Anthropic als een melding die de gebruiker begrijpt. */
function explain(error: unknown): Error {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new AiKeyError('Deze API-sleutel van Anthropic werkt niet (meer). Vul bij Plug-ins een geldige sleutel in.');
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new Error('Anthropic heeft het even te druk, of je limiet is bereikt. Probeer het zo opnieuw.');
  }
  if (error instanceof Anthropic.BadRequestError && /credit|balance/i.test(error.message)) {
    return new Error('Je tegoed bij Anthropic is op. Vul het aan op console.anthropic.com.');
  }
  if (error instanceof Anthropic.APIError) {
    return new Error(`Anthropic gaf een fout (${error.status ?? 'onbekend'}). Probeer het opnieuw.`);
  }
  return error instanceof Error ? error : new Error('De AI is niet bereikbaar');
}

export const anthropic: AiProvider = {
  async verifyKey(apiKey) {
    try {
      // Kost niets en zegt meteen of de sleutel bij dit model mag
      await client(apiKey).models.retrieve(MODEL);
    } catch (error) {
      throw explain(error);
    }
  },

  async proposeQuote(apiKey, input) {
    try {
      const response = await client(apiKey).beta.messages.parse({
        model: MODEL,
        max_tokens: 16000,
        // Weigert het model onterecht, dan probeert Anthropic het zelf op een ander model
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: systemPrompt(input.source),
        messages: [{ role: 'user', content: buildUserPrompt(input) }],
        output_config: { effort: 'medium', format: zodOutputFormat(QuoteProposalSchema) },
      });

      if (response.stop_reason === 'refusal') {
        throw new Error('De AI wilde deze mail niet verwerken. Maak de offerte met de hand.');
      }
      if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
        throw new Error('De AI kwam niet tot een volledig voorstel. Probeer het opnieuw.');
      }

      return response.parsed_output;
    } catch (error) {
      throw explain(error);
    }
  },

  async readReceipt(apiKey, file) {
    try {
      // Een PDF gaat mee als document, een foto als afbeelding
      const attachment =
        file.mediaType === 'application/pdf'
          ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: file.base64 } }
          : { type: 'image' as const, source: { type: 'base64' as const, media_type: file.mediaType as 'image/jpeg' | 'image/png' | 'image/webp', data: file.base64 } };

      const response = await client(apiKey).beta.messages.parse({
        model: MODEL,
        max_tokens: 4000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: RECEIPT_PROMPT,
        messages: [{ role: 'user', content: [attachment, { type: 'text', text: 'Lees dit bonnetje of deze factuur uit.' }] }],
        output_config: { effort: 'low', format: zodOutputFormat(ReceiptReadingSchema) },
      });

      if (response.stop_reason === 'refusal' || !response.parsed_output) {
        throw new Error('De AI kon dit bestand niet lezen. Vul de gegevens met de hand in.');
      }

      return response.parsed_output;
    } catch (error) {
      throw explain(error);
    }
  },
};
