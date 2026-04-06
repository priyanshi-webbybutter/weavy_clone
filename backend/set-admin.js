require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required');
  console.error('   Please add it to your backend/.env file');
  process.exit(1);
}

if (!supabaseUrl) {
  console.error('❌ SUPABASE_URL is required');
  process.exit(1);
}

const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

async function setAdmin(email) {
  console.log(`🔍 Looking for user: ${email}`);
  
  // Get user by email
  const { data: { users }, error: listError } = await adminSupabase.auth.admin.listUsers();
  
  if (listError) {
    console.error('❌ Error listing users:', listError);
    return;
  }

  const user = users.find(u => u.email === email);
  if (!user) {
    console.error(`❌ User not found: ${email}`);
    console.log('\nAvailable users:');
    users.forEach(u => console.log(`  - ${u.email} (${u.id})`));
    return;
  }

  console.log(`✅ Found user: ${user.email} (${user.id})`);
  console.log('📋 Current app_metadata:', JSON.stringify(user.app_metadata, null, 2));
  console.log('📋 Current user_metadata:', JSON.stringify(user.user_metadata, null, 2));

  // Update user metadata
  const { data, error } = await adminSupabase.auth.admin.updateUserById(
    user.id,
    {
      app_metadata: {
        ...(user.app_metadata || {}),
        role: 'admin'
      }
    }
  );

  if (error) {
    console.error('❌ Error updating user:', error);
    console.error('   Details:', error.message);
  } else {
    console.log('\n✅ User updated successfully!');
    console.log('📋 New app_metadata:', JSON.stringify(data.user.app_metadata, null, 2));
    console.log('\n🎉 User is now an admin. You can log in to the admin dashboard.');
  }
}

// Run: node backend/set-admin.js your-email@example.com
const email = process.argv[2];
if (!email) {
  console.error('❌ Usage: node set-admin.js <email>');
  console.error('   Example: node set-admin.js admin@example.com');
  process.exit(1);
}

setAdmin(email).catch(console.error);

