/**
 * Bundled category art — filenames under `assets/categories/`.
 * Slugs must match `public.categories.slug` in Supabase.
 */
const categoryImageNature = require("../../assets/categories/nature.png") as number;
const categoryImageResort = require("../../assets/categories/resort.png") as number;
const categoryImageFood = require("../../assets/categories/food.png") as number;

export type TravelCategoryDef = {
  label: string;
  slug: string;
  image: number;
};

export const TRAVEL_CATEGORIES: readonly TravelCategoryDef[] = [
  { label: "Nature & Adventure", slug: "nature-adventure", image: categoryImageNature },
  { label: "Resort & Leisure", slug: "resorts-leisure", image: categoryImageResort },
  { label: "Food & Dining", slug: "food-dining", image: categoryImageFood },
];
