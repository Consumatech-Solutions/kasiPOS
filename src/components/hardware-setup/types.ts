import { LucideIcon } from "lucide-react";

export type DeviceType = "printer" | "scanner" | "reader";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export type ModalStep =
  | "choice"
  | "searching"
  | "found"
  | "connecting"
  | "success"
  | "error";

export interface HardwareDevice {
  id: DeviceType;
  name: string;
  icon: LucideIcon;
  status: ConnectionStatus;
  modelName?: string;
  connectionType?:
    | "Bluetooth"
    | "USB"
    | "Network"
    | "WebUSB"
    | "WebHID"
    | "Server";
  deviceId?: string;
}
