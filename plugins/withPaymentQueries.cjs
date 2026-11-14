const {withAndroidManifest,withInfoPlist}=require('@expo/config-plugins');
module.exports=config=>{
 config=withAndroidManifest(config,mod=>{
 const manifest=mod.modResults.manifest;manifest.queries=manifest.queries||[{}];const queries=manifest.queries[0];
 queries.package=queries.package||[];const pkg='com.google.android.apps.nbu.paisa.user';if(!queries.package.some(p=>p.$?.['android:name']===pkg))queries.package.push({$:{'android:name':pkg}});
 queries.intent=queries.intent||[];
 for(const scheme of ['upi','tez'])if(!queries.intent.some(i=>i.data?.some(d=>d.$?.['android:scheme']===scheme)))queries.intent.push({action:[{$:{'android:name':'android.intent.action.VIEW'}}],category:[{$:{'android:name':'android.intent.category.BROWSABLE'}}],data:[{$:{'android:scheme':scheme}}]});
 return mod;
 });
 return withInfoPlist(config,mod=>{mod.modResults.LSApplicationQueriesSchemes=[...new Set([...(mod.modResults.LSApplicationQueriesSchemes||[]),'gpay','tez','upi'])];return mod;});
};
