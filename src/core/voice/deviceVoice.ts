import {Platform} from 'react-native';
import Constants,{ExecutionEnvironment} from 'expo-constants';
import {requireOptionalNativeModule} from 'expo-modules-core';
import {chooseHindiVoice,explainVoiceSupport,type VoiceSupport} from './speechProfile';
import type {VoicePort} from './CravingVoiceSession';

type SpeechEngine=Pick<typeof import('expo-speech'),'speak'|'stop'|'getAvailableVoicesAsync'>;
type RecognitionEngine=Pick<typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule,'isRecognitionAvailable'|'requestPermissionsAsync'|'start'|'abort'|'addListener'>;

type SpeechProfile={voices?:Awaited<ReturnType<SpeechEngine['getAvailableVoicesAsync']>>;loadedAt?:number;loading?:Promise<void>;stopping?:Promise<void>};
const profiles=new WeakMap<SpeechEngine,SpeechProfile>();
function profileFor(speech:SpeechEngine){let profile=profiles.get(speech);if(!profile){profile={};profiles.set(speech,profile);}return profile;}
// Enumerating installed voices initializes device TTS, but neither speaks nor
// requests microphone permissions. Cache across sheets; refresh after 5 minutes.
export function prepareSpeech(speech:SpeechEngine):Promise<void>{
 const profile=profileFor(speech);
 if(profile.loading)return profile.loading;
 if(profile.voices&&Date.now()-(profile.loadedAt||0)<300000)return Promise.resolve();
 profile.loading=Promise.resolve().then(()=>speech.getAvailableVoicesAsync()).then(voices=>{profile.voices=voices;profile.loadedAt=Date.now();}).catch(()=>{}).finally(()=>{profile.loading=undefined;});
 return profile.loading;
}
const deviceSpeech=()=>Platform.OS==='web'||requireOptionalNativeModule('ExpoSpeech')?require('expo-speech') as typeof import('expo-speech'):null;
export function prepareDeviceSpeech(){try{const speech=deviceSpeech();if(speech)void prepareSpeech(speech);}catch{/* Voice remains optional; Home must still open. */}}

// Exported for behavioral tests using injected platform engines. A stop also
// invalidates voice enumeration, so a late getVoices result cannot start audio.
export function createVoicePort(speech:SpeechEngine|null,recognition:RecognitionEngine|null,support:VoiceSupport,onHint?:(hint:string)=>void):VoicePort {
 let generation=0,queuedSpeech=false;
 return {
  speak:(text,done,error)=>{
   const token=++generation;
   if(!speech){error();return;}
   void (async()=>{
    let timer:ReturnType<typeof setTimeout>|undefined;
    try{
     const profile=profileFor(speech),preparing=prepareSpeech(speech);
     // Home normally prepares the voice before the tap. An immediate first tap
     // gets at most 120ms of lookup time, then uses the Hindi platform default.
     if(!profile.voices)await Promise.race([preparing,new Promise<void>(resolve=>{timer=setTimeout(resolve,120);})]);
     if(token!==generation)return;
     const voice=chooseHindiVoice(profile.voices||[]);
     onHint?.(voice?'Hindi · '+voice.name:profile.voices?'For clearer Hindi, download a Hindi voice in your phone’s speech settings.':'Hindi · device default');
     queuedSpeech=true;
     speech.speak(text,{language:'hi-IN',voice:voice?.identifier,rate:.96,pitch:1.02,onDone:()=>{if(token===generation){queuedSpeech=false;done();}},onError:()=>{if(token===generation){queuedSpeech=false;error();}}});
    }catch{if(token===generation)error();}finally{clearTimeout(timer);}
   })();
  },
  stopSpeaking:()=>{
   ++generation;
   if(!speech)return Promise.resolve();
   const profile=profileFor(speech);
   // A new sheet has nothing to stop. Still await any previous sheet's stop,
   // so a rapid reopen cannot have its greeting cancelled by a late native stop.
   if(!queuedSpeech)return profile.stopping||Promise.resolve();
   queuedSpeech=false;
   const stopping=Promise.resolve().then(()=>speech.stop());profile.stopping=stopping;
   void stopping.then(()=>{if(profile.stopping===stopping)profile.stopping=undefined;},()=>{if(profile.stopping===stopping)profile.stopping=undefined;});
   return stopping;
  },
  available:()=>support.kind==='ready'&&recognition?.isRecognitionAvailable()===true,
  unavailableReason:()=>support.message,
  permission:async()=>!!(await recognition?.requestPermissionsAsync())?.granted,
  start:language=>recognition?.start({lang:language,interimResults:true,continuous:false,maxAlternatives:1,addsPunctuation:false,recordingOptions:{persist:false}}),
  abort:()=>recognition?.abort(),
  on:(event,callback)=>{const subscription=recognition?.addListener(event,callback);return()=>subscription?.remove();},
 };
}
export function inspectDeviceVoice(){
 const speech=deviceSpeech();
 const hasModule=Platform.OS==='web'||!!requireOptionalNativeModule('ExpoSpeechRecognition');
 const recognition=hasModule?(require('expo-speech-recognition') as typeof import('expo-speech-recognition')).ExpoSpeechRecognitionModule:null;
 let service=false;try{service=recognition?.isRecognitionAvailable()===true;}catch{}
 const support=explainVoiceSupport(Platform.OS,Constants.executionEnvironment===ExecutionEnvironment.StoreClient,hasModule,service);
 return {speech,recognition,support};
}
export function deviceVoice(onHint?:(hint:string)=>void):{port:VoicePort;support:VoiceSupport}{
 const {speech,recognition,support}=inspectDeviceVoice();
 return {port:createVoicePort(speech,recognition,support,onHint),support};
}
