import { defineConfig } from "hardhat/config";
import hardhatMultiBaasPlugin from "../../../dist/index.js";

export default defineConfig({
  plugins: [hardhatMultiBaasPlugin],
  mbConfig: {
    host: "http://localhost:8080",
    apiKey: "fixture-api-key",
  },
});
