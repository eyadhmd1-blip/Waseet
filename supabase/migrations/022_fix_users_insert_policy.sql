-- Allow authenticated users to create their own profile row during onboarding.
-- RLS was enabled on 'users' in 001 but no INSERT policy was defined,
-- which silently blocked all inserts.
CREATE POLICY "users_insert_own"
  ON users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Same gap existed on providers table (INSERT was missing).
CREATE POLICY "providers_insert_own"
  ON providers
  FOR INSERT
  WITH CHECK (auth.uid() = id);
