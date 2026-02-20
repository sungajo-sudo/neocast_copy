/**
 * Web Bluetooth API Type Definitions
 * Based on https://webbluetoothcg.github.io/web-bluetooth/
 */

interface BluetoothRequestDeviceFilter {
  services?: BluetoothServiceUUID[];
  name?: string;
  namePrefix?: string;
  manufacturerData?: BluetoothManufacturerDataFilter[];
  serviceData?: BluetoothServiceDataFilter[];
}

interface BluetoothManufacturerDataFilter {
  companyIdentifier: number;
  dataPrefix?: BufferSource;
  mask?: BufferSource;
}

interface BluetoothServiceDataFilter {
  service: BluetoothServiceUUID;
  dataPrefix?: BufferSource;
  mask?: BufferSource;
}

interface RequestDeviceOptions {
  filters?: BluetoothRequestDeviceFilter[];
  optionalServices?: BluetoothServiceUUID[];
  optionalManufacturerData?: number[];
  acceptAllDevices?: boolean;
}

type BluetoothServiceUUID = number | string;
type BluetoothCharacteristicUUID = number | string;
type BluetoothDescriptorUUID = number | string;

interface BluetoothDevice extends EventTarget {
  readonly id: string;
  readonly name?: string;
  readonly gatt?: BluetoothRemoteGATTServer;
  watchAdvertisements(options?: WatchAdvertisementsOptions): Promise<void>;
  forget(): Promise<void>;
  readonly watchingAdvertisements: boolean;
  ongattserverdisconnected: ((this: BluetoothDevice, ev: Event) => void) | null;
  onadvertisementreceived: ((this: BluetoothDevice, ev: BluetoothAdvertisingEvent) => void) | null;
  oncharacteristicvaluechanged: ((this: BluetoothDevice, ev: Event) => void) | null;
  onserviceadded: ((this: BluetoothDevice, ev: Event) => void) | null;
  onservicechanged: ((this: BluetoothDevice, ev: Event) => void) | null;
  onserviceremoved: ((this: BluetoothDevice, ev: Event) => void) | null;
}

interface WatchAdvertisementsOptions {
  signal?: AbortSignal;
}

interface BluetoothAdvertisingEvent extends Event {
  readonly device: BluetoothDevice;
  readonly uuids: BluetoothServiceUUID[];
  readonly name?: string;
  readonly appearance?: number;
  readonly txPower?: number;
  readonly rssi?: number;
  readonly manufacturerData: BluetoothManufacturerDataMap;
  readonly serviceData: BluetoothServiceDataMap;
}

interface BluetoothManufacturerDataMap {
  readonly size: number;
  get(key: number): DataView | undefined;
  has(key: number): boolean;
  [Symbol.iterator](): IterableIterator<[number, DataView]>;
  entries(): IterableIterator<[number, DataView]>;
  keys(): IterableIterator<number>;
  values(): IterableIterator<DataView>;
  forEach(callbackfn: (value: DataView, key: number, map: BluetoothManufacturerDataMap) => void): void;
}

interface BluetoothServiceDataMap {
  readonly size: number;
  get(key: BluetoothServiceUUID): DataView | undefined;
  has(key: BluetoothServiceUUID): boolean;
  [Symbol.iterator](): IterableIterator<[BluetoothServiceUUID, DataView]>;
  entries(): IterableIterator<[BluetoothServiceUUID, DataView]>;
  keys(): IterableIterator<BluetoothServiceUUID>;
  values(): IterableIterator<DataView>;
  forEach(callbackfn: (value: DataView, key: BluetoothServiceUUID, map: BluetoothServiceDataMap) => void): void;
}

interface BluetoothRemoteGATTServer {
  readonly device: BluetoothDevice;
  readonly connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
  getPrimaryServices(service?: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService[]>;
}

interface BluetoothRemoteGATTService extends EventTarget {
  readonly device: BluetoothDevice;
  readonly uuid: string;
  readonly isPrimary: boolean;
  getCharacteristic(characteristic: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic>;
  getCharacteristics(characteristic?: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic[]>;
  getIncludedService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
  getIncludedServices(service?: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService[]>;
  oncharacteristicvaluechanged: ((this: BluetoothRemoteGATTService, ev: Event) => void) | null;
  onserviceadded: ((this: BluetoothRemoteGATTService, ev: Event) => void) | null;
  onservicechanged: ((this: BluetoothRemoteGATTService, ev: Event) => void) | null;
  onserviceremoved: ((this: BluetoothRemoteGATTService, ev: Event) => void) | null;
}

interface BluetoothCharacteristicProperties {
  readonly broadcast: boolean;
  readonly read: boolean;
  readonly writeWithoutResponse: boolean;
  readonly write: boolean;
  readonly notify: boolean;
  readonly indicate: boolean;
  readonly authenticatedSignedWrites: boolean;
  readonly reliableWrite: boolean;
  readonly writableAuxiliaries: boolean;
}

interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  readonly service: BluetoothRemoteGATTService;
  readonly uuid: string;
  readonly properties: BluetoothCharacteristicProperties;
  readonly value?: DataView;
  getDescriptor(descriptor: BluetoothDescriptorUUID): Promise<BluetoothRemoteGATTDescriptor>;
  getDescriptors(descriptor?: BluetoothDescriptorUUID): Promise<BluetoothRemoteGATTDescriptor[]>;
  readValue(): Promise<DataView>;
  writeValue(value: BufferSource): Promise<void>;
  writeValueWithResponse(value: BufferSource): Promise<void>;
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  oncharacteristicvaluechanged: ((this: BluetoothRemoteGATTCharacteristic, ev: Event) => void) | null;
}

interface BluetoothRemoteGATTDescriptor {
  readonly characteristic: BluetoothRemoteGATTCharacteristic;
  readonly uuid: string;
  readonly value?: DataView;
  readValue(): Promise<DataView>;
  writeValue(value: BufferSource): Promise<void>;
}

interface Bluetooth extends EventTarget {
  getAvailability(): Promise<boolean>;
  readonly referringDevice?: BluetoothDevice;
  getDevices(): Promise<BluetoothDevice[]>;
  requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
  onavailabilitychanged: ((this: Bluetooth, ev: Event) => void) | null;
}

interface Navigator {
  readonly bluetooth: Bluetooth;
}

interface BluetoothUUID {
  getService(name: string | number): string;
  getCharacteristic(name: string | number): string;
  getDescriptor(name: string | number): string;
  canonicalUUID(alias: number): string;
}

declare const BluetoothUUID: BluetoothUUID;
