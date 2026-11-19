import { PageHeader as Header, type PageHeaderProps } from "../ui/page-header";
import { HeaderTools } from "./header-tools";

export function PageHeader({ actions, tools = true, ...props }: PageHeaderProps & { tools?: boolean }) {
  return <Header {...props} actions={tools ? <>{actions}<HeaderTools /></> : actions} />;
}
