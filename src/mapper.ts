import { log, warn, error } from "./log.js";
import Binary from "./bin.js";
import * as _ from "./types.js";
import fs from "fs";

type Config = { [key: string]: string[][] };

const FILE = new Binary("types/dataset");

class Tmapper {
  private config: Config = {};
  private events: _.Events = {};

  private exited: boolean = false;

  constructor() {
    this.loadTypes();
    this.loadConfig();
  
    // Save the types file every 60 seconds and on exit
    setInterval(this.saveTypes.bind(this), 60_000);
    process.on("exit", this.exitHandler.bind(this));
    process.on("SIGINT", this.exitHandler.bind(this));
    process.on("SIGUSR1", this.exitHandler.bind(this));
    process.on("SIGUSR2", this.exitHandler.bind(this));
    process.on("uncaughtException", this.exitHandler.bind(this));
  }

  // Handle on exit events
  private exitHandler(): void {
    if (this.exited) return;
    this.exited = true;
    
    // Save the types file
    this.saveTypes();
    log("Exiting...");

    process.exit(0);
  }

  // Load the types file and parse it
  private loadTypes(): void {
    if (!fs.existsSync("types")) {
      fs.mkdirSync("types");
      warn("Could not find types folder");
    }
    if (!fs.existsSync("types/dataset")) {
      warn("Could not find dataset file");
      return;
    }

    this.events = FILE.decode();
    log(`Loaded dataset file with ${Object.keys(this.events).length} events`);
  }

  // Load the config file and parse it
  private loadConfig(): void {
    if (!fs.existsSync(".cfg")) {
      warn("Could not find .cfg file");
      return;
    }
  
    // Read the file and remove any whitespace
    const content = fs.readFileSync(".cfg", "utf-8").trim();
    let pos = 0;

    // Loop through the file, matching the pattern
    while (pos < content.length) {
      // Match the pattern, and throw an error if it doesn't match
      const match = /^\s*\[(?<event>[A-Z_]+)\]\n(?<fields>([\w.]+(\n|$))+)/.exec(content.slice(pos));
      if (match === null) error(`Invalid config file after position ${pos}`);

      // Get the event name and the fields
      const { event, fields } = match.groups as { event: string, fields: string };
      const fieldList = fields.trim().split("\n").map(v => v.trim().split("."));

      // Throw an error if any of the fields are empty
      if (fieldList.some(v => v.some(v => v === ""))) error(`Invalid config entry for event ${event} after position ${pos}`);
      this.config[event] = fieldList;

      // Increment the position
      pos += match[0].length;
    }

    log("Loaded config file");
  }

  // Save the types file
  private saveTypes(): void {
    log("Saving types...");
    const size = FILE.encode(this.events);
    log(`Saved dataset file with ${Object.keys(this.events).length} events (${size} bytes)`);
  }

  // Register an event
  public register(event: string, data: any): void {
    if (!(event in this.events)) this.events[event] = [{ undef: false, types: [], arr: null, obj: null }];
    
    // Map the data to the base type
    this.map(this.events[event][0], data);
    
    // If there is no config for this event, return
    if (!(event in this.config)) return;
    
    // Get the pattern and analyze the data
    const pattern = structuredClone(this.config[event]);
    const configuration = this.analyze(pattern, data);

    // Find the index of the configuration. If it doesn't exist, add it
    let idx = (this.events[event].slice(1) as _.Entry[]).findIndex(v => this.cmp(configuration, v.where));
    if (idx === -1) {
      this.events[event].push({ where: configuration, data: { undef: false, types: [], arr: null, obj: null } });
      idx = this.events[event].length - 2;
    }

    // Map the data to the configuration
    this.map((this.events[event][idx + 1] as _.Entry).data, data);
  }

  // Map an object to a type
  private map(ref: _.Type, obj: object | object[] | any): void {
    const type = obj === null ? "null" : typeof obj;
    const isArray = Array.isArray(obj);

    // Store the keys that are not undefined
    const notUndef = Object.entries(ref.obj ?? {}).filter(([_, value]) => !value.undef).map(v => v[0]);

    // Map the object as an array
    if (isArray) {
      if (ref.arr === null) ref.arr = { undef: false, types: [], arr: null, obj: null }
      for (const item of obj) this.map(ref.arr, item);
      return;
    }

    // Map the object as an object
    if (type === "object") {
      if (ref.obj === null) ref.obj = {};
      
      // Map the object's keys
      for (const [key, value] of Object.entries(obj)) {
        if (!(key in ref.obj)) ref.obj[key] = { undef: false, types: [], arr: null, obj: null };
        this.map(ref.obj[key], value);
      
        // Remove the key from the notUndef array
        if (notUndef.includes(key)) notUndef.splice(notUndef.indexOf(key), 1);
      }

      // Mark the keys that are undefined
      for (const key of notUndef) ref.obj[key].undef = true;
      return;
    }

    // Map the object as a primitive
    if (!ref.types.some(v => v === type)) ref.types.push(type);
  }

  // Analyze an object and return the properties
  private analyze(keys: string[][], obj: any): { [key: string]: any } {
    const props: { [key: string]: any } = {};

    // Loop through the keys and get the properties
    for (const key of keys) props[key.join(".")] = this.inspect(obj, key);
    return props;
  }

  // Inspect an object and return the value at the given keys
  private inspect(obj: any, keys: string[]): any {
    if (typeof obj !== "object" || obj === null) return;
    
    // Get the key and remove it from the keys array
    const key = keys.shift()!;
    if (!(key in obj)) return;

    // If there are no more keys, return the value, otherwise inspect the object
    if (keys.length === 0) return obj[key];
    return this.inspect(obj[key], keys);
  }

  // Deeply compare two objects
  private cmp(objA: any, objB: any): boolean {
    const typeA = objA === null ? "null" : typeof objA;
    const typeB = objB === null ? "null" : typeof objB;

    // If the types are different, return false
    if (typeA !== typeB) return false;

    // If the types are arrays, compare the lengths and the values
    if (objA instanceof Array) return objA.length === objB.length && objA.every((v, i) => this.cmp(v, objB[i]));

    // If the types are objects, compare the keys and the values
    if (typeA === "object") {
      const keysA = Object.keys(objA);
      const keysB = Object.keys(objB);

      if (keysA.length !== keysB.length || keysA.some(k => !keysB.includes(k))) return false;
      return keysA.every(k => this.cmp(objA[k], objB[k]));
    }
    
    return objA === objB;
  }
}

export default new Tmapper();