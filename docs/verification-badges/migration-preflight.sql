-- Read-only preflight for an independently verified, pre-badge schema.
-- Aggregate counts only; no customer names, emails, or transaction references.
-- Inspect the actual live schema and obtain deployment/migration approval separately.
BEGIN READ ONLY;
SELECT current_database() AS database_name, current_schema() AS schema_name;
SELECT status, "planCode", count(*) AS subscription_count
FROM "SellerSubscription"
GROUP BY status, "planCode"
ORDER BY status, "planCode";
SELECT
  count(*) FILTER (WHERE "sellerId" IS NULL) AS missing_legacy_seller_owner,
  count(*) FILTER (WHERE "startsAt" IS NULL OR "currentPeriodEnd" IS NULL) AS incomplete_period,
  count(*) FILTER (WHERE "startsAt" >= "currentPeriodEnd") AS invalid_period,
  count(*) FILTER (WHERE status IN ('ACTIVE', 'CANCELLED') AND "currentPeriodEnd" <= now()) AS ended_status_not_expired,
  count(*) FILTER (WHERE "startsAt" > now()) AS future_start
FROM "SellerSubscription";
-- ACTIVE status is not proof of a subscription payment. No backfill is authorized.
COMMIT;
