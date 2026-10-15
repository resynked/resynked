import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { buildUserPrompt, systemPrompt } from './prompt';
import { AiKeyError, QuoteProposalSchema, type AiProvider } from './types';

/**
 * OpenAI, met de sleutel van de gebruiker zelf.
 *
 * Het model is in te stellen met OPENAI_MODEL, zodat je zonder nieuwe versie
 * van Khance kunt overstappen als OpenAI een nieuw model uitbrengt.
 */
const MODEL = process.env.OPENAI_MODEL || 'gpt-5';

function client(apiKey: string) {
  return new OpenAI({ apiKey });
}

/** Een fout van OpenAI als een melding die de gebruiker begrijpt. */
function explain(error: unknown): Error {
  if (error instanceof OpenAI.AuthenticationError || error instanceof OpenAI.PermissionDeniedError) {
    return new AiKeyError('Deze API-sleutel van OpenAI werkt niet (meer). Vul bij Plug-ins een geldige sleutel in.');
  }
  if (error instanceof OpenAI.RateLimitError) {
    return /quota/i.test(error.message)
      ? new Error('Je tegoed bij OpenAI is op. Vul het aan op platform.openai.com.')
      : new Error('OpenAI heeft het even te druk, of je limiet is bereikt. Probeer het zo opnieuw.');
  }
  if (error instanceof OpenAI.APIError) {
    return new Error(`OpenAI gaf een fout (${error.status ?? 'onbekend'}). Probeer het opnieuw.`);
  }
  return error instanceof Error ? error : new Error('De AI is niet bereikbaar');
}

export const openai: AiProvider = {
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
      const response = await client(apiKey).responses.parse({
        model: MODEL,
        instructions: systemPrompt(input.source),
        input: buildUserPrompt(input),
        text: { format: zodTextFormat(QuoteProposalSchema, 'quote_proposal') },
      });

      if (!response.output_parsed) {
        throw new Error('De AI kwam niet tot een volledig voorstel. Probeer het opnieuw.');
      }

      return response.output_parsed;
    } catch (error) {
      throw explain(error);
    }
  },
};
