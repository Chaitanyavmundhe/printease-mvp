import { sha256Buffer } from '../utils/agentCrypto.js';

function requireSupabaseConfig() {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_BUCKET = 'documents' } = process.env;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    const error = new Error('Document storage is not configured. Set SUPABASE_URL, SUPABASE_SERVICE_KEY, and SUPABASE_BUCKET.');
    error.statusCode = 503;
    throw error;
  }

  return {
    supabaseUrl: SUPABASE_URL.replace(/\/+$/, ''),
    serviceKey: SUPABASE_SERVICE_KEY,
    bucket: SUPABASE_BUCKET
  };
}

export async function uploadDocumentToStorage({ file, documentId }) {
  const { supabaseUrl, serviceKey, bucket } = requireSupabaseConfig();
  const safeName = file.originalname.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'document';
  const storagePath = `${documentId}/${Date.now()}-${safeName}`;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${storagePath}`;
  const fileSha256 = sha256Buffer(file.buffer);

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': file.mimetype,
      'x-upsert': 'false'
    },
    body: file.buffer
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const error = new Error(`Supabase upload failed: ${detail || response.status}`);
    error.statusCode = 502;
    throw error;
  }

  return {
    fileUrl: `${supabaseUrl}/storage/v1/object/public/${bucket}/${storagePath}`,
    fileSha256,
    storagePath
  };
}
