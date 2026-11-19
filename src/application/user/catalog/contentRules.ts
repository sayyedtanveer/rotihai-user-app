import type {Banner,Category,Plan,ReferralStats,ReferralSettings} from '../../../core/api/models';
export function activeBanners(banners:Banner[]=[]){return banners.filter(b=>b.isActive!==false&&!!b.title?.trim()).slice().sort((a,b)=>(a.displayOrder??0)-(b.displayOrder??0));}
export function bannerAction(banner:Banner,webBase?:string):{kind:'subscriptions'}|{kind:'category';id:string}|{kind:'url';url:string}|null{
 if(banner.actionType==='subscription')return {kind:'subscriptions'};
 if(banner.actionType==='category'&&banner.actionValue?.trim())return {kind:'category',id:banner.actionValue.trim()};
 if(banner.actionType==='url'&&banner.actionValue?.trim()){try{const url=new URL(banner.actionValue.trim(),webBase);if(['https:','http:'].includes(url.protocol))return {kind:'url',url:url.toString()};}catch{}}
 return null;
}
export function groupPlans(plans:Plan[]=[],categories:Category[]=[]){
 const groups=new Map<string,{key:string;category:string;name:string;order:number;plans:Plan[]}>();
 for(const plan of plans.filter(p=>p.isActive)){const name=plan.sectionName?.trim()||'General',key=plan.categoryId+':'+name;let group=groups.get(key);if(!group){group={key,category:categories.find(c=>c.id===plan.categoryId)?.name||'Meal plans',name,order:plan.sectionOrder??0,plans:[]};groups.set(key,group);}group.order=Math.min(group.order,plan.sectionOrder??0);group.plans.push(plan);}
 return [...groups.values()].sort((a,b)=>a.order-b.order||a.category.localeCompare(b.category)||a.name.localeCompare(b.name));
}
export function referralEarnings(stats:ReferralStats){const value=stats.totalEarnings??stats.totalEarned;return typeof value==='number'&&Number.isFinite(value)?value:null;}
export function referralShareMessage(code:string,settings?:ReferralSettings,webBase?:string){const benefit=settings&&Number.isFinite(settings.referredBonus)&&settings.referredBonus>0?' Eligible first orders can receive ₹'+settings.referredBonus+' under the current referral rules.':'';return 'Try RotiHai! Use my referral code '+code+'.'+benefit+(webBase?.startsWith('https://')?' '+webBase:'');}

export function orderedCategories(categories:Category[]=[]){return categories.slice().sort((a,b)=>(a.displayOrder??Number.MAX_SAFE_INTEGER)-(b.displayOrder??Number.MAX_SAFE_INTEGER));}
