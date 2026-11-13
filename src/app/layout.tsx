import "./style.css";
import "./workspace-polish.css";
import { RestoreReturnScroll } from "./components/context-link";
export const metadata = {
  title: "Salong Eko – boka tid",
  description: "Boka en behandling hos vår demosalong.",
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv">
      <body>
        <RestoreReturnScroll />
        <p className="demo-banner">Demo – endast påhittade uppgifter</p>
        {children}
      </body>
    </html>
  );
}
