/**
 * ====================================================================
 * ALL KARNATAKA QIRATH COMPETITION - BACKEND SUPABASE CONNECTOR
 * Presented by Reid & Premium Groom Studio
 * ====================================================================
 * 
 * You can set your credentials here directly OR click "Supabase Settings"
 * in the Admin Dashboard to connect live without editing code!
 */

const SUPABASE_CONFIG = {
  // Put your Supabase project URL here (e.g. "https://xyzcompany.supabase.co")
  url: window.localStorage.getItem('AKQC_SUPABASE_URL') || "https://qoipskxlszsrukpduxle.supabase.co",

  // Put your Supabase public Anon Key here (from Project Settings -> API)
  anonKey: window.localStorage.getItem('AKQC_SUPABASE_ANON_KEY') || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvaXBza3hsc3pzcnVrcGR1eGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3MDAxMjQsImV4cCI6MjEwNzI3NjEyNH0.uO-rdd7QHqCds9-SB-K4aT_kInqu0F4FK1dBxQgAJLU",

  // Default admin PIN for accessing the management dashboard
  adminPin: window.localStorage.getItem('AKQC_ADMIN_PIN') || "RP26"
};

let supabaseClient = null;

// Initialize Supabase Client if credentials exist
function initSupabase() {
  const url = window.localStorage.getItem('AKQC_SUPABASE_URL') || SUPABASE_CONFIG.url;
  const key = window.localStorage.getItem('AKQC_SUPABASE_ANON_KEY') || SUPABASE_CONFIG.anonKey;

  if (url && key && window.supabase) {
    try {
      supabaseClient = window.supabase.createClient(url.trim(), key.trim());
      console.log('✅ Supabase connected successfully to:', url);
      return true;
    } catch (err) {
      console.error('❌ Supabase init error:', err);
      supabaseClient = null;
      return false;
    }
  }
  supabaseClient = null;
  return false;
}

// Call on load
if (typeof window !== 'undefined') {
  initSupabase();
}

/**
 * Check if real Supabase backend is configured and active
 */
function isSupabaseConfigured() {
  return !!supabaseClient;
}

/**
 * Save new Supabase Credentials and re-initialize
 */
function saveSupabaseCredentials(url, key, pin) {
  if (url) localStorage.setItem('AKQC_SUPABASE_URL', url.trim());
  if (key) localStorage.setItem('AKQC_SUPABASE_ANON_KEY', key.trim());
  if (pin) localStorage.setItem('AKQC_ADMIN_PIN', pin.trim());
  return initSupabase();
}

/**
 * Reset Supabase Credentials to Demo Mode
 */
function resetToDemoMode() {
  localStorage.removeItem('AKQC_SUPABASE_URL');
  localStorage.removeItem('AKQC_SUPABASE_ANON_KEY');
  supabaseClient = null;
}

/**
 * Upload a file to a Supabase Storage Bucket
 */
async function uploadToStorage(bucketName, file, folder = '') {
  if (!isSupabaseConfigured()) {
    // Demo mode: Return Object URL or simulated URL
    return URL.createObjectURL(file);
  }

  const fileExt = file.name.split('.').pop();
  const cleanName = file.name.replace(/[^a-zA-Z0-9]/g, '_');
  // Collision-free unique filename for 1000+ candidates
  const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const filePath = `${folder ? folder + '/' : ''}${uniqueId}_${cleanName}.${fileExt}`;

  const { data, error } = await supabaseClient.storage
    .from(bucketName)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    console.error(`Storage upload error in [${bucketName}]:`, error);
    throw new Error(`Failed to upload to ${bucketName}: ${error.message}`);
  }

  // Get Public URL
  const { data: urlData } = supabaseClient.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

/**
 * Get Master Template Poster URL and configuration
 */
async function getMasterPosterFromBackend() {
  const localUrl = localStorage.getItem('AKQC_MASTER_POSTER_URL') || '';
  const localConfig = localStorage.getItem('AKQC_MASTER_POSTER_CONFIG');
  let config = { cx: 50, cy: 44.5, radius: 20 };
  if (localConfig) {
    try { config = JSON.parse(localConfig); } catch(e) {}
  }

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabaseClient
        .from('app_settings')
        .select('*')
        .in('key', ['master_poster_url', 'master_poster_config']);

      if (!error && data && data.length > 0) {
        const urlRow = data.find(r => r.key === 'master_poster_url');
        const configRow = data.find(r => r.key === 'master_poster_config');
        if (urlRow && urlRow.value) {
          localStorage.setItem('AKQC_MASTER_POSTER_URL', urlRow.value);
          if (configRow && configRow.value) {
            localStorage.setItem('AKQC_MASTER_POSTER_CONFIG', configRow.value);
            try { config = JSON.parse(configRow.value); } catch(e) {}
          }
          return { url: urlRow.value, config };
        }
      }
    } catch(err) {
      console.warn('Could not read master poster from app_settings:', err);
    }
  }

  // Fallback to default bundled poster if none set
  const finalUrl = localUrl || 'assets/master_poster_default.jpg';
  return { url: finalUrl, config };
}

/**
 * Save Master Template Poster URL and configuration
 */
async function saveMasterPosterToBackend(url, config = { cx: 50, cy: 44.5, radius: 20 }) {
  localStorage.setItem('AKQC_MASTER_POSTER_URL', url || '');
  localStorage.setItem('AKQC_MASTER_POSTER_CONFIG', JSON.stringify(config));

  if (isSupabaseConfigured()) {
    try {
      const rows = [
        { key: 'master_poster_url', value: url || '', updated_at: new Date().toISOString() },
        { key: 'master_poster_config', value: JSON.stringify(config), updated_at: new Date().toISOString() }
      ];
      await supabaseClient.from('app_settings').upsert(rows);
    } catch(err) {
      console.warn('Could not upsert master poster to app_settings:', err);
    }
  }
  return true;
}

/**
 * Submit participant registration
 */
async function submitRegistrationToBackend(participantData) {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabaseClient
      .from('participants')
      .insert([participantData])
      .select();

    if (error) {
      console.error('Database insert error:', error);
      throw error;
    }
    return data[0];
  } else {
    // Demo Mode: Store in LocalStorage
    const localStore = getLocalParticipants();
    localStore.unshift(participantData);
    saveLocalParticipants(localStore);
    return participantData;
  }
}

/**
 * Fetch all participants for Admin (Configured for up to 5,000 participants)
 */
async function fetchParticipantsFromBackend(filters = {}) {
  if (isSupabaseConfigured()) {
    let query = supabaseClient
      .from('participants')
      .select('*')
      .order('created_at', { ascending: false })
      .range(0, 4999); // Ensures all 1000+ records are loaded without truncation

    if (filters.branch && filters.branch !== 'All') {
      query = query.eq('branch', filters.branch);
    }
    if (filters.status && filters.status !== 'All') {
      query = query.eq('status', filters.status);
    }
    if (filters.category && filters.category !== 'All') {
      query = query.eq('category', filters.category);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Database query error:', error);
      throw error;
    }
    return data || [];
  } else {
    // Demo Mode: read from LocalStorage
    let list = getLocalParticipants();
    if (filters.branch && filters.branch !== 'All') {
      list = list.filter(p => p.branch === filters.branch);
    }
    if (filters.status && filters.status !== 'All') {
      list = list.filter(p => p.status === filters.status);
    }
    if (filters.category && filters.category !== 'All') {
      list = list.filter(p => p.category === filters.category);
    }
    return list;
  }
}

/**
 * Update a participant status or score
 */
async function updateParticipantInBackend(registrationId, updates) {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabaseClient
      .from('participants')
      .update(updates)
      .eq('registration_id', registrationId)
      .select();

    if (error) throw error;
    return data[0];
  } else {
    const list = getLocalParticipants();
    const index = list.findIndex(p => p.registration_id === registrationId);
    if (index !== -1) {
      list[index] = { ...list[index], ...updates, updated_at: new Date().toISOString() };
      saveLocalParticipants(list);
      return list[index];
    }
    throw new Error('Participant not found');
  }
}

/**
 * Delete a participant from database
 */
async function deleteParticipantFromBackend(registrationId) {
  if (isSupabaseConfigured()) {
    const { error } = await supabaseClient
      .from('participants')
      .delete()
      .eq('registration_id', registrationId);

    if (error) {
      console.error('Database delete error:', error);
      throw error;
    }
    return true;
  } else {
    let list = getLocalParticipants();
    list = list.filter(p => p.registration_id !== registrationId);
    saveLocalParticipants(list);
    return true;
  }
}

/**
 * Safely delete an object from Supabase Storage
 */
async function deleteFromStorage(bucketName, pathOrUrl) {
  if (!isSupabaseConfigured() || !pathOrUrl) return;
  try {
    let path = pathOrUrl;
    if (path.includes(`/${bucketName}/`)) {
      path = path.split(`/${bucketName}/`)[1];
    }
    await supabaseClient.storage.from(bucketName).remove([path]);
  } catch (err) {
    console.warn(`Could not remove ${pathOrUrl} from ${bucketName}:`, err);
  }
}

/**
 * Track participant by Registration ID or Phone Number
 */
async function trackParticipantInBackend(searchVal) {
  const queryVal = searchVal.trim();
  if (isSupabaseConfigured()) {
    const { data, error } = await supabaseClient
      .from('participants')
      .select('*')
      .or(`registration_id.ilike.%${queryVal}%,phone.ilike.%${queryVal}%`)
      .limit(5);

    if (error) throw error;
    return data || [];
  } else {
    const list = getLocalParticipants();
    return list.filter(p => 
      p.registration_id.toLowerCase().includes(queryVal.toLowerCase()) || 
      p.phone.includes(queryVal)
    );
  }
}

// ====================================================================
// LOCAL STORAGE MOCK DATA (Runs seamlessly before user connects Supabase)
// ====================================================================
const LOCAL_STORAGE_KEY = 'AKQC_LOCAL_PARTICIPANTS';

function getLocalParticipants() {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) {
    const initialSamples = generateSampleParticipants();
    saveLocalParticipants(initialSamples);
    return initialSamples;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveLocalParticipants(list) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
}

function generateSampleParticipants() {
  return [
    {
      id: "demo-1",
      registration_id: "AKQC-2026-1042",
      full_name: "Mohammed Zayan",
      age: 14,
      category: "Senior (13 - 18 yrs)",
      phone: "+91 9845123456",
      whatsapp: "+91 9845123456",
      address: "Bolia House, Darbe",
      district: "Puttur, Dakshina Kannada",
      branch: "Puttur",
      surah_recited: "Surah Al-Mulk (Ayah 1-15)",
      maqam_style: "Bayati",
      aadhaar_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop",
      video_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      ig_screenshot_url: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop",
      wa_screenshot_url: "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?w=500&auto=format&fit=crop",
      status: "Shortlisted",
      judge_score: 94.5,
      judge_notes: "Flawless Tajweed and beautiful Waqf control. Highly recommended for finale.",
      created_at: new Date(Date.now() - 3600000 * 24).toISOString()
    },
    {
      id: "demo-2",
      registration_id: "AKQC-2026-1088",
      full_name: "Abdul Raheem K.",
      age: 11,
      category: "Junior (5 - 12 yrs)",
      phone: "+91 8762345678",
      whatsapp: "+91 8762345678",
      address: "Near Juma Masjid, Ullal",
      district: "Thokkotu, Mangalore",
      branch: "Thokkotu",
      surah_recited: "Surah Ar-Rahman (Ayah 1-25)",
      maqam_style: "Hijaz",
      aadhaar_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop",
      video_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
      ig_screenshot_url: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop",
      wa_screenshot_url: "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?w=500&auto=format&fit=crop",
      status: "Approved",
      judge_score: 88.0,
      judge_notes: "Clear pronunciation, impressive breath control for junior category.",
      created_at: new Date(Date.now() - 3600000 * 12).toISOString()
    },
    {
      id: "demo-3",
      registration_id: "AKQC-2026-1120",
      full_name: "Hamza Farooq",
      age: 22,
      category: "Open (19+ yrs)",
      phone: "+91 9481239876",
      whatsapp: "+91 9481239876",
      address: "Main Road, Kaikamba",
      district: "B.C Road, Bantwal",
      branch: "B.C Road",
      surah_recited: "Surah Maryam (Ayah 1-20)",
      maqam_style: "Nahawand",
      aadhaar_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop",
      video_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
      ig_screenshot_url: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop",
      wa_screenshot_url: "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?w=500&auto=format&fit=crop",
      status: "Pending Review",
      judge_score: 0,
      judge_notes: "",
      created_at: new Date(Date.now() - 3600000 * 4).toISOString()
    },
    {
      id: "demo-4",
      registration_id: "AKQC-2026-1154",
      full_name: "Zuhair Ahmed",
      age: 16,
      category: "Senior (13 - 18 yrs)",
      phone: "+91 9901456789",
      whatsapp: "+91 9901456789",
      address: "Gandhinagar",
      district: "Sullia, Dakshina Kannada",
      branch: "Sullia",
      surah_recited: "Surah Al-Qiyamat",
      maqam_style: "Rast",
      aadhaar_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop",
      video_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",
      ig_screenshot_url: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop",
      wa_screenshot_url: "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?w=500&auto=format&fit=crop",
      status: "Approved",
      judge_score: 85.0,
      judge_notes: "Strong voice projection, verified following proofs.",
      created_at: new Date(Date.now() - 3600000 * 2).toISOString()
    }
  ];
}

/**
 * Global HTML Escaping Utility
 */
function escapeHtml(str) {
  return (str || '').replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
