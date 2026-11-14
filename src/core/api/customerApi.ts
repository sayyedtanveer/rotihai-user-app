import {cachedResponse,cacheResponse,cachedProfile,bindCachedProfile,markCachedDelivery} from './offlineCache';
import {requireConnection,isConnected} from './connectivity';
export type Customer = { id: string; name: string; phone: string; address: string | null; latitude: number | string | null; longitude: number | string | null };
export type Session = { user: Customer; accessToken: string; refreshToken: string; isNewUser: boolean };
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function customerApi<T>(path: string, body?: unknown, token?: string, method?: string, extraHeaders?: Record<string,string>): Promise<T> {
  if (typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_UI_REVIEW === '1') return require('../../review/transport').reviewRequest(path,body,method);
  const isRead=(method??(body===undefined?'GET':'POST'))==='GET';
  const fresh=extraHeaders?.['X-RotiHai-Require-Fresh']==='1';
  const outgoingHeaders={...extraHeaders};delete outgoingHeaders['X-RotiHai-Require-Fresh'];
  const owner=token?(await cachedProfile(token))?.id:undefined;
  if(!isRead||fresh)await requireConnection();
  else if(!await isConnected()){const cached=await cachedResponse<T>(path,owner);if(cached!==null){markCachedDelivery(path,owner,true);return cached;}throw new Error('You are offline. Open previously viewed items or reconnect to load this screen.');}
  const base = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
  if (!base || base.includes('example.com')) throw new Error('The service is not connected yet. Please try again later.');
  if (!base.startsWith('https://')) throw new Error('A secure HTTPS connection is required.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(base + path, {
      method: method ?? (body ? 'POST' : 'GET'), signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...outgoingHeaders },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const raw = await response.text();
    let data: any = null;
    try { data = raw ? JSON.parse(raw) : null; } catch {
      throw new ApiError(response.status, response.ok ? 'The service returned an unexpected response.' : 'The service is temporarily unavailable. Please try again.');
    }
    if (!response.ok) throw new ApiError(response.status, data?.message || 'Request failed. Please try again.');
    if(isRead){const cacheOwner=path==='/api/user/profile'&&token?data?.id:owner;
      if(path==='/api/user/profile'&&token&&data?.id)await bindCachedProfile(token,data.id);
      markCachedDelivery(path,cacheOwner,false);
      void cacheResponse(path,data,cacheOwner).catch(()=>{});
    }
    return data as T;
  } catch (error) {
    if(isRead&&!fresh&&!(error instanceof ApiError&&error.status>=400&&error.status<500)){const cached=await cachedResponse<T>(path,owner);if(cached!==null){markCachedDelivery(path,owner,true);return cached;}}
    if (error instanceof Error && error.name === 'AbortError') throw new Error('The request timed out. Please try again.');
    throw error;
  } finally { clearTimeout(timer); }
}
