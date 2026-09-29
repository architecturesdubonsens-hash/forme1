-- Migration 003 : table app_logs pour la journalisation des erreurs
-- A executer dans le Supabase SQL Editor

CREATE TABLE IF NOT EXISTS app_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    level TEXT NOT NULL,
    logger TEXT,
    message TEXT,
    module TEXT,
    function_name TEXT,
    line INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    exc_info TEXT
);

CREATE INDEX IF NOT EXISTS idx_app_logs_created_at ON app_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_level ON app_logs (level);

ALTER TABLE app_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role reads app_logs" ON app_logs
    FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "Service role inserts app_logs" ON app_logs
    FOR INSERT WITH CHECK (auth.role() = 'service_role');
