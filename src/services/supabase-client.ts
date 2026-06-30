import {createClient} from "@supabase/supabase-js";

const VITE_SUPABASE_PROJECT_URL= import.meta.env.VITE_SUPABASE_PROJECT_URL;
const VITE_SUPABASE_API_KEY = import.meta.env.VITE_SUPABASE_API_KEY;

export const supabase = createClient(
    VITE_SUPABASE_PROJECT_URL,
    VITE_SUPABASE_API_KEY 
);