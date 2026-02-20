# PenStreamClient 기술 아키텍처 결정서

## 1. 기술 스택 선택

### 1.1 UI 프레임워크: Avalonia 11 (선택)

**선택 근거:**

| 기준 | Avalonia | MAUI | Uno Platform | Electron |
|------|----------|------|--------------|----------|
| 크로스플랫폼 | ⭐⭐⭐ Win/Mac/Linux/Mobile | ⭐⭐ Win/Mac/Mobile | ⭐⭐⭐ | ⭐⭐⭐ |
| 성능 | ⭐⭐⭐ 네이티브 수준 | ⭐⭐ | ⭐⭐ | ⭐ |
| 바이너리 크기 | ⭐⭐⭐ ~30MB | ⭐⭐ ~50MB | ⭐⭐ | ⭐ ~150MB+ |
| 그래픽 렌더링 | ⭐⭐⭐ SkiaSharp 내장 | ⭐⭐ | ⭐⭐ | ⭐⭐ |
| MVVM 지원 | ⭐⭐⭐ 네이티브 | ⭐⭐⭐ | ⭐⭐⭐ | ⭐ |
| 성숙도 | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ |

**결론:** 크로스플랫폼 지원, SkiaSharp 기반 고성능 렌더링, 경량 바이너리를 고려하여 Avalonia 선택

---

### 1.2 런타임: .NET 8 LTS

- **AOT 컴파일 지원**: 시작 시간 단축, 메모리 사용량 감소
- **성능 개선**: Span<T>, Memory<T>로 효율적인 바이너리 처리
- **크로스플랫폼**: Windows, macOS, Linux, Android, iOS 지원

---

### 1.3 핵심 라이브러리

| 라이브러리 | 버전 | 용도 |
|-----------|------|------|
| **Avalonia** | 11.x | UI 프레임워크 |
| **CommunityToolkit.Mvvm** | 8.x | MVVM 패턴, 소스 제너레이터 |
| **SocketIOClient** | 3.x | Socket.io 클라이언트 |
| **SkiaSharp** | 2.88+ | 2D 그래픽 렌더링 (Avalonia 내장) |
| **Concentus** | 2.x | Opus 오디오 코덱 |
| **System.IO.Pipelines** | .NET 8 | 고성능 바이너리 스트림 |
| **Microsoft.Extensions.DI** | 8.x | 의존성 주입 |
| **Serilog** | 3.x | 구조화된 로깅 |

---

## 2. 프로젝트 구조

### 2.1 솔루션 구조

```
PenStreamClient/
├── src/
│   ├── PenStreamClient.Core/              # 핵심 비즈니스 로직 (플랫폼 독립)
│   │   ├── Protocol/                      # 바이너리 프로토콜
│   │   │   ├── BinaryReader.cs
│   │   │   ├── BinaryWriter.cs
│   │   │   ├── MessageTypes.cs
│   │   │   └── Messages/
│   │   │       ├── StrokeStart.cs
│   │   │       ├── StrokePoint.cs
│   │   │       └── ...
│   │   │
│   │   ├── Services/                      # 서비스 레이어
│   │   │   ├── Interfaces/
│   │   │   │   ├── IConnectionService.cs
│   │   │   │   ├── IStrokeService.cs
│   │   │   │   └── IVoiceService.cs
│   │   │   ├── ConnectionService.cs
│   │   │   ├── StrokeService.cs
│   │   │   ├── VoiceService.cs
│   │   │   ├── SessionService.cs
│   │   │   └── HistoryService.cs
│   │   │
│   │   ├── Models/                        # 도메인 모델
│   │   │   ├── Session.cs
│   │   │   ├── Participant.cs
│   │   │   ├── Stroke.cs
│   │   │   ├── StrokePoint.cs
│   │   │   └── Permission.cs
│   │   │
│   │   ├── Events/                        # 이벤트 정의
│   │   │   ├── StrokeReceivedEvent.cs
│   │   │   ├── ParticipantJoinedEvent.cs
│   │   │   └── ConnectionStateChangedEvent.cs
│   │   │
│   │   └── Utils/                         # 유틸리티
│   │       ├── UuidHelper.cs
│   │       └── ColorHelper.cs
│   │
│   ├── PenStreamClient.UI/                # Avalonia UI
│   │   ├── App.axaml
│   │   ├── App.axaml.cs
│   │   │
│   │   ├── ViewModels/
│   │   │   ├── MainViewModel.cs
│   │   │   ├── SessionViewModel.cs
│   │   │   ├── CanvasViewModel.cs
│   │   │   ├── ParticipantsViewModel.cs
│   │   │   └── SettingsViewModel.cs
│   │   │
│   │   ├── Views/
│   │   │   ├── MainWindow.axaml
│   │   │   ├── SessionView.axaml
│   │   │   ├── CanvasView.axaml
│   │   │   ├── ParticipantsView.axaml
│   │   │   └── Dialogs/
│   │   │       ├── JoinSessionDialog.axaml
│   │   │       └── PermissionDialog.axaml
│   │   │
│   │   ├── Controls/                      # 커스텀 컨트롤
│   │   │   ├── StrokeCanvas.cs            # 필기 렌더링 캔버스
│   │   │   ├── ToolBar.axaml
│   │   │   └── VoiceIndicator.axaml
│   │   │
│   │   ├── Converters/                    # 값 변환기
│   │   │   ├── ColorToBrushConverter.cs
│   │   │   └── ConnectionStateToIconConverter.cs
│   │   │
│   │   └── Themes/
│   │       └── Default.axaml
│   │
│   ├── PenStreamClient.Desktop/           # 데스크톱 진입점
│   │   ├── Program.cs
│   │   └── PenStreamClient.Desktop.csproj
│   │
│   ├── PenStreamClient.Android/           # Android 진입점
│   │   └── ...
│   │
│   └── PenStreamClient.iOS/               # iOS 진입점
│       └── ...
│
├── tests/
│   ├── PenStreamClient.Core.Tests/
│   └── PenStreamClient.UI.Tests/
│
├── PenStreamClient.sln
└── docs/
    └── spec/
        ├── PLANNING.md
        ├── ARCHITECTURE.md
        └── PROTOCOL.md
```

---

## 3. 아키텍처 패턴

### 3.1 MVVM + Service Layer

```
┌─────────────────────────────────────────────────────────────────┐
│                          View Layer                              │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐    │
│  │  MainWindow   │  │  CanvasView   │  │  ParticipantsView │    │
│  │   (XAML)      │  │   (XAML)      │  │      (XAML)       │    │
│  └───────┬───────┘  └───────┬───────┘  └─────────┬─────────┘    │
└──────────┼──────────────────┼────────────────────┼──────────────┘
           │ DataBinding       │                    │
┌──────────┼──────────────────┼────────────────────┼──────────────┐
│          │           ViewModel Layer             │              │
│  ┌───────┴───────┐  ┌───────┴───────┐  ┌────────┴────────┐     │
│  │ MainViewModel │  │CanvasViewModel│  │ParticipantsVM   │     │
│  │               │  │               │  │                 │     │
│  │ - Sessions    │  │ - Strokes     │  │ - Participants  │     │
│  │ - Status      │  │ - CurrentTool │  │ - Permissions   │     │
│  └───────┬───────┘  └───────┬───────┘  └────────┬────────┘     │
└──────────┼──────────────────┼────────────────────┼──────────────┘
           │ DI                │                    │
┌──────────┼──────────────────┼────────────────────┼──────────────┐
│          │           Service Layer               │              │
│  ┌───────┴───────┐  ┌───────┴───────┐  ┌────────┴────────┐     │
│  │SessionService │  │ StrokeService │  │PermissionService│     │
│  │               │  │               │  │                 │     │
│  │ - Create      │  │ - Send        │  │ - Grant         │     │
│  │ - Join        │  │ - Receive     │  │ - Revoke        │     │
│  │ - Leave       │  │ - Buffer      │  │ - Query         │     │
│  └───────┬───────┘  └───────┬───────┘  └────────┬────────┘     │
└──────────┼──────────────────┼────────────────────┼──────────────┘
           │                   │                    │
┌──────────┼──────────────────┼────────────────────┼──────────────┐
│          │           Protocol Layer              │              │
│  ┌───────┴────────────────────────────────────────┴───────────┐ │
│  │                    ConnectionService                       │ │
│  │  ┌────────────────┐  ┌────────────────┐                    │ │
│  │  │  SocketClient  │  │   RestClient   │                    │ │
│  │  │  (Socket.io)   │  │    (HTTP)      │                    │ │
│  │  └────────────────┘  └────────────────┘                    │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 의존성 주입 설정

```csharp
// App.axaml.cs
public partial class App : Application
{
    public static IServiceProvider Services { get; private set; } = null!;

    public override void OnFrameworkInitializationCompleted()
    {
        var services = new ServiceCollection();
        ConfigureServices(services);
        Services = services.BuildServiceProvider();

        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            desktop.MainWindow = new MainWindow
            {
                DataContext = Services.GetRequiredService<MainViewModel>()
            };
        }

        base.OnFrameworkInitializationCompleted();
    }

    private void ConfigureServices(IServiceCollection services)
    {
        // Configuration
        services.AddSingleton<IConfiguration>(provider =>
            new ConfigurationBuilder()
                .AddJsonFile("appsettings.json", optional: true)
                .AddEnvironmentVariables()
                .Build());

        // Services
        services.AddSingleton<IConnectionService, ConnectionService>();
        services.AddSingleton<IStrokeService, StrokeService>();
        services.AddSingleton<IVoiceService, VoiceService>();
        services.AddSingleton<ISessionService, SessionService>();
        services.AddSingleton<IHistoryService, HistoryService>();
        services.AddSingleton<IPermissionService, PermissionService>();

        // ViewModels
        services.AddTransient<MainViewModel>();
        services.AddTransient<SessionViewModel>();
        services.AddTransient<CanvasViewModel>();
        services.AddTransient<ParticipantsViewModel>();
        services.AddTransient<SettingsViewModel>();

        // Logging
        services.AddLogging(builder =>
        {
            builder.AddSerilog(new LoggerConfiguration()
                .MinimumLevel.Debug()
                .WriteTo.Debug()
                .WriteTo.File("logs/penstreamclient-.log", rollingInterval: RollingInterval.Day)
                .CreateLogger());
        });
    }
}
```

---

## 4. 핵심 컴포넌트 설계

### 4.1 ConnectionService (연결 관리)

```csharp
// Services/ConnectionService.cs
public interface IConnectionService
{
    ConnectionState State { get; }
    IObservable<ConnectionState> StateChanged { get; }

    Task<bool> ConnectAsync(string serverUrl, string token);
    Task DisconnectAsync();

    Task JoinSessionAsync(string sessionId);
    Task LeaveSessionAsync();

    Task SendAsync(string eventName, byte[] data);
    IObservable<byte[]> On(string eventName);
}

public class ConnectionService : IConnectionService, IDisposable
{
    private readonly ILogger<ConnectionService> _logger;
    private SocketIOClient.SocketIO? _strokeSocket;
    private SocketIOClient.SocketIO? _voiceSocket;
    private SocketIOClient.SocketIO? _controlSocket;

    private readonly BehaviorSubject<ConnectionState> _stateSubject =
        new(ConnectionState.Disconnected);

    public ConnectionState State => _stateSubject.Value;
    public IObservable<ConnectionState> StateChanged => _stateSubject.AsObservable();

    public ConnectionService(ILogger<ConnectionService> logger)
    {
        _logger = logger;
    }

    public async Task<bool> ConnectAsync(string serverUrl, string token)
    {
        try
        {
            _stateSubject.OnNext(ConnectionState.Connecting);

            var options = new SocketIOOptions
            {
                Auth = new { token },
                Reconnection = true,
                ReconnectionAttempts = 5,
                ReconnectionDelay = 1000,
                Transport = SocketIOClient.Transport.TransportProtocol.WebSocket
            };

            // Stroke 네임스페이스 연결
            _strokeSocket = new SocketIOClient.SocketIO($"{serverUrl}/stroke", options);
            _strokeSocket.OnConnected += (_, _) =>
                _logger.LogInformation("Stroke socket connected");
            _strokeSocket.OnDisconnected += (_, reason) =>
                _logger.LogWarning("Stroke socket disconnected: {Reason}", reason);
            _strokeSocket.OnReconnecting += (_, attempt) =>
            {
                _stateSubject.OnNext(ConnectionState.Reconnecting);
                _logger.LogInformation("Reconnecting attempt {Attempt}", attempt);
            };

            await _strokeSocket.ConnectAsync();

            // Voice 네임스페이스 연결
            _voiceSocket = new SocketIOClient.SocketIO($"{serverUrl}/voice", options);
            await _voiceSocket.ConnectAsync();

            // Control 네임스페이스 연결
            _controlSocket = new SocketIOClient.SocketIO($"{serverUrl}/control", options);
            await _controlSocket.ConnectAsync();

            _stateSubject.OnNext(ConnectionState.Connected);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Connection failed");
            _stateSubject.OnNext(ConnectionState.Disconnected);
            return false;
        }
    }

    public async Task JoinSessionAsync(string sessionId)
    {
        var joinMessage = new { sessionId };

        await _strokeSocket!.EmitAsync("join", joinMessage);
        await _voiceSocket!.EmitAsync("join", joinMessage);
        await _controlSocket!.EmitAsync("join", joinMessage);

        _logger.LogInformation("Joined session {SessionId}", sessionId);
    }

    public async Task SendAsync(string eventName, byte[] data)
    {
        if (_strokeSocket?.Connected != true)
        {
            _logger.LogWarning("Cannot send: not connected");
            return;
        }

        await _strokeSocket.EmitAsync(eventName, data);
    }

    public IObservable<byte[]> On(string eventName)
    {
        return Observable.Create<byte[]>(observer =>
        {
            _strokeSocket?.On(eventName, response =>
            {
                var data = response.GetValue<byte[]>();
                observer.OnNext(data);
            });

            return Disposable.Empty;
        });
    }

    public void Dispose()
    {
        _strokeSocket?.Dispose();
        _voiceSocket?.Dispose();
        _controlSocket?.Dispose();
        _stateSubject.Dispose();
    }
}

public enum ConnectionState
{
    Disconnected,
    Connecting,
    Connected,
    Reconnecting
}
```

### 4.2 StrokeService (스트로크 관리)

```csharp
// Services/StrokeService.cs
public interface IStrokeService
{
    IObservable<Stroke> StrokeStarted { get; }
    IObservable<(Guid strokeId, StrokePoint point)> PointAdded { get; }
    IObservable<Guid> StrokeEnded { get; }

    void StartStroke(Stroke stroke);
    void AddPoint(Guid strokeId, StrokePoint point);
    void EndStroke(Guid strokeId);
    void CancelStroke(Guid strokeId);
}

public class StrokeService : IStrokeService, IDisposable
{
    private readonly IConnectionService _connection;
    private readonly ILogger<StrokeService> _logger;
    private readonly ConcurrentDictionary<Guid, Stroke> _activeStrokes = new();

    private readonly Subject<Stroke> _strokeStarted = new();
    private readonly Subject<(Guid, StrokePoint)> _pointAdded = new();
    private readonly Subject<Guid> _strokeEnded = new();

    public IObservable<Stroke> StrokeStarted => _strokeStarted.AsObservable();
    public IObservable<(Guid, StrokePoint)> PointAdded => _pointAdded.AsObservable();
    public IObservable<Guid> StrokeEnded => _strokeEnded.AsObservable();

    public StrokeService(IConnectionService connection, ILogger<StrokeService> logger)
    {
        _connection = connection;
        _logger = logger;

        // 서버로부터 메시지 수신 설정
        SetupMessageHandlers();
    }

    private void SetupMessageHandlers()
    {
        // WRAPPED 메시지 처리 (다른 사용자의 스트로크)
        _connection.On("stroke")
            .Subscribe(data => HandleIncomingMessage(data));
    }

    private void HandleIncomingMessage(byte[] data)
    {
        var reader = new Protocol.BinaryReader(data);
        var messageType = (MessageType)reader.ReadByte();

        switch (messageType)
        {
            case MessageType.Wrapped:
                HandleWrappedMessage(reader);
                break;

            case MessageType.HistoryStart:
                HandleHistoryStart(reader);
                break;

            case MessageType.HistoryStroke:
                HandleHistoryStroke(reader);
                break;

            case MessageType.HistoryEnd:
                HandleHistoryEnd(reader);
                break;
        }
    }

    private void HandleWrappedMessage(Protocol.BinaryReader reader)
    {
        var senderId = reader.ReadGuid();
        var payloadLength = reader.ReadUInt32();
        var payload = reader.ReadBytes((int)payloadLength);

        // Payload 파싱
        var payloadReader = new Protocol.BinaryReader(payload);
        var innerType = (MessageType)payloadReader.ReadByte();

        switch (innerType)
        {
            case MessageType.StrokeStart:
                var stroke = ParseStrokeStart(payloadReader);
                stroke.UserId = senderId;
                _activeStrokes[stroke.Id] = stroke;
                _strokeStarted.OnNext(stroke);
                break;

            case MessageType.StrokePoint:
                var (strokeId, point) = ParseStrokePoint(payloadReader);
                if (_activeStrokes.TryGetValue(strokeId, out var activeStroke))
                {
                    activeStroke.Points.Add(point);
                    _pointAdded.OnNext((strokeId, point));
                }
                break;

            case MessageType.StrokeEnd:
                var endStrokeId = payloadReader.ReadGuid();
                if (_activeStrokes.TryRemove(endStrokeId, out _))
                {
                    _strokeEnded.OnNext(endStrokeId);
                }
                break;
        }
    }

    public void StartStroke(Stroke stroke)
    {
        _activeStrokes[stroke.Id] = stroke;

        // 바이너리 패킷 생성 및 전송
        var writer = new Protocol.BinaryWriter();
        writer.WriteByte((byte)MessageType.StrokeStart);
        writer.WriteGuid(stroke.Id);
        writer.WriteUInt32(stroke.PageId);
        writer.WriteUInt32(stroke.Color);
        writer.WriteFloat(stroke.Thickness);
        writer.WriteByte((byte)stroke.PenType);
        writer.WriteByte((byte)stroke.Flags);
        writer.WriteInt64(stroke.StartTimestamp);

        _ = _connection.SendAsync("stroke", writer.ToArray());

        _strokeStarted.OnNext(stroke);
    }

    public void AddPoint(Guid strokeId, StrokePoint point)
    {
        if (!_activeStrokes.TryGetValue(strokeId, out var stroke))
            return;

        stroke.Points.Add(point);

        // 바이너리 패킷 생성 및 전송
        var writer = new Protocol.BinaryWriter();
        writer.WriteByte((byte)MessageType.StrokePoint);
        writer.WriteGuid(strokeId);
        writer.WriteFloat(point.X);
        writer.WriteFloat(point.Y);
        writer.WriteUInt16(point.Pressure);
        writer.WriteInt64(point.Timestamp);

        _ = _connection.SendAsync("stroke", writer.ToArray());

        _pointAdded.OnNext((strokeId, point));
    }

    public void EndStroke(Guid strokeId)
    {
        if (!_activeStrokes.TryRemove(strokeId, out _))
            return;

        var writer = new Protocol.BinaryWriter();
        writer.WriteByte((byte)MessageType.StrokeEnd);
        writer.WriteGuid(strokeId);

        _ = _connection.SendAsync("stroke", writer.ToArray());

        _strokeEnded.OnNext(strokeId);
    }

    public void CancelStroke(Guid strokeId)
    {
        _activeStrokes.TryRemove(strokeId, out _);

        var writer = new Protocol.BinaryWriter();
        writer.WriteByte((byte)MessageType.StrokeCancel);
        writer.WriteGuid(strokeId);

        _ = _connection.SendAsync("stroke", writer.ToArray());
    }

    public void Dispose()
    {
        _strokeStarted.Dispose();
        _pointAdded.Dispose();
        _strokeEnded.Dispose();
    }
}
```

### 4.3 StrokeCanvas (렌더링 컴포넌트)

```csharp
// Controls/StrokeCanvas.cs
public class StrokeCanvas : Control
{
    private readonly IStrokeService _strokeService;
    private readonly ConcurrentDictionary<Guid, List<StrokePoint>> _strokes = new();
    private readonly ConcurrentDictionary<Guid, StrokeInfo> _strokeInfos = new();
    private readonly CompositeDisposable _disposables = new();

    // 이중 버퍼링용 비트맵
    private SKBitmap? _backBuffer;
    private SKCanvas? _backCanvas;

    public static readonly StyledProperty<IReadOnlyDictionary<Guid, Color>> UserColorsProperty =
        AvaloniaProperty.Register<StrokeCanvas, IReadOnlyDictionary<Guid, Color>>(nameof(UserColors));

    public IReadOnlyDictionary<Guid, Color> UserColors
    {
        get => GetValue(UserColorsProperty);
        set => SetValue(UserColorsProperty, value);
    }

    public StrokeCanvas()
    {
        _strokeService = App.Services.GetRequiredService<IStrokeService>();
        SubscribeToStrokes();
    }

    private void SubscribeToStrokes()
    {
        _strokeService.StrokeStarted
            .ObserveOn(AvaloniaScheduler.Instance)
            .Subscribe(stroke =>
            {
                _strokes[stroke.Id] = new List<StrokePoint>(stroke.Points);
                _strokeInfos[stroke.Id] = new StrokeInfo
                {
                    UserId = stroke.UserId,
                    Color = stroke.Color,
                    Thickness = stroke.Thickness,
                    PenType = stroke.PenType
                };
            })
            .DisposeWith(_disposables);

        _strokeService.PointAdded
            .ObserveOn(AvaloniaScheduler.Instance)
            .Subscribe(tuple =>
            {
                var (strokeId, point) = tuple;
                if (_strokes.TryGetValue(strokeId, out var points))
                {
                    points.Add(point);
                    // 증분 렌더링
                    InvalidateVisual();
                }
            })
            .DisposeWith(_disposables);

        _strokeService.StrokeEnded
            .ObserveOn(AvaloniaScheduler.Instance)
            .Subscribe(strokeId =>
            {
                // 완성된 스트로크를 백버퍼에 렌더링
                if (_strokes.TryGetValue(strokeId, out var points) &&
                    _strokeInfos.TryGetValue(strokeId, out var info))
                {
                    RenderStrokeToBackBuffer(points, info);
                    _strokes.TryRemove(strokeId, out _);
                }
                InvalidateVisual();
            })
            .DisposeWith(_disposables);
    }

    public override void Render(DrawingContext context)
    {
        base.Render(context);

        var bounds = Bounds;
        if (bounds.Width <= 0 || bounds.Height <= 0) return;

        // SkiaSharp 사용
        using var lease = SkiaSharp.AvaloniaExtensions.LeaseSkia(context);
        var canvas = lease.SkCanvas;

        // 배경
        canvas.Clear(SKColors.White);

        // 백버퍼 (완성된 스트로크들)
        if (_backBuffer != null)
        {
            canvas.DrawBitmap(_backBuffer, 0, 0);
        }

        // 활성 스트로크 (진행 중)
        foreach (var (strokeId, points) in _strokes)
        {
            if (points.Count < 2) continue;
            if (!_strokeInfos.TryGetValue(strokeId, out var info)) continue;

            RenderStrokePoints(canvas, points, info);
        }
    }

    private void RenderStrokePoints(SKCanvas canvas, List<StrokePoint> points, StrokeInfo info)
    {
        var color = GetUserColor(info.UserId) ?? SKColor.Parse($"#{info.Color:X8}");

        using var paint = new SKPaint
        {
            Color = color,
            StrokeWidth = info.Thickness * 3.78f, // mm to pixels (96 DPI)
            StrokeCap = SKStrokeCap.Round,
            StrokeJoin = SKStrokeJoin.Round,
            IsAntialias = true,
            Style = info.PenType == PenType.Highlighter
                ? SKPaintStyle.Stroke
                : SKPaintStyle.Stroke
        };

        // 형광펜은 반투명
        if (info.PenType == PenType.Highlighter)
        {
            paint.Color = paint.Color.WithAlpha(128);
        }

        // Catmull-Rom 스플라인으로 부드럽게
        if (points.Count >= 4)
        {
            using var path = new SKPath();
            path.MoveTo(ToPoint(points[0]));

            for (int i = 1; i < points.Count - 2; i++)
            {
                var p0 = points[Math.Max(0, i - 1)];
                var p1 = points[i];
                var p2 = points[i + 1];
                var p3 = points[Math.Min(points.Count - 1, i + 2)];

                // Catmull-Rom to Bezier
                var bezier = CatmullRomToBezier(p0, p1, p2, p3);
                path.CubicTo(bezier.C1, bezier.C2, bezier.P2);
            }

            canvas.DrawPath(path, paint);
        }
        else
        {
            // 점이 적으면 직선으로
            for (int i = 1; i < points.Count; i++)
            {
                canvas.DrawLine(ToPoint(points[i - 1]), ToPoint(points[i]), paint);
            }
        }
    }

    private static SKPoint ToPoint(StrokePoint p) => new(p.X * 3.78f, p.Y * 3.78f);

    private SKColor? GetUserColor(Guid userId)
    {
        if (UserColors?.TryGetValue(userId, out var color) == true)
        {
            return new SKColor(color.R, color.G, color.B, color.A);
        }
        return null;
    }

    private void RenderStrokeToBackBuffer(List<StrokePoint> points, StrokeInfo info)
    {
        EnsureBackBuffer();
        if (_backCanvas == null) return;

        RenderStrokePoints(_backCanvas, points, info);
    }

    private void EnsureBackBuffer()
    {
        var width = (int)Bounds.Width;
        var height = (int)Bounds.Height;

        if (_backBuffer == null || _backBuffer.Width != width || _backBuffer.Height != height)
        {
            _backBuffer?.Dispose();
            _backBuffer = new SKBitmap(width, height);
            _backCanvas = new SKCanvas(_backBuffer);
            _backCanvas.Clear(SKColors.Transparent);
        }
    }

    protected override void OnDetachedFromVisualTree(VisualTreeAttachmentEventArgs e)
    {
        base.OnDetachedFromVisualTree(e);
        _disposables.Dispose();
        _backBuffer?.Dispose();
    }
}

internal record StrokeInfo
{
    public Guid UserId { get; init; }
    public uint Color { get; init; }
    public float Thickness { get; init; }
    public PenType PenType { get; init; }
}
```

### 4.4 CanvasViewModel

```csharp
// ViewModels/CanvasViewModel.cs
public partial class CanvasViewModel : ViewModelBase
{
    private readonly IStrokeService _strokeService;
    private readonly ISessionService _sessionService;
    private Stroke? _currentStroke;

    [ObservableProperty]
    private PenType _currentPenType = PenType.Pen;

    [ObservableProperty]
    private uint _currentColor = 0xFF000000; // Black

    [ObservableProperty]
    private float _currentThickness = 1.0f;

    [ObservableProperty]
    private uint _currentPageId = 1;

    [ObservableProperty]
    private ObservableDictionary<Guid, Color> _userColors = new();

    public CanvasViewModel(IStrokeService strokeService, ISessionService sessionService)
    {
        _strokeService = strokeService;
        _sessionService = sessionService;

        // 참가자 색상 할당
        _sessionService.ParticipantsChanged.Subscribe(participants =>
        {
            AssignUserColors(participants);
        });
    }

    private readonly Color[] _colorPalette = new[]
    {
        Colors.Blue, Colors.Green, Colors.Orange, Colors.Purple,
        Colors.Red, Colors.Teal, Colors.Brown, Colors.Pink
    };

    private void AssignUserColors(IEnumerable<Participant> participants)
    {
        int index = 0;
        foreach (var p in participants)
        {
            if (!UserColors.ContainsKey(p.UserId))
            {
                UserColors[p.UserId] = _colorPalette[index % _colorPalette.Length];
                index++;
            }
        }
    }

    // 펜 다운
    public void OnPointerPressed(float x, float y, float pressure)
    {
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        _currentStroke = new Stroke
        {
            Id = Guid.NewGuid(),
            UserId = _sessionService.CurrentUserId,
            PageId = CurrentPageId,
            Color = CurrentColor,
            Thickness = CurrentThickness,
            PenType = CurrentPenType,
            Flags = StrokeFlags.PressureSensitive,
            StartTimestamp = timestamp,
            Points = new List<StrokePoint>()
        };

        var point = new StrokePoint
        {
            X = x,
            Y = y,
            Pressure = (ushort)(pressure * 65535),
            Timestamp = timestamp
        };
        _currentStroke.Points.Add(point);

        _strokeService.StartStroke(_currentStroke);
    }

    // 펜 이동
    public void OnPointerMoved(float x, float y, float pressure)
    {
        if (_currentStroke == null) return;

        var point = new StrokePoint
        {
            X = x,
            Y = y,
            Pressure = (ushort)(pressure * 65535),
            Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        };

        _strokeService.AddPoint(_currentStroke.Id, point);
    }

    // 펜 업
    public void OnPointerReleased()
    {
        if (_currentStroke == null) return;

        _strokeService.EndStroke(_currentStroke.Id);
        _currentStroke = null;
    }

    // 도구 변경 커맨드
    [RelayCommand]
    private void SetPenType(PenType penType)
    {
        CurrentPenType = penType;
    }

    [RelayCommand]
    private void SetColor(uint color)
    {
        CurrentColor = color;
    }

    [RelayCommand]
    private void SetThickness(float thickness)
    {
        CurrentThickness = thickness;
    }
}
```

---

## 5. 음성 서비스

### 5.1 VoiceService

```csharp
// Services/VoiceService.cs
public interface IVoiceService
{
    bool IsMuted { get; }
    IObservable<bool> IsMutedChanged { get; }
    IObservable<(Guid userId, bool isSpeaking)> SpeakingChanged { get; }

    Task StartAsync();
    Task StopAsync();
    void SetMuted(bool muted);
}

public class VoiceService : IVoiceService, IDisposable
{
    private readonly IConnectionService _connection;
    private readonly ILogger<VoiceService> _logger;

    // Opus 코덱
    private OpusEncoder? _encoder;
    private OpusDecoder? _decoder;

    // 오디오 캡처/재생 (플랫폼별 구현 필요)
    private IAudioCapture? _audioCapture;
    private IAudioPlayback? _audioPlayback;

    private readonly BehaviorSubject<bool> _isMuted = new(false);
    private readonly Subject<(Guid, bool)> _speakingChanged = new();

    private uint _sequenceNumber;

    public bool IsMuted => _isMuted.Value;
    public IObservable<bool> IsMutedChanged => _isMuted.AsObservable();
    public IObservable<(Guid, bool)> SpeakingChanged => _speakingChanged.AsObservable();

    public VoiceService(IConnectionService connection, ILogger<VoiceService> logger)
    {
        _connection = connection;
        _logger = logger;

        // Opus 설정: 48kHz, Mono, 20ms 프레임
        _encoder = new OpusEncoder(48000, 1, OpusApplication.OPUS_APPLICATION_VOIP);
        _encoder.Bitrate = 24000;
        _encoder.Complexity = 5;

        _decoder = new OpusDecoder(48000, 1);
    }

    public async Task StartAsync()
    {
        // 음성 수신 핸들러
        _connection.On("voice").Subscribe(HandleVoiceData);

        // 오디오 캡처 시작
        _audioCapture = AudioFactory.CreateCapture();
        _audioCapture.DataAvailable += OnAudioDataAvailable;
        _audioCapture.Start();

        // 오디오 재생 시작
        _audioPlayback = AudioFactory.CreatePlayback();
        _audioPlayback.Start();

        // VOICE_START 전송
        var writer = new Protocol.BinaryWriter();
        writer.WriteByte((byte)MessageType.VoiceStart);
        writer.WriteUInt32(48000);  // Sample Rate
        writer.WriteByte(1);        // Channels

        await _connection.SendAsync("voice", writer.ToArray());

        _logger.LogInformation("Voice service started");
    }

    private void OnAudioDataAvailable(object? sender, AudioDataEventArgs e)
    {
        if (IsMuted) return;

        // PCM → Opus 인코딩
        var encoded = new byte[1276]; // Max Opus frame size
        var encodedLength = _encoder!.Encode(e.Buffer, e.SampleCount, encoded, encoded.Length);

        if (encodedLength > 0)
        {
            // VOICE_DATA 패킷 생성
            var writer = new Protocol.BinaryWriter();
            writer.WriteByte((byte)MessageType.VoiceData);
            writer.WriteUInt32(_sequenceNumber++);
            writer.WriteInt64(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
            writer.WriteUInt16((ushort)encodedLength);
            writer.WriteBytes(encoded.AsSpan(0, encodedLength));

            _ = _connection.SendAsync("voice", writer.ToArray());
        }
    }

    private void HandleVoiceData(byte[] data)
    {
        var reader = new Protocol.BinaryReader(data);
        var messageType = (MessageType)reader.ReadByte();

        if (messageType == MessageType.Wrapped)
        {
            var senderId = reader.ReadGuid();
            var payloadLength = reader.ReadUInt32();
            var payload = reader.ReadBytes((int)payloadLength);

            var payloadReader = new Protocol.BinaryReader(payload);
            var innerType = (MessageType)payloadReader.ReadByte();

            if (innerType == MessageType.VoiceData)
            {
                var sequenceNumber = payloadReader.ReadUInt32();
                var timestamp = payloadReader.ReadInt64();
                var dataLength = payloadReader.ReadUInt16();
                var opusData = payloadReader.ReadBytes(dataLength);

                // Opus → PCM 디코딩
                var pcm = new short[960]; // 20ms @ 48kHz
                var decodedSamples = _decoder!.Decode(opusData, pcm, pcm.Length);

                if (decodedSamples > 0)
                {
                    _audioPlayback?.Write(pcm, decodedSamples);
                    _speakingChanged.OnNext((senderId, true));
                }
            }
        }
    }

    public void SetMuted(bool muted)
    {
        _isMuted.OnNext(muted);

        // VOICE_MUTE/UNMUTE 전송
        var writer = new Protocol.BinaryWriter();
        writer.WriteByte(muted ? (byte)MessageType.VoiceMute : (byte)MessageType.VoiceUnmute);
        _ = _connection.SendAsync("voice", writer.ToArray());
    }

    public async Task StopAsync()
    {
        _audioCapture?.Stop();
        _audioPlayback?.Stop();

        var writer = new Protocol.BinaryWriter();
        writer.WriteByte((byte)MessageType.VoiceEnd);
        await _connection.SendAsync("voice", writer.ToArray());

        _logger.LogInformation("Voice service stopped");
    }

    public void Dispose()
    {
        _audioCapture?.Dispose();
        _audioPlayback?.Dispose();
        _isMuted.Dispose();
        _speakingChanged.Dispose();
    }
}
```

---

## 6. 오프라인 버퍼링

### 6.1 OfflineBuffer

```csharp
// Services/OfflineBuffer.cs
public class OfflineBuffer : IDisposable
{
    private readonly IConnectionService _connection;
    private readonly Queue<BufferedMessage> _buffer = new();
    private readonly SemaphoreSlim _lock = new(1, 1);
    private const int MaxBufferSize = 10000;

    public OfflineBuffer(IConnectionService connection)
    {
        _connection = connection;

        _connection.StateChanged.Subscribe(state =>
        {
            if (state == ConnectionState.Connected)
            {
                _ = FlushBufferAsync();
            }
        });
    }

    public async Task BufferOrSendAsync(string eventName, byte[] data)
    {
        if (_connection.State == ConnectionState.Connected)
        {
            await _connection.SendAsync(eventName, data);
        }
        else
        {
            await BufferAsync(eventName, data);
        }
    }

    private async Task BufferAsync(string eventName, byte[] data)
    {
        await _lock.WaitAsync();
        try
        {
            if (_buffer.Count >= MaxBufferSize)
            {
                _buffer.Dequeue(); // 오래된 메시지 제거
            }

            _buffer.Enqueue(new BufferedMessage
            {
                EventName = eventName,
                Data = data,
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            });
        }
        finally
        {
            _lock.Release();
        }
    }

    private async Task FlushBufferAsync()
    {
        await _lock.WaitAsync();
        try
        {
            while (_buffer.Count > 0)
            {
                var message = _buffer.Dequeue();
                await _connection.SendAsync(message.EventName, message.Data);
                await Task.Delay(10); // 서버 부하 방지
            }
        }
        finally
        {
            _lock.Release();
        }
    }

    public void Dispose()
    {
        _lock.Dispose();
    }
}

internal record BufferedMessage
{
    public string EventName { get; init; } = string.Empty;
    public byte[] Data { get; init; } = Array.Empty<byte>();
    public long Timestamp { get; init; }
}
```

---

## 7. 상태 관리

### 7.1 세션 상태 머신

```csharp
// Services/SessionStateMachine.cs
public enum SessionState
{
    Idle,           // 초기 상태
    Creating,       // 세션 생성 중
    Joining,        // 세션 참가 중
    Connecting,     // WebSocket 연결 중
    Syncing,        // 히스토리 동기화 중
    Active,         // 활성 상태
    Paused,         // 일시정지
    Reconnecting,   // 재연결 중
    Leaving,        // 나가는 중
    Error           // 에러 상태
}

public class SessionStateMachine
{
    private SessionState _currentState = SessionState.Idle;
    private readonly Subject<SessionState> _stateChanged = new();

    public SessionState CurrentState => _currentState;
    public IObservable<SessionState> StateChanged => _stateChanged.AsObservable();

    private readonly Dictionary<(SessionState, SessionEvent), SessionState> _transitions = new()
    {
        // Idle
        { (SessionState.Idle, SessionEvent.CreateSession), SessionState.Creating },
        { (SessionState.Idle, SessionEvent.JoinSession), SessionState.Joining },

        // Creating
        { (SessionState.Creating, SessionEvent.SessionCreated), SessionState.Connecting },
        { (SessionState.Creating, SessionEvent.Error), SessionState.Error },

        // Joining
        { (SessionState.Joining, SessionEvent.SessionJoined), SessionState.Connecting },
        { (SessionState.Joining, SessionEvent.Error), SessionState.Error },

        // Connecting
        { (SessionState.Connecting, SessionEvent.Connected), SessionState.Syncing },
        { (SessionState.Connecting, SessionEvent.Error), SessionState.Error },

        // Syncing
        { (SessionState.Syncing, SessionEvent.SyncCompleted), SessionState.Active },
        { (SessionState.Syncing, SessionEvent.Disconnected), SessionState.Reconnecting },

        // Active
        { (SessionState.Active, SessionEvent.Pause), SessionState.Paused },
        { (SessionState.Active, SessionEvent.Leave), SessionState.Leaving },
        { (SessionState.Active, SessionEvent.Disconnected), SessionState.Reconnecting },
        { (SessionState.Active, SessionEvent.SessionClosed), SessionState.Idle },

        // Paused
        { (SessionState.Paused, SessionEvent.Resume), SessionState.Active },
        { (SessionState.Paused, SessionEvent.Leave), SessionState.Leaving },

        // Reconnecting
        { (SessionState.Reconnecting, SessionEvent.Connected), SessionState.Syncing },
        { (SessionState.Reconnecting, SessionEvent.Error), SessionState.Error },
        { (SessionState.Reconnecting, SessionEvent.Leave), SessionState.Idle },

        // Leaving
        { (SessionState.Leaving, SessionEvent.Left), SessionState.Idle },

        // Error
        { (SessionState.Error, SessionEvent.Reset), SessionState.Idle },
    };

    public bool TryTransition(SessionEvent evt)
    {
        if (_transitions.TryGetValue((_currentState, evt), out var newState))
        {
            _currentState = newState;
            _stateChanged.OnNext(newState);
            return true;
        }
        return false;
    }
}

public enum SessionEvent
{
    CreateSession,
    SessionCreated,
    JoinSession,
    SessionJoined,
    Connected,
    SyncCompleted,
    Disconnected,
    Pause,
    Resume,
    Leave,
    Left,
    SessionClosed,
    Error,
    Reset
}
```

---

## 8. 플랫폼별 구현

### 8.1 프로젝트 구성

```xml
<!-- PenStreamClient.Core.csproj -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
  </PropertyGroup>
</Project>

<!-- PenStreamClient.Desktop.csproj -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <RuntimeIdentifiers>win-x64;osx-x64;osx-arm64;linux-x64</RuntimeIdentifiers>
  </PropertyGroup>
</Project>

<!-- PenStreamClient.Android.csproj -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0-android</TargetFramework>
    <SupportedOSPlatformVersion>24</SupportedOSPlatformVersion>
  </PropertyGroup>
</Project>
```

### 8.2 플랫폼별 오디오 추상화

```csharp
// Platform/IAudioCapture.cs
public interface IAudioCapture : IDisposable
{
    event EventHandler<AudioDataEventArgs>? DataAvailable;
    void Start();
    void Stop();
}

public interface IAudioPlayback : IDisposable
{
    void Start();
    void Stop();
    void Write(short[] samples, int count);
}

// 팩토리
public static class AudioFactory
{
    public static IAudioCapture CreateCapture()
    {
#if WINDOWS
        return new WindowsAudioCapture();
#elif ANDROID
        return new AndroidAudioCapture();
#elif IOS
        return new iOSAudioCapture();
#else
        return new CrossPlatformAudioCapture(); // OpenAL 기반
#endif
    }
}
```

---

## 9. 테스트 전략

### 9.1 단위 테스트

```csharp
// Tests/Protocol/BinaryReaderTests.cs
public class BinaryReaderTests
{
    [Fact]
    public void ReadGuid_ValidData_ReturnsCorrectGuid()
    {
        var expected = Guid.NewGuid();
        var bytes = expected.ToByteArray();
        var reader = new BinaryReader(bytes);

        var result = reader.ReadGuid();

        Assert.Equal(expected, result);
    }

    [Fact]
    public void ReadStrokePoint_ValidPacket_ParsesCorrectly()
    {
        var writer = new BinaryWriter();
        writer.WriteByte(0x02); // STROKE_POINT
        writer.WriteGuid(Guid.NewGuid());
        writer.WriteFloat(100.5f);
        writer.WriteFloat(200.3f);
        writer.WriteUInt16(32768);
        writer.WriteInt64(1704067200000);

        var reader = new BinaryReader(writer.ToArray());
        var type = reader.ReadByte();
        var strokeId = reader.ReadGuid();
        var x = reader.ReadFloat();
        var y = reader.ReadFloat();
        var pressure = reader.ReadUInt16();
        var timestamp = reader.ReadInt64();

        Assert.Equal(0x02, type);
        Assert.Equal(100.5f, x, 0.01f);
        Assert.Equal(200.3f, y, 0.01f);
        Assert.Equal(32768, pressure);
    }
}
```

### 9.2 통합 테스트

```csharp
// Tests/Services/StrokeServiceIntegrationTests.cs
public class StrokeServiceIntegrationTests
{
    [Fact]
    public async Task StrokeRoundTrip_SendAndReceive_MatchesOriginal()
    {
        // Arrange
        var mockConnection = new MockConnectionService();
        var service = new StrokeService(mockConnection, Mock.Of<ILogger<StrokeService>>());

        var receivedStrokes = new List<Stroke>();
        service.StrokeStarted.Subscribe(s => receivedStrokes.Add(s));

        // Act
        var originalStroke = new Stroke
        {
            Id = Guid.NewGuid(),
            PageId = 1,
            Color = 0xFF0000FF,
            Thickness = 2.0f,
            PenType = PenType.Pen
        };

        service.StartStroke(originalStroke);

        // Simulate server echo
        var sentData = mockConnection.LastSentData;
        mockConnection.SimulateReceive(WrapMessage(Guid.NewGuid(), sentData));

        // Assert
        Assert.Single(receivedStrokes);
        Assert.Equal(originalStroke.Color, receivedStrokes[0].Color);
    }
}
```

---

## 10. 성능 최적화

### 10.1 메모리 풀링

```csharp
// Utils/BufferPool.cs
public static class BufferPool
{
    private static readonly ArrayPool<byte> _pool = ArrayPool<byte>.Shared;

    public static byte[] Rent(int minimumLength)
    {
        return _pool.Rent(minimumLength);
    }

    public static void Return(byte[] array)
    {
        _pool.Return(array);
    }
}

// 사용 예
public void SendStrokePoint(StrokePoint point)
{
    var buffer = BufferPool.Rent(35); // STROKE_POINT 크기
    try
    {
        // 버퍼에 데이터 쓰기
        WriteStrokePoint(buffer, point);
        _connection.SendAsync("stroke", buffer.AsSpan(0, 35).ToArray());
    }
    finally
    {
        BufferPool.Return(buffer);
    }
}
```

### 10.2 렌더링 최적화

```csharp
// 더티 리전 추적
private readonly List<SKRect> _dirtyRegions = new();

public void InvalidateRegion(float x, float y, float radius)
{
    var rect = new SKRect(x - radius, y - radius, x + radius, y + radius);
    _dirtyRegions.Add(rect);

    // 더티 리전만 다시 그리기
    InvalidateVisual();
}

public override void Render(DrawingContext context)
{
    foreach (var region in _dirtyRegions)
    {
        // 해당 영역만 렌더링
        RenderRegion(context, region);
    }
    _dirtyRegions.Clear();
}
```

---

## 11. 배포

### 11.1 빌드 명령

```bash
# Windows
dotnet publish src/PenStreamClient.Desktop -c Release -r win-x64 --self-contained

# macOS (Intel)
dotnet publish src/PenStreamClient.Desktop -c Release -r osx-x64 --self-contained

# macOS (Apple Silicon)
dotnet publish src/PenStreamClient.Desktop -c Release -r osx-arm64 --self-contained

# Linux
dotnet publish src/PenStreamClient.Desktop -c Release -r linux-x64 --self-contained

# Android
dotnet publish src/PenStreamClient.Android -c Release

# iOS
dotnet publish src/PenStreamClient.iOS -c Release
```

### 11.2 앱 서명 및 배포

| 플랫폼 | 배포 방식 |
|--------|----------|
| Windows | MSIX / ClickOnce / 독립 실행형 |
| macOS | .app 번들 / DMG / App Store |
| Linux | AppImage / Flatpak / DEB/RPM |
| Android | APK / Google Play |
| iOS | App Store / TestFlight |

---

## 12. 로깅 및 진단

### 12.1 Serilog 설정

```csharp
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Debug()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .Enrich.WithThreadId()
    .WriteTo.Debug()
    .WriteTo.File(
        path: "logs/penstreamclient-.log",
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 7,
        outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff} [{Level:u3}] [{ThreadId}] {Message:lj}{NewLine}{Exception}"
    )
    .CreateLogger();
```

### 12.2 성능 메트릭

```csharp
public class PerformanceMetrics
{
    private readonly Stopwatch _stopwatch = new();
    private long _strokesSent;
    private long _strokesReceived;
    private long _bytesTransferred;

    public void RecordStrokeSent() => Interlocked.Increment(ref _strokesSent);
    public void RecordStrokeReceived() => Interlocked.Increment(ref _strokesReceived);
    public void RecordBytesTransferred(int bytes) => Interlocked.Add(ref _bytesTransferred, bytes);

    public PerformanceSnapshot GetSnapshot() => new()
    {
        StrokesSent = _strokesSent,
        StrokesReceived = _strokesReceived,
        BytesTransferred = _bytesTransferred,
        Uptime = _stopwatch.Elapsed
    };
}
```

---

*문서 버전: 1.0*
*최종 수정: 2026-01-09*
