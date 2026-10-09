import { pageMetadata } from "../../lib/seo";
import { AcquisitionPage } from "../components/acquisition-page";
export const metadata = pageMetadata(
  "Social Commerce Platform for Modern Businesses",
  "Share your EaziCart storefront and product links on social media. Help customers discover products, browse your catalog and order through EaziCart.",
  "/social-commerce",
);
export default function Page() {
  return (
    <AcquisitionPage
      title="Share your products. Give customers a place to shop."
      intro="For Nigerian businesses that sell through social media, EaziCart gives products a home beyond the conversation: a public storefront, product pages and a customer ordering flow."
      sections={[
        {
          title: "Turn interest into a product visit",
          copy: "Share the link to your public seller profile or an individual product in your social posts and messages. Customers can browse your catalog and see current prices and availability.",
        },
        {
          title: "Connect discovery with shopping",
          copy: "EaziCart's customer experience includes product discovery, seller profiles and published Reels. Product links connect browsing to the existing cart and checkout flow.",
          items: [
            "Create and update products in your seller workspace.",
            "Publish product Reels using the existing seller tools.",
            "View orders and their fulfillment states in your workspace.",
          ],
        },
        {
          title: "What is supported today?",
          copy: "You can share store and product links on Instagram, WhatsApp, X and other channels. EaziCart does not currently import orders automatically from those services or synchronize their inboxes. Customer chat is not yet a live messaging service.",
        },
      ]}
      otherPath="/online-store"
      otherLabel="Learn about your online storefront"
    />
  );
}
