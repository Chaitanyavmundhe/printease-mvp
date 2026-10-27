// Disposable PostgreSQL only. Never reads DATABASE_URL or connects to Supabase.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const bin = process.env.PE_TEST_PG_BIN || '/usr/lib/postgresql/16/bin';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'printease-status-pg-'));
const data = path.join(temp, 'data');
const run = (name, args) => execFileSync(path.join(bin, name), args, { stdio: 'pipe' });
let started = false;
let client;

(async () => {
  try {
    run('initdb', ['-D', data, '-A', 'trust', '--no-locale']);
    run('pg_ctl', ['-D', data, '-l', path.join(temp, 'postgres.log'), '-o', `-k ${temp} -p 55432 -c listen_addresses=''`, '-w', 'start']);
    started = true;
    client = new Client({ host: temp, port: 55432, database: 'postgres', user: os.userInfo().username, ssl: false });
    await client.connect();
    const migration = fs.readFileSync(path.join(__dirname, '../src/db/migrations/20261027_align_runtime_status_constraints.sql'), 'utf8');
    for (const idType of ['text', 'uuid']) {
      await client.query(`create schema fixture_${idType}; set search_path to fixture_${idType};
        create table print_orders(id ${idType} default gen_random_uuid(), payment_status text);
        create table agents(id ${idType} default gen_random_uuid(), status text);
        create table agent_pairing_sessions(id ${idType} default gen_random_uuid(), status text);
        insert into agents(status) values ('legacy_unknown');`);
      await client.query('begin');
      await client.query(migration);
      await client.query('commit');
      // Running twice is safe, including when a historical row needs auditing.
      await client.query(migration);
      for (const [table, column, values] of [
        ['print_orders', 'payment_status', ['not_requested', 'requested', 'collected', 'verified']],
        ['agents', 'status', ['online', 'paused', 'offline', 'active']],
        ['agent_pairing_sessions', 'status', ['claimed', 'confirmed', 'expired']],
      ]) {
        for (const value of values) await client.query(`insert into ${table}(${column}) values ($1)`, [value]);
        await assert.rejects(client.query(`insert into ${table}(${column}) values ($1)`, ['attacker_invalid_status']), { code: '23514' });
      }
      const legacy = await client.query("select status from agents where status = 'legacy_unknown'");
      assert.equal(legacy.rows.length, 1, 'migration must not silently rewrite historical rows');
    }
    console.log('Status migration passed on disposable PostgreSQL: text + UUID IDs, idempotency, canonical writes, invalid writes rejected, historical rows preserved.');
  } finally {
    await client?.end().catch(() => {});
    if (started) run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
