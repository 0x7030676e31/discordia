import fs from "fs";
import Binary from "./bin.js";
import * as _ from "./types.js";

const FILE = new Binary("types/dataset");

class Compiler {
  private staticFields: { [key: string]: any } = {};
  
  constructor() {
    if (!fs.existsSync("./types/dataset")) throw new Error("Could not find events.json file");
    const data = FILE.decode();
  
    let count = 0;

    const types: string[] = [];
    const declarations: string[] = [];
    const events = Object.keys(data).sort();
    for (const event of events) {
      const [type, ...entries] = data[event];
      count += entries.length + 1;
      
      const eventTypes: string[] = [`MAIN_${event}`];

      // Compile main event
      declarations.push(`${event} with ${entries.length + 1} subtypes`, `\t - MAIN_${event}`);
      types.push(`export type MAIN_${event} = ${this.compileType(type, 1, event)};`);

      // Compile partial events
      for (const idx in entries) {
        const entry = entries[idx];

        // Add static fields to the staticFields object
        for (const key in entry.where) this.staticFields[`${event}.${key}`] = entry.where[key];
        
        // Compile partial event
        types.push(`export type PARTIAL_${event}_${idx} = ${this.compileType(entry.data, 1, event)};`);

        // Add partial event to the eventTypes array
        eventTypes.push(`PARTIAL_${event}_${idx}`);
        declarations.push(`\t - PARTIAL_${event}_${idx} with ${Object.entries(entry.where).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(", ")}`);
        this.staticFields = {};
      }

      // Generate event type
      types.push(`export type ${event} = ${eventTypes.join(" | ")};\n`);
      declarations.push("");
    }

    declarations.push(`\n${events.length} Events mapped`, `${count} Types declared`, `Discordia ${new Date().toLocaleString()}`);

    fs.writeFileSync("./types/types.ts", types.join("\n\n"));
    fs.writeFileSync("./types/declarations.txt", declarations.join("\n"));
  }

  private compileType(type: _.Type, depth: number = 1, path: string = ""): string {
    // Check if the type is a static field
    if (path in this.staticFields) return JSON.stringify(this.staticFields[path]);

    const entries: string[] = [];

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