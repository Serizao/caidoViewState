import { defineConfig } from "@caido-community/dev";
import vue from "@vitejs/plugin-vue";
import prefixwrap from "postcss-prefixwrap";
import tailwindcss from "tailwindcss";
// @ts-ignore
import tailwindcssPrimeUI from "tailwindcss-primeui";
import caidoTheme from "@caido/tailwindcss";

export default defineConfig({
  id: "viewstate-analyzer",
  name: "ViewState Analyzer",
  description: "Analyze ASP.NET ViewState to detect encryption and MAC signature",
  version: "1.0.1",
  author: {
    name: "Serizao",
    email: "dev@caido.io",
    url: "https://github.com/serizao/caidoViewState",
  },
  plugins: [
    {
      kind: "backend",
      id: "backend",
      root: "packages/backend",
    },
    {
      kind: "frontend",
      id: "frontend",
      root: "packages/frontend",
      backend: {
        id: "backend",
      },
      vite: {
        plugins: [vue()],
        build: {
          rollupOptions: {
            external: [
              "vue",
              "@caido/sdk-frontend",
              "@codemirror/autocomplete",
              "@codemirror/commands",
              "@codemirror/language",
              "@codemirror/lint",
              "@codemirror/search",
              "@codemirror/state",
              "@codemirror/view",
              "@lezer/common",
              "@lezer/highlight",
              "@lezer/lr",
            ],
          },
        },
        resolve: {
          alias: {
            "@": "./packages/frontend/src",
          },
        },
        css: {
          postcss: {
            plugins: [
              tailwindcss({
                config: {
                  prefix: "",
                  darkMode: ["selector", '[data-mode="dark"]'],
                  content: [
                    "./packages/frontend/**/*.vue",
                    "./packages/frontend/**/*.ts",
                  ],
                  plugins: [tailwindcssPrimeUI, caidoTheme],
                },
              }),
              prefixwrap("#plugin--viewstate-analyzer", {
                ignoredSelectors: [":root", /^::/, /\[data-mode/],
              }),
            ],
          },
        },
      },
    },
  ],
});
