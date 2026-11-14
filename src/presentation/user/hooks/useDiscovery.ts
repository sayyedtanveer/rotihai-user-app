import { useApi } from '../../../core/providers/CustomerProvider';
import { useDeliveryArea } from '../../../core/location/DeliveryAreaProvider';
import { serviceableChefs } from '../../../core/location/discoveryRules';
import type { Category, Chef, Product } from '../../../core/api/models';
export function useDiscovery() {
  const { area } = useDeliveryArea();
  const chefs = useApi<Chef[]>(area ? `/api/chefs/by-location?latitude=${area.latitude}&longitude=${area.longitude}&pincode=${area.pincode}` : '/api/chefs/by-location', { enabled: !!area, interval: 30000 });
  const products = useApi<Product[]>('/api/products', { enabled: !!area, interval: 30000 });
  const categories = useApi<Category[]>('/api/categories', { enabled: !!area });
  const kitchens = area ? serviceableChefs(chefs.data || [], area) : [];
  const dishes = (products.data || []).filter(p => kitchens.some(c => c.id === p.chefId));
  return { area, chefs, products, categories, kitchens, dishes, loading: chefs.isPending || products.isPending || categories.isPending, error: chefs.error || products.error || categories.error, refresh: () => Promise.all([chefs.refetch(), products.refetch(), categories.refetch()]) };
}
