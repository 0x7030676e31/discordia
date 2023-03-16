export type Type = {
  undef: boolean;
  types: string[];
  arr: Type | null;
  obj: { [key: string]: Type } | null;
}

export type Entry = {
  where: { [key: string]: any };
  data: Type;
}

export type Events = {
  [key: string]: [Type, ...Entry[]];
}