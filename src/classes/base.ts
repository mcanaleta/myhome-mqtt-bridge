import { Dictionary, forEach, invert, keyBy, mapValues } from "lodash";
import { MqttClient } from "mqtt";
import { CommandSession } from "../openwebnet/commandsession";
import { asyncPublish } from "../mqttutils";
import { OWNMonitorMessage } from "../openwebnet/types";

export abstract class EntityClass<ET extends Entity> {
  abstract className: string;

  mqttPrefix!: string;
  entitiesByOWNId!: Dictionary<ET>;
  entities!: Dictionary<ET>;

  public constructor(
    public cmd: CommandSession,
    public mqtt: MqttClient,
    public entitiesConfig: { [name: string]: any }
  ) {}

  public setup() {
    this.mqttPrefix = `homeassistant/${this.className}`;
    this.entities = mapValues(this.entitiesConfig, (config, name) => {
      const e = this.createEntity(config);
      e.name = name;
      e.ownId = config.where;
      e.title = config.name;
      e.mqttPrefix = `${this.mqttPrefix}/${name}`;
      e.setup();
      return e;
    });

    this.entitiesByOWNId = keyBy(this.entities, "ownId");
  }

  abstract createEntity(config: any): ET;

  setupMqtt() {
    Object.values(this.entities).forEach(async (e) => {
      const prefix = e.mqttPrefix;
      const extraPayload = e.configPayload();
      const name = e.title;
      const object_id = e.name;
      const configMessage = { name, object_id, ...extraPayload };
      this.subscribeTopicSuffixes.forEach((s) => {
        this.mqtt.subscribe(`${prefix}/${s}`);
      });
      this.subscribeOnceTopicSuffixes.forEach((s) => {
        this.mqtt.subscribe(`${prefix}/${s}`);
      });
      console.log(`[MQTT] publishing config ${JSON.stringify(configMessage)}`);
      await asyncPublish(
        this.mqtt,
        `${prefix}/config`,
        JSON.stringify(configMessage),
        { retain: true }
      );
      await e.setupMQTT();
    });
  }

  abstract subscribeTopicSuffixes: string[];
  subscribeOnceTopicSuffixes: string[] = [];

  handleOWNMessage(msg: OWNMonitorMessage) {
    const entity = this.entitiesByOWNId[msg.ownId];
    if (entity) {
      entity.handleOWNMessage(msg);
    } else {
      console.log(
        `[OWN] WARN ${this.className} entity not found for OWN id ${msg.ownId}`
      );
      console.log(
        `[OWN] valid entities: ${Object.keys(this.entities).join(",")}`
      );
    }
  }

  handleMQTTMessage(topicSuffix: string, msg: string) {
    const match = /^([^\/]*)\/(.*)$/.exec(topicSuffix);
    if (match) {
      const [_, name, suffix2] = match;
      this.entities[name].handleMQTTMessage(suffix2, msg);
      if (this.subscribeOnceTopicSuffixes.includes(suffix2)) {
        const topic = `${this.mqttPrefix}/${topicSuffix}`;
        this.mqtt.unsubscribe(topic);
      }
    }
  }
}

export abstract class Entity {
  mqttPrefix!: string;
  ownId!: string;
  title!: string;
  name!: string;
  public constructor(public clz: EntityClass<Entity>) {}
  setup() {}
  abstract handleMQTTMessage(topicSuffix: string, msg: string): Promise<void>;
  abstract handleOWNMessage(msg: OWNMonitorMessage): Promise<void>;
  async setupMQTT() {}
  public mqttPublish(topicSuffix: string, message: string, retain = false) {
    const topic = `${this.mqttPrefix}/${topicSuffix}`;
    console.log("[MQTT] publishing message", topic, message);
    this.clz.mqtt.publish(`${topic}`, message, { retain });
  }

  abstract configPayload(): any;
}

export abstract class ClimateEntity extends Entity {}
