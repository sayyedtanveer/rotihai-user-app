const {withAppBuildGradle}=require('@expo/config-plugins');
module.exports=config=>withAppBuildGradle(config,mod=>{
 if(!mod.modResults.contents.includes('CMAKE_OBJECT_PATH_MAX')){
  mod.modResults.contents=mod.modResults.contents.replace(/defaultConfig\s*\{/,'defaultConfig {\n        // Shorten generated C++ object paths on Windows.\n        externalNativeBuild { cmake { arguments "-DCMAKE_OBJECT_PATH_MAX=240" } }');
 }
 return mod;
});
