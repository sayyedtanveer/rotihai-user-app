const fs=require('fs'),path=require('path'),cp=require('child_process');
const adb=path.join(process.env.LOCALAPPDATA,'Android/Sdk/platform-tools/adb.exe');
const out=path.resolve('review/screenshots/native');fs.mkdirSync(out,{recursive:true});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const run=(args)=>cp.execFileSync(adb,process.env.ROTIHAI_REVIEW_PACKAGE&&args.includes('host.exp.exponent')?[...args.slice(0,-1),'-n',process.env.ROTIHAI_REVIEW_PACKAGE+'/.MainActivity']:args,{encoding:'utf8',timeout:60000,maxBuffer:20*1024*1024});
const screens=process.argv.slice(2);
(async()=>{for(const name of screens){
 console.log('Opening '+name);
 const url='exp://127.0.0.1:8092/--/review?screen='+encodeURIComponent(name)+'&__expo_disable_fab=1&__expo_disable_auto_launch=1&__expo_disable_onboarding=1';
 run(['shell','am','start','-a','android.intent.action.VIEW','-d',"'"+url+"'",'host.exp.exponent']);
 await wait(2200);
 let xml='';for(let attempt=0;attempt<12;attempt++){try{run(['shell','uiautomator','dump','/sdcard/rotihai-review.xml']);}catch{await wait(800);continue;}xml=run(['exec-out','cat','/sdcard/rotihai-review.xml']);if(xml.includes('WRITES · '+name)&&(name==='Loading'||(!xml.includes('Loading nearby kitchens')&&!xml.includes('content-desc="Loading"'))))break;if(attempt===2)run(['shell','am','start','-a','android.intent.action.VIEW','-d',"'"+url+"'",'host.exp.exponent']);await wait(1400);}if(!xml.includes('WRITES · '+name))throw new Error('Screen did not become ready: '+name);
 fs.writeFileSync(path.join(out,name+'.xml'),xml);
 const png=cp.execFileSync(adb,['exec-out','screencap','-p'],{maxBuffer:20*1024*1024,timeout:60000});fs.writeFileSync(path.join(out,name+'.png'),png);
 const text=[...xml.matchAll(/text="([^"]+)"/g)].map(m=>m[1]).join(' | ');
 console.log(name+': '+text.slice(0,300));
 if(text.includes('Something went wrong')||text.includes('LogBox'))process.exitCode=1;
}})().catch(e=>{console.error(e.message);process.exitCode=1});
