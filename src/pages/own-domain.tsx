import { OwnDomainPage } from "@/concept/site/own-domain/own-domain-page";
import { getOwnDomainProps, type OwnDomainProps } from "@/concept/site/own-domain/props";

export const getServerSideProps = getOwnDomainProps;

export default function Page(props: OwnDomainProps) {
  return <OwnDomainPage {...props} />;
}
