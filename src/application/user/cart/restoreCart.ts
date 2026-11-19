import {isProductOrderable} from '../catalog/menuRules';
import {assertCanAdd,cartFulfillment,groupKey} from './cartRules';
import {currentProductOffer} from './checkoutRules';
import {cartItemFromProduct} from '../catalog/menuRules';
import type { CartItem, Category, Chef, Product, ProductOffer } from '../../../core/api/models';
type Request = <T>(path: string) => Promise<T>;
export type SavedBasket = {chefId?: string | null; categoryId?: string | null; items: Array<Partial<CartItem>>};
export async function restoreCartItems(saved: SavedBasket, request: Request,options:{serviceableChefIds?:string[]}={}): Promise<CartItem[]> {
  if (!Array.isArray(saved.items) || !saved.items.length || saved.items.length > 100) throw new Error('This saved basket has no valid items.');
  const categories = await request<Category[]>('/api/categories');
  const chefs=new Map<string,Chef>();
  const restored=await Promise.all(saved.items.map(async old => {
    if (!old.id || !Number.isInteger(old.quantity) || old.quantity! <= 0) throw new Error('The saved quantity is invalid. Choose your items again.');
    const product=await request<Product>('/api/products/'+encodeURIComponent(old.id));
    const promotion={offer:await currentProductOffer(request,product,old.offer)};
    if ((saved.chefId && saved.chefId !== product.chefId) || (saved.categoryId && saved.categoryId !== product.categoryId)) throw new Error(product.name + ' has moved to another menu. Add it again from the menu.');
    const chef = await request<Chef>('/api/chefs/' + encodeURIComponent(product.chefId));
    chefs.set(product.chefId,chef);
    if(chef.isActive===false)throw new Error(chef.name+' is not accepting this order right now.');
    if(options.serviceableChefIds&&!options.serviceableChefIds.includes(product.chefId))throw new Error(chef.name+' does not serve your selected location.');
    const variant = product.variants?.find(v => v.id === old.variantId);
    if (!product.isAvailable || (product.hasVariants && !old.variantId) || (old.variantId && (!variant?.isActive || !variant.isAvailable))) throw new Error(product.name + ' is unavailable. Choose another dish from the menu.');
    const category = categories.find(c => c.id === product.categoryId);
    if (!category) throw new Error('This menu is no longer available.');
    const activeOffer = promotion.offer && promotion.offer.isActive !== false && (!promotion.offer.validUntil || Date.parse(promotion.offer.validUntil) > Date.now()) ? promotion.offer : null;
    return cartItemFromProduct(product,chef,category,{variant,quantity:old.quantity!,instructions:old.specialInstructions,offer:activeOffer});
  }));
  const validated:CartItem[]=[];
  for(const item of restored){assertCanAdd(validated,item);validated.push(item);}
  for(const item of validated){const chef=chefs.get(item.chefId),preorder=cartFulfillment(validated.filter(other=>groupKey(other)===groupKey(item))).preorder;if(chef?.isCurrentlyOpen===false&&!isProductOrderable(chef,item,preorder))throw new Error((chef?.name||'This kitchen')+' is not accepting this order right now.');}
  return validated;
}
