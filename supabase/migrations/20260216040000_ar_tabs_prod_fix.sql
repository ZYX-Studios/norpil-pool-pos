-- AR Tabs Production Fix
-- Fixes FK reference to use correct sessions table name (table_sessions vs pos_sessions)

-- First, check if the original migration partially applied
DO $$
BEGIN
    -- Check if ar_ledger_entries table exists but has FK to pos_sessions
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'ar_ledger_entries'
    ) THEN
        -- Check if FK constraint exists
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_schema = 'public' AND tc.table_name = 'ar_ledger_entries'
            AND tc.constraint_type = 'FOREIGN KEY'
            AND kcu.column_name = 'pos_session_id'
        ) THEN
            -- Drop the FK constraint if it references pos_sessions
            IF EXISTS (
                SELECT 1 FROM information_schema.referential_constraints rc
                JOIN information_schema.key_column_usage kcu ON rc.constraint_name = kcu.constraint_name
                WHERE rc.constraint_schema = 'public' AND rc.table_name = 'ar_ledger_entries'
                AND kcu.column_name = 'pos_session_id'
                AND rc.unique_constraint_name LIKE '%pos_sessions%'
            ) THEN
                ALTER TABLE ar_ledger_entries DROP CONSTRAINT IF EXISTS ar_ledger_entries_pos_session_id_fkey;
            END IF;
        END IF;
    END IF;
END $$;

-- Now create or update the FK to reference the correct sessions table
-- First check which sessions table exists
DO $$
DECLARE
    sessions_table_name TEXT;
BEGIN
    -- Check which sessions table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'table_sessions'
    ) THEN
        sessions_table_name := 'table_sessions';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'pos_sessions'
    ) THEN
        sessions_table_name := 'pos_sessions';
    ELSE
        RAISE NOTICE 'No sessions table found, skipping FK creation';
        RETURN;
    END IF;
    
    -- Add FK constraint if ar_ledger_entries exists and column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'ar_ledger_entries'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'ar_ledger_entries' 
        AND column_name = 'pos_session_id'
    ) THEN
        EXECUTE format('
            ALTER TABLE ar_ledger_entries 
            ADD CONSTRAINT ar_ledger_entries_pos_session_id_fkey 
            FOREIGN KEY (pos_session_id) REFERENCES %I(id) ON DELETE SET NULL',
            sessions_table_name
        );
    END IF;
END $$;

-- Update indexes to match the correct table name if needed
DO $$
DECLARE
    sessions_table_name TEXT;
BEGIN
    -- Check which sessions table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'table_sessions'
    ) THEN
        sessions_table_name := 'table_sessions';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'pos_sessions'
    ) THEN
        sessions_table_name := 'pos_sessions';
    ELSE
        RETURN;
    END IF;
    
    -- Drop old index if it exists with wrong name
    DROP INDEX IF EXISTS idx_ar_ledger_entries_pos_session_id;
    
    -- Create new index with correct reference
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS idx_ar_ledger_entries_pos_session_id 
        ON ar_ledger_entries(pos_session_id)',
        sessions_table_name
    );
END $$;

-- Create a safe resume script for partial applies
COMMENT ON MIGRATION '20260216040000_ar_tabs_prod_fix.sql' IS '
This migration fixes the FK reference in the AR Tabs MVP migration to work with production schema.
Production uses table_sessions instead of pos_sessions.

Safe for partial applies:
- If ar_ledger_entries doesn''t exist yet: no-op
- If FK already correct: no-op  
- If FK references wrong table: drops and recreates
- If no sessions table: skips FK creation

Run this after the original AR Tabs migration (20260215232046_ar_tabs_mvp.sql).
';