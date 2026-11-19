import type { Category, Chef, Product, CartItem } from '../../../core/api/models';
// Match the backend: explicit product mode, otherwise inherit the selected chef.
// Category delivery-slot settings never turn a dish into a preorder.
export function effectiveFulfillmentMode(product:Pick<Product,'effectiveMode'|'fulfillmentMode'>,chef?:Pick<Chef,'fulfillmentMode'>):'instant'|'preorder'|'both'{
 if(['instant','preorder','both'].includes(product.effectiveMode||''))return product.effectiveMode as 'instant'|'preorder'|'both';
 if(product.fulfillmentMode==='instant'||product.fulfillmentMode==='preorder')return product.fulfillmentMode;
 return chef?.fulfillmentMode==='instant'||chef?.fulfillmentMode==='preorder'?chef.fulfillmentMode:'both';
}
export function isKitchenOrderable(chef?: Chef) { return !!chef && chef.isActive !== false && (chef.isCurrentlyOpen ?? chef.isActive) === true; }
export function isProductOrderable(chef:Chef|undefined,product:Pick<Product,'effectiveMode'|'fulfillmentMode'>,preorderBasket=false){const mode=effectiveFulfillmentMode(product,chef);return !!chef&&chef.isActive!==false&&(mode==='preorder'||mode==='both'&&preorderBasket||isKitchenOrderable(chef));}
export function kitchenStatus(chef: Chef) { return isKitchenOrderable(chef) ? 'Accepting orders' : chef.isActive === false ? 'Currently unavailable' : 'Currently closed'; }
export function matchesCategory(chef: Chef, products: Product[], categoryId?: string) {
  return !categoryId || chef.categoryId === categoryId || chef.categoryIds?.includes(categoryId) || products.some(p => p.chefId === chef.id && p.categoryId === categoryId);
}
export function groupMenu(products: Product[], categories: Category[] = [], includeCategory = false) {
  const groups = new Map<string, { key: string; title: string; order: number; data: Product[] }>();
  for (const product of products) {
    const section = product.section?.trim() || 'Others';
    const category = categories.find(c => c.id === product.categoryId);
    const key = includeCategory ? product.categoryId + ':' + section : section;
    if (!groups.has(key)) groups.set(key, { key, title: includeCategory ? (category?.name || 'Menu') + ' · ' + section : section, order: product.section?.trim() ? product.sectionOrder ?? 0 : 999, data: [] });
    groups.get(key)!.data.push(product);
  }
  return [...groups.values()].sort((a,b) => a.order-b.order || a.title.localeCompare(b.title)).map(g => ({ ...g, data: [...g.data].sort((a,b) => (a.sortOrder ?? 0)-(b.sortOrder ?? 0) || a.name.localeCompare(b.name)) }));
}
export function cartItemIssue(item: CartItem, products: Product[], chefs: Chef[], preorderBasket=false): string | null {
  const chef = chefs.find(c=>c.id===item.chefId), product = products.find(p=>p.id===item.id);
  if (!chef) return 'Not available in this delivery area';
  if (chef.isActive === false) return 'Kitchen currently unavailable';
  if (!isKitchenOrderable(chef)&&(!product||!isProductOrderable(chef,product,preorderBasket))) return 'Kitchen currently closed';
  if (!product?.isAvailable) return 'Dish currently unavailable';
  if (item.variantId) {
    const variant=product.variants?.find(v=>v.id===item.variantId);
    if (!variant?.isActive || !variant.isAvailable) return 'Selected size is unavailable';
    if (item.quantity>variant.stockQuantity) return 'Selected quantity is out of stock';
  } else if (item.quantity>product.stockQuantity) return 'Selected quantity is out of stock';
  return null;
}

export function cartItemFromProduct(p:Product,chef:Chef|undefined,category:Category|undefined,options:{variant?:import('../../../core/api/models').Variant;quantity?:number;instructions?:string;offer?:import('../../../core/api/models').ProductOffer|null}={}):CartItem{
 const variant=options.variant,mode=effectiveFulfillmentMode(p,chef);
 return {key:p.id+':'+(variant?.id||''),id:p.id,name:p.name,image:p.image,price:variant?.price??p.price,quantity:options.quantity??1,chefId:p.chefId,chefName:chef?.name||'',categoryId:p.categoryId,categoryName:category?.name||'',variantId:variant?.id,variantName:variant?.name,specialInstructions:options.instructions,effectiveMode:mode,stockQuantity:variant?.stockQuantity??p.stockQuantity,offerPercentage:p.offerPercentage,offer:variant?null:options.offer===undefined?p.offer:options.offer};
}
