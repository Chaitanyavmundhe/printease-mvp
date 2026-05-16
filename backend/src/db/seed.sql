insert into users (id, name, mobile, password_hash, role, centre_id, created_at)
values
  (
    'user-1',
    'Demo User',
    '9876543210',
    '$2a$10$WuyGh8Q7VdHCSDdcDhZo5uVifiLmIBy2zh5t6ynxmmI1SaqGvgbZO',
    'user',
    null,
    now()
  ),
  (
    'hub-owner-1',
    'Sai Owner',
    '9998887776',
    '$2a$10$WuyGh8Q7VdHCSDdcDhZo5uVifiLmIBy2zh5t6ynxmmI1SaqGvgbZO',
    'centre',
    null,
    now()
  )
on conflict (id) do update set
  name = excluded.name,
  mobile = excluded.mobile,
  password_hash = excluded.password_hash,
  role = excluded.role;

insert into centres (
  id,
  name,
  owner_id,
  centre_code,
  mobile,
  status,
  upi_id,
  bw_single,
  bw_double,
  color_single,
  color_double,
  watermark_charge,
  created_at
)
values
  (
    'centre-1',
    'Sai Printing Hub',
    'hub-owner-1',
    '2045',
    '9998887776',
    'available',
    'saiprint@upi',
    1,
    1.5,
    2,
    3,
    2,
    now()
  ),
  (
    'centre-2',
    'College Xerox Centre',
    null,
    '7832',
    '8887776665',
    'busy',
    'collegeprint@upi',
    1,
    1.5,
    3,
    4,
    2,
    now()
  )
on conflict (id) do update set
  name = excluded.name,
  owner_id = excluded.owner_id,
  centre_code = excluded.centre_code,
  mobile = excluded.mobile,
  status = excluded.status,
  upi_id = excluded.upi_id,
  bw_single = excluded.bw_single,
  bw_double = excluded.bw_double,
  color_single = excluded.color_single,
  color_double = excluded.color_double,
  watermark_charge = excluded.watermark_charge;

update users
set centre_id = 'centre-1'
where id = 'hub-owner-1';

insert into printers (
  id,
  centre_id,
  printer_name,
  printer_type,
  protocol,
  ip_address,
  port,
  status,
  is_active,
  created_at
)
values (
  'printer-1',
  'centre-1',
  'Main HP Laser Printer',
  'laser',
  'PDF_MANUAL_DOWNLOAD',
  '',
  null,
  'online',
  true,
  now()
)
on conflict (id) do update set
  centre_id = excluded.centre_id,
  printer_name = excluded.printer_name,
  printer_type = excluded.printer_type,
  protocol = excluded.protocol,
  ip_address = excluded.ip_address,
  port = excluded.port,
  status = excluded.status,
  is_active = excluded.is_active;

insert into orders (
  id,
  order_code,
  user_id,
  centre_id,
  document_id,
  document_name,
  pages,
  copies,
  color_type,
  side_type,
  watermark_enabled,
  amount,
  payment_status,
  status,
  pickup_code,
  created_at
)
values (
  'order-1',
  'PRN-2045-8932',
  'user-1',
  'centre-1',
  null,
  'Assignment.pdf',
  12,
  1,
  'color',
  'single',
  false,
  24,
  'verified',
  'Ready for Pickup',
  '8932',
  now()
)
on conflict (id) do update set
  order_code = excluded.order_code,
  user_id = excluded.user_id,
  centre_id = excluded.centre_id,
  document_name = excluded.document_name,
  pages = excluded.pages,
  copies = excluded.copies,
  color_type = excluded.color_type,
  side_type = excluded.side_type,
  watermark_enabled = excluded.watermark_enabled,
  amount = excluded.amount,
  payment_status = excluded.payment_status,
  status = excluded.status,
  pickup_code = excluded.pickup_code;
