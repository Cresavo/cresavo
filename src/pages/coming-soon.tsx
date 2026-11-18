import { getProductSiteProps, type ProductSiteProps } from "@/concept/site/links";
import { ProductPage } from "@/concept/site/product-page";

export const getServerSideProps = getProductSiteProps;

export default function Page(props: ProductSiteProps) {
  return <ProductPage {...props} studio={false} />;
}
