import { defineConfig, devices } from "@playwright/test";
export default defineConfig({testDir:"./tests/e2e", workers:1, projects:[{name:"desktop",use:{...devices["Desktop Chrome"]}},{name:"mobile",use:{...devices["Pixel 7"]}}], use:{baseURL:"http://localhost:3000"}, webServer:{command:"npm run dev",url:"http://localhost:3000",reuseExistingServer:!process.env.CI,timeout:120000}});
