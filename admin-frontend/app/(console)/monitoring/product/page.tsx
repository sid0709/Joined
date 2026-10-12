import type { Metadata } from "next";
import { ProductPage } from "@/components/monitoring/product-page";

export const metadata: Metadata = { title: "Product" };

export default function Page() {
  return <ProductPage />;
}
