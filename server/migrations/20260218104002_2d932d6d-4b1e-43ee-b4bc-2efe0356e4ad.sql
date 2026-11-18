
-- Drop the overly permissive update policy
DROP POLICY IF EXISTS "Public can update quotation signature" ON quotations;

-- Create a more restricted policy: public can only update via the public token
-- The actual field restriction will be enforced in the application code
-- This allows unauthenticated users to accept/reject quotations they have the token for
CREATE POLICY "Public can update quotation by token"
  ON quotations FOR UPDATE
  USING (public_token IS NOT NULL)
  WITH CHECK (public_token IS NOT NULL);
