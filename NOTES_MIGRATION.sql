-- Migration script for Notes feature
-- Run this in your Supabase SQL editor

-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS notes_tenant_id_idx ON notes(tenant_id);
CREATE INDEX IF NOT EXISTS notes_customer_id_idx ON notes(customer_id);
CREATE INDEX IF NOT EXISTS notes_created_at_idx ON notes(created_at DESC);

-- Enable Row Level Security
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for notes table
-- Policy: Users can only see notes for their tenant
CREATE POLICY "Users can view notes from their tenant"
  ON notes FOR SELECT
  USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Policy: Users can insert notes for their tenant
CREATE POLICY "Users can insert notes for their tenant"
  ON notes FOR INSERT
  WITH CHECK (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Policy: Users can update notes for their tenant
CREATE POLICY "Users can update notes for their tenant"
  ON notes FOR UPDATE
  USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Policy: Users can delete notes for their tenant
CREATE POLICY "Users can delete notes for their tenant"
  ON notes FOR DELETE
  USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
