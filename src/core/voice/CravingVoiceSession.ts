import {hindiGreeting} from './speechProfile';
export type BuddyState='IDLE'|'SPEAKING'|'LISTENING'|'PROCESSING'|'RESULTS';
export type VoicePort={
 speak:(text:string,done:()=>void,error:()=>void)=>void;
 stopSpeaking:()=>Promise<void>;
 available:()=>boolean;
 unavailableReason?:()=>string;
 permission:()=>Promise<boolean>;
 start:(language:string)=>void;
 abort:()=>void;
 on:(event:'result'|'end'|'error',callback:(event:any)=>void)=>()=>void;
};
export const greeting=hindiGreeting;
// All callbacks and permission continuations belong to one generation. Closing,
// typing, backgrounding or retrying invalidates them before stopping native audio.
export class CravingVoiceSession {
 private generation=0;
 private removers:Array<()=>void>=[];
 private timer:ReturnType<typeof setTimeout>|undefined;
 private foreground=true;
 private permissionSession:number|undefined;
 private resumePermission:((active:boolean)=>void)|undefined;
 constructor(private voice:VoicePort,private update:(state:BuddyState,message?:string,transcript?:string)=>void,private submit:(text:string)=>void,private timeouts={speech:18000,listen:12000}){}
 cancel(){
  ++this.generation;clearTimeout(this.timer);this.timer=undefined;
  this.permissionSession=undefined;this.resumePermission?.(false);this.resumePermission=undefined;
  this.removers.splice(0).forEach(remove=>remove());
  try{this.voice.abort();}catch{}
  return this.voice.stopSpeaking().catch(()=>{});
 }
 appStateChanged(state:string){
  if(state==='active'){this.foreground=true;this.resumePermission?.(true);return;}
  if(state!=='background')return;
  this.foreground=false;
  // Android's permission Activity also emits background. No recording exists
  // yet, so keep the sheet/session while that request resolves.
  if(this.permissionSession===this.generation)return;
  void this.cancel();this.update('IDLE','Voice paused while you were away. Tap the mic to continue.');
 }
 async open(language:string){
  const stopped=this.cancel(),session=this.generation;
  await stopped;if(session!==this.generation)return;
  this.update('SPEAKING');
  this.timer=setTimeout(()=>{if(session!==this.generation)return;void this.cancel();this.update('IDLE','Voice greeting is unavailable. Type your craving or tap Retry microphone.');},this.timeouts.speech);
  try{this.voice.speak(greeting,()=>{if(session!==this.generation)return;clearTimeout(this.timer);void this.listen(language,session);},()=>{if(session!==this.generation)return;void this.cancel();this.update('IDLE','Voice greeting is unavailable. Type your craving or tap Retry microphone.');});}
  catch{if(session===this.generation){void this.cancel();this.update('IDLE','Voice is unavailable in this build. You can type below.');}}
 }
 async retry(language:string){const stopped=this.cancel(),session=this.generation;await stopped;if(session===this.generation)await this.listen(language,session);}
 private async listen(language:string,session:number){
  let transcript='';
  const fail=(message:string)=>{if(session!==this.generation)return;void this.cancel();this.update('IDLE',message,transcript);};
  try{
   if(!this.foreground){fail('Return to RotiHai and tap the mic to continue.');return;}
   if(!this.voice.available()){fail(this.voice.unavailableReason?.()||'Speech recognition is unavailable on this device or build. Type your craving below.');return;}
   this.update('IDLE','Allow microphone and speech access to talk, or type below.');
   this.permissionSession=session;
   const granted=await this.voice.permission();if(session!==this.generation)return;
   if(granted&&!this.foreground){
    // Android may resolve permission just before reporting the Activity active.
    // Allow that brief ordering difference; never start recording in background
    // or automatically restart a session after a prolonged real app switch.
    const returned=await new Promise<boolean>(resolve=>{
     this.resumePermission=resolve;
     this.timer=setTimeout(()=>resolve(false),1500);
    });
    if(session!==this.generation)return;
    clearTimeout(this.timer);this.timer=undefined;this.resumePermission=undefined;
    if(!returned){fail('Microphone access is ready. Tap the mic when you return to continue.');return;}
   }
   this.permissionSession=undefined;
   if(!granted){fail('Microphone or speech access was denied. Type below, or enable access in device settings and retry.');return;}
   this.removers.push(this.voice.on('result',event=>{
    if(session!==this.generation)return;
    transcript=event.results?.[0]?.transcript?.trim()||transcript;
    this.update('LISTENING',undefined,transcript);
    if(event.isFinal&&transcript){void this.cancel();this.update('PROCESSING',undefined,transcript);this.submit(transcript);}
   }));
   this.removers.push(this.voice.on('end',()=>{
    if(session!==this.generation)return;
    if(transcript){void this.cancel();this.update('PROCESSING',undefined,transcript);this.submit(transcript);}
    else fail('I didn’t catch that. Retry microphone or type your craving.');
   }));
   this.removers.push(this.voice.on('error',event=>{
    const errors:Record<string,string>={'not-allowed':'Microphone or speech access was denied. Enable Microphone and Speech Recognition for RotiHai in Settings, then retry.','language-not-supported':'This speech service does not support that language. Try the other language or add Hindi in your phone’s speech settings.','no-speech':'I didn’t catch that. Tap the microphone and try again.','audio-capture':'The microphone is unavailable or in use. Close other recording apps, check microphone access, then retry.','network':'Your speech service needs a connection. Reconnect and tap the microphone again.'};
    fail(errors[event.error]||'Speech recognition stopped. Tap the microphone to try again.');
   }));
   this.update('LISTENING',undefined,'');
   this.timer=setTimeout(()=>fail('Listening timed out. Retry microphone or type your craving.'),this.timeouts.listen);
   this.voice.start(language);
  }catch{fail('Could not start speech recognition. Retry or type your craving.');}
 }
}
