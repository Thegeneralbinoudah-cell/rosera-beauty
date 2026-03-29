/** Home screen category chips — single source of truth for Search `categoryValue` filter. */
export const HOME_CATEGORY_CHIPS = [
  { id: 'salon', label: 'صالون نسائي', icon: '', categoryValue: 'salon' },
  { id: 'clinic', label: 'عيادات تجميل', icon: '', categoryValue: 'clinic' },
  { id: 'spa', label: 'سبا ومساج', icon: '', categoryValue: 'spa' },
  { id: 'makeup', label: 'مكياج', icon: '', categoryValue: 'makeup' },
  { id: 'skincare', label: 'عناية بالبشرة', icon: '', categoryValue: 'skincare' },
] as const

export type HomeCategoryValue = (typeof HOME_CATEGORY_CHIPS)[number]['categoryValue']

export const HOME_CATEGORY_VALUE_SET = new Set<string>(HOME_CATEGORY_CHIPS.map((c) => c.categoryValue))

export function isHomeCategoryValue(v: string): v is HomeCategoryValue {
  return HOME_CATEGORY_VALUE_SET.has(v)
}

/** Arabic banner label for a canonical `categoryValue` */
export function arabicLabelForCategoryValue(value: string): string {
  const row = HOME_CATEGORY_CHIPS.find((c) => c.categoryValue === value)
  return row?.label ?? value
}
