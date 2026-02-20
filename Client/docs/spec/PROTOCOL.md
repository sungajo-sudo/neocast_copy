# PenStreamClient 프로토콜 구현 가이드

## 1. 개요

이 문서는 PenStreamServer와 통신하기 위한 클라이언트 측 프로토콜 구현 가이드입니다.

### 1.1 프로토콜 특성

| 항목 | 값 |
|------|-----|
| 전송 방식 | WebSocket (Socket.io) Binary |
| 바이트 순서 | **Little Endian** |
| 문자 인코딩 | UTF-8 |
| UUID 형식 | 16바이트 바이너리 (RFC 4122) |

### 1.2 Socket.io 네임스페이스

| 네임스페이스 | 용도 | 데이터 형식 |
|-------------|------|------------|
| `/stroke` | 필기 데이터 송수신 | Binary |
| `/voice` | 음성 데이터 송수신 | Binary |
| `/control` | 제어 메시지 | JSON |

---

## 2. 기본 데이터 타입

### 2.1 Primitive Types

| 타입 | 크기 | C# 타입 | 범위 |
|------|------|---------|------|
| `uint8` | 1 byte | `byte` | 0 ~ 255 |
| `uint16` | 2 bytes | `ushort` | 0 ~ 65,535 |
| `uint32` | 4 bytes | `uint` | 0 ~ 4,294,967,295 |
| `int32` | 4 bytes | `int` | -2^31 ~ 2^31-1 |
| `int64` | 8 bytes | `long` | -2^63 ~ 2^63-1 |
| `float32` | 4 bytes | `float` | IEEE 754 |
| `float64` | 8 bytes | `double` | IEEE 754 |

### 2.2 UUID (16 bytes)

```
RFC 4122 바이너리 표현:
┌────────────────────────────────────────────────────────────────┐
│ Offset │ Size │ Field                                          │
├────────┼──────┼────────────────────────────────────────────────┤
│   0    │  4   │ time_low                                       │
│   4    │  2   │ time_mid                                       │
│   6    │  2   │ time_hi_and_version                            │
│   8    │  1   │ clock_seq_hi_and_reserved                      │
│   9    │  1   │ clock_seq_low                                  │
│  10    │  6   │ node                                           │
└────────┴──────┴────────────────────────────────────────────────┘
총 16 bytes
```

### 2.3 Color (ARGB, 4 bytes)

```
Little Endian 메모리 레이아웃:
┌────────────────────────────────────────────────────────────────┐
│ Byte 0 │ Byte 1 │ Byte 2 │ Byte 3 │
│  Blue  │  Green │   Red  │  Alpha │
└────────────────────────────────────────────────────────────────┘

예: 빨간색 (불투명) = 0xFFFF0000
    메모리: [0x00, 0x00, 0xFF, 0xFF]
```

---

## 3. 메시지 타입 코드

### 3.1 클라이언트 → 서버

| Code | Name | Size | 설명 |
|------|------|------|------|
| `0x01` | STROKE_START | 39 bytes | 새 스트로크 시작 |
| `0x02` | STROKE_POINT | 35 bytes | 스트로크 점 데이터 |
| `0x03` | STROKE_END | 17 bytes | 스트로크 종료 |
| `0x04` | STROKE_CANCEL | 17 bytes | 스트로크 취소 |
| `0x05` | STROKE_POINT_BATCH | 가변 | 점 배치 전송 |
| `0x10` | PAGE_CHANGE | 5 bytes | 페이지 변경 |
| `0x11` | PAGE_ADD | 14 bytes | 페이지 추가 |
| `0x20` | CLEAR_PAGE | 5 bytes | 페이지 지우기 |
| `0x22` | UNDO | 7 bytes | 실행 취소 |
| `0x23` | REDO | 7 bytes | 다시 실행 |
| `0x30` | POINTER_MOVE | 13 bytes | 포인터 위치 |
| `0x31` | POINTER_ON | 7 bytes | 포인터 켜기 |
| `0x32` | POINTER_OFF | 1 byte | 포인터 끄기 |
| `0x80` | VOICE_DATA | 가변 | 음성 프레임 |
| `0x81` | VOICE_START | 6 bytes | 음성 시작 |
| `0x82` | VOICE_END | 1 byte | 음성 종료 |
| `0x83` | VOICE_MUTE | 1 byte | 음소거 |
| `0x84` | VOICE_UNMUTE | 1 byte | 음소거 해제 |

### 3.2 서버 → 클라이언트

| Code | Name | Size | 설명 |
|------|------|------|------|
| `0xF0` | WRAPPED | 21 + N bytes | 래핑된 메시지 |
| `0xF1` | HISTORY_START | 10 bytes | 히스토리 동기화 시작 |
| `0xF2` | HISTORY_STROKE | 50 + N bytes | 히스토리 스트로크 |
| `0xF3` | HISTORY_END | 5 bytes | 히스토리 동기화 완료 |
| `0xE0` | ERROR | 5 + N bytes | 에러 메시지 |
| `0xE1` | ACK | 가변 | 확인 응답 |

---

## 4. 바이너리 리더/라이터 구현

### 4.1 BinaryWriter (C#)

```csharp
// Protocol/BinaryWriter.cs
using System;
using System.Buffers.Binary;
using System.Collections.Generic;
using System.Text;

namespace PenStreamClient.Protocol;

public class BinaryWriter
{
    private readonly List<byte> _buffer = new();

    public void WriteByte(byte value)
    {
        _buffer.Add(value);
    }

    public void WriteUInt16(ushort value)
    {
        Span<byte> bytes = stackalloc byte[2];
        BinaryPrimitives.WriteUInt16LittleEndian(bytes, value);
        _buffer.AddRange(bytes.ToArray());
    }

    public void WriteUInt32(uint value)
    {
        Span<byte> bytes = stackalloc byte[4];
        BinaryPrimitives.WriteUInt32LittleEndian(bytes, value);
        _buffer.AddRange(bytes.ToArray());
    }

    public void WriteInt32(int value)
    {
        Span<byte> bytes = stackalloc byte[4];
        BinaryPrimitives.WriteInt32LittleEndian(bytes, value);
        _buffer.AddRange(bytes.ToArray());
    }

    public void WriteInt64(long value)
    {
        Span<byte> bytes = stackalloc byte[8];
        BinaryPrimitives.WriteInt64LittleEndian(bytes, value);
        _buffer.AddRange(bytes.ToArray());
    }

    public void WriteFloat(float value)
    {
        Span<byte> bytes = stackalloc byte[4];
        BinaryPrimitives.WriteSingleLittleEndian(bytes, value);
        _buffer.AddRange(bytes.ToArray());
    }

    public void WriteDouble(double value)
    {
        Span<byte> bytes = stackalloc byte[8];
        BinaryPrimitives.WriteDoubleLittleEndian(bytes, value);
        _buffer.AddRange(bytes.ToArray());
    }

    public void WriteGuid(Guid value)
    {
        // .NET의 Guid.ToByteArray()는 mixed-endian이므로 직접 변환
        var bytes = value.ToByteArray();
        _buffer.AddRange(bytes);
    }

    public void WriteBytes(ReadOnlySpan<byte> value)
    {
        _buffer.AddRange(value.ToArray());
    }

    public void WriteString(string value)
    {
        var bytes = Encoding.UTF8.GetBytes(value);
        WriteUInt16((ushort)bytes.Length);
        _buffer.AddRange(bytes);
    }

    public byte[] ToArray() => _buffer.ToArray();

    public void Clear() => _buffer.Clear();

    public int Length => _buffer.Count;
}
```

### 4.2 BinaryReader (C#)

```csharp
// Protocol/BinaryReader.cs
using System;
using System.Buffers.Binary;
using System.Text;

namespace PenStreamClient.Protocol;

public class BinaryReader
{
    private readonly ReadOnlyMemory<byte> _buffer;
    private int _offset;

    public BinaryReader(byte[] buffer)
    {
        _buffer = buffer;
        _offset = 0;
    }

    public BinaryReader(ReadOnlyMemory<byte> buffer)
    {
        _buffer = buffer;
        _offset = 0;
    }

    public int Position => _offset;
    public int Remaining => _buffer.Length - _offset;

    public byte ReadByte()
    {
        var value = _buffer.Span[_offset];
        _offset += 1;
        return value;
    }

    public ushort ReadUInt16()
    {
        var value = BinaryPrimitives.ReadUInt16LittleEndian(_buffer.Span.Slice(_offset, 2));
        _offset += 2;
        return value;
    }

    public uint ReadUInt32()
    {
        var value = BinaryPrimitives.ReadUInt32LittleEndian(_buffer.Span.Slice(_offset, 4));
        _offset += 4;
        return value;
    }

    public int ReadInt32()
    {
        var value = BinaryPrimitives.ReadInt32LittleEndian(_buffer.Span.Slice(_offset, 4));
        _offset += 4;
        return value;
    }

    public long ReadInt64()
    {
        var value = BinaryPrimitives.ReadInt64LittleEndian(_buffer.Span.Slice(_offset, 8));
        _offset += 8;
        return value;
    }

    public float ReadFloat()
    {
        var value = BinaryPrimitives.ReadSingleLittleEndian(_buffer.Span.Slice(_offset, 4));
        _offset += 4;
        return value;
    }

    public double ReadDouble()
    {
        var value = BinaryPrimitives.ReadDoubleLittleEndian(_buffer.Span.Slice(_offset, 8));
        _offset += 8;
        return value;
    }

    public Guid ReadGuid()
    {
        var bytes = _buffer.Span.Slice(_offset, 16).ToArray();
        _offset += 16;
        return new Guid(bytes);
    }

    public byte[] ReadBytes(int count)
    {
        var bytes = _buffer.Span.Slice(_offset, count).ToArray();
        _offset += count;
        return bytes;
    }

    public string ReadString()
    {
        var length = ReadUInt16();
        var bytes = ReadBytes(length);
        return Encoding.UTF8.GetString(bytes);
    }

    public void Skip(int count)
    {
        _offset += count;
    }
}
```

---

## 5. 메시지 구조 상세

### 5.1 STROKE_START (0x01) - 39 bytes

```
┌─────────────────────────────────────────────────────────────────┐
│                      STROKE_START Packet                         │
├────────┬────────┬───────────────────────────────────────────────┤
│ Offset │  Size  │ Field                                         │
├────────┼────────┼───────────────────────────────────────────────┤
│   0    │   1    │ Type (0x01)                                   │
│   1    │  16    │ StrokeId (Guid)                               │
│  17    │   4    │ PageId (uint32)                               │
│  21    │   4    │ Color (ARGB uint32)                           │
│  25    │   4    │ Thickness (float32, mm 단위)                  │
│  29    │   1    │ PenType (uint8)                               │
│  30    │   1    │ Flags (uint8)                                 │
│  31    │   8    │ Timestamp (int64, Unix ms)                    │
└────────┴────────┴───────────────────────────────────────────────┘
```

**C# 구현:**

```csharp
public class StrokeStartMessage
{
    public Guid StrokeId { get; set; }
    public uint PageId { get; set; }
    public uint Color { get; set; }
    public float Thickness { get; set; }
    public PenType PenType { get; set; }
    public StrokeFlags Flags { get; set; }
    public long Timestamp { get; set; }

    public byte[] ToBytes()
    {
        var writer = new BinaryWriter();
        writer.WriteByte(0x01);  // Type
        writer.WriteGuid(StrokeId);
        writer.WriteUInt32(PageId);
        writer.WriteUInt32(Color);
        writer.WriteFloat(Thickness);
        writer.WriteByte((byte)PenType);
        writer.WriteByte((byte)Flags);
        writer.WriteInt64(Timestamp);
        return writer.ToArray();
    }

    public static StrokeStartMessage FromBytes(BinaryReader reader)
    {
        // Type은 이미 읽었다고 가정
        return new StrokeStartMessage
        {
            StrokeId = reader.ReadGuid(),
            PageId = reader.ReadUInt32(),
            Color = reader.ReadUInt32(),
            Thickness = reader.ReadFloat(),
            PenType = (PenType)reader.ReadByte(),
            Flags = (StrokeFlags)reader.ReadByte(),
            Timestamp = reader.ReadInt64()
        };
    }
}

public enum PenType : byte
{
    Pen = 0,
    Highlighter = 1,
    Eraser = 2,
    Brush = 3
}

[Flags]
public enum StrokeFlags : byte
{
    None = 0,
    PressureSensitive = 1,
    TiltSensitive = 2
}
```

### 5.2 STROKE_POINT (0x02) - 35 bytes

```
┌─────────────────────────────────────────────────────────────────┐
│                      STROKE_POINT Packet                         │
├────────┬────────┬───────────────────────────────────────────────┤
│ Offset │  Size  │ Field                                         │
├────────┼────────┼───────────────────────────────────────────────┤
│   0    │   1    │ Type (0x02)                                   │
│   1    │  16    │ StrokeId (Guid)                               │
│  17    │   4    │ X (float32, mm)                               │
│  21    │   4    │ Y (float32, mm)                               │
│  25    │   2    │ Pressure (uint16, 0~65535)                    │
│  27    │   8    │ Timestamp (int64, Unix ms)                    │
└────────┴────────┴───────────────────────────────────────────────┘
```

**좌표계:**

```
(0,0) ─────────────────────────► X (mm)
  │
  │    좌측 상단이 원점
  │    단위: 밀리미터 (mm)
  │    A4 기준: 210mm x 297mm
  │
  ▼
  Y (mm)
```

**압력 값:**

| 값 | 백분율 | 설명 |
|----|--------|------|
| 0 | 0% | 최소 필압 (호버) |
| 32768 | 50% | 중간 필압 |
| 65535 | 100% | 최대 필압 |

**C# 구현:**

```csharp
public class StrokePointMessage
{
    public Guid StrokeId { get; set; }
    public float X { get; set; }      // mm 단위
    public float Y { get; set; }      // mm 단위
    public ushort Pressure { get; set; }  // 0~65535
    public long Timestamp { get; set; }

    public byte[] ToBytes()
    {
        var writer = new BinaryWriter();
        writer.WriteByte(0x02);
        writer.WriteGuid(StrokeId);
        writer.WriteFloat(X);
        writer.WriteFloat(Y);
        writer.WriteUInt16(Pressure);
        writer.WriteInt64(Timestamp);
        return writer.ToArray();
    }

    public static StrokePointMessage FromBytes(BinaryReader reader)
    {
        return new StrokePointMessage
        {
            StrokeId = reader.ReadGuid(),
            X = reader.ReadFloat(),
            Y = reader.ReadFloat(),
            Pressure = reader.ReadUInt16(),
            Timestamp = reader.ReadInt64()
        };
    }

    // 압력 값을 0.0~1.0 비율로 변환
    public float PressureNormalized => Pressure / 65535f;
}
```

### 5.3 STROKE_POINT_BATCH (0x05) - 가변

```
┌─────────────────────────────────────────────────────────────────┐
│                  STROKE_POINT_BATCH Packet                       │
├────────┬────────┬───────────────────────────────────────────────┤
│ Offset │  Size  │ Field                                         │
├────────┼────────┼───────────────────────────────────────────────┤
│   0    │   1    │ Type (0x05)                                   │
│   1    │  16    │ StrokeId (Guid)                               │
│  17    │   2    │ PointCount (uint16)                           │
│  19    │  18*N  │ Points[] (N개의 Point)                        │
└────────┴────────┴───────────────────────────────────────────────┘

Point 구조 (18 bytes each):
┌────────┬────────┬───────────────────────────────────────────────┐
│   0    │   4    │ X (float32)                                   │
│   4    │   4    │ Y (float32)                                   │
│   8    │   2    │ Pressure (uint16)                             │
│  10    │   8    │ Timestamp (int64)                             │
└────────┴────────┴───────────────────────────────────────────────┘
```

**C# 구현:**

```csharp
public class StrokePointBatchMessage
{
    public Guid StrokeId { get; set; }
    public List<PointData> Points { get; set; } = new();

    public byte[] ToBytes()
    {
        var writer = new BinaryWriter();
        writer.WriteByte(0x05);
        writer.WriteGuid(StrokeId);
        writer.WriteUInt16((ushort)Points.Count);

        foreach (var point in Points)
        {
            writer.WriteFloat(point.X);
            writer.WriteFloat(point.Y);
            writer.WriteUInt16(point.Pressure);
            writer.WriteInt64(point.Timestamp);
        }

        return writer.ToArray();
    }

    public static StrokePointBatchMessage FromBytes(BinaryReader reader)
    {
        var message = new StrokePointBatchMessage
        {
            StrokeId = reader.ReadGuid()
        };

        var count = reader.ReadUInt16();
        for (int i = 0; i < count; i++)
        {
            message.Points.Add(new PointData
            {
                X = reader.ReadFloat(),
                Y = reader.ReadFloat(),
                Pressure = reader.ReadUInt16(),
                Timestamp = reader.ReadInt64()
            });
        }

        return message;
    }
}

public struct PointData
{
    public float X;
    public float Y;
    public ushort Pressure;
    public long Timestamp;
}
```

### 5.4 STROKE_END (0x03) - 17 bytes

```
┌─────────────────────────────────────────────────────────────────┐
│                       STROKE_END Packet                          │
├────────┬────────┬───────────────────────────────────────────────┤
│   0    │   1    │ Type (0x03)                                   │
│   1    │  16    │ StrokeId (Guid)                               │
└────────┴────────┴───────────────────────────────────────────────┘
```

### 5.5 STROKE_CANCEL (0x04) - 17 bytes

```
┌─────────────────────────────────────────────────────────────────┐
│                     STROKE_CANCEL Packet                         │
├────────┬────────┬───────────────────────────────────────────────┤
│   0    │   1    │ Type (0x04)                                   │
│   1    │  16    │ StrokeId (Guid)                               │
└────────┴────────┴───────────────────────────────────────────────┘
```

---

## 6. 서버 메시지 처리

### 6.1 WRAPPED (0xF0) - 21 + N bytes

다른 사용자의 메시지를 감싸서 전달받습니다.

```
┌─────────────────────────────────────────────────────────────────┐
│                       WRAPPED Packet                             │
├────────┬────────┬───────────────────────────────────────────────┤
│   0    │   1    │ Type (0xF0)                                   │
│   1    │  16    │ SenderId (Guid, 원본 송신자)                  │
│  17    │   4    │ PayloadLength (uint32)                        │
│  21    │   N    │ Payload (원본 패킷)                           │
└────────┴────────┴───────────────────────────────────────────────┘
```

**C# 구현:**

```csharp
public class WrappedMessage
{
    public Guid SenderId { get; set; }
    public byte[] Payload { get; set; } = Array.Empty<byte>();

    public static WrappedMessage FromBytes(BinaryReader reader)
    {
        return new WrappedMessage
        {
            SenderId = reader.ReadGuid(),
            Payload = reader.ReadBytes((int)reader.ReadUInt32())
        };
    }

    // Payload를 파싱하여 원본 메시지 추출
    public object ParsePayload()
    {
        var payloadReader = new BinaryReader(Payload);
        var type = (MessageType)payloadReader.ReadByte();

        return type switch
        {
            MessageType.StrokeStart => StrokeStartMessage.FromBytes(payloadReader),
            MessageType.StrokePoint => StrokePointMessage.FromBytes(payloadReader),
            MessageType.StrokeEnd => new { StrokeId = payloadReader.ReadGuid() },
            MessageType.StrokeCancel => new { StrokeId = payloadReader.ReadGuid() },
            _ => throw new InvalidOperationException($"Unknown wrapped message type: {type}")
        };
    }
}
```

### 6.2 HISTORY_START (0xF1) - 10 bytes

```
┌─────────────────────────────────────────────────────────────────┐
│                     HISTORY_START Packet                         │
├────────┬────────┬───────────────────────────────────────────────┤
│   0    │   1    │ Type (0xF1)                                   │
│   1    │   4    │ TotalStrokes (uint32)                         │
│   5    │   4    │ TotalPages (uint32)                           │
│   9    │   1    │ FromArchive (uint8, bool)                     │
└────────┴────────┴───────────────────────────────────────────────┘
```

### 6.3 HISTORY_STROKE (0xF2) - 50 + N bytes

```
┌─────────────────────────────────────────────────────────────────┐
│                    HISTORY_STROKE Packet                         │
├────────┬────────┬───────────────────────────────────────────────┤
│   0    │   1    │ Type (0xF2)                                   │
│   1    │  16    │ StrokeId (Guid)                               │
│  17    │  16    │ UserId (Guid, 작성자)                         │
│  33    │   4    │ PageId (uint32)                               │
│  37    │   4    │ Color (ARGB uint32)                           │
│  41    │   4    │ Thickness (float32)                           │
│  45    │   1    │ PenType (uint8)                               │
│  46    │   4    │ CompressedLength (uint32)                     │
│  50    │   N    │ CompressedPoints (Brotli 압축)                │
└────────┴────────┴───────────────────────────────────────────────┘
```

**압축 해제 후 Points 구조:**

```
Delta-encoded point array:
┌─────────────────────────────────────────────────────────────────┐
│ uint16   PointCount                                              │
│ int16[]  DeltaX (첫 번째는 절대값 * 100)                         │
│ int16[]  DeltaY (첫 번째는 절대값 * 100)                         │
│ uint8[]  Pressure (0-255로 스케일됨)                             │
│ uint16[] DeltaTime (첫 번째는 0)                                 │
└─────────────────────────────────────────────────────────────────┘
```

**C# 구현 (압축 해제):**

```csharp
public class HistoryStrokeMessage
{
    public Guid StrokeId { get; set; }
    public Guid UserId { get; set; }
    public uint PageId { get; set; }
    public uint Color { get; set; }
    public float Thickness { get; set; }
    public PenType PenType { get; set; }
    public List<StrokePoint> Points { get; set; } = new();

    public static HistoryStrokeMessage FromBytes(BinaryReader reader)
    {
        var message = new HistoryStrokeMessage
        {
            StrokeId = reader.ReadGuid(),
            UserId = reader.ReadGuid(),
            PageId = reader.ReadUInt32(),
            Color = reader.ReadUInt32(),
            Thickness = reader.ReadFloat(),
            PenType = (PenType)reader.ReadByte()
        };

        var compressedLength = reader.ReadUInt32();
        var compressedData = reader.ReadBytes((int)compressedLength);

        // Brotli 압축 해제
        using var ms = new MemoryStream(compressedData);
        using var brotli = new BrotliStream(ms, CompressionMode.Decompress);
        using var output = new MemoryStream();
        brotli.CopyTo(output);
        var decompressedData = output.ToArray();

        // Delta 디코딩
        message.Points = DecodeDeltaPoints(decompressedData);

        return message;
    }

    private static List<StrokePoint> DecodeDeltaPoints(byte[] data)
    {
        var reader = new BinaryReader(data);
        var pointCount = reader.ReadUInt16();

        var deltaX = new short[pointCount];
        var deltaY = new short[pointCount];
        var pressure = new byte[pointCount];
        var deltaTime = new ushort[pointCount];

        for (int i = 0; i < pointCount; i++)
            deltaX[i] = (short)reader.ReadUInt16();

        for (int i = 0; i < pointCount; i++)
            deltaY[i] = (short)reader.ReadUInt16();

        for (int i = 0; i < pointCount; i++)
            pressure[i] = reader.ReadByte();

        for (int i = 0; i < pointCount; i++)
            deltaTime[i] = reader.ReadUInt16();

        // 델타 디코딩
        var points = new List<StrokePoint>(pointCount);
        float x = deltaX[0] / 100f;  // 첫 번째는 절대값
        float y = deltaY[0] / 100f;
        long time = 0;

        for (int i = 0; i < pointCount; i++)
        {
            if (i > 0)
            {
                x += deltaX[i] / 100f;
                y += deltaY[i] / 100f;
                time += deltaTime[i];
            }

            points.Add(new StrokePoint
            {
                X = x,
                Y = y,
                Pressure = (ushort)(pressure[i] * 257),  // 0-255 → 0-65535
                Timestamp = time
            });
        }

        return points;
    }
}
```

### 6.4 HISTORY_END (0xF3) - 5 bytes

```
┌─────────────────────────────────────────────────────────────────┐
│                      HISTORY_END Packet                          │
├────────┬────────┬───────────────────────────────────────────────┤
│   0    │   1    │ Type (0xF3)                                   │
│   1    │   4    │ SyncedStrokes (uint32)                        │
└────────┴────────┴───────────────────────────────────────────────┘
```

### 6.5 ERROR (0xE0) - 5 + N bytes

```
┌─────────────────────────────────────────────────────────────────┐
│                        ERROR Packet                              │
├────────┬────────┬───────────────────────────────────────────────┤
│   0    │   1    │ Type (0xE0)                                   │
│   1    │   2    │ ErrorCode (uint16)                            │
│   3    │   2    │ MessageLength (uint16)                        │
│   5    │   N    │ Message (UTF-8 string)                        │
└────────┴────────┴───────────────────────────────────────────────┘
```

**에러 코드:**

| Code | Name | 설명 |
|------|------|------|
| 1001 | SESSION_NOT_FOUND | 세션을 찾을 수 없음 |
| 1002 | SESSION_CLOSED | 세션이 종료됨 |
| 1003 | SESSION_FULL | 세션 인원 초과 |
| 2001 | PERMISSION_DENIED | 권한 없음 |
| 2002 | NOT_HOST | 호스트 권한 필요 |
| 3001 | INVALID_PACKET | 잘못된 패킷 형식 |
| 3002 | INVALID_STROKE_ID | 잘못된 스트로크 ID |
| 4001 | RATE_LIMITED | 요청 제한 초과 |

---

## 7. 음성 메시지

### 7.1 VOICE_START (0x81) - 6 bytes

```
┌─────────────────────────────────────────────────────────────────┐
│                      VOICE_START Packet                          │
├────────┬────────┬───────────────────────────────────────────────┤
│   0    │   1    │ Type (0x81)                                   │
│   1    │   4    │ SampleRate (uint32)                           │
│   5    │   1    │ Channels (uint8)                              │
└────────┴────────┴───────────────────────────────────────────────┘
```

### 7.2 VOICE_DATA (0x80) - 15 + N bytes

```
┌─────────────────────────────────────────────────────────────────┐
│                      VOICE_DATA Packet                           │
├────────┬────────┬───────────────────────────────────────────────┤
│   0    │   1    │ Type (0x80)                                   │
│   1    │   4    │ SequenceNumber (uint32)                       │
│   5    │   8    │ Timestamp (int64, Unix ms)                    │
│  13    │   2    │ DataLength (uint16)                           │
│  15    │   N    │ OpusFrame (Opus 인코딩 데이터)                │
└────────┴────────┴───────────────────────────────────────────────┘
```

**음성 설정 권장값:**

| 항목 | 값 |
|------|-----|
| Codec | Opus |
| Sample Rate | 48000 Hz |
| Channels | 1 (Mono) |
| Frame Size | 20ms (960 samples) |
| Bitrate | 24000 bps |

---

## 8. Control 채널 (JSON)

`/control` 네임스페이스는 JSON 형식을 사용합니다.

### 8.1 세션 상태 변경

```json
{
  "type": "SESSION_STATUS",
  "status": "active",
  "timestamp": 1704067200000
}
```

### 8.2 참가자 이벤트

```json
// 참가
{
  "type": "PARTICIPANT_JOIN",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "userName": "홍길동",
  "role": "guest",
  "timestamp": 1704067200000
}

// 퇴장
{
  "type": "PARTICIPANT_LEAVE",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "reason": "disconnect",
  "timestamp": 1704067200000
}
```

### 8.3 권한 변경

```json
{
  "type": "PERMISSION_CHANGED",
  "guestId": "550e8400-e29b-41d4-a716-446655440000",
  "canReceiveFrom": [
    "host-uuid-here",
    "other-guest-uuid"
  ],
  "timestamp": 1704067200000
}
```

### 8.4 히스토리 동기화

```json
// 시작
{
  "type": "HISTORY_SYNC_START",
  "totalStrokes": 150,
  "totalPages": 3,
  "fromArchive": true
}

// 진행
{
  "type": "HISTORY_SYNC_PROGRESS",
  "syncedStrokes": 75,
  "totalStrokes": 150,
  "percentage": 50
}

// 완료
{
  "type": "HISTORY_SYNC_END",
  "syncedStrokes": 150,
  "duration": 2500
}
```

---

## 9. 메시지 파서 구현

### 9.1 통합 메시지 파서

```csharp
// Protocol/MessageParser.cs
public static class MessageParser
{
    public static object Parse(byte[] data)
    {
        var reader = new BinaryReader(data);
        var type = (MessageType)reader.ReadByte();

        return type switch
        {
            // 클라이언트 → 서버 (수신하지 않음)
            MessageType.StrokeStart => StrokeStartMessage.FromBytes(reader),
            MessageType.StrokePoint => StrokePointMessage.FromBytes(reader),
            MessageType.StrokePointBatch => StrokePointBatchMessage.FromBytes(reader),

            // 서버 → 클라이언트
            MessageType.Wrapped => WrappedMessage.FromBytes(reader),
            MessageType.HistoryStart => HistoryStartMessage.FromBytes(reader),
            MessageType.HistoryStroke => HistoryStrokeMessage.FromBytes(reader),
            MessageType.HistoryEnd => HistoryEndMessage.FromBytes(reader),
            MessageType.Error => ErrorMessage.FromBytes(reader),

            // 음성
            MessageType.VoiceData => VoiceDataMessage.FromBytes(reader),

            _ => throw new InvalidOperationException($"Unknown message type: 0x{(byte)type:X2}")
        };
    }
}

public enum MessageType : byte
{
    // 스트로크
    StrokeStart = 0x01,
    StrokePoint = 0x02,
    StrokeEnd = 0x03,
    StrokeCancel = 0x04,
    StrokePointBatch = 0x05,

    // 페이지
    PageChange = 0x10,
    PageAdd = 0x11,
    PageDelete = 0x12,

    // 편집
    ClearPage = 0x20,
    ClearAll = 0x21,
    Undo = 0x22,
    Redo = 0x23,

    // 포인터
    PointerMove = 0x30,
    PointerOn = 0x31,
    PointerOff = 0x32,

    // 음성
    VoiceData = 0x80,
    VoiceStart = 0x81,
    VoiceEnd = 0x82,
    VoiceMute = 0x83,
    VoiceUnmute = 0x84,

    // 서버 메시지
    Wrapped = 0xF0,
    HistoryStart = 0xF1,
    HistoryStroke = 0xF2,
    HistoryEnd = 0xF3,

    // 에러
    Error = 0xE0,
    Ack = 0xE1
}
```

---

## 10. 연결 핸드셰이크

### 10.1 Socket.io 연결 시 인증

```csharp
var options = new SocketIOOptions
{
    Auth = new
    {
        token = "JWT_TOKEN_HERE"
    },
    Query = new Dictionary<string, string>
    {
        ["protocolVersion"] = "1.0",
        ["clientVersion"] = "1.0.0",
        ["platform"] = GetPlatform()
    },
    Reconnection = true,
    ReconnectionAttempts = 5,
    ReconnectionDelay = 1000,
    Transport = TransportProtocol.WebSocket
};

var socket = new SocketIOClient.SocketIO("https://server.example.com/stroke", options);
```

### 10.2 세션 참가

```csharp
// REST API로 세션 참가
var response = await httpClient.PostAsync(
    $"/api/sessions/{sessionCode}/join",
    new StringContent("", Encoding.UTF8, "application/json")
);
var sessionInfo = await response.Content.ReadFromJsonAsync<SessionInfo>();

// Socket.io로 Room 참가
await strokeSocket.EmitAsync("join", new { sessionId = sessionInfo.Id });
await voiceSocket.EmitAsync("join", new { sessionId = sessionInfo.Id });
await controlSocket.EmitAsync("join", new { sessionId = sessionInfo.Id });
```

---

## 11. 버전 호환성

### 11.1 프로토콜 버전 협상

서버 응답:

```json
{
  "protocolVersion": "1.0",
  "serverVersion": "1.0.0",
  "compatible": true
}
```

### 11.2 하위 호환성 규칙

| 규칙 | 설명 |
|------|------|
| 새 필드 | 패킷 끝에만 추가 |
| 기존 필드 | 오프셋/크기 변경 금지 |
| Reserved | 0으로 설정, 무시 |
| 알 수 없는 타입 | 에러 없이 무시 |

---

## 12. 부록

### 12.1 체크리스트

**송신 구현:**
- [ ] STROKE_START 패킷 생성
- [ ] STROKE_POINT 패킷 생성 (실시간)
- [ ] STROKE_POINT_BATCH 패킷 생성 (배치)
- [ ] STROKE_END 패킷 생성
- [ ] STROKE_CANCEL 패킷 생성
- [ ] VOICE_START/DATA/END 패킷 생성

**수신 구현:**
- [ ] WRAPPED 메시지 파싱
- [ ] HISTORY_START/STROKE/END 파싱
- [ ] ERROR 메시지 처리
- [ ] Control 채널 JSON 처리

**연결 관리:**
- [ ] JWT 인증
- [ ] 세션 참가/나가기
- [ ] 자동 재연결
- [ ] 오프라인 버퍼링

### 12.2 디버깅 팁

```csharp
// 패킷 덤프
public static void DumpPacket(byte[] data, string label)
{
    var hex = BitConverter.ToString(data).Replace("-", " ");
    Console.WriteLine($"[{label}] {data.Length} bytes: {hex}");
}

// 사용
DumpPacket(writer.ToArray(), "STROKE_START");
// 출력: [STROKE_START] 39 bytes: 01 55 0E 84 00 E2 9B 41 D4 ...
```

---

*문서 버전: 1.0*
*최종 수정: 2026-01-09*
