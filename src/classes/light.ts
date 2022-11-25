import _ from "lodash";
import { EntityClass } from "./base";

export const light: EntityClass = {
  configPayload: {
    payload_on: "ON",
    payload_off: "OFF",
  },

  stateMessage: (state: any) => {
    return state ? "ON" : "OFF";
  },

  msg2MyHomeCmdArgs: (msg: any) => {
    return [msg == "ON"];
  },
};
