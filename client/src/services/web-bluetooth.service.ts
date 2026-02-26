/**
 * Web Bluetooth API wrapper for NeoSmartpen
 * Based on PenStreamer.Browser/wwwroot/webBluetooth.js
 */

// NeoSmartpen service and characteristic UUIDs
const SERVICE_UUID_16 = 0x19f1;
const SERVICE_UUID_128 = '4f99f138-9d53-5bfa-9e50-b147491afe68';
// Write/Notify UUIDs (16-bit used for comparison)
const WRITE_CHAR_UUID_128 = '8bc8cc7d-88ca-56b0-af9a-9bf514d0d61a';
const NOTI_CHAR_UUID_128 = '64cd86b1-2256-5aeb-9f04-2caf6c60ae57';

interface DeviceInfo {
  device: BluetoothDevice;
  server: BluetoothRemoteGATTServer | null;
  service: BluetoothRemoteGATTService | null;
  writeChar: BluetoothRemoteGATTCharacteristic | null;
  notiChar: BluetoothRemoteGATTCharacteristic | null;
}

type DataReceivedCallback = (deviceId: string, data: Uint8Array) => void;
type DisconnectedCallback = (deviceId: string) => void;

class WebBluetoothService {
  private devices = new Map<string, DeviceInfo>();
  private writeQueues = new Map<string, Array<{ data: Uint8Array; resolve: () => void; reject: (e: Error) => void }>>();
  private writeLocks = new Map<string, boolean>();

  private dataReceivedCallbacks = new Map<string, DataReceivedCallback>();
  private disconnectedCallbacks = new Map<string, DisconnectedCallback>();

  /**
   * Check if Web Bluetooth API is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (!('bluetooth' in navigator)) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Request a NeoSmartpen device
   */
  async requestDevice(): Promise<string | null> {
    try {
      const options: RequestDeviceOptions = {
        filters: [{ services: [SERVICE_UUID_16] }, { services: [SERVICE_UUID_128] }],
        optionalServices: [SERVICE_UUID_16, SERVICE_UUID_128],
      };

      const device = await navigator.bluetooth.requestDevice(options);

      if (device) {
        this.devices.set(device.id, {
          device: device,
          server: null,
          service: null,
          writeChar: null,
          notiChar: null,
        });

        device.addEventListener('gattserverdisconnected', () => {
          this.onDeviceDisconnected(device.id);
        });

        return device.id;
      }
    } catch (error) {
      console.error('[WebBluetooth] requestDevice error:', error);
    }
    return null;
  }

  /**
   * Connect to a device
   */
  async connectDevice(deviceId: string): Promise<boolean> {
    try {
      const deviceInfo = this.devices.get(deviceId);
      if (!deviceInfo) {
        console.error('[WebBluetooth] Device not found:', deviceId);
        return false;
      }

      const device = deviceInfo.device;
      if (!device.gatt) {
        console.error('[WebBluetooth] GATT not available');
        return false;
      }

      console.log('[WebBluetooth] Connecting to GATT server...');
      const server = await device.gatt.connect();
      deviceInfo.server = server;

      // Try to get NeoSmartpen service (16-bit first, then 128-bit)
      let service: BluetoothRemoteGATTService | null = null;
      try {
        console.log('[WebBluetooth] Getting primary service (16-bit)...');
        service = await server.getPrimaryService(SERVICE_UUID_16);
      } catch {
        try {
          console.log('[WebBluetooth] Getting primary service (128-bit)...');
          service = await server.getPrimaryService(SERVICE_UUID_128);
        } catch (e2) {
          console.error('[WebBluetooth] Failed to get service:', e2);
          return false;
        }
      }
      deviceInfo.service = service;

      // Get characteristics
      console.log('[WebBluetooth] Getting characteristics...');
      const characteristics = await service.getCharacteristics();

      for (const char of characteristics) {
        const uuid = char.uuid;

        // Check for write characteristic
        if (uuid.includes('2ba0') || uuid === WRITE_CHAR_UUID_128.toLowerCase()) {
          deviceInfo.writeChar = char;
          console.log('[WebBluetooth] Write characteristic found');
        }

        // Check for notification characteristic
        if (uuid.includes('2ba1') || uuid === NOTI_CHAR_UUID_128.toLowerCase()) {
          deviceInfo.notiChar = char;
          console.log('[WebBluetooth] Notification characteristic found');

          try {
            await char.startNotifications();
            console.log('[WebBluetooth] Notifications started');
          } catch (e) {
            console.error('[WebBluetooth] startNotifications error:', e);
          }

          char.addEventListener('characteristicvaluechanged', (event) => {
            const target = event.target as unknown as BluetoothRemoteGATTCharacteristic;
            if (target?.value) {
              this.onNotificationReceived(deviceId, target.value);
            }
          });
        }
      }

      if (!deviceInfo.writeChar || !deviceInfo.notiChar) {
        console.error('[WebBluetooth] Required characteristics not found');
        return false;
      }

      console.log('[WebBluetooth] Connected successfully');
      return true;
    } catch (error) {
      console.error('[WebBluetooth] Connect error:', error);
      return false;
    }
  }

  /**
   * Disconnect from a device
   */
  async disconnectDevice(deviceId: string): Promise<void> {
    try {
      const deviceInfo = this.devices.get(deviceId);
      if (deviceInfo?.server?.connected) {
        deviceInfo.server.disconnect();
      }
    } catch (error) {
      console.error('[WebBluetooth] Disconnect error:', error);
    }
  }

  /**
   * Write data to a device
   */
  async writeData(deviceId: string, data: Uint8Array): Promise<void> {
    if (!this.writeQueues.has(deviceId)) {
      this.writeQueues.set(deviceId, []);
    }

    return new Promise((resolve, reject) => {
      this.writeQueues.get(deviceId)!.push({ data, resolve, reject });
      this.processWriteQueue(deviceId);
    });
  }

  private async processWriteQueue(deviceId: string): Promise<void> {
    if (this.writeLocks.get(deviceId)) {
      return;
    }

    const queue = this.writeQueues.get(deviceId);
    if (!queue || queue.length === 0) {
      return;
    }

    this.writeLocks.set(deviceId, true);

    while (queue.length > 0) {
      const item = queue.shift()!;
      try {
        const deviceInfo = this.devices.get(deviceId);
        if (!deviceInfo?.writeChar) {
          item.reject(new Error('Write characteristic not available'));
          continue;
        }

        // Convert Uint8Array to ArrayBuffer for Web Bluetooth API
        const buffer = new ArrayBuffer(item.data.length);
        new Uint8Array(buffer).set(item.data);

        if (deviceInfo.writeChar.properties.writeWithoutResponse) {
          await deviceInfo.writeChar.writeValueWithoutResponse(buffer);
        } else if (deviceInfo.writeChar.properties.write) {
          await deviceInfo.writeChar.writeValueWithResponse(buffer);
        } else {
          item.reject(new Error('Write not supported'));
          continue;
        }
        item.resolve();
      } catch (error) {
        item.reject(error as Error);
      }

      // Small delay between writes to prevent GATT conflicts
      await new Promise((r) => setTimeout(r, 20));
    }

    this.writeLocks.set(deviceId, false);
  }

  /**
   * Get device name
   */
  getDeviceName(deviceId: string): string {
    const deviceInfo = this.devices.get(deviceId);
    return deviceInfo?.device.name || 'Unknown';
  }

  /**
   * Check if device is connected
   */
  isConnected(deviceId: string): boolean {
    const deviceInfo = this.devices.get(deviceId);
    return deviceInfo?.server?.connected || false;
  }

  /**
   * Register data received callback
   */
  onDataReceived(deviceId: string, callback: DataReceivedCallback): void {
    this.dataReceivedCallbacks.set(deviceId, callback);
  }

  /**
   * Register disconnected callback
   */
  onDisconnected(deviceId: string, callback: DisconnectedCallback): void {
    this.disconnectedCallbacks.set(deviceId, callback);
  }

  /**
   * Remove callbacks for a device
   */
  removeCallbacks(deviceId: string): void {
    this.dataReceivedCallbacks.delete(deviceId);
    this.disconnectedCallbacks.delete(deviceId);
  }

  private onNotificationReceived(deviceId: string, dataView: DataView): void {
    const data = new Uint8Array(dataView.buffer);
    const callback = this.dataReceivedCallbacks.get(deviceId);
    if (callback) {
      callback(deviceId, data);
    }
  }

  private onDeviceDisconnected(deviceId: string): void {
    this.devices.delete(deviceId);
    this.writeQueues.delete(deviceId);
    this.writeLocks.delete(deviceId);

    const callback = this.disconnectedCallbacks.get(deviceId);
    if (callback) {
      callback(deviceId);
    }

    this.dataReceivedCallbacks.delete(deviceId);
    this.disconnectedCallbacks.delete(deviceId);
  }
}

// Singleton instance
export const webBluetoothService = new WebBluetoothService();
