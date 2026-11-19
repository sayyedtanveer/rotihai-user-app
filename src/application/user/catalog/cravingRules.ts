import type {Category, Chef, Product} from '../../../core/api/models';
import {discountedUnitPrice} from '../cart/cartRules';
import {effectiveFulfillmentMode, isProductOrderable} from './menuRules';

const tastes:Record<string,string[]>={sweet:['sweet','meetha','mitha','meethi','मीठा','मीठी','मिठा'],sour:['sour','tangy','khatta','khata','khatti','खट्टा','खट्टी'],spicy:['spicy','teekha','tikha','teekhi','तीखा','तीखी','masaledar','मसालेदार'],chatpata:['chatpata','chatpati','चटपटा','चटपटी']};
const spices:Record<string,string[]>={none:['no spice','without spice','bina mirch','बिना मिर्च'],mild:['mild','less spicy','less spice','kam teekha','kam tikha','halka teekha','halka tikha','हल्का तीखा','कम तीखा'],medium:['medium spice','medium spicy','medium teekha','मध्यम तीखा'],hot:['hot spice','hot spicy','very spicy','bahut teekha','बहुत तीखा']};
const foods:Record<string,string[]>={chicken:['chicken','चिकन','murgh','मुर्ग'],paneer:['paneer','पनीर'],roti:['roti','rotis','chapati','chapatis','phulka','रोटी','चपाती','फुल्का'],rice:['rice','chawal','चावल'],biryani:['biryani','बिरयानी'],thali:['thali','थाली'],dal:['dal','daal','दाल'],paratha:['paratha','parantha','पराठा'],mutton:['mutton','मटन'],fish:['fish','machli','machhli','मछली'],egg:['egg','eggs','anda','अंडा'],snack:['snack','snacks','nashta','नाश्ता'],breakfast:['breakfast','subah ka nashta','सुबह का नाश्ता'],dessert:['dessert','desserts','mithai','मिठाई'],pizza:['pizza','पिज्जा']};
const cuisines:Record<string,string[]>={'South Indian':['south indian','dakshin bhartiya','दक्षिण भारतीय'],'North Indian':['north indian','उत्तर भारतीय'],Punjabi:['punjabi','पंजाबी'],Maharashtrian:['maharashtrian','महाराष्ट्रीयन'],Gujarati:['gujarati','गुजराती'],'Indo-Chinese':['indo chinese','इंडो चाइनीज']};
const styles:Record<string,string[]>={'home-style':['homemade','home style','homestyle','ghar ka','ghar jaisa','घर का','घर जैसा'],'street-style':['street style','street food','स्ट्रीट स्टाइल']};
const normalize=(value:string)=>value.normalize('NFKC').toLowerCase().replace(/[०-९]/g,c=>String('०१२३४५६७८९'.indexOf(c))).replace(/[^\p{L}\p{M}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
const contains=(text:string,term:string)=>(' '+text+' ').includes(' '+normalize(term)+' ');
const filler=new Set(normalize('mujhe muje chahiye chahie khana khane ka ki ke kuch koi hai hain ho mann man mera mere meri aaj please want would like something food eat eating i am craving for a an the and with to options under below within upto up to budget rs rupees rupee rupaye rupay tak se kam mein me only sirf bas andar vegetarian veg non nonveg मुझे चाहिए खाना खाने का की के कुछ कोई है हैं मन मेरा मेरी आज रुपये रुपए तक से कम में अंदर सिर्फ केवल aur और ya या or do you have show find').split(' '));
export type Requirement={kind:'taste'|'spice'|'cuisine'|'style'|'dietary'|'exclusion';value:string};
export type CravingIntent={text:string;budget?:number;diet?:'veg'|'nonveg';groups:string[][];labels:string[];warnings:string[];requirements:Requirement[];tasteOperator:'and'|'or';clarification?:string;broadened?:string};
function labelsFor(intent:Pick<CravingIntent,'diet'|'budget'|'requirements'|'groups'|'tasteOperator'>){return [...(intent.budget!==undefined?['Up to ₹'+intent.budget]:[]),...(intent.diet?[intent.diet==='veg'?'Vegetarian':'Non-vegetarian']:[]),...intent.groups.map(g=>g[0]),...intent.requirements.map(r=>r.value),...(intent.requirements.filter(r=>r.kind==='taste').length>1?[intent.tasteOperator.toUpperCase()]:[])];}
export function interpretCraving(text:string):CravingIntent{
 text=text.slice(0,300).trim();let value=normalize(text);
 const requirements:Requirement[]=[],groups:string[][]=[];
 const consume=(phrase:string)=>{value=normalize((' '+value+' ').split(' '+normalize(phrase)+' ').join(' '));};
 const digits=text.toLowerCase().replace(/[०-९]/g,c=>String('०१२३४५६७८९'.indexOf(c)));
 const number='(\\d+(?:\\.\\d{1,2})?)';
 const budgetMatch=digits.match(new RegExp('(?:under|below|within|upto|up to|budget|rs\\.?|rupees)\\s*₹?\\s*'+number))||digits.match(new RegExp(number+'\\s*(?:rupees|rs|rupaye|rupay|रुपये|रुपए)?\\s*(?:ke andar|ke under|se kam|tak|के अंदर|से कम|तक)'))||digits.match(new RegExp('₹\\s*'+number));
 const budget=budgetMatch?Number(budgetMatch[1]):undefined;if(budgetMatch)consume(budgetMatch[0]);
 const hasOr=['ya','or','या'].some(term=>contains(value,term));
 let clarification:string|undefined;
 let diet:CravingIntent['diet'];
 const nonveg=['non veg','nonveg','non vegetarian','मांसाहारी'].filter(p=>contains(value,p));
 if(nonveg.length){diet='nonveg';nonveg.sort((a,b)=>b.length-a.length).forEach(consume);}
 const veg=['veg','vegetarian','शाकाहारी'].filter(p=>contains(value,p));
 if(veg.length){if(diet)clarification='Would you like vegetarian or non-vegetarian food?';else diet='veg';veg.forEach(consume);}
 if(['vegan','वीगन'].some(p=>contains(value,p))){requirements.push({kind:'dietary',value:'vegan'});consume('vegan');consume('वीगन');}
 // Preparation is separate from culinary identity. Never turn no-added into
 // free/low, or a less-salt request into a low-sodium assertion.
 const nutrients:Record<string,string[]>={sugar:['sugar','shakkar','chini','चीनी','शक्कर'],salt:['salt','namak','नमक'],sodium:['sodium','सोडियम'],oil:['oil','tel','तेल'],protein:['protein','प्रोटीन']};
 for(const [nutrient,aliases]of Object.entries(nutrients)){
  const modifiers:Record<string,string[]>={'no added':['no added','without added','bina added','बिना अतिरिक्त'],'no added / exclusion':['without','no','bina','बिना'],low:['low','कम'],less:['less','kam'],high:['high','zyada','ज्यादा']};
  let found=false;
  for(const [modifier,prefixes]of Object.entries(modifiers))for(const alias of aliases)for(const prefix of prefixes){const phrase=prefix+' '+alias;if(contains(value,phrase)){requirements.push({kind:'dietary',value:modifier+' '+nutrient});consume(phrase);found=true;}}
  for(const alias of aliases)for(const suffix of ['free','kam','nahi','नहीं']){const phrase=alias+' '+suffix;if(contains(value,phrase)){requirements.push({kind:'dietary',value:alias+' '+suffix});consume(phrase);found=true;}}
  if(found)aliases.forEach(consume);
 }
 const extract=(dictionary:Record<string,string[]>,kind:Requirement['kind']|null)=>{
  const phrases=Object.entries(dictionary).flatMap(([key,aliases])=>aliases.map(alias=>({key,alias}))).sort((a,b)=>b.alias.length-a.alias.length);
  const found=new Set<string>();for(const {key,alias}of phrases)if(contains(value,alias)){if(!found.has(key)){if(kind)requirements.push({kind,value:key});else groups.push(dictionary[key]);found.add(key);}consume(alias);}
 };
 extract(spices,'spice');extract(tastes,'taste');extract(cuisines,'cuisine');extract(styles,'style');extract(foods,null);
 if(['hot','medium'].some(p=>contains(value,p))){clarification='Do you mean the spice level, serving temperature, or portion size?';consume('hot');consume('medium');}
 if(['not','no','without','nahi','nahin','bina','बिना','नहीं'].some(p=>contains(value,p)))requirements.push({kind:'exclusion',value:'ingredient or preparation exclusion'});
 for(const token of value.split(' '))if(token&&!filler.has(token)&&!/^\d+$/.test(token))groups.push([token]);
 const tasteCount=requirements.filter(r=>r.kind==='taste').length;
 // Only an OR entirely between taste terms has an unambiguous scope. Mixed
 // dish/diet/preparation expressions need clarification instead of lost ANDs.
 if(hasOr&&(tasteCount<2||requirements.some(r=>r.kind!=='taste')||groups.length>0||tasteCount>2&&['and','aur','और'].some(term=>contains(value,term))))clarification='Which options should I treat as alternatives? Please search one dish or preference at a time.';
 const intent:CravingIntent={text,budget,diet,groups,requirements,tasteOperator:hasOr?'or':'and',clarification,labels:[],warnings:[]};
 intent.labels=labelsFor(intent);
 if(requirements.length)intent.warnings=[requirements.some(r=>r.kind==='dietary'||r.kind==='exclusion')?'This preference needs verified chef preparation details, which are not available in the current catalog.':'Verified taste, spice, cuisine or preparation details are not available in the current catalog.'];
 return intent;
}

export type CravingMatch={product:Product;chef:Chef;price:number;mode:string;score:number};
export type CravingMatches={exact:CravingMatch[];alternatives:CravingMatch[];intent:CravingIntent;status:'matches'|'no-match'|'unverified'|'clarify'};
export function matchCraving(intent:CravingIntent,products:Product[],chefs:Chef[],categories:Category[]):CravingMatches{
 const result:CravingMatches={intent,exact:[],alternatives:[],status:intent.clarification?'clarify':intent.requirements.length?'unverified':'no-match'};
 // Phase 1 has no verified attributes. A name/category or extra runtime
 // property cannot certify a strict requirement. Never generate fallback rows.
 if(intent.clarification||intent.requirements.length||!intent.text)return result;
 for(const original of products){
  const chef=chefs.find(c=>c.id===original.chefId);
  if(!chef||!original.isAvailable||!isProductOrderable(chef,original))continue;
  if(intent.diet==='veg'&&original.isVeg!==true||intent.diet==='nonveg'&&original.isVeg!==false)continue;
  const variants=original.variants?.filter(v=>v.isActive&&v.isAvailable&&Number.isFinite(v.price)&&v.price>=0&&v.stockQuantity>0);
  if(original.hasVariants?!variants?.length:!(original.stockQuantity>0))continue;
  const raw=original.hasVariants?Math.min(...variants!.map(v=>v.price)):original.price;
  if(!Number.isFinite(raw)||raw<0)continue;
  const price=discountedUnitPrice(raw,original.offerPercentage||0);
  if(intent.budget!==undefined&&price>intent.budget)continue;
  const metadata=normalize([original.name,original.description,original.section,categories.find(c=>c.id===original.categoryId)?.name].filter(Boolean).join(' '));
  const hits=intent.groups.filter(group=>group.some(alias=>contains(metadata,alias))).length;
  if(hits!==intent.groups.length)continue;
  result.exact.push({product:original.hasVariants?{...original,variants}:original,chef,price,mode:effectiveFulfillmentMode(original,chef),score:hits});
 }
 result.exact.sort((a,b)=>b.score-a.score||(a.chef.distanceFromUser??Infinity)-(b.chef.distanceFromUser??Infinity)||a.price-b.price||a.product.id.localeCompare(b.product.id));
 result.exact=result.exact.slice(0,12);if(result.exact.length)result.status='matches';return result;
}

export type BroadeningChoice={id:string;label:string};
export function broadeningChoices(intent:CravingIntent):BroadeningChoice[]{
 // Dietary/exclusion requirements are never offered a one-click relaxation.
 if(intent.clarification||intent.requirements.some(r=>r.kind==='dietary'||r.kind==='exclusion'))return [];
 if(intent.requirements.length)return [{id:'without-unverified',label:intent.groups.length?'Search '+intent.groups.map(g=>g[0]).join(' + ')+' without '+intent.requirements.map(r=>r.value).join(' + ')+' requirements':'Browse dishes without '+intent.requirements.map(r=>r.value).join(' + ')+' requirements'}];
 if(intent.groups.length)return [{id:'browse',label:'Browse dishes without dish-name keywords'}];
 return [];
}
export function broadenCraving(intent:CravingIntent,choiceId:string):CravingIntent|undefined{
 const choice=broadeningChoices(intent).find(c=>c.id===choiceId);if(!choice)return;
 const broader:CravingIntent={...intent,groups:choiceId==='browse'?[]:intent.groups,requirements:[],warnings:[],labels:[],broadened:choice.label};
 broader.labels=labelsFor(broader);return broader;
}
