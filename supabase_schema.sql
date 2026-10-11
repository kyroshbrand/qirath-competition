-- ====================================================================
-- ALL KARNATAKA QIRATH COMPETITION - SUPABASE DATABASE SCHEMA
-- Presented by Reid & Premium Groom Studio
-- ====================================================================
-- INSTRUCTIONS:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard
-- 2. Select your project -> Click "SQL Editor" in the left sidebar
-- 3. Click "+ New query", paste this entire script, and click "Run"
-- ====================================================================

-- 1. Create the participants table
CREATE TABLE IF NOT EXISTS public.participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id VARCHAR(30) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    age INT NOT NULL,
    category VARCHAR(50) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    whatsapp VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    district VARCHAR(100),
    branch VARCHAR(50) NOT NULL,
    surah_recited VARCHAR(150),
    maqam_style VARCHAR(100),
    aadhaar_url TEXT,
    video_url TEXT NOT NULL,
    ig_screenshot_url TEXT,
    wa_screenshot_url TEXT,
    status VARCHAR(30) DEFAULT 'Pending Review', -- 'Pending Review', 'Approved', 'Shortlisted', 'Rejected'
    judge_score NUMERIC(5, 2) DEFAULT 0,
    judge_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Indexes for super fast search & branch filtering
CREATE INDEX IF NOT EXISTS idx_participants_branch ON public.participants(branch);
CREATE INDEX IF NOT EXISTS idx_participants_status ON public.participants(status);
CREATE INDEX IF NOT EXISTS idx_participants_phone ON public.participants(phone);
CREATE INDEX IF NOT EXISTS idx_participants_reg_id ON public.participants(registration_id);
CREATE INDEX IF NOT EXISTS idx_participants_created_at ON public.participants(created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies (Safe drop & re-create so you can run anytime):
DROP POLICY IF EXISTS "Allow public insert of registrations" ON public.participants;
CREATE POLICY "Allow public insert of registrations" 
ON public.participants FOR INSERT 
TO public 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read by registration or phone" ON public.participants;
CREATE POLICY "Allow public read by registration or phone" 
ON public.participants FOR SELECT 
TO public 
USING (true);

DROP POLICY IF EXISTS "Allow admin full access" ON public.participants;
CREATE POLICY "Allow admin full access" 
ON public.participants FOR ALL 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);

-- 5. Create Storage Buckets for Uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('qirath-videos', 'qirath-videos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('aadhaar-cards', 'aadhaar-cards', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('follow-proofs', 'follow-proofs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 6. Storage Security Policies (Safe drop & re-create)
DROP POLICY IF EXISTS "Allow public uploads to qirath-videos" ON storage.objects;
CREATE POLICY "Allow public uploads to qirath-videos" 
ON storage.objects FOR INSERT 
TO public 
WITH CHECK (bucket_id = 'qirath-videos');

DROP POLICY IF EXISTS "Allow public read of qirath-videos" ON storage.objects;
CREATE POLICY "Allow public read of qirath-videos" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'qirath-videos');

DROP POLICY IF EXISTS "Allow public uploads to aadhaar-cards" ON storage.objects;
CREATE POLICY "Allow public uploads to aadhaar-cards" 
ON storage.objects FOR INSERT 
TO public 
WITH CHECK (bucket_id = 'aadhaar-cards');

DROP POLICY IF EXISTS "Allow public read of aadhaar-cards" ON storage.objects;
CREATE POLICY "Allow public read of aadhaar-cards" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'aadhaar-cards');

DROP POLICY IF EXISTS "Allow public uploads to follow-proofs" ON storage.objects;
CREATE POLICY "Allow public uploads to follow-proofs" 
ON storage.objects FOR INSERT 
TO public 
WITH CHECK (bucket_id = 'follow-proofs');

DROP POLICY IF EXISTS "Allow public read of follow-proofs" ON storage.objects;
CREATE POLICY "Allow public read of follow-proofs" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'follow-proofs');

-- ====================================================================
-- SUCCESS: Schema and Storage Buckets setup is complete!
-- ====================================================================
