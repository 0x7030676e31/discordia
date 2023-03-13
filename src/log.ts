const reset = "\x1b[0m";
const yellow = "\x1b[38;2;189;183;107m";
const blue = "\x1b[38;2;65;105;225m";
const orange = "\x1b[38;2;255;140;0m";
const red = "\x1b[38;2;255;0;0m";


const date = new Date();
function fmtDate(): string {
  let diff = new Date().getTime() - date.getTime();
  
  const hours = Math.floor(diff / 3_600_000);
  diff -= hours * 3_600_000;
  
  const minutes = Math.floor(diff / 60_000);
  diff -= minutes * 60_000;
  
  const seconds = (diff / 1000).toFixed(2);

  const sPadStart =  " ".repeat(2 - seconds.toString().split(".")[0].length);
  const sPadEnd =  " ".repeat(2 - (seconds.toString().split(".")?.[1]?.length ?? 0));
  
  return `[${yellow}${hours}h ${minutes.toString().padStart(2, " ")}m ${sPadStart}${seconds}${sPadEnd}s${reset}]`;
}

export function log(msg: string): void {
  console.log(`${fmtDate()} ${blue}${msg}${reset}`);
}

export function warn(msg: string): void {
  console.log(`${fmtDate()} ${orange}${msg}${reset}`);
}

export function error(msg: string): never {
  console.log(`${fmtDate()} ${red}${msg}${reset}`);
  process.exit(1);
}