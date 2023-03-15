import fs from "fs";

type Type = {
  undef: boolean;
  types: string[];
  arr: Type | null;
  obj: { [key: string]: Type } | null;
}

type Entry = {
  where: { [key: string]: any };
  data: Type;
}

type Events = {
  [key: string]: [Type, ...Entry[]];
}

class Compiler {
  constructor() {
    if (!fs.existsSync("./types/events.json")) throw new Error("Could not find events.json file");
    const content = JSON.parse(fs.readFileSync("./types/events.json", "utf-8")) as Events;
  
    // const events = Object.keys(content).sort();
    // for (const event of events) {
    //   console.log(event);
    // }
  }
}

new Compiler();