import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

import { query, executor, timestamp, number, isUuid, centreSelect } from './common.js';
import { mapOrder, mapPayment } from './mappers.js';

export async function updateOrderPayment(orderId, paymentStatus, status, client) {
  const result = await executor(client).query(
    'update print_orders set payment_status = $2, status = $3 where id = $1 returning *, hub_id as centre_id',
    [orderId, paymentStatus, status]
  );
  return mapOrder(result.rows[0]);
}

export async function createPayment(payment, client) {
  const result = await executor(client).query(
    `insert into payments (
       id, order_id, amount, method, transaction_id, status, created_at, verified_at,
       provider, provider_order_id, provider_payment_id, provider_signature,
       provider_status, provider_payload, payment_link_id, qr_code_id, qr_image_url, short_url
     )
     values (
       $1, $2, $3, $4, $5, $6, coalesce($7, now()), $8,
       $9, $10, $11, $12,
       $13, coalesce($14::jsonb, '{}'::jsonb), $15, $16, $17, $18
     )
     returning *`,
    [
      payment.id,
      payment.orderId,
      payment.amount,
      payment.method || payment.gateway || 'RAZORPAY',
      payment.transactionId || payment.gatewayPaymentId || payment.gatewayOrderId || null,
      payment.status,
      payment.createdAt || null,
      payment.verifiedAt || null,
      payment.provider || null,
      payment.providerOrderId || payment.gatewayOrderId || null,
      payment.providerPaymentId || payment.gatewayPaymentId || null,
      payment.providerSignature || null,
      payment.providerStatus || null,
      payment.providerPayload ? JSON.stringify(payment.providerPayload) : null,
      payment.paymentLinkId || null,
      payment.qrCodeId || null,
      payment.qrImageUrl || null,
      payment.shortUrl || null
    ]
  );

  return mapPayment(result.rows[0]);
}

export async function findPaymentById(id, client) {
  const result = await executor(client).query('select * from payments where id = $1', [id]);
  return mapPayment(result.rows[0]);
}

export async function findPaymentByProviderOrderId(providerOrderId, client) {
  const result = await executor(client).query(
    'select * from payments where provider_order_id = $1 order by created_at desc limit 1',
    [providerOrderId]
  );
  return mapPayment(result.rows[0]);
}

export async function findPaymentByProviderPaymentId(providerPaymentId, client) {
  const result = await executor(client).query(
    'select * from payments where provider_payment_id = $1 order by created_at desc limit 1',
    [providerPaymentId]
  );
  return mapPayment(result.rows[0]);
}

export async function updatePayment(paymentId, updates, client) {
  const result = await executor(client).query(
    `update payments
     set
       transaction_id = coalesce($2, transaction_id),
       status = coalesce($3, status),
       verified_at = coalesce($4, verified_at),
       provider_payment_id = coalesce($5, provider_payment_id),
       provider_signature = coalesce($6, provider_signature),
       provider_status = coalesce($7, provider_status),
       provider_payload = case
         when $8::jsonb is null then provider_payload
         else provider_payload || $8::jsonb
       end,
       payment_link_id = coalesce($9, payment_link_id),
       qr_code_id = coalesce($10, qr_code_id),
       qr_image_url = coalesce($11, qr_image_url),
       short_url = coalesce($12, short_url)
     where id = $1
     returning *`,
    [
      paymentId,
      updates.transactionId || updates.gatewayPaymentId || updates.providerPaymentId || null,
      updates.status || null,
      updates.verifiedAt || null,
      updates.providerPaymentId || updates.gatewayPaymentId || null,
      updates.providerSignature || null,
      updates.providerStatus || null,
      updates.providerPayload ? JSON.stringify(updates.providerPayload) : null,
      updates.paymentLinkId || null,
      updates.qrCodeId || null,
      updates.qrImageUrl || null,
      updates.shortUrl || null
    ]
  );

  return mapPayment(result.rows[0]);
}
