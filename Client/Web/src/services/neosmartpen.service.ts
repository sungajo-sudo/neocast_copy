/**
 * NeoSmartpen Pen Client Service
 * Handles NeoSmartpen protocol parsing and pen events
 * Based on PenStreamer.Browser/Bluetooth/WebBluetoothPenClient.cs
 */

import { webBluetoothService } from './web-bluetooth.service';
import {
  Protocol,
  DotType,
  PacketReader,
  PacketBuilder,
  type DotData,
  type PenConnectedData,
  type PenStatusData,
  type NcodePageAddress,
} from './pen-protocol';

type DotCallback = (dot: DotData) => void;
type ConnectedCallback = (data: PenConnectedData) => void;
type DisconnectedCallback = () => void;
type AuthenticatedCallback = () => void;
type PasswordRequestedCallback = (retryCount: number, maxRetryCount: number) => void;
type BatteryCallback = (battery: number) => void;
type StatusCallback = (status: PenStatusData) => void;
type ErrorCallback = (error: string) => void;
type LogCallback = (message: string) => void;

class NeoSmartpenService {
  private deviceId: string | null = null;
  private buffer: number[] = [];
  private isEscaped = false;

  // Pen state
  private maxForce = -1;
  private _isStartWithDown = false;
  private currentTime = BigInt(-1);
  private currentSection = -1;
  private currentOwner = -1;
  private currentNote = -1;
  private currentPage = -1;
  private _penTipColor = -1;
  private dotCount = 0;

  // Device info
  private _deviceName = '';
  private _firmwareVersion = '';
  private _protocolVersion = '';
  private _macAddress = '';
  private _battery = -1;
  private _isConnected = false;
  private _isAuthenticated = false;

  // Callbacks
  private dotCallback: DotCallback | null = null;
  private connectedCallback: ConnectedCallback | null = null;
  private disconnectedCallback: DisconnectedCallback | null = null;
  private authenticatedCallback: AuthenticatedCallback | null = null;
  private passwordRequestedCallback: PasswordRequestedCallback | null = null;
  private batteryCallback: BatteryCallback | null = null;
  private statusCallback: StatusCallback | null = null;
  private errorCallback: ErrorCallback | null = null;
  private logCallback: LogCallback | null = null;

  // Getters
  get deviceName(): string {
    return this._deviceName;
  }
  get firmwareVersion(): string {
    return this._firmwareVersion;
  }
  get protocolVersion(): string {
    return this._protocolVersion;
  }
  get macAddress(): string {
    return this._macAddress;
  }
  get battery(): number {
    return this._battery;
  }
  get isStartWithDown(): boolean {
    return this._isStartWithDown;
  }
  get penTipColor(): number {
    return this._penTipColor;
  }
  get isConnected(): boolean {
    return this._isConnected;
  }
  get isAuthenticated(): boolean {
    return this._isAuthenticated;
  }
  get currentPageAddress(): NcodePageAddress | null {
    if (this.currentSection < 0) return null;
    return {
      section: this.currentSection,
      owner: this.currentOwner,
      book: this.currentNote,
      page: this.currentPage,
    };
  }

  /**
   * Check if Web Bluetooth is available
   */
  async isAvailable(): Promise<boolean> {
    return webBluetoothService.isAvailable();
  }

  /**
   * Scan and connect to a NeoSmartpen
   */
  async connect(): Promise<boolean> {
    try {
      this.log('Requesting device...');
      const deviceId = await webBluetoothService.requestDevice();
      if (!deviceId) {
        this.log('Device request cancelled');
        return false;
      }

      this.deviceId = deviceId;
      this.log(`Device selected: ${webBluetoothService.getDeviceName(deviceId)}`);

      // Register callbacks
      webBluetoothService.onDataReceived(deviceId, (_id, data) => this.onDataReceived(data));
      webBluetoothService.onDisconnected(deviceId, () => this.onDeviceDisconnected());

      this.log('Connecting...');
      const connected = await webBluetoothService.connectDevice(deviceId);
      if (!connected) {
        this.log('Connection failed');
        return false;
      }

      this.log('Starting handshake...');
      this.startHandshake();
      return true;
    } catch (error) {
      this.log(`Connect error: ${error}`);
      return false;
    }
  }

  /**
   * Disconnect from the pen
   */
  async disconnect(): Promise<void> {
    if (this.deviceId) {
      await webBluetoothService.disconnectDevice(this.deviceId);
      this.deviceId = null;
    }
  }

  /**
   * Input password for locked pen
   */
  inputPassword(password: string): void {
    const packet = new PacketBuilder(Protocol.CMD_PASSWORD_REQUEST).putString(password, 16).build();
    this.sendPacket(packet);
  }

  // Event registration
  onDot(callback: DotCallback): void {
    this.dotCallback = callback;
  }
  onConnected(callback: ConnectedCallback): void {
    this.connectedCallback = callback;
  }
  onDisconnected(callback: DisconnectedCallback): void {
    this.disconnectedCallback = callback;
  }
  onAuthenticated(callback: AuthenticatedCallback): void {
    this.authenticatedCallback = callback;
  }
  onPasswordRequested(callback: PasswordRequestedCallback): void {
    this.passwordRequestedCallback = callback;
  }
  onBattery(callback: BatteryCallback): void {
    this.batteryCallback = callback;
  }
  onStatus(callback: StatusCallback): void {
    this.statusCallback = callback;
  }
  onError(callback: ErrorCallback): void {
    this.errorCallback = callback;
  }
  onLog(callback: LogCallback): void {
    this.logCallback = callback;
  }

  private startHandshake(): void {
    this.reqVersion();
  }

  private onDataReceived(data: Uint8Array): void {
    for (const b of data) {
      this.parseByte(b);
    }
  }

  private onDeviceDisconnected(): void {
    this._isConnected = false;
    this._isAuthenticated = false;
    this.deviceId = null;
    this.disconnectedCallback?.();
  }

  private parseByte(b: number): void {
    if (b === Protocol.STX) {
      this.buffer = [];
      this.isEscaped = false;
      return;
    }

    if (b === Protocol.ETX) {
      if (this.buffer.length >= 4) {
        this.processPacket();
      }
      this.buffer = [];
      return;
    }

    if (b === Protocol.DLE) {
      this.isEscaped = true;
      return;
    }

    if (this.isEscaped) {
      this.buffer.push(b ^ 0x20);
      this.isEscaped = false;
    } else {
      this.buffer.push(b);
    }
  }

  private processPacket(): void {
    const data = new Uint8Array(this.buffer);
    if (data.length < 3) return;

    const cmd = data[0];
    const hasResult = (cmd >> 4) !== 0x6 && cmd !== 0x73;
    let offset = 1;

    if (hasResult && data.length > offset) {
      offset++;
    }

    if (data.length < offset + 2) return;

    const length = data[offset] | (data[offset + 1] << 8);
    offset += 2;

    const packetData = new Uint8Array(length);
    if (length > 0 && data.length >= offset + length) {
      packetData.set(data.slice(offset, offset + Math.min(length, data.length - offset)));
    }

    this.parsePacket(cmd, packetData);
  }

  private parsePacket(cmd: number, data: Uint8Array): void {
    const reader = new PacketReader(data);

    switch (cmd) {
      case Protocol.CMD_VERSION_RESPONSE:
        this.parseVersionResponse(reader);
        break;

      case Protocol.CMD_SETTING_INFO_RESPONSE:
        this.parseSettingInfoResponse(reader);
        break;

      case Protocol.CMD_PASSWORD_RESPONSE:
        this.parsePasswordResponse(reader);
        break;

      case Protocol.CMD_ONLINE_DATA_RESPONSE:
        // Online data mode enabled
        break;

      case Protocol.EVT_LOW_BATTERY:
        this._battery = reader.getByteToInt();
        this.batteryCallback?.(this._battery);
        break;

      case Protocol.EVT_SHUTDOWN:
        this.onDeviceDisconnected();
        break;

      // Dot events (Protocol V2 legacy)
      case Protocol.EVT_PEN_UPDOWN:
      case Protocol.EVT_PAPER_INFO:
      case Protocol.EVT_PEN_DOT:
      case Protocol.EVT_PEN_ERROR:
        this.parseDotEvent(cmd, reader);
        break;

      // Dot events (Protocol V2 new)
      case Protocol.EVT_NEW_PEN_DOWN:
      case Protocol.EVT_NEW_PEN_UP:
      case Protocol.EVT_NEW_PAPER_INFO:
      case Protocol.EVT_NEW_PEN_DOT:
      case Protocol.EVT_NEW_PEN_ERROR:
        this.parseNewDotEvent(cmd, reader);
        break;
    }
  }

  private parseVersionResponse(reader: PacketReader): void {
    this._deviceName = reader.getString(16);
    this._firmwareVersion = reader.getString(16);
    this._protocolVersion = reader.getString(8);
    reader.getString(16); // subName
    reader.getUShort(); // deviceType
    const macBytes = reader.getBytes(6);
    this._macAddress = Array.from(macBytes)
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(':');

    this.log(`Device: ${this._deviceName}, FW: ${this._firmwareVersion}`);
    this.requestPenStatus();
  }

  private parseSettingInfoResponse(reader: PacketReader): void {
    const locked = reader.getByteToInt() === 1;
    const pwdMaxRetryCount = reader.getByteToInt();
    const pwdRetryCount = reader.getByteToInt();
    reader.getLong(); // timestamp
    reader.getShort(); // autoPowerOffTime
    const maxForce = reader.getShort();
    reader.getByteToInt(); // usedStorage
    reader.getByteToInt(); // penCapOff
    reader.getByteToInt(); // autoPowerOn
    const beep = reader.getByteToInt() === 1;
    const hover = reader.getByteToInt() === 1;
    const batteryLeft = reader.getByteToInt();
    reader.getByteToInt(); // useOffline
    const fsrStep = reader.getByteToInt();

    this._battery = batteryLeft;

    // First time - complete connection
    if (this.maxForce === -1) {
      this.maxForce = maxForce;
      this._isConnected = true;

      this.log(`Connected (MaxForce=${this.maxForce})`);

      this.connectedCallback?.({
        macAddress: this._macAddress,
        deviceName: this._deviceName,
        firmwareVersion: this._firmwareVersion,
        protocolVersion: this._protocolVersion,
        maxForce: this.maxForce,
      });

      if (locked) {
        this.passwordRequestedCallback?.(pwdRetryCount, pwdMaxRetryCount);
      } else {
        this.completeAuthentication();
      }
    } else {
      this.statusCallback?.({
        battery: batteryLeft,
        beep,
        hover,
        sensitivity: fsrStep,
      });
    }
  }

  private parsePasswordResponse(reader: PacketReader): void {
    const status = reader.getByteToInt();
    const cntRetry = reader.getByteToInt();
    const cntMax = reader.getByteToInt();

    if (status === 1) {
      this.completeAuthentication();
    } else {
      this.passwordRequestedCallback?.(cntRetry, cntMax);
    }
  }

  private completeAuthentication(): void {
    this.setPenTime(Date.now());
    this._isAuthenticated = true;
    this.authenticatedCallback?.();
    this.log('Authenticated - ready');
    this.enableAllNotes();
  }

  private parseDotEvent(cmd: number, reader: PacketReader): void {
    switch (cmd) {
      case Protocol.EVT_PEN_UPDOWN: {
        const updown = reader.getByteToInt();
        this.currentTime = reader.getLong();
        this._penTipColor = reader.getInt();

        if (updown === 0) {
          // Pen down
          this._isStartWithDown = true;
          this.dotCount = 0;
        } else {
          // Pen up
          this._isStartWithDown = false;
          this.emitDot(0, 0, 0, DotType.PenUp);
        }
        break;
      }

      case Protocol.EVT_PAPER_INFO: {
        const rb = reader.getBytes(4);
        this.currentSection = rb[3] & 0xff;
        this.currentOwner = rb[0] | (rb[1] << 8) | (rb[2] << 16);
        this.currentNote = reader.getInt();
        this.currentPage = reader.getInt();
        break;
      }

      case Protocol.EVT_PEN_DOT: {
        const timeAdd = reader.getByteToInt();
        this.currentTime += BigInt(timeAdd);

        const force = reader.getShort();
        const x = reader.getShort();
        const y = reader.getShort();
        const fx = reader.getByteToInt();
        const fy = reader.getByteToInt();

        const realX = x + fx * 0.01;
        const realY = y + fy * 0.01;

        const dotType = this.dotCount === 0 ? DotType.PenDown : DotType.PenMove;
        this.emitDot(realX, realY, force, dotType);
        this.dotCount++;
        break;
      }

      case Protocol.EVT_PEN_ERROR: {
        const errorCode = reader.getByteToInt();
        this.errorCallback?.(`Pen error code: ${errorCode}`);
        break;
      }
    }
  }

  private parseNewDotEvent(cmd: number, reader: PacketReader): void {
    switch (cmd) {
      case Protocol.EVT_NEW_PEN_DOWN: {
        reader.getByteToInt(); // ecount
        this.currentTime = reader.getLong();
        reader.getByte(); // penTipType
        this._penTipColor = reader.getInt();

        this._isStartWithDown = true;
        this.dotCount = 0;
        break;
      }

      case Protocol.EVT_NEW_PEN_UP: {
        reader.getByteToInt(); // ecount
        this.currentTime = reader.getLong();
        reader.getShort(); // dotCount
        reader.getShort(); // totalImageCount
        reader.getShort(); // processImageCount
        reader.getShort(); // successImageCount
        reader.getShort(); // sendImageCount

        this._isStartWithDown = false;
        this.emitDot(0, 0, 0, DotType.PenUp);
        break;
      }

      case Protocol.EVT_NEW_PAPER_INFO: {
        reader.getByteToInt(); // ecount
        const rb = reader.getBytes(4);
        this.currentSection = rb[3] & 0xff;
        this.currentOwner = rb[0] | (rb[1] << 8) | (rb[2] << 16);
        this.currentNote = reader.getInt();
        this.currentPage = reader.getInt();
        break;
      }

      case Protocol.EVT_NEW_PEN_DOT: {
        reader.getByteToInt(); // ecount
        const timeAdd = reader.getByte();
        this.currentTime += BigInt(timeAdd);

        const force = reader.getShort();
        const x = reader.getUShort();
        const y = reader.getUShort();
        const fx = reader.getByte();
        const fy = reader.getByte();
        const tiltX = reader.getByteToInt();
        const tiltY = reader.getByteToInt();
        const twist = reader.getShort();

        const realX = x + fx * 0.01;
        const realY = y + fy * 0.01;

        const dotType = this.dotCount === 0 ? DotType.PenDown : DotType.PenMove;
        this.emitDot(realX, realY, force, dotType, tiltX, tiltY, twist);
        this.dotCount++;
        break;
      }

      case Protocol.EVT_NEW_PEN_ERROR: {
        reader.getByteToInt(); // ecount
        reader.getByteToInt(); // timeadd
        const force = reader.getShort();
        reader.getByteToInt(); // brightness
        this.errorCallback?.(`Image processing error, force=${force}`);
        break;
      }
    }
  }

  private emitDot(x: number, y: number, force: number, dotType: DotType, tiltX = 0, tiltY = 0, twist = 0): void {
    this.dotCallback?.({
      x,
      y,
      force,
      maxForce: this.maxForce > 0 ? this.maxForce : 1023,
      section: this.currentSection,
      owner: this.currentOwner,
      book: this.currentNote,
      page: this.currentPage,
      timestamp: Number(this.currentTime),
      dotType,
      tiltX,
      tiltY,
      twist,
    });
  }

  // Request methods
  private reqVersion(): void {
    const appVersion = '1.0.0.0';
    const protocolVersion = '2.12';

    const packet = new PacketBuilder(Protocol.CMD_VERSION_REQUEST)
      .putNull(16)
      .put(0x12) // Connection Type: BLE
      .put(0x01)
      .putString(appVersion, 16)
      .putString(protocolVersion, 8)
      .build();

    this.sendPacket(packet);
  }

  private requestPenStatus(): void {
    const packet = new PacketBuilder(Protocol.CMD_SETTING_INFO_REQUEST).build();
    this.sendPacket(packet);
  }

  private setPenTime(timestamp: number): void {
    const packet = new PacketBuilder(Protocol.CMD_SETTING_CHANGE_REQUEST)
      .put(Protocol.SETTING_TIMESTAMP)
      .putLong(BigInt(timestamp))
      .build();
    this.sendPacket(packet);
  }

  private enableAllNotes(): void {
    const packet = new PacketBuilder(Protocol.CMD_ONLINE_DATA_REQUEST)
      .put(0xff)
      .put(0xff)
      .put(0xff)
      .put(0xff)
      .put(0x01)
      .build();
    this.sendPacket(packet);
  }

  private async sendPacket(data: Uint8Array): Promise<void> {
    if (!this.deviceId) return;
    try {
      await webBluetoothService.writeData(this.deviceId, data);
    } catch (error) {
      console.error('[NeoSmartpen] TX error:', error);
    }
  }

  private log(message: string): void {
    console.log(`[NeoSmartpen] ${message}`);
    this.logCallback?.(message);
  }
}

// Singleton instance
export const neosmartpenService = new NeoSmartpenService();
