import { defineCollection, reference, z } from "astro:content"

const blogCollection = defineCollection({
    type: "content",
    schema: z.object({
        title: z.string(),
        description: z.string().max(200),
        publishDate: z.date(),
        tags: z.array(z.string()),
        image: z.string().optional(),
        footnote: z.string().optional(),
        relatedPosts: z.array(reference("blog")).optional(),
    }),
})

export const collections = {
    blog: blogCollection,
}
