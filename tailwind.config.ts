import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // First Access Lending Blue
        primary: {
          light: '#0EF0F0',
          DEFAULT: '#0283DB',
          dark: '#003961',
        },
      },
      fontFamily: {
        heading: ['var(--font-roboto-condensed)', 'system-ui', '-apple-system', 'Franklin Gothic', 'sans-serif'],
        body: ['var(--font-roboto)', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
