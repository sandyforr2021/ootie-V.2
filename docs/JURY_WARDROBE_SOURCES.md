# Jury wardrobe sources

Checked on 2026-10-22. The private jury account contains eight team-prepared pieces so reviewers can explore an inhabited wardrobe. Its account and storage are real; the team has not claimed that a consumer purchased or wore these products.

The complete source records are in [juryWardrobeSources.json](../src/data/juryWardrobeSources.json). They include the official product URL, observed image URL, name, brand, material, color and verification date.

| Product | Source |
|---|---|
| Classic Organic Tee, Optical White | [Colorful Standard](https://colorfulstandard.com/products/classic-organic-tee-t-shirt-optical-white-male) |
| Classic Merino Wool Crew, Soft Lavender | [Colorful Standard](https://colorfulstandard.com/products/women-classic-merino-wool-crew-women-merino-crewneck-soft-lavender-female) |
| Organic Workwear Jacket, Kelly Green | [Colorful Standard](https://colorfulstandard.com/en-fr/products/organic-workwear-jacket-kelly-green-male) |
| Organic Twill Pants, Dusty Olive | [Colorful Standard](https://colorfulstandard.com/products/organic-twill-pants-dusty-olive-male) |
| Organic Twill Shorts, Ivory White | [Colorful Standard](https://colorfulstandard.com/en-gb/products/women-organic-twill-shorts-ivory-white) |
| Campo Leather, White Black | [VEJA](https://www.veja-store.com/en_de/p/campo-leather-white-black-CP0501537.html) |
| Medium Nylon Crescent Bag, Pool Blue | [BAGGU Japan](https://www.baggu.jp/?pid=191887997) |
| Organic Cotton Cap, Red Tangerine | [Colorful Standard](https://colorfulstandard.com/products/organic-cotton-cap-red-tangerine-female) |

Original product pixels were preserved, with no generative replacement or cropping. Private storage serves signed image URLs. Wardrobe cards use `object-fit: contain` to show the whole item. Product details link back to the source merchant.

No price, purchase date, wear history or affiliate relationship was invented. Product pages are provenance, not evidence of a commercial image license, endorsement or merchant partnership. Before using these images in public promotional materials, confirm the relevant permission or replace them with team-owned product photography. Do not publish the private wardrobe or credentials to GitHub.

`scripts/provision-judge-account.mjs` provisions the explicitly requested jury account and checks sign-in and anonymous isolation. `scripts/refresh-judge-wardrobe.mjs` updates only its eight deterministic item IDs, backing up prior rows under the ignored `backups/` directory. Both refuse a Supabase hostname other than the OOTIE project.


## 2026-10-23 extension

Twelve additional distinct catalog pieces are recorded in `src/data/juryWardrobeExtras.json`, from the merchant's public product catalog, checked 2026-10-23. The jury wardrobe now contains twenty items. Originals/favorites/history were preserved; new purchase prices and dates are unknown. Photos are private for the jury, except the previously approved SOS selection. This source record does not assert a redistribution license.
