import { HomePage } from "@/concept/site/home/home-page";
import { getProductSiteProps, type ProductSiteProps } from "@/concept/site/links";

export const getServerSideProps = getProductSiteProps;

export default function Page(props: ProductSiteProps) {
  return <HomePage {...props} />;
}
