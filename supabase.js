const SUPABASE_URL = "https://uatbsgnqgpklugtwqbjh.supabase.co";

const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhdGJzZ25xZ3BrbHVndHdxYmpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzUwNzgsImV4cCI6MjA4ODc1MTA3OH0.XIu4V2xSDswqwJX2rNNxYynhacTVCmv3iS1pOIFFn3Q";

const supabaseClient = supabase.createClient(
SUPABASE_URL,
SUPABASE_KEY
);