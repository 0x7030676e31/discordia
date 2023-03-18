import * as _ from "./types.js";
import zlib from "zlib";
import fs from "fs";

type Primitive = string | number | boolean | null | undefined;
type Type = Primitive | Obj | Array<Primitive | Obj>;
type Obj = { [key: string]: Type };

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

    const res: _.Events = {};
    const bin = zlib.inflateSync((fs.readFileSync(this.path)));
    
    let offset = 0;
    while (offset < bin.length) {
      let buff = "";
      while (bin[offset] !== 0x00) buff += String.fromCharCode(bin[offset++]);
      offset++;

      const key = buff;
      const type = this.decodeType(bin.subarray(offset));
      
      res[key] = [ type ];
      break;
    }
  }

  private decodeType(buff: Buffer): _.Type {
    


    return null as any;
  }

  // Encode the data into a binary file
  public encode(inp: _.Events): void {
    const bin: number[] = [];

    const keys = Object.keys(inp);
    for (const key of keys) {
      bin.push(...key.split("").map(c => c.charCodeAt(0)), 0);

      // Encode the first entry
      this.encodeType(inp[key][0], bin);

      // Encode the rest of the entries
      const entries = inp[key].slice(1) as _.Entry[];
      for (const entry of entries) {
        bin.push(...this.encodeJson(entry.where), 0x00);
        this.encodeType(entry.data, bin);
      }

      // End of entry
      bin.push(0x03);
    }

    // Deflate the binary file and write it to disk
    fs.writeFileSync(this.path, zlib.deflateSync(Buffer.from(bin)));
  }

  // Recursively encode the type into a binary file
  private encodeType(type: _.Type, ref: number[]): void {
    let types = type.undef ? 0x01 : 0x00;
    if (type.types.includes("string")) types |= 0x02;
    if (type.types.includes("number")) types |= 0x04;
    if (type.types.includes("boolean")) types |= 0x08;
    if (type.types.includes("null")) types |= 0x10;
    
    ref.push(types);
    const idx = ref.length - 1;
    
    // Encode the array
    if (type.arr !== null) {
      this.encodeType(type.arr, ref);
      ref[idx] |= 0x40;
    }

    // Encode the object
    if (type.obj !== null) {
      const keys = Object.keys(type.obj);
      for (const key of keys) {
        ref.push(...key.split("").map(c => c.charCodeAt(0)), 0);
        this.encodeType(type.obj[key], ref);
      }

      ref[idx] |= 0x80;
    }

    // End of entry
    ref.push(0x00);
  }

  private encodeJson(obj: Obj): number[] {
    const bin: number[] = [];
    this.jsonMap(obj, bin);
    return bin;
  }

  private jsonMap(type: Type, ref: number[]): void {
    switch (typeof type) {
      case "boolean":
        ref.push(+type); // 0x00 = false, 0x01 = true
        break;
  
      case "number":
        type += 0x80_00_00_00; // Add 2^31 to make it positive
        ref.push(
          0x02,
          (type >> 24) & 0xff,
          (type >> 16) & 0xff,
          (type >> 8) & 0xff,
          type & 0xff,
        ); // 0x02 = Number, i32 as 4 bytes
        break;
  
      case "string":
        ref.push(0x03, ...new TextEncoder().encode(type), 0x00); // 0x03 = String, 0x00 = End of string
        break;
  
      case "undefined":
        ref.push(0x04); // 0x04 = Undefined
        break;
      
      case "object":
        if (type === null) {
          ref.push(0x05); // 0x05 = Null
          break;
        }
  
        if (type instanceof Array) {
          ref.push(0x06); // 0x06 = Array
          for (const value of type) this.jsonMap(value, ref);
          ref.push(0x00); // End of entry
          break;
        }
  
        ref.push(0x07); // 0x07 = Object
        const keys = Object.keys(type);
        for (const key of keys) {
          const value = type[key];
          ref.push(...new TextEncoder().encode(key), 0x00);
          this.jsonMap(value, ref);
        }
        ref.push(0x00); // End of entry
        break;
    }
  }
}

const content: _.Events = JSON.parse(fs.readFileSync("types/events.json", "utf-8"));
const bin = new Binary("./types/dataset");
bin.decode();
bin.encode(content);