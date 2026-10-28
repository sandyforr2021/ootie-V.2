# Catalogue image

## Transparent wardrobe derivatives

`cutouts/*.png` contains local background-removal derivatives of the 20 product photos documented in `src/data/juryWardrobeSources.json` and `src/data/juryWardrobeExtras.json`. Prepared on 2026-10-28 with the free MIT-licensed BiRefNet Lite model (`studioludens/birefnet-lite-512`, revision `962e67969ec6acec9c19fab76acee4f5e22e990c`); the blue bag uses conservative colour-background segmentation including the enclosed handle opening. No generative image API, credits or garment redraw was used. The pink linen shirt and sunglasses use the corrected complete product photographs listed below. Original files and cloud wardrobe records remain unchanged. `src/data/catalogCutouts.json` maps the original merchant URLs to their transparent derivatives, only for the existing seeded merchant image paths.

`linen-shirt-bubblegum-pink.jpg` is the merchant's garment-only product photograph, retrieved on 2026-10-28 without pixel modification. It replaces the model photograph only for the original seeded wardrobe image; user replacement photos remain unchanged.

- Product: https://colorfulstandard.com/products/linen-oversized-shirt-bubblegum-pink-female
- Original: https://colorfulstandard.com/cdn/shop/files/CS4011_OrganicLinenOversizedShirt-BubblegumPink_2.jpg?v=1746797937&width=1000

`sunglass-17-lavender.jpg` is the complete merchant photograph of Colorful Standard's Sunglass 17, Deep Black Solid / Lavender, retrieved on 2026-10-28 without pixel modification.

- Product: https://colorfulstandard.com/products/sunglass-17-sunglasses-deep-black-solid-lavender
- Original: https://colorfulstandard.com/cdn/shop/files/CS0017_Deep_Black_Solid-Lavender.jpg?v=1685533284&width=800
- Use: replace the cropped detail photograph in the existing project wardrobe display. No cloud records were modified.
