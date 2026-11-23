import type { Product } from "../lib/api/types";

// Isolated visual-preview catalog. No real sellers, inventory, or payments.
export const easyuiPreviewProducts: Product[] = [
  { id:"preview-sneaker", name:"Everyday Sneakers (Demo)", price:"54000", stock:0, active:true, rating:"4.8", soldLabel:"Demo", images:[{url:"https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=700",altText:"Red sneaker"}], category:{id:"preview-fashion",name:"Fashion",slug:"fashion"},seller:{id:"preview-seller",userId:"preview-user",displayName:"Demo Store",bio:"Visual preview only"} },
  { id:"preview-headphones", name:"Wireless Headphones (Demo)", price:"78000", stock:0, active:true, rating:"4.7", soldLabel:"Demo", images:[{url:"https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=700",altText:"Headphones"}], category:{id:"preview-electronics",name:"Electronics",slug:"electronics"},seller:{id:"preview-seller",userId:"preview-user",displayName:"Demo Store",bio:"Visual preview only"} },
  { id:"preview-bag", name:"Classic Bag (Demo)", price:"38500", stock:0, active:true, rating:"4.9", soldLabel:"Demo", images:[{url:"https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=700",altText:"Leather handbag"}], category:{id:"preview-fashion",name:"Fashion",slug:"fashion"},seller:{id:"preview-seller",userId:"preview-user",displayName:"Demo Store",bio:"Visual preview only"} }
];
export const easyuiPreviewCatalog = {data:easyuiPreviewProducts,pagination:{page:1,limit:100,total:easyuiPreviewProducts.length,pages:1}};
export const isEasyuiPreview = process.env.VERCEL_ENV === "preview" && process.env.VERCEL_GIT_COMMIT_REF === "feature/easyui-integration-20261123";
