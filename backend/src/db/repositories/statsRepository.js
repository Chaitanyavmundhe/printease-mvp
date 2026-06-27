import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

import { query, executor, timestamp, number, isUuid, centreSelect } from './common.js';

export async function upsertPlatformVisit(sessionId, isPageView, client) {
  const pageViewIncrement = isPageView ? 1 : 0;
  
  await executor(client).query(
    `insert into platform_visits (session_id, created_at, last_active_at, page_views)
     values ($1, now(), now(), $2)
     on conflict (session_id) do update 
     set last_active_at = now(),
         page_views = platform_visits.page_views + $2`,
    [sessionId, pageViewIncrement]
  );
}

export async function getGlobalPlatformStats(client) {
  // Total orders, pages, revenue
  const ordersResult = await executor(client).query(
    `select 
       count(id) as total_orders,
       sum(pages * copies) as total_pages,
       sum(amount) as total_revenue
     from print_orders 
     where status in ('printed', 'completed')`
  );

  // Total print hubs (printers)
  const hubsResult = await executor(client).query(
    `select count(id) as total_printers from print_hubs`
  );

  // Visits and live users
  const visitsResult = await executor(client).query(
    `select 
       count(*) as total_visits,
       sum(coalesce(page_views, 1)) as total_page_views,
       sum(extract(epoch from (last_active_at - created_at))) as total_seconds_spent,
       count(case when last_active_at > now() - interval '5 minutes' then 1 end) as live_users,
       count(case when created_at >= date_trunc('day', now()) then 1 end) as visits_today,
       count(case when created_at >= date_trunc('month', now()) then 1 end) as visits_this_month
     from platform_visits`
  );

  // Registered Users
  const usersResult = await executor(client).query(
    `select count(id) as total_users from users`
  );

  const orders = ordersResult.rows[0];
  const hubs = hubsResult.rows[0];
  const visits = visitsResult.rows[0];
  const users = usersResult.rows[0];

  return {
    totalOrders: parseInt(orders.total_orders || 0, 10),
    totalPages: parseInt(orders.total_pages || 0, 10),
    totalRevenue: parseFloat(orders.total_revenue || 0),
    totalPrinters: parseInt(hubs.total_printers || 0, 10),
    totalVisits: parseInt(visits.total_visits || 0, 10),
    totalPageViews: parseInt(visits.total_page_views || 0, 10),
    totalSecondsSpent: parseInt(visits.total_seconds_spent || 0, 10),
    liveUsers: parseInt(visits.live_users || 0, 10),
    visitsToday: parseInt(visits.visits_today || 0, 10),
    visitsThisMonth: parseInt(visits.visits_this_month || 0, 10),
    registeredUsers: parseInt(users.total_users || 0, 10)
  };
}
