import { IClientOptions } from "mqtt";
import { ConnectOptions } from "./connection";

export type Map<T> = { [id: string]: T };
export type Config = {
  mqtt: {
    url: string;
    opts?: IClientOptions;
  };

  myhome: ConnectOptions;

  // home assistant ID => myhome number , area pl, etc
  entities: {
    light: Map<string>;
    cover: Map<string>;
    climate: Map<string>;
  };
};
