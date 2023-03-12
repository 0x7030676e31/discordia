import fs from "fs";

type config = { [key: string]: string[][] };

type Type = {
  undef: boolean;
  types: string[];
  arr: Type[] | null;
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

  constructor() {
    this.loadTypes();
    this.loadConfig();
  
    // Save the types file every 60 seconds and on exit
    setInterval(this.saveTypes.bind(this), 60000);
    process.on("exit", this.saveTypes.bind(this));
  }

  // Load the types file and parse it
  private loadTypes(): void {
    if (!fs.existsSync("types")) fs.mkdirSync("types");
    if (!fs.existsSync("types/events.json")) fs.writeFileSync("types/events.json", "{}");

    this.events = JSON.parse(fs.readFileSync("types/events.json", "utf-8"));
  }

  // Load the config file and parse it
  private loadConfig(): void {
    if (!fs.existsSync(".cfg")) return;
  
    // Read the file and remove any whitespace
    const content = fs.readFileSync(".cfg", "utf-8").trim();
    let pos = 0;

    // Loop through the file, matching the pattern
    while (pos < content.length) {
      // Match the pattern, and throw an error if it doesn't match
      const match = /^\s*\[(?<event>[A-Z_]+)\]\n(?<fields>([\w.]+(\n|$))+)/.exec(content.slice(pos));
      if (match === null) throw new Error(`Invalid config file after position ${pos}`);

      // Get the event name and the fields
      const { event, fields } = match.groups as { event: string, fields: string };
      const fieldList = fields.trim().split("\n").map(v => v.trim().split("."));

      // Throw an error if any of the fields are empty
      if (fieldList.some(v => v.some(v => v === ""))) throw new Error(`Invalid config entry for event ${event} after position ${pos}`);
      this.config[event] = fieldList;

      // Increment the position
      pos += match[0].length;
    }
  }

  private saveTypes(): void {
    this.events["TEST"]
  }

  public register(event: string, data: any): void {
  
  }
}
export default new Tmapper();