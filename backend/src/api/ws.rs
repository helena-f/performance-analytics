use actix_web::{web, HttpRequest, HttpResponse, Error};
use actix_ws::AggregatedMessage;
use futures_util::StreamExt;
use tokio::time::{interval, Duration};
use crate::profiler::{cpu::CpuProfiler, memory::MemoryProfiler, sampler::*, swiftui::SwiftUIAnalyzer};
use crate::models::ProfileEvent;

/// WebSocket handler for live profiling data streaming
pub async fn profiling_ws(req: HttpRequest, stream: web::Payload) -> Result<HttpResponse, Error> {
    let (response, mut session, msg_stream) = actix_ws::handle(&req, stream)?;

    // We need to consume incoming messages (pings/close frames) or the connection breaks.
    // Spawn a task to drain the incoming stream.
    let mut msg_stream = msg_stream
        .aggregate_continuations()
        .max_continuation_size(2_usize.pow(20));

    let (close_tx, mut close_rx) = tokio::sync::oneshot::channel::<()>();

    // Task 1: drain incoming messages, detect close
    actix_web::rt::spawn(async move {
        while let Some(msg) = msg_stream.next().await {
            match msg {
                Ok(AggregatedMessage::Close(_)) => break,
                Ok(AggregatedMessage::Ping(data)) => {
                    // pong is handled automatically by actix-ws
                    let _ = data;
                }
                _ => {}
            }
        }
        let _ = close_tx.send(());
    });

    // Task 2: send profiling data
    actix_web::rt::spawn(async move {
        let mut cpu = CpuProfiler::new();
        let mut memory = MemoryProfiler::new();
        let mut stack_sampler = StackSampler::new();
        let mut io_sampler = IoSampler::new();
        let mut energy_sampler = EnergySampler::new();
        let mut swiftui = SwiftUIAnalyzer::new();

        // Send session started event
        let start_event = ProfileEvent::SessionStarted {
            session_id: uuid::Uuid::new_v4().to_string(),
            process_name: "System".to_string(),
            pid: 0,
        };
        let _ = session.text(serde_json::to_string(&start_event).unwrap()).await;

        // Sample at ~4Hz for smooth visualization
        let mut tick = interval(Duration::from_millis(250));

        loop {
            tokio::select! {
                _ = tick.tick() => {},
                _ = &mut close_rx => {
                    let _ = session.close(None).await;
                    break;
                }
            }

            // CPU sample
            let cpu_sample = cpu.sample();
            let cpu_usage = cpu_sample.usage_percent;
            let event = ProfileEvent::CpuUpdate(cpu_sample);
            if session.text(serde_json::to_string(&event).unwrap()).await.is_err() {
                break;
            }

            // Memory sample
            let mem_sample = memory.sample_system();
            let event = ProfileEvent::MemoryUpdate(mem_sample);
            if session.text(serde_json::to_string(&event).unwrap()).await.is_err() {
                break;
            }

            // I/O sample
            let io_sample = io_sampler.sample();
            let event = ProfileEvent::IoUpdate(io_sample);
            if session.text(serde_json::to_string(&event).unwrap()).await.is_err() {
                break;
            }

            // Energy sample
            let energy_sample = energy_sampler.sample(cpu_usage);
            let event = ProfileEvent::EnergyUpdate(energy_sample);
            if session.text(serde_json::to_string(&event).unwrap()).await.is_err() {
                break;
            }

            // Stack sample
            let stack = stack_sampler.sample();
            let event = ProfileEvent::StackCapture(stack);
            if session.text(serde_json::to_string(&event).unwrap()).await.is_err() {
                break;
            }

            // SwiftUI issue detection
            if let Some(issue) = swiftui.generate_issue() {
                let event = ProfileEvent::SwiftUIIssue(issue);
                if session.text(serde_json::to_string(&event).unwrap()).await.is_err() {
                    break;
                }
            }
        }
    });

    Ok(response)
}
