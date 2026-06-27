import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

import { query, executor, timestamp, number, isUuid, centreSelect } from './common.js';
import { mapCentre } from './mappers.js';

export async function listCentres() {
  const result = await query(`${centreSelect} order by c.created_at desc`);
  return result.rows.map(mapCentre);
}

export async function findCentreByCode(code, client) {
  const result = await executor(client).query(`${centreSelect} where c.centre_code = $1`, [code]);
  return mapCentre(result.rows[0]);
}

export async function findCentreById(id, client) {
  const result = await executor(client).query(`${centreSelect} where c.id = $1`, [id]);
  return mapCentre(result.rows[0]);
}

export async function findCentreForUser(user, client) {
  if (!user || user.role !== 'hub') return null;

  const result = await executor(client).query(
    `${centreSelect} where c.id = $1 or c.owner_id = $2 limit 1`,
    [user.centreId, user.id]
  );

  return mapCentre(result.rows[0]);
}

export async function createCentre(centre, client) {
  const pricing = centre.pricing || {};
  const result = await executor(client).query(
    `insert into print_hubs (
       id, owner_id, hub_name, centre_code, mobile, status, upi_id, upi_qr_image_url,
       bw_single, bw_double, color_single, color_double, watermark_charge, created_at
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, coalesce($14, now()))
     returning *`,
    [
      centre.id,
      centre.ownerId,
      centre.hubName || centre.name,
      centre.centreCode,
      centre.mobile,
      centre.status || 'available',
      centre.upiId || null,
      centre.upiQrImageUrl || null,
      pricing.bwSingle ?? centre.bwSingle ?? 1,
      pricing.bwDouble ?? centre.bwDouble ?? 1.5,
      pricing.colorSingle ?? centre.colorSingle ?? 2,
      pricing.colorDouble ?? centre.colorDouble ?? 3,
      pricing.watermarkCharge ?? centre.watermarkCharge ?? 2,
      centre.createdAt || null
    ]
  );

  return findCentreById(result.rows[0].id, client);
}

export async function updateCentrePricing(centreId, pricing) {
  const result = await query(
    `update print_hubs
     set
       bw_single = coalesce($2, bw_single),
       bw_double = coalesce($3, bw_double),
       color_single = coalesce($4, color_single),
       color_double = coalesce($5, color_double),
       watermark_charge = coalesce($6, watermark_charge)
     where id = $1
     returning id`,
    [
      centreId,
      pricing.bwSingle ?? null,
      pricing.bwDouble ?? null,
      pricing.colorSingle ?? null,
      pricing.colorDouble ?? null,
      pricing.watermarkCharge ?? null
    ]
  );

  if (!result.rows[0]) return null;
  return findCentreById(result.rows[0].id);
}

export async function updateCentrePaymentMethod(centreId, upiId) {
  const nextUpiId = typeof upiId === 'object' ? upiId.upiId : upiId;
  const nextQrImageUrl = typeof upiId === 'object' ? upiId.upiQrImageUrl : undefined;
  const result = await query(
    'update print_hubs set upi_id = coalesce($2, upi_id), upi_qr_image_url = coalesce($3, upi_qr_image_url) where id = $1 returning id',
    [centreId, nextUpiId, nextQrImageUrl]
  );

  if (!result.rows[0]) return null;
  return findCentreById(result.rows[0].id);
}

export async function updateCentreAfterOrderSettings(centreId, afterOrderSettings, client) {
  const result = await executor(client).query(
    `update print_hubs
     set after_order_settings = $2::jsonb
     where id = $1
     returning id`,
    [centreId, JSON.stringify(afterOrderSettings)]
  );
  if (!result.rows[0]) return null;
  return findCentreById(result.rows[0].id, client);
}

export async function updateHubLocation(centreId, fields) {
  const result = await query(
    `update print_hubs
     set
       location_enabled = $2,
       latitude = $3,
       longitude = $4,
       address_text = $5,
       area = $6,
       city = $7,
       map_updated_at = now()
     where id = $1
     returning id`,
    [
      centreId,
      Boolean(fields.locationEnabled),
      fields.latitude ?? null,
      fields.longitude ?? null,
      fields.addressText ?? null,
      fields.area ?? null,
      fields.city ?? null
    ]
  );

  return findCentreById(result.rows[0].id);
}

export async function updateCentreProfile(ownerId, updates, client) {
  const result = await executor(client).query(
    `update print_hubs
     set hub_name = coalesce($2, hub_name),
         centre_code = coalesce($3, centre_code)
     where owner_id = $1
     returning *`,
    [ownerId, updates.hubName, updates.centreCode]
  );
  return result.rows[0] ? mapCentre(result.rows[0]) : null;
}

export async function deleteCentreByOwner(ownerId, client) {
  await executor(client).query(
    `delete from print_hubs where owner_id = $1`,
    [ownerId]
  );
}
