import "./style.css";
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
        <p className="demo-banner">Demo – endast påhittade uppgifter</p>
        {children}
      </body>
    </html>
  );
}
