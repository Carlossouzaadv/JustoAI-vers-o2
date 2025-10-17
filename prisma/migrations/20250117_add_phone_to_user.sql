-- AddColumn phone to public.users table

-- Step 1: Add the phone column
ALTER TABLE public.users ADD COLUMN "phone" text;

-- Step 2: Create index on phone for faster lookups (optional)
CREATE INDEX IF NOT EXISTS users_phone_idx ON public.users ("phone");

-- Step 3: Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'phone';
