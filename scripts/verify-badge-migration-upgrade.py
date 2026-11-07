#!/usr/bin/env python3
"""Verify the additive badge migration on a pre-badge, disposable schema only.

Requires an already-created empty local database named eazicart_badge_upgrade_test.
Does not connect to a payment provider or use the application's DATABASE_URL.
"""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
from urllib.parse import urlparse

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--database-url", required=True)
parser.add_argument("--psql", default=shutil.which("psql"))
args = parser.parse_args()
url = urlparse(args.database_url)
if (
    url.scheme not in ("postgres", "postgresql")
    or url.hostname not in ("localhost", "127.0.0.1")
    or not url.port
    or url.port == 5432
    or url.path != "/eazicart_badge_upgrade_test"
    or url.password
    or url.query
    or url.fragment
):
    parser.error("Use only a password-free, explicit non-production loopback port and eazicart_badge_upgrade_test")
if not args.psql or not Path(args.psql).is_file():
    parser.error("Provide an installed PostgreSQL psql executable using --psql")


def sql(statement):
    result = subprocess.run(
        [args.psql, "-X", "--no-password", args.database_url, "-v", "ON_ERROR_STOP=1", "-At"],
        input=statement, text=True, capture_output=True,
    )
    if result.returncode:
        raise RuntimeError("Disposable migration assertion failed: " + result.stderr)
    return result.stdout.strip()


data_directory = sql("SHOW data_directory;")
if not (
    data_directory == "/workspace/verification-db"
    or data_directory.startswith("/tmp/pg_virtualenv.")
    or data_directory.startswith("/tmp/eazicart-badge-")
):
    parser.error("The server must use an explicitly disposable PostgreSQL data directory")

if sql("SELECT count(*) FROM pg_tables WHERE schemaname = 'public';") != "0":
    parser.error("The disposable database must be empty. Existing contents are never dropped or overwritten.")
root = Path(__file__).resolve().parent.parent
migrations = root / "packages/database/prisma/migrations"
target = migrations / "20261106190000_subscription_verification/migration.sql"
base = sorted(p for p in migrations.glob("*/migration.sql") if p.parent.name < target.parent.name)
for migration in base:
    sql(migration.read_text())

sql("""
INSERT INTO "User" ("id", "email", "passwordHash", "name", "createdAt", "updatedAt")
VALUES ('badge-upgrade-user', 'badge-upgrade@eazicart.invalid', 'non-login-fixture', 'Migration fixture', now(), now());
INSERT INTO "SellerProfile" ("id", "displayName", "userId")
VALUES ('badge-upgrade-seller', 'Migration fixture store', 'badge-upgrade-user');
INSERT INTO "Address" ("id", "line1", "city", "region", "postalCode", "country", "userId")
VALUES ('badge-upgrade-address', 'Fixture only', 'Fixture', 'Fixture', '0000', 'NG', 'badge-upgrade-user');
INSERT INTO "Order" ("id", "total", "userId", "addressId", "createdAt", "updatedAt")
VALUES ('badge-upgrade-order', 100, 'badge-upgrade-user', 'badge-upgrade-address', now(), now());
INSERT INTO "Payment" ("id", "provider", "reference", "status", "amount", "currency", "paidAt", "orderId", "createdAt", "updatedAt")
VALUES ('badge-upgrade-order-payment', 'PAYSTACK', 'badge-upgrade-historical-order', 'SUCCESS', 100, 'NGN', now(), 'badge-upgrade-order', now(), now());
INSERT INTO "SellerSubscription" ("id", "status", "sellerId", "planCode", "startsAt", "currentPeriodEnd", "createdAt", "updatedAt")
VALUES
('badge-upgrade-legacy-active', 'ACTIVE', 'badge-upgrade-seller', 'PRO', now() - interval '1 day', now() + interval '1 day', now(), now()),
('badge-upgrade-legacy-invalid-period', 'ACTIVE', 'badge-upgrade-seller', 'BUSINESS', now() + interval '1 day', now() - interval '1 day', now(), now()),
('badge-upgrade-legacy-pending', 'PENDING', 'badge-upgrade-seller', 'BUSINESS', NULL, NULL, now(), now());
""")

snapshot_query = """
SELECT jsonb_build_object(
  'payment', (SELECT to_jsonb(p) FROM "Payment" p WHERE "id" = 'badge-upgrade-order-payment'),
  'subscriptions', (SELECT jsonb_agg(to_jsonb(s) - 'accountId' - 'suspendedAt' ORDER BY "id") FROM "SellerSubscription" s)
)::text;
"""
before = json.loads(sql(snapshot_query))
sql(target.read_text())
after = json.loads(sql(snapshot_query))
assert before == after, "Migration changed historical fixture data"
assert sql('SELECT count(*) FROM "SubscriptionPayment";') == "0", "Migration fabricated paid evidence"
assert sql('SELECT count(*) FROM "SellerSubscription" WHERE "accountId" IS NOT NULL OR "suspendedAt" IS NOT NULL;') == "0"
assert sql('SELECT count(*) FROM "User" WHERE "verificationSuspendedAt" IS NOT NULL;') == "0"
assert sql("SELECT convalidated FROM pg_constraint WHERE conname='SellerSubscription_valid_period';") == "f"
assert sql("SELECT convalidated FROM pg_constraint WHERE conname='SellerSubscription_one_owner';") == "t"

def rejects(statement, expected_constraint):
    try:
        sql(statement)
    except RuntimeError as error:
        assert expected_constraint in str(error), str(error)
    else:
        raise AssertionError("Constraint accepted invalid fixture data: " + expected_constraint)


rejects("""
INSERT INTO "SellerSubscription" ("id", "sellerId", "accountId", "planCode", "createdAt", "updatedAt")
VALUES ('bad-owner', 'badge-upgrade-seller', 'badge-upgrade-user', 'PRO', now(), now());
""", "SellerSubscription_one_owner")
rejects("""
INSERT INTO "SellerSubscription" ("id", "accountId", "planCode", "startsAt", "currentPeriodEnd", "createdAt", "updatedAt")
VALUES ('bad-period', 'badge-upgrade-user', 'PRO', now() + interval '1 day', now(), now(), now());
""", "SellerSubscription_valid_period")
rejects("""
INSERT INTO "SubscriptionPayment" ("id", "subscriptionId", "accountId", "provider", "reference", "planCode", "amountMinor", "currency")
VALUES ('bad-amount', 'badge-upgrade-legacy-active', 'badge-upgrade-user', 'KORAPAY', 'bad-amount-ref', 'PRO', 0, 'NGN');
""", "SubscriptionPayment_positive_amount")
assert json.loads(sql(snapshot_query)) == before
assert sql('SELECT count(*) FROM "SubscriptionPayment";') == "0"
print(json.dumps({
    "result": "passed", "baseMigrations": len(base), "legacySubscriptionsPreserved": 3,
    "historicalOrderPaymentsPreserved": 1, "subscriptionPaymentsFabricated": 0,
    "invalidLegacyPeriodPreserved": True, "newInvalidOwnerPeriodAndAmountRejected": True, "productionTouched": False,
}, indent=2))
