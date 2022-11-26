import _ from "lodash";
import { MqttClient } from "mqtt";
import { CommandSession } from "../command";
import { CoverMessage, OWNMonitorMessage } from "../monitor";
import { Entity, EntityClass } from "./base";

//https://developer.legrand.com/documentation/open-web-net-for-myhome/
// https://developer.legrand.com/uploads/2019/12/WHO_2.pdf

const MQTT_2_OWN = {
  OPEN: "UP",
  CLOSE: "DOWN",
  STOP: "STOP",
};

export class Cover extends EntityClass<CoverEntity> {
  className = "cover";
  subscribeTopicSuffixes = ["set"];

  public createEntity(config: any): CoverEntity {
    const e = new CoverEntity(this);
    return e;
  }
}

class CoverEntity extends Entity {
  configPayload() {
    return {
      command_topic: `${this.mqttPrefix}/set`,
      state_topic: `${this.mqttPrefix}/state`,
      config_topic: `${this.mqttPrefix}/config`,
      //payload_on: "ON",
      //payload_off: "OFF",
    };
  }
  async handleMQTTMessage(topicSuffix: string, msg: string) {
    if (topicSuffix == "set")
      this.clz.cmd.shutterCommand(this.ownId, (MQTT_2_OWN as any)[msg]);
    //this.clz.cmd.lightCommand(this.ownId, msg == "ON");
  }

  async handleOWNMessage(msg: OWNMonitorMessage) {
    if (msg instanceof CoverMessage)
      this.clz.mqtt.publish(`${this.mqttPrefix}/state`, msg.state);
  }
}
