insert into users (id, name, mobile, password_hash, role, created_at)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'Demo User',
    '9876543210',
    '$2a$10$WuyGh8Q7VdHCSDdcDhZo5uVifiLmIBy2zh5t6ynxmmI1SaqGvgbZO',
    'user',
    now()
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'Sai Owner',
    '9998887776',
    '$2a$10$WuyGh8Q7VdHCSDdcDhZo5uVifiLmIBy2zh5t6ynxmmI1SaqGvgbZO',
    'hub',
    now()
  )
on conflict (id) do update set
  name = excluded.name,
  mobile = excluded.mobile,
  password_hash = excluded.password_hash,
  role = excluded.role;

insert into print_hubs (
  id,
  owner_id,
  hub_name,
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
    '33333333-3333-4333-8333-333333333333',
    '22222222-2222-4222-8222-222222222222',
    'Sai Printing Hub',
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
    '44444444-4444-4444-8444-444444444444',
    null,
    'College Xerox Centre',
    '7832',
    '8887776665',
    'busy',
    'collegeprint@upi',
    1,
    1.5,
    2,
    3,
    2,
    now()
  )
on conflict (id) do update set
  owner_id = excluded.owner_id,
  hub_name = excluded.hub_name,
  centre_code = excluded.centre_code,
  mobile = excluded.mobile,
  status = excluded.status,
  upi_id = excluded.upi_id,
  bw_single = excluded.bw_single,
  bw_double = excluded.bw_double,
  color_single = excluded.color_single,
  color_double = excluded.color_double,
  watermark_charge = excluded.watermark_charge;

insert into printers (
  id,
  hub_id,
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
  '55555555-5555-4555-8555-555555555555',
  '33333333-3333-4333-8333-333333333333',
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
  hub_id = excluded.hub_id,
  printer_name = excluded.printer_name,
  printer_type = excluded.printer_type,
  protocol = excluded.protocol,
  ip_address = excluded.ip_address,
  port = excluded.port,
  status = excluded.status,
  is_active = excluded.is_active;

insert into print_orders (
  id,
  order_code,
  user_id,
  hub_id,
  document_name,
  document_url,
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
  '66666666-6666-4666-8666-666666666666',
  'PRN-2045-8932',
  '11111111-1111-4111-8111-111111111111',
  '33333333-3333-4333-8333-333333333333',
  'Assignment.pdf',
  null,
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
  hub_id = excluded.hub_id,
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
