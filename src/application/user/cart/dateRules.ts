export function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validPauseDates(start: string, resume: string, today: string): boolean {
  return validCalendarDate(start) && start >= today && (resume === '' || (validCalendarDate(resume) && resume > start));
}

export function subscriptionPauseRequest(start:string,resume:string,today:string){
 if(!validPauseDates(start,resume,today))throw new Error('Choose a valid pause date. The optional resume date must be later.');
 return {pauseStartDate:start,...(resume?{pauseResumeDate:resume}:{})};
}
