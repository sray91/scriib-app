-- Update the Unipile account ID to the correct value
-- This fixes the "Not Found" error when trying to send connection requests

UPDATE public.linkedin_outreach_accounts
SET unipile_account_id = '1wXiQcz-RjS7MGnjYLVX2Q'
WHERE unipile_account_id = 'nKY0PS7TTaKX3t8uQ_rjgw';

-- Verify the update
SELECT id, account_name, unipile_account_id, is_active
FROM public.linkedin_outreach_accounts
WHERE unipile_account_id = '1wXiQcz-RjS7MGnjYLVX2Q';
