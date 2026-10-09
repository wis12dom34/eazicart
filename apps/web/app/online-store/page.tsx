import { pageMetadata } from "../../lib/seo";
import { AcquisitionPage } from "../components/acquisition-page";
export const metadata = pageMetadata(
  "Create an Online Store for Your Business in Nigeria",
  "Create a public seller profile, add products and share your EaziCart storefront. Manage stock and orders through the existing seller workspace.",
  "/online-store",
);
export default function Page() {
  return (
    <AcquisitionPage
      title="Your products. Your storefront. One link to share."
      intro="Give customers a clear place to browse what you sell. Your EaziCart public seller profile brings your store name, bio and product catalog together in a mobile shopping experience."
      sections={[
        {
          title: "Set up your public store identity",
          copy: "Create your account, open the seller workspace and set up your seller profile. The storefront editor lets you update your real store name and bio and preview the public store page.",
        },
        {
          title: "Publish a catalog customers can browse",
          copy: "Add products with names, descriptions, images, prices, categories and stock quantities. Customers can open a product page from your catalog to see its details and current availability.",
          items: [
            "Edit product information and stock in your existing workspace.",
            "Deactivate a product when it should no longer be available.",
            "Share your public seller-profile link with customers.",
          ],
        },
        {
          title: "Keep orders connected to your products",
          copy: "Customers use the existing cart and checkout flow. Sellers can view their orders and manage fulfillment states. This is the EaziCart storefront, not a separate website or a custom-domain service.",
        },
      ]}
      otherPath="/social-commerce"
      otherLabel="Use your store link for social selling"
    />
  );
}
