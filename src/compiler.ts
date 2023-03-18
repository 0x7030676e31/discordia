import fs from "fs";
import Binary from "./bin.js";
import * as _ from "./types.js";

const FILE = new Binary("types/dataset");

class Compiler {
  constructor() {
    if (!fs.existsSync("./types/dataset")) throw new Error("Could not find events.json file");
    const data = FILE.decode();
  
    const types: string[] = [];
    const events = Object.keys(data).sort();
    for (const event of events) {
      const [type, ...entries] = data[event];

      types.push(`export type ${event} = ${this.compileType(type, 1, event)};`);
      // entries.forEach(entry => console.log(`## ${event}.${Object.keys(entry.where).join(".")}`));
    }

    fs.writeFileSync("./types/types.ts", types.join("\n"));
  }

  private compileType(type: _.Type, depth: number = 1, path: string = ""): string {
    const entries: string[] = [];

    // console.log(path);

    // Compile array
    if (type.arr !== null) entries.push(`${this.compileType(type.arr, depth, `${path}.#`)}[]`);    
    
    // Compile object
    if (type.obj !== null) {
      let str = `{\n`;
      const keys = Object.keys(type.obj);
      for (const key of keys) {
        const entry = type.obj[key];
        str += `${"\t".repeat(depth)}${key}${entry.undef ? "?" : ""}: ${this.compileType(entry, depth + 1, `${path}.${key}`)};\n`;
      }
      entries.push(str + `${"\t".repeat(depth - 1)}}`);
    }

    // Add basic types
    entries.push(...type.types);    
    return entries.join(" | ");
  }
}

new Compiler();