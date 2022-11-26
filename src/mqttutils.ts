import { IClientPublishOptions, MqttClient } from "mqtt";
export async function asyncPublish(
  mqtt: MqttClient,
  topic: string,
  msg: any,
  opts?: IClientPublishOptions
) {
  return new Promise((res, rej) => {
    mqtt.publish(topic, msg, opts || {}, (err, packet) => {
      if (err) {
        rej(err);
      } else {
        res(packet);
      }
    });
  });
}
