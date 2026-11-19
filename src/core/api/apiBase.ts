export function apiOrigin(configured: string | undefined): string {
 return (configured || '').replace(/\/+$/, '').replace(/\/api$/, '');
}
export function validatedApiOrigin(configured: string | undefined, development: boolean): string {
 const origin = apiOrigin(configured);
 if (!origin || origin.includes('example.com')) throw new Error('The service is not connected yet. Please try again later.');
 const host = /^http:\/\/([^/:]+|\[::1\])(?::\d+)?$/.exec(origin)?.[1];
 const octets = host?.split('.').map(Number);
 const privateAddress = octets?.length === 4 && octets.every(value => Number.isInteger(value) && value >= 0 && value <= 255)
  && (octets[0] === 10 || (octets[0] === 192 && octets[1] === 168)
   || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31));
 const local = host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || privateAddress;
 if (!origin.startsWith('https://') && !(development && local)) throw new Error('A secure HTTPS connection is required.');
 return origin;
}
