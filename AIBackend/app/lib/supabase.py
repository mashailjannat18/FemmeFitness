from supabase import create_client, Client

# Initialize Supabase client
SUPABASE_URL = "https://oqrdyazxwbpmemnablfk.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xcmR5YXp4d2JwbWVtbmFibGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQzNjkyNTcsImV4cCI6MjA0OTk0NTI1N30.nXtUdxnIqQXUhY-W06h5TO2B6CXi0sBsD6Rj_f9ojnQ"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
