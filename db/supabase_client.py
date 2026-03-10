import os
from dotenv import load_dotenv
# Load environment variables from .env file
load_dotenv()

# Initializes the Supabase client connection using URL and key from environment.
# Raises ValueError clearly if credentials are missing so misconfiguration is
# never silently hidden. Returns None if the SDK itself cannot be imported
# (e.g. build failures on Python 3.14 / ARM).
def init_supabase():
    try:
        from supabase import create_client
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_KEY")

        if not supabase_url or not supabase_key:
            raise ValueError(
                "SUPABASE_URL and SUPABASE_KEY must both be set in the .env file."
            )

        return create_client(supabase_url, supabase_key)

    except ImportError:
        # Supabase SDK could not be compiled/installed in this environment.
        # Return None so callers can degrade gracefully instead of crashing.
        return None

    except ValueError as e:
        # Configuration error — surface this prominently so it is not confused
        # with a generic runtime failure.
        print(f"[CONFIG ERROR] Supabase misconfiguration: {e}")
        raise

    except Exception as e:
        # Unexpected SDK-level error (network issue during client init, etc.)
        # TODO: Replace print with structured logger once logging is set up.
        print(f"[ERROR] Failed to initialize Supabase client: {e}")
        raise

# Make supabase accessible via db.supabase_client.supabase
supabase = init_supabase()
