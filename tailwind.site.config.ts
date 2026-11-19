import config from "./tailwind.config";

const siteConfig = {
  ...config,
  content: ["./src/pages/**/*.tsx", "./src/concept/{site,ui}/**/*.tsx"],
};

export default siteConfig;
