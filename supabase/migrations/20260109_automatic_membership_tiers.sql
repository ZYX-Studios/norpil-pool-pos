-- Function to recalculate membership tier based on wallet balance
CREATE OR REPLACE FUNCTION recalculate_membership_tier()
RETURNS TRIGGER AS $$
DECLARE
    customer_id UUID;
    default_tier_id UUID;
    current_tier_id UUID;
BEGIN
    -- Get the profile_id (customer_id) from the wallet
    customer_id := NEW.profile_id;

    -- Strict Downgrade Logic
    IF NEW.balance < 500 THEN
        UPDATE profiles
        SET membership_tier_id = NULL,
            is_member = FALSE
        WHERE id = customer_id
        AND (membership_tier_id IS NOT NULL OR is_member = TRUE);
        
    ELSE
        -- Entry / Maintenance Logic (Balance >= 500)
        
        -- Check if user already has a tier
        SELECT membership_tier_id INTO current_tier_id
        FROM profiles
        WHERE id = customer_id;

        IF current_tier_id IS NULL THEN
            -- User has NO tier, so they are entering the system.
            -- assign "Default" tier (lowest rank or by name "Default")
             SELECT id INTO default_tier_id
             FROM membership_tiers
             WHERE name = 'Default'
             LIMIT 1;
             
             -- Fallback: Use lowest discount tier if Default not found
             IF default_tier_id IS NULL THEN
                SELECT id INTO default_tier_id
                FROM membership_tiers
                ORDER BY discount_percentage ASC
                LIMIT 1;
             END IF;

             UPDATE profiles
             SET membership_tier_id = default_tier_id,
                 is_member = TRUE
             WHERE id = customer_id;
        ELSE
            -- User ALREADY has a tier.
            -- KEEP IT. Only Ensure is_member is true.
            UPDATE profiles
            SET is_member = TRUE
            WHERE id = customer_id AND is_member = FALSE;
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on wallet balance update
DROP TRIGGER IF EXISTS on_wallet_balance_change ON wallets;
CREATE TRIGGER on_wallet_balance_change
    AFTER UPDATE OF balance ON wallets
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_membership_tier();
