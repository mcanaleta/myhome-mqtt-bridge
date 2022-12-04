export abstract class OWNMonitorMessage {
  abstract className: ClassName;
  abstract ownId: string;
}
export type ClassName = "light" | "climate" | "cover";
