# Figma implementation audit

## Design source

- Figma file: <https://www.figma.com/design/747q8npBh3lvQTo9HPKYY8>
- Access checked: 2026-09-11
- Status: blocked before screen inventory

The supplied Figma URL cannot currently be read from the build environment. The
available web integration returns `401 Unauthorized`, while a direct request to
Figma is rejected by the environment proxy with `403`. No frame names, node IDs,
dimensions, styles, prototype links, or exportable assets can therefore be
inspected reliably.

Per the implementation requirements, no UI has been inferred from the product
name or substituted with a template. Implementation and visual comparison must
wait until the source frames are available through an authenticated Figma
connection or a supplied `.fig`/PDF export with the original assets.

## Repository inventory

The current repository is a pnpm/Turborepo TypeScript monorepo containing:

- `apps/web`: a minimal Next.js landing page using the App Router.
- `packages/ui`: a shared React package with the existing `BrandMark`.
- `packages/types`: the shared domain-contract boundary.
- `packages/database`: an intentionally unconnected PostgreSQL boundary.
- `packages/config`: shared ESLint and TypeScript configuration.

There are currently no customer purchase, seller product, seller order, API, or
authentication routes to map to the Figma screens. The existing landing page is
the only implemented screen.

## Implementation gate

Before UI work starts, design access must expose enough information to:

1. Inventory all pages, sections, frames, components, variants, and prototype
   connections.
2. Identify canonical frames and exclude duplicates or legacy explorations.
3. Record each canonical frame's viewport, route, role, and prototype
   destination.
4. Export the original raster/vector assets and identify the fonts and design
   tokens used by the file.
5. Determine which bottom-navigation instance is the latest shared version.
6. Establish matching viewport pairs for Figma-to-browser screenshot checks.

## Planned delivery order

Once the design gate is cleared, implementation will proceed without changing
the requested sequence:

1. Shared design tokens and reusable primitives.
2. Customer discovery and purchase flow.
3. Seller product management.
4. Seller order management.
5. Responsive desktop adaptations for screens without dedicated desktop frames.
6. Backend integration, documenting only the integrations that are genuinely
   unavailable.
7. Screenshot comparison at matching frame sizes and prototype-equivalent
   journey verification.

## Evidence required for completion

Each implemented screen should be recorded with its Figma frame/node, code
route, viewport, backend state, and visual verification result. An exact-match
claim is not valid until a browser screenshot has been compared with the source
frame at the same viewport.
