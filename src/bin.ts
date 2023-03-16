import * as _ from "./types.js";
import fs from "fs";

export default class Binary {
  private path: string;
  
  constructor(path: string) {
    this.path = path;
  }

  public decode(): void {
    if (!fs.existsSync(this.path)) {
      console.log("File does not exist");
      return;
    }
    
    const bin = new Uint8Array(fs.readFileSync(this.path));
    let offset = 0;

    while (offset < bin.length) {
      const buff: number[] = [];
      while (bin[offset] !== 0) buff.push(bin[offset++]);

      const key = new TextDecoder().decode(new Uint8Array(buff));
      console.log(key);
    
      offset++;
    }
  }

  public encode(inp: _.Events): void {
    const bin = new Uint8Array(1024);
    let offset = 0;

    const keys = Object.keys(inp);
    for (const key of keys) {
      bin.set(new TextEncoder().encode(key), offset);
      bin[offset + key.length] = 0;
      offset += key.length + 1;
    }

    fs.writeFileSync(this.path, bin.slice(0, offset));
  }
}

const content: _.Events = JSON.parse(fs.readFileSync("types/events.json", "utf-8"));
const bin = new Binary("./types/dataset");
bin.decode();
bin.encode(content);