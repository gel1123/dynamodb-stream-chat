import { defineConfig } from "astro/config";
import aws from "astro-sst";
import svelte from "@astrojs/svelte";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  output: "server",
  adapter: aws(),
  integrations: [svelte(), tailwind()],
});
