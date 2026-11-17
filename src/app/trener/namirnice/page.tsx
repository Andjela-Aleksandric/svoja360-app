import { requireCoach } from "@/lib/auth";
import { listFoods } from "@/lib/data/nutrition";
import { t } from "@/lib/i18n/sr";
import { FoodLibrary } from "./library";

export const metadata = { title: t.foods.title };

export default async function FoodsPage() {
  await requireCoach();
  return <FoodLibrary foods={await listFoods(true)} />;
}
