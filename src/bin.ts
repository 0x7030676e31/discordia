import * as _ from "./types.js";
import zlib from "zlib";
import fs from "fs";

type Primitive = string | number | boolean | null | undefined;
type Type = Primitive | Obj | Type[];
type Obj = { [key: string]: Type };

export default class Binary {
  private path: string;
  private decodeOffset = 0;
  
  constructor(path: string) {
    this.path = path;
  }

  public decode(): _.Events {
    const res: _.Events = {};
    const buff = zlib.inflateSync((fs.readFileSync(this.path)));

    while (this.decodeOffset < buff.length) {
      let key = "";
      while (buff[this.decodeOffset] !== 0x00) key += String.fromCharCode(buff[this.decodeOffset++]);
      this.decodeOffset++;

      res[key] = [ this.decodeType(buff) ];

      while (buff[this.decodeOffset] !== 0x00) {
        const where: Obj = this.decodeJson(buff);
        const data = this.decodeType(buff);
        res[key].push({ where, data });
      }

      this.decodeOffset++;
    }

    return res;
  }

  private decodeType(buff: Buffer): _.Type {
    const typeByte = buff[this.decodeOffset++];
    const type: _.Type = { types: [], undef: Boolean(typeByte & 0x01), arr: null, obj: null };

    // Decode the type
    if (typeByte & 0x02) type.types.push("string");
    if (typeByte & 0x04) type.types.push("number");
    if (typeByte & 0x08) type.types.push("boolean");
    if (typeByte & 0x10) type.types.push("null");

    // Decode the array
    if (typeByte & 0x40) type.arr = this.decodeType(buff);
    
    // Decode the object
    if (!(typeByte & 0x80)) return type; 
    type.obj = {};
    
    // Decode the object keys
    while (true) {
      if (buff[this.decodeOffset] === 0x00) {
        this.decodeOffset++;
        break;
      }

      // Decode the key
      let key = "";
      while (buff[this.decodeOffset] !== 0x00) key += String.fromCharCode(buff[this.decodeOffset++]);
      this.decodeOffset++;
      
      // Decode the type
      type.obj[key] = this.decodeType(buff);
    }

    return type;
  }

  private decodeJson(buff: Buffer): Obj {
    if (buff[this.decodeOffset] !== 0x07) throw new Error("Invalid JSON");
    return this.decodeJsonRec(buff) as Obj;
  }
  
  private decodeJsonRec(buff: Buffer): Type {
    switch (buff[this.decodeOffset++]) {
      case 0x00: return false;
      case 0x01: return true;
      case 0x02:
        const num = buff.readUInt32BE(this.decodeOffset) - 0x80000000;
        this.decodeOffset += 4;
        return num;
  
      case 0x03:
        let str = "";
        while (buff[this.decodeOffset] !== 0x00) str += String.fromCharCode(buff[this.decodeOffset++]);
        this.decodeOffset++;
        return str;
  
      case 0x04: return undefined;
      case 0x05: return null;
      case 0x06:
        const arr: Type[] = [];
        while (buff[this.decodeOffset] !== 0x00) arr.push(this.decodeJsonRec(buff));
        this.decodeOffset++;
        return arr;
      
      case 0x07:
        const obj: Obj = {};
        while (buff[this.decodeOffset] !== 0x00) {
          let key = "";
          while (buff[this.decodeOffset] !== 0x00) key += String.fromCharCode(buff[this.decodeOffset++]);
          this.decodeOffset++;
          obj[key] = this.decodeJsonRec(buff);
        }
        this.decodeOffset++;
        return obj;
    }
  }


  // Encode the data into a binary file
  public encode(inp: _.Events): number {
    const bin: number[] = [];

    const keys = Object.keys(inp);
    for (const key of keys) {
      bin.push(...key.split("").map(c => c.charCodeAt(0)), 0x00);

      // Encode the first entry
      this.encodeType(inp[key][0], bin);

      // Encode the rest of the entries
      const entries = inp[key].slice(1) as _.Entry[];
      for (const entry of entries) {
        bin.push(...this.encodeJson(entry.where));
        this.encodeType(entry.data, bin);
      }

      // End of entry
      bin.push(0x00);
    }

    // Deflate the binary file and write it to disk
    const buff = zlib.deflateSync(Buffer.from(bin));
    fs.writeFileSync(this.path, buff);

    return buff.length;
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
    if (type.obj === null) return;
    const keys = Object.keys(type.obj);
    for (const key of keys) {
      ref.push(...key.split("").map(c => c.charCodeAt(0)), 0);
      this.encodeType(type.obj[key], ref);
    }

    ref[idx] |= 0x80;
    ref.push(0x00);
  }

  private encodeJson(obj: Obj): number[] {
    const bin: number[] = [];
    this.encodeJsonRec(obj, bin);
    return bin;
  }

  private encodeJsonRec(type: Type, ref: number[]): void {
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
        ref.push(0x03, ...type.split("").map(c => c.charCodeAt(0)), 0x00); // 0x03 = String, 0x00 = End of string
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
          for (const value of type) this.encodeJsonRec(value, ref);
          ref.push(0x00); // End of entry
          break;
        }
  
        ref.push(0x07); // 0x07 = Object
        const keys = Object.keys(type);
        for (const key of keys) {
          const value = type[key];
          ref.push(...new TextEncoder().encode(key), 0x00);
          this.encodeJsonRec(value, ref);
        }
        ref.push(0x00); // End of entry
        break;
    }
  }
}
