// Adversarial tests against the real authorization SQL in a disposable local
// PostgreSQL cluster. Never uses production credentials, storage or documents.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const bin = process.env.PE_TEST_PG_BIN || '/usr/lib/postgresql/16/bin';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'printease-access-pg-'));
const data = path.join(temp, 'data');
const cwd = process.cwd();
const run = (name, args) => execFileSync(path.join(bin, name), args, { stdio: 'pipe' });
const ids = Array.from({ length: 8 }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
let started = false, pool, client;

(async () => {
  try {
    run('initdb', ['-D', data, '-A', 'trust', '--no-locale']);
    run('pg_ctl', ['-D', data, '-l', path.join(temp, 'postgres.log'), '-o', `-k ${temp} -p 55432 -c listen_addresses=''`, '-w', 'start']);
    started = true;
    // dotenv resolves against this empty temporary cwd, not the real repo.
    process.chdir(temp);
    Object.assign(process.env, { DATABASE_URL: '', PGHOST: temp, PGPORT: '55432', PGDATABASE: 'postgres', PGUSER: os.userInfo().username, PGPASSWORD: '', DB_SSL: 'false', PGSSLMODE: 'disable' });
    ({ pool } = await import(pathToFileURL(path.join(__dirname, '../src/config/db.js')).href));
    const { findDocumentAccessContext } = await import(pathToFileURL(path.join(__dirname, '../src/db/repositories/documentRepository.js')).href);
    client = await pool.connect();
    const [owner, stranger, hub, otherHub, order, doc, file, otherOrder] = ids;
    for (const type of ['text', 'uuid']) {
      await client.query(`create schema access_${type}; set search_path to access_${type};
        create table print_orders(id ${type}, user_id ${type}, hub_id ${type}, order_code text, guest_token text, guest_token_hash text, expires_at timestamptz);
        create table documents(id ${type}, file_name text, file_type text, file_size integer, file_size_bytes bigint, file_url text, file_sha256 text, storage_path text,
          print_ready_storage_path text, print_ready_sha256 text, prepared_page_count integer, preparation_status text, page_count integer, created_at timestamptz default now());
        create table print_order_files(id ${type}, order_id ${type}, document_id ${type}, created_at timestamptz default now());`);
      await client.query("insert into documents(id, file_name, storage_path) values ($1, 'fixture.pdf', 'private-fixture.pdf')", [doc]);
      await client.query("insert into print_orders(id,user_id,hub_id,order_code) values ($1,$2,$3,'OWN'),($4,$5,$6,'OTHER')", [order, owner, hub, otherOrder, stranger, otherHub]);
      await client.query("insert into print_order_files(id,order_id,document_id,created_at) values ($1,$2,$3,now()-interval '1 hour'),($4,$5,$3,now())", [file, order, doc, crypto.randomUUID(), otherOrder]);

      const access = (user, token) => findDocumentAccessContext(doc, user, token, client);
      assert.equal(await access(null, null), null, 'anonymous access must fail');
      assert.equal(await access({ id: crypto.randomUUID(), role: 'user' }, null), null, 'foreign account must fail');
      assert.equal(await access({ role: 'hub', centreId: crypto.randomUUID() }, null), null, 'foreign hub must fail');
      assert.equal((await access({ id: owner, role: 'user' }, null)).orderId, order);
      assert.equal((await access({ role: 'hub', centreId: hub }, null)).orderId, order, 'a newer foreign order must not shadow the authorized one');

      const token = 'local-random-capability';
      const hash = crypto.createHash('sha256').update(token).digest('hex');
      await client.query("update print_orders set user_id=null, guest_token_hash=$2, expires_at=now()+interval '1 hour' where id=$1", [order, hash]);
      assert.equal(await access(null, 'wrong-capability'), null);
      assert.equal((await access(null, token)).allowed, true);
      await client.query("update print_orders set expires_at=now()-interval '1 second' where id=$1", [order]);
      assert.equal(await access(null, token), null, 'expired document capability must fail');
      assert.equal((await access({ role: 'hub', centreId: hub }, null)).allowed, true, 'owner hub retains authorized support access');
    }
    console.log('Actual document authorization SQL passed on text + UUID fixtures: anonymous/foreign account/foreign hub/wrong token/expired token denied; owner and hub access preserved.');
  } finally {
    client?.release();
    await pool?.end();
    process.chdir(cwd);
    if (started) run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
