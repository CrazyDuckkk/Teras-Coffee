export interface RecipeIngredient {
  menuId: string;
  bahanBakuId: string;
  takaran: string | number;
  hanyaBawaPulang: boolean;
}

export interface TransactionMenuItem {
  menuId: string;
  qty: number;
  bawaPulang: boolean;
}

export interface IngredientConsumption {
  bahanBakuId: string;
  qtyDipakai: number;
}

export function getRequiredIngredients(
  items: TransactionMenuItem[],
  recipes: RecipeIngredient[]
): IngredientConsumption[] {
  const requiredByIngredient = new Map<string, number>();

  for (const item of items) {
    for (const recipe of recipes) {
      if (
        recipe.menuId !== item.menuId ||
        (recipe.hanyaBawaPulang && !item.bawaPulang)
      ) {
        continue;
      }

      const required = Number(recipe.takaran) * item.qty;
      requiredByIngredient.set(
        recipe.bahanBakuId,
        (requiredByIngredient.get(recipe.bahanBakuId) ?? 0) + required
      );
    }
  }

  return [...requiredByIngredient].map(([bahanBakuId, qtyDipakai]) => ({
    bahanBakuId,
    qtyDipakai,
  }));
}

export function getRecipeConsumptionSnapshots(
  item: TransactionMenuItem,
  recipes: RecipeIngredient[]
): IngredientConsumption[] {
  return getRequiredIngredients([item], recipes);
}

export function aggregateConsumptionSnapshots(
  snapshots: { bahanBakuId: string; qtyDipakai: string | number }[]
): IngredientConsumption[] {
  const restoredByIngredient = new Map<string, number>();

  for (const snapshot of snapshots) {
    restoredByIngredient.set(
      snapshot.bahanBakuId,
      (restoredByIngredient.get(snapshot.bahanBakuId) ?? 0) + Number(snapshot.qtyDipakai)
    );
  }

  return [...restoredByIngredient].map(([bahanBakuId, qtyDipakai]) => ({
    bahanBakuId,
    qtyDipakai,
  }));
}

export function calculateRecipeHpp(
  menuId: string,
  recipes: RecipeIngredient[],
  prices: Map<string, string | number>,
  bawaPulang: boolean
): number {
  return recipes.reduce((total, recipe) => {
    if (recipe.menuId !== menuId || (recipe.hanyaBawaPulang && !bawaPulang)) return total;
    return total + Number(recipe.takaran) * Number(prices.get(recipe.bahanBakuId) ?? 0);
  }, 0);
}
