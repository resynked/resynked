import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { createGroq } from '@ai-sdk/groq';
import { streamText, CoreMessage } from 'ai';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY!,
});

// Define schemas outside to avoid TypeScript type instantiation issues
const customerSchema = z.object({
  name: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

const productSchema = z.object({
  name: z.string(),
  price: z.number(),
  description: z.string().optional(),
  stock: z.number().optional(),
  image_url: z.string().optional(),
});

const invoiceSchema = z.object({
  customer_id: z.string(),
  invoice_number: z.string(),
  invoice_date: z.string(),
  due_date: z.string(),
  items: z.array(z.object({
    product_id: z.string(),
    quantity: z.number(),
    price: z.number(),
  })),
  tax_percentage: z.number().default(21),
  discount_percentage: z.number().default(0),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !(session.user as any)?.tenantId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tenantId = (session.user as any).tenantId;
  const { messages } = req.body;

  try {
    // Fetch data from Supabase
    const [customers, products, invoices] = await Promise.all([
      supabase.from('customers').select('*').eq('tenant_id', tenantId),
      supabase.from('products').select('*').eq('tenant_id', tenantId),
      supabase.from('invoices').select('*, customer:customers(*)').eq('tenant_id', tenantId),
    ]);

    const systemMessage = `Je bent een behulpzame AI assistent voor een facturatie systeem. Je helpt gebruikers met het beheren van klanten, producten en facturen.

Beschikbare klanten:
${customers.data?.map(c => `- ${c.name} (ID: ${c.id}, Email: ${c.email || 'geen'})`).join('\n') || 'Geen klanten'}

Beschikbare producten:
${products.data?.map(p => `- ${p.name} (ID: ${p.id}, Prijs: €${p.price}, Voorraad: ${p.stock || 0})`).join('\n') || 'Geen producten'}

Recente facturen:
${invoices.data?.slice(0, 5).map(i => `- Factuur voor ${i.customer?.name || 'Onbekend'}, Totaal: €${i.total}, Status: ${i.status}`).join('\n') || 'Geen facturen'}

TOEVOEGEN WORKFLOW - VOLG EXACT:

Stap 1: Als gebruiker zegt "voeg toe" - Vraag ALLE vragen IN ÉÉN BERICHT:
"Oké! Wat is de naam? Wat is de prijs? Wat is de beschrijving? Hoeveel voorraad?"
(Wacht op antwoord, vraag NIET of je het moet toevoegen!)

Stap 2: Als gebruiker ALLE antwoorden geeft - Toon samenvatting:
"Ik heb het volgende:
- Naam: [X]
- Prijs: €[X]
- Beschrijving: [X]
- Voorraad: [X]

Wil je dit toevoegen? (ja/nee)"

Stap 3:
- Als "ja" → Roep createProduct/createCustomer tool AAN (1x)
- Als "nee" → Vraag wat anders moet, herhaal stap 2

Stap 4: DIRECT NA tool uitgevoerd - ALTIJD REAGEREN:
Je MOET een bericht sturen: "✓ [Item naam] is succesvol toegevoegd! Kan ik nog ergens mee helpen?"
(Dit is VERPLICHT - NOOIT stoppen zonder bevestiging te sturen!)

ABSOLUUT VERBODEN:
- Na elke vraag vragen "moet ik het nu toevoegen?"
- Tool aanroepen zonder expliciete JA
- Tool 2x aanroepen
- Lege berichten sturen

Wees kort, duidelijk en volg de stappen EXACT.`;

    // @ts-ignore - Complex tool types cause TS issues
    const result = await streamText({
      model: groq('llama-3.3-70b-versatile'),
      messages: [
        { role: 'system', content: systemMessage } as CoreMessage,
        ...(messages as CoreMessage[]),
      ],
      tools: {
        createCustomer: {
          description: 'Maak een nieuwe klant aan in de database',
          inputSchema: customerSchema,
          execute: async ({ name, email, phone, address }: any) => {
            const { data, error } = await supabase
              .from('customers')
              .insert({ name, email, phone, address, tenant_id: tenantId })
              .select()
              .single();

            if (error) {
              console.error('Error creating customer:', error);
              throw new Error(`Fout bij aanmaken klant: ${error.message}`);
            }
            return { success: true, customer: data };
          },
        },
        createProduct: {
          description: 'Maak een nieuw product aan in de database',
          inputSchema: productSchema,
          execute: async ({ name, price, description, stock, image_url }: any) => {
            const { data, error } = await supabase
              .from('products')
              .insert({
                name,
                price,
                description: description || null,
                stock: stock || 0,
                image_url: image_url || null,
                tenant_id: tenantId
              })
              .select()
              .single();

            if (error) {
              console.error('Error creating product:', error);
              throw new Error(`Fout bij aanmaken product: ${error.message}`);
            }
            return { success: true, product: data };
          },
        },
        createInvoice: {
          description: 'Maak een nieuwe factuur aan in de database',
          inputSchema: invoiceSchema,
          execute: async ({ customer_id, invoice_number, invoice_date, due_date, items, tax_percentage = 21, discount_percentage = 0 }: any) => {
            // Calculate total
            const subtotal = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
            const discount = subtotal * (discount_percentage / 100);
            const taxableAmount = subtotal - discount;
            const tax = taxableAmount * (tax_percentage / 100);
            const total = taxableAmount + tax;

            const { data: invoice, error: invoiceError } = await supabase
              .from('invoices')
              .insert({
                tenant_id: tenantId,
                customer_id,
                invoice_number,
                invoice_date,
                due_date,
                currency: 'EUR',
                tax_percentage,
                discount_percentage,
                total,
                status: 'draft',
              })
              .select()
              .single();

            if (invoiceError) {
              console.error('Error creating invoice:', invoiceError);
              throw new Error(`Fout bij aanmaken factuur: ${invoiceError.message}`);
            }

            // Insert invoice items
            const { error: itemsError } = await supabase
              .from('invoice_items')
              .insert(
                items.map((item: any) => ({
                  invoice_id: invoice.id,
                  product_id: item.product_id,
                  quantity: item.quantity,
                  price: item.price,
                }))
              );

            if (itemsError) {
              console.error('Error creating invoice items:', itemsError);
              throw new Error(`Fout bij aanmaken factuurregels: ${itemsError.message}`);
            }

            return { success: true, invoice };
          },
        },
      },
    });

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');

    // Stream the response including tool calls and results
    for await (const chunk of result.fullStream) {
      console.log('Stream chunk type:', chunk.type);

      // Only write text deltas to the response
      if (chunk.type === 'text-delta') {
        console.log('Text delta:', chunk.text);
        res.write(chunk.text);
      } else if (chunk.type === 'tool-result') {
        // Log tool results for debugging
        console.log('Tool result:', chunk.toolName, chunk.output);
      } else if (chunk.type === 'tool-call') {
        console.log('Tool call:', chunk.toolName);
      } else if (chunk.type === 'finish') {
        console.log('Stream finished');
      }
    }

    console.log('Stream ended, closing response');

    res.end();
  } catch (error: any) {
    console.error('Chat error:', error);

    // If headers already sent, we can't send JSON
    if (res.headersSent) {
      res.end();
      return;
    }

    return res.status(500).json({ error: 'Er is iets misgegaan' });
  }
}
