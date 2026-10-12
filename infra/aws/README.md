# EaziCart AWS deployment preparation

These templates prepare the existing API for ECS Fargate and managed PostgreSQL.
They have not been deployed. No AWS account is connected to this workspace.
The frontend stays in its existing Vercel project.

## What is included

- HTTPS Application Load Balancer with `/ready` health checks.
- Two API tasks initially, scaling up to six based on CPU and memory. These are
  starting settings, not a tested customer capacity guarantee.
- A pinned API image, rolling deployment rollback, Secrets Manager injection,
  scoped runtime-secret permissions and thirty-day logs.
- Private encrypted PostgreSQL with TLS required, Multi-AZ enabled by default,
  seven-day backups, storage growth capped at 100 GB and deletion protection.

API tasks use public subnets for outbound image pulls and secret access. Their
security group accepts incoming API traffic only from the load balancer. This
avoids introducing NAT gateways in the first configuration. The database uses
private subnets. Both sets of subnets must belong to the supplied VPC and span
at least two availability zones. Existing network resources are supplied as
parameters; these templates do not create or duplicate a VPC.

## Deployment order

1. Select the AWS account and region, review an AWS Pricing Calculator estimate,
   configure billing alerts, and approve the recurring budget. Include load
   balancer, Fargate, public IPv4, RDS Multi-AZ, storage, logs, secrets and transfer.
   Task and storage caps are resource limits, not a total billing cap.
2. Build the existing `Dockerfile.api` image for Linux AMD64, publish to a private
   ECR repository and supply its immutable digest as `ImageUri`.
3. Supply the existing VPC/subnets, a validated regional ACM certificate, the
   exact stable customer origin and separate database/JWT secret ARNs. Use the
   default Secrets Manager encryption key with the current execution policy;
   customer-managed KMS keys require scoped decrypt permissions.
4. Create the API stack with `StartService=false`. It creates the cluster, task
   definition and API security group but starts no application tasks. The ALB
   and other created resources still incur costs in this state. CloudFormation
   requires `CAPABILITY_IAM`; review the change set before executing it.
5. Create the database stack using the API security group output and a supported
   PostgreSQL 16 minor version verified in the chosen region. If a database
   already exists, reuse it instead of creating this database stack.
6. From a controlled task in the VPC, use the RDS-managed admin secret to apply
   the existing Prisma migrations. Create a separate PostgreSQL runtime role
   with only the required data access and sequence permissions. Store its TLS
   connection URL as the database secret referenced by API tasks. Keep the admin
   secret out of the API execution role. Do not run the demo seed in production.
7. Update the API stack to `StartService=true` only after migrations succeed.
   Ensure `MaximumTasks >= MinimumTasks` before creating the change set. Verify
   both tasks and their target health before switching customer traffic.
8. Point the API DNS name covered by the certificate at the load balancer. Set
   the existing Vercel project's `NEXT_PUBLIC_API_BASE_URL` to that HTTPS origin
   and rebuild. Verify account, catalogue, cart and order flows against the
   deployed database.

Secrets are injected at task startup. Restart tasks after rotating JWT or runtime
database credentials; admin-password rotation is independently managed by RDS.
Image rollback does not roll back database migrations. Use compatible migrations
and retain a tested database recovery procedure.

## Remaining application work

This infrastructure alone does not make the whole product scalable. Before
launch, measure concurrent checkout behaviour, tune database indexes and the
Prisma connection pool per task against RDS capacity, and verify payment
idempotency and retries. Autoscaling the API cannot remove database bottlenecks.

S3/CloudFront direct uploads, background job workers, shared rate limiting,
cookie-based refresh authentication, Chat and real rider tracking still require
implementation. In particular, the current local Reels upload store must not be
enabled across Fargate replicas: their filesystems are ephemeral and unshared.
The API template deliberately leaves uploads and real Paystack payments
unconfigured until their production integrations are ready.

Validate changes locally with `cfn-lint infra/aws/api.yaml infra/aws/database.yaml`
and with AWS CloudFormation change sets in the actual account. Schema validation
does not verify regional availability, network connectivity, IAM permissions,
cost, capacity or successful deployment.
