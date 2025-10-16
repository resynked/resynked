import { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password, name, tenantName } = req.body;

  // Validation
  if (!email || !password || !name || !tenantName) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create tenant first
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert({ name: tenantName })
      .select()
      .single();

    if (tenantError) {
      console.error('Tenant creation error:', tenantError);
      return res.status(500).json({ error: 'Failed to create tenant' });
    }

    // Create user with tenant_id
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        tenant_id: tenant.id,
        email,
        password_hash: passwordHash,
        name,
        role: 'admin', // First user is admin
      })
      .select()
      .single();

    if (userError) {
      console.error('User creation error:', userError);
      // Clean up tenant if user creation fails
      await supabaseAdmin.from('tenants').delete().eq('id', tenant.id);
      return res.status(500).json({ error: 'Failed to create user' });
    }

    return res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
