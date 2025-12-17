-- Add Membership Numbers to Profiles
-- Format: NP-XXXXX (5 digits, supports up to 99,999 members)

-- 1. Add membership_number column to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS membership_number TEXT UNIQUE;

-- 2. Create a sequence for membership numbers
CREATE SEQUENCE IF NOT EXISTS membership_number_seq START WITH 1;

-- 3. Create function to generate membership number
CREATE OR REPLACE FUNCTION generate_membership_number()
RETURNS TEXT AS $$
DECLARE
    next_num INTEGER;
    new_number TEXT;
BEGIN
    -- Get next sequence value
    next_num := nextval('membership_number_seq');
    
    -- Format as NP-XXXXX (5 digits with leading zeros)
    new_number := 'NP-' || LPAD(next_num::TEXT, 5, '0');
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger function to auto-assign membership numbers
CREATE OR REPLACE FUNCTION assign_membership_number()
RETURNS TRIGGER AS $$
BEGIN
    -- Only assign if becoming a member and doesn't have a number yet
    IF NEW.is_member = true AND NEW.membership_number IS NULL THEN
        NEW.membership_number := generate_membership_number();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger on profiles
DROP TRIGGER IF EXISTS trg_assign_membership_number ON profiles;
CREATE TRIGGER trg_assign_membership_number
    BEFORE INSERT OR UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION assign_membership_number();

-- 6. Backfill membership numbers for existing members
DO $$
DECLARE
    profile_record RECORD;
BEGIN
    -- Assign membership numbers to existing members who don't have one
    FOR profile_record IN 
        SELECT id 
        FROM profiles 
        WHERE is_member = true 
        AND membership_number IS NULL
        ORDER BY created_at ASC
    LOOP
        UPDATE profiles 
        SET membership_number = generate_membership_number()
        WHERE id = profile_record.id;
    END LOOP;
END $$;

-- 7. Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_membership_number 
ON profiles(membership_number) 
WHERE membership_number IS NOT NULL;

-- 8. Add comment for documentation
COMMENT ON COLUMN profiles.membership_number IS 'Unique membership number in format NP-XXXXX, assigned when user becomes a member. Permanent even if membership is revoked.';
