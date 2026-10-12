# EaziCart iOS release requirements

The existing TypeScript/Fastify/PostgreSQL API will serve the website and the
future iOS app. Hosting on a VPS does not determine App Store approval. The
current Next.js project is a website and does not yet produce a signed iOS app.
Retain it; select the iOS implementation separately before starting mobile code.

The following are release gates, not claims of implemented functionality:

| Area                    | Required work                                                                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile experience       | Ship a complete iOS experience with useful app functionality beyond a repackaged website; verify navigation, loading, errors and checkout on devices.                                                                     |
| Accounts                | Support initiating account deletion inside the app; implement deletion/anonymization and explain legally required retention. Verify session revocation and related media handling.                                        |
| Sessions                | Complete refresh, logout and revocation behavior. Use appropriate secure device storage for iOS credentials and review the website's current local-storage token approach.                                                |
| Reels, reviews and chat | Add objectionable-content filtering, reports, timely moderation, user blocking and published support contact information.                                                                                                 |
| Privacy                 | Provide a privacy policy in the app and store listing; declare collected data and SDK behavior accurately; request camera, photos and location only for explained features.                                               |
| Payments                | Physical goods and services consumed outside the app use ordinary checkout. Review digital subscriptions, paid features and promotions separately against applicable storefront rules before implementing their checkout. |
| Review access           | Keep the backend online, provide a working reviewer account and instructions, and submit accurate screenshots and metadata.                                                                                               |
| Distribution            | Prepare Apple Developer membership, signing, App Store Connect setup and device/TestFlight validation before submission.                                                                                                  |

Apple makes the final review decision. Re-check policies before submission.
Official references checked 9 October 2026:

- https://developer.apple.com/app-store/review/guidelines/ (1.2, 2.1, 3.1, 4.2, 5.1)
- https://developer.apple.com/support/offering-account-deletion-in-your-app/
