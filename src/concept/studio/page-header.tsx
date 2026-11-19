import { PageHeader as Header, type PageHeaderProps } from "../ui/page-header";
import { HeaderTools } from "./header-tools";

export function PageHeader({ actions, ...props }: PageHeaderProps) {
  return <Header {...props} actions={<>{actions}<HeaderTools /></>} />;
}
