const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.join(__dirname, '..', '.env.local');
let supabaseUrl = '';
let supabaseAnonKey = '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)/);
  const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(.*)/);
  if (urlMatch) supabaseUrl = urlMatch[1].trim().replace(/['"]/g, '');
  if (keyMatch) supabaseAnonKey = keyMatch[1].trim().replace(/['"]/g, '');
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing env vars in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'nonexistent@user.com',
    password: 'WrongPassword123!'
  });
  console.log("Data:", data);
  console.log("Error:", error);
  if (error) {
    console.log("Error Stringified:", JSON.stringify(error, null, 2));
    console.log("Error Message:", error.message);
    console.log("Error Status:", error.status);
    console.log("Error Code:", error.code);
  }
}

run();
