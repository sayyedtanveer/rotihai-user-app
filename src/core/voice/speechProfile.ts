export const hindiGreeting='हाय! आज क्या खाने का मन है? बताओ ना, कुछ बढ़िया ढूँढते हैं!';
export type DeviceVoice={identifier:string;language:string;quality?:string;name?:string};
// Hindi script must use a Hindi voice, rather than an English Indian voice
// reading transliterated Hindi. Voice identity is always selected at runtime.
export function chooseHindiVoice<T extends DeviceVoice>(voices:T[]):T|undefined {
 const rank=(voice:DeviceVoice)=>(voice.language.replace('_','-').toLowerCase()==='hi-in'?10:0)+(voice.quality==='Enhanced'?3:0)+(/premium/i.test(voice.identifier)?2:0);
 return voices.filter(v=>/^hi(?:[-_]|$)/i.test(v.language)).sort((a,b)=>rank(b)-rank(a))[0];
}
export type VoiceSupport={kind:'ready'|'expo-go'|'missing-module'|'missing-service'|'unsupported-browser';message:string};
export function explainVoiceSupport(platform:string,expoGo:boolean,hasModule:boolean,hasService:boolean):VoiceSupport {
 if(platform!=='web'&&expoGo)return {kind:'expo-go',message:'You’re in Expo Go. Microphone conversations need the installed RotiHai development app. For a quick speech test here, tap the text field and use your keyboard’s dictation mic.'};
 if(!hasModule)return {kind:'missing-module',message:'This installed app needs an update to enable the microphone. Install the latest RotiHai development build.'};
 if(!hasService)return platform==='web'?{kind:'unsupported-browser',message:'This browser doesn’t support speech recognition. Try Safari on iPhone or Chrome on Android, with microphone access and a secure connection.'}:{kind:'missing-service',message:platform==='android'?'Your phone’s speech recognition service is unavailable. Enable or update the Google speech service in device settings, then try again.':'Speech recognition is unavailable on this iPhone. Check microphone and speech recognition access in Settings, then try again.'};
 return {kind:'ready',message:''};
}
