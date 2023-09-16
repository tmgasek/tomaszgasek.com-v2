import { defineConfig } from "astro/config"
import { remarkReadingTime } from "./src/remark-reading-time"

// https://astro.build/config
export default defineConfig({
    markdown: {
        remarkPlugins: [remarkReadingTime],

        shikiConfig: {
            theme: "poimandres",
        },
    },
})
