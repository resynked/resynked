import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { createGroq } from '@ai-sdk/groq';
import { streamText, tool } from 'ai';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY!,
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
    console.log('Chat API called for tenant:', tenantId);

    // Fetch data from Supabase
    const [customers, products] = await Promise.all([
      supabase.from('customers').select('*').eq('tenant_id', tenantId),
      supabase.from('products').select('*').eq('tenant_id', tenantId),
    ]);

    console.log('Fetched customers:', customers.data?.length || 0);
    console.log('Fetched products:', products.data?.length || 0);

    const systemMessage = `Je bent een behulpzame assistent voor het facturatie systeem.

Beschikbare klanten:
${customers.data?.map(c => `- ${c.name}`).join('\n') || 'Geen klanten'}

Beschikbare producten:
${products.data?.map(p => `- ${p.name} (€${p.price})`).join('\n') || 'Geen producten'}

Je kunt vragen beantwoorden over klanten, producten, en facturen. Je kunt ook helpen met het maken van facturen.`;

    console.log('Calling Groq with', messages.length, 'messages');

    const result = await streamText({
      model: groq('llama-3.3-70b-versatile'),
      messages: [
        { role: 'system', content: systemMessage },
        ...messages,
      ],
      tools: {
        createInvoice: {
          description: 'Maak een nieuwe factuur aan in het systeem. Gebruik deze functie wanneer de gebruiker vraagt om een factuur te maken.',
          parameters: z.object({
            customerName: z.string().describe('De naam van de klant'),
            items: z.array(z.object({
              productName: z.string().describe('De naam van het product'),
              quantity: z.number().describe('De hoeveelheid'),
            })).describe('De producten/items voor de factuur'),
          }),
          execute: async ({ customerName, items }: { customerName: string; items: Array<{ productName: string; quantity: number }> }) => {
            console.log('Creating invoice for:', customerName, 'with items:', items);

            // Find customer
            const customer = customers.data?.find(
              c => c.name.toLowerCase().includes(customerName.toLowerCase())
            );

            if (!customer) {
              return { success: false, error: `Klant "${customerName}" niet gevonden` };
            }

            // Calculate total
            let total = 0;
            const invoiceItems = [];

            for (const item of items) {
              const product = products.data?.find(
                p => p.name.toLowerCase().includes(item.productName.toLowerCase())
              );

              if (!product) {
                return { success: false, error: `Product "${item.productName}" niet gevonden` };
              }

              const itemTotal = product.price * item.quantity;
              total += itemTotal;

              invoiceItems.push({
                product_id: product.id,
                quantity: item.quantity,
                price: product.price,
                total: itemTotal,
              });
            }

            // Create invoice
            const { data: invoice, error: invoiceError } = await supabase
              .from('invoices')
              .insert({
                tenant_id: tenantId,
                customer_id: customer.id,
                total,
                status: 'draft',
              })
              .select()
              .single();

            if (invoiceError || !invoice) {
              console.error('Invoice creation error:', invoiceError);
              return { success: false, error: 'Fout bij het aanmaken van de factuur' };
            }

            // Create invoice items
            const itemsToInsert = invoiceItems.map(item => ({
              ...item,
              invoice_id: invoice.id,
              tenant_id: tenantId,
            }));

            const { error: itemsError } = await supabase
              .from('invoice_items')
              .insert(itemsToInsert);

            if (itemsError) {
              console.error('Invoice items error:', itemsError);
              return { success: false, error: 'Fout bij het toevoegen van factuurregels' };
            }

            return {
              success: true,
              invoiceId: invoice.id,
              total,
              message: `Factuur succesvol aangemaakt voor ${customer.name} met totaal €${total.toFixed(2)}`,
            };
          },
        },
      },
    });

    console.log('Groq stream started');

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');

    // Stream the response - handle both text and tool calls
    for await (const chunk of result.fullStream) {
      console.log('Chunk type:', chunk.type);

      if (chunk.type === 'text-delta') {
        res.write(chunk.textDelta);
      } else if (chunk.type === 'tool-call') {
        console.log('Tool called:', chunk.toolName, chunk.args);
      } else if (chunk.type === 'tool-result') {
        console.log('Tool result:', chunk.result);
        // Optionally write tool result to stream
        if (chunk.result && typeof chunk.result === 'object' && 'message' in chunk.result) {
          res.write(`\n\n${chunk.result.message}`);
        }
      }
    }

    res.end();
  } catch (error: any) {
    console.error('Chat error:', error);
    console.error('Error details:', error.message, error.stack);

    // If headers already sent, we can't send JSON
    if (res.headersSent) {
      res.end();
      return;
    }

    return res.status(500).json({
      error: 'Er is iets misgegaan',
      message: error.message || 'Unknown error'
    });
  }
}
