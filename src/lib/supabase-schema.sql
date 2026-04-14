-- Users profile table (extends Supabase auth)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  betfair_connected BOOLEAN DEFAULT false,
  betfair_session_token TEXT,
  subscription_status TEXT DEFAULT 'inactive',
  subscription_tier TEXT,
  stripe_customer_id TEXT,
  default_stake NUMERIC DEFAULT 25,
  max_exposure NUMERIC DEFAULT 500,
  stop_loss NUMERIC DEFAULT 50,
  auto_green_up_target NUMERIC DEFAULT 0,
  ai_guardian_enabled BOOLEAN DEFAULT true,
  ai_signals_enabled BOOLEAN DEFAULT true,
  daily_loss_limit NUMERIC DEFAULT 100,
  max_single_trade NUMERIC DEFAULT 100,
  shadow_mode BOOLEAN DEFAULT true,
  streak_protection_enabled BOOLEAN DEFAULT true,
  streak_threshold INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ALTER TABLE profiles ADD COLUMN shadow_mode BOOLEAN DEFAULT true;
-- ALTER TABLE profiles ADD COLUMN streak_protection_enabled BOOLEAN DEFAULT true;
-- ALTER TABLE profiles ADD COLUMN streak_threshold INTEGER DEFAULT 3;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Trades table
CREATE TABLE trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  market_id TEXT,
  selection_id TEXT,
  player TEXT,
  side TEXT,
  entry_price NUMERIC,
  exit_price NUMERIC,
  stake NUMERIC,
  pnl NUMERIC,
  status TEXT DEFAULT 'open',
  greened_up BOOLEAN DEFAULT false,
  is_shadow BOOLEAN DEFAULT false,
  ai_signal_used BOOLEAN DEFAULT false,
  notes TEXT,
  coach_insight TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- ALTER TABLE trades ADD COLUMN coach_insight TEXT;

-- Briefings table (cached pre-match AI briefings)
CREATE TABLE briefings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  market_id TEXT NOT NULL,
  player1 TEXT,
  player2 TEXT,
  tournament TEXT,
  surface TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trading DNA table (cached AI pattern analysis)
CREATE TABLE trading_dna (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  dna_data JSONB NOT NULL,
  trade_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- App config (vendor session, etc.)
CREATE TABLE app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_config (key, value) VALUES ('vendor_session', '6gI2QVT80KvjC84XfTu4DlrbZyCaIBXKAOc3Cs8yIYs=')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- RLS policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_dna ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users read own trades" ON trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own trades" ON trades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own trades" ON trades FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users read own briefings" ON briefings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own briefings" ON briefings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own trading_dna" ON trading_dna FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own trading_dna" ON trading_dna FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read app_config" ON app_config FOR SELECT USING (true);
CREATE POLICY "Allow public update app_config" ON app_config FOR UPDATE USING (true);
CREATE POLICY "Allow public insert app_config" ON app_config FOR INSERT WITH CHECK (true);
