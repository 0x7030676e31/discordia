import { log, warn, error } from "./log.js";
import fs from "fs";

type config = { [key: string]: string[][] };

type Type = {
  undef: boolean;
  types: string[];
  arr: Type | null;
  obj: { [key: string]: Type } | null;
}

type Events = {
  [key: string]: [Type, ...{
    where: { [key: string]: any };
    data: Type;
  }[]];
}

class Tmapper {
  private config: config = {};
  private events: Events = {};

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
    if (!fs.existsSync("types/events.json")) {
      fs.writeFileSync("types/events.json", "{}");
      warn("Could not find events.json file");
    }

    const content = fs.readFileSync("types/events.json", "utf-8");
    this.events = JSON.parse(content);
    log(`Loaded ${content.length} bytes from events.json`);
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

  private saveTypes(): void {
    log("Saving types...");
    fs.writeFileSync("types/events.json", JSON.stringify(this.events));
  }

  // Register an event
  public register(event: string, data: any): void {
    if (!(event in this.events)) this.events[event] = [{ undef: false, types: [], arr: null, obj: null }];
    this.map(this.events[event][0], data);
  }

  // Map an object to a type
  private map(ref: Type, obj: object | object[] | any): void {
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

  // TODO: analyze the types based on the config
  private analyze(): { [key: string]: any } {
    return {};
  }
}

export default new Tmapper();