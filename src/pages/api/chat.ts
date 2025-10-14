import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { createGroq } from '@ai-sdk/groq';
import { streamText } from 'ai';
import { supabase } from '@/lib/supabase';

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
    // Fetch data from Supabase
    const [customers, products] = await Promise.all([
      supabase.from('customers').select('*').eq('tenant_id', tenantId),
      supabase.from('products').select('*').eq('tenant_id', tenantId),
    ]);

    const systemMessage = `Je bent een behulpzame assistent voor het facturatie systeem.

Beschikbare klanten:
${customers.data?.map(c => `- ${c.name}`).join('\n') || 'Geen klanten'}

Beschikbare producten:
${products.data?.map(p => `- ${p.name} (€${p.price})`).join('\n') || 'Geen producten'}

Je kunt vragen beantwoorden over klanten, producten, en facturen. Je kunt ook helpen met het maken van facturen.`;

    const result = streamText({
      model: groq('llama-3.3-70b-versatile'),
      messages: [
        { role: 'system', content: systemMessage },
        ...messages,
      ],
    });

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');

    // Stream the response
    for await (const chunk of result.textStream) {
      res.write(chunk);
    }

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
