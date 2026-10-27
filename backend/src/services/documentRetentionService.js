import { withTransaction } from '../config/db.js';
import { getSupabaseAdminClient, getSupabaseBucketName } from '../config/supabase.js';

// Retention includes the converted PDF as well as the uploaded original. Keep
// batches small and serialize scheduled/manual callers so cleanup cannot race
// itself. A storage error leaves DB rows intact for the next retry.
export async function removeExpiredDocuments() {
  return withTransaction(async client => {
    const lock = await client.query('select pg_try_advisory_xact_lock(178423, 2) as acquired');
    if (!lock.rows[0]?.acquired) return { success: true, deletedCount: 0, skipped: true };

    const { rows } = await client.query(`
      select d.id, d.storage_path, d.print_ready_storage_path
      from documents d
      where d.created_at < now() - interval '15 days'
        and not exists (
          select 1 from print_order_files f join print_jobs j on j.order_id = f.order_id
          where f.document_id = d.id
            and j.status in ('queued', 'assigned', 'accepted', 'downloading', 'printing', 'submitted_to_printer')
        )
      order by d.created_at, d.id
      limit 100
      for update of d skip locked
    `);
    if (!rows.length) return { success: true, deletedCount: 0 };

    const paths = [...new Set(rows.flatMap(doc => [doc.storage_path, doc.print_ready_storage_path]).filter(Boolean))];
    if (paths.length) {
      const { error } = await getSupabaseAdminClient().storage.from(getSupabaseBucketName()).remove(paths);
      if (error) throw new Error('Document storage cleanup failed.');
    }

    // Production has both UUID and text ID schemas. Compare their text forms,
    // rather than forcing a UUID array and failing after storage was deleted.
    const ids = rows.map(doc => String(doc.id));
    await client.query('delete from print_job_files where document_id::text = any($1::text[])', [ids]);
    await client.query('delete from print_order_files where document_id::text = any($1::text[])', [ids]);
    await client.query('delete from documents where id::text = any($1::text[])', [ids]);
    return { success: true, deletedCount: rows.length };
  });
}
