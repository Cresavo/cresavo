import { AboutPage } from "@/concept/site/about-page";
import { getSiteProps, type SiteProps } from "@/concept/site/links";

export const getServerSideProps = getSiteProps;

export default function Page(props: SiteProps) {
  return <AboutPage {...props} />;
}
