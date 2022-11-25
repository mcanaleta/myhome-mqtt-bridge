export type EntityClass = {
  configPayload: any;
  stateMessage: (state: any) => string;
  msg2MyHomeCmdArgs: (msg: any) => any[];
};
