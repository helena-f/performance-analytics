use actix_web::{web, HttpRequest, HttpResponse, Error};
use tokio::time::{interval, Duration};
use crate::profiler::{cpu::CpuProfiler, memory::MemoryProfiler, sampler::*, swiftui::SwiftUIAnalyzer};
use crate::models::ProfileEvent;

/// WebSocket handler for live profiling data streaming
pub async fn profiling_ws(req: HttpRequest, stream: web::Payload) -> Result<HttpResponse, Error> {
    let (response, mut session, _msg_stream) = actix_ws::handle(&req, stream)?;

    // Spawn the profiling loop
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
        let mut stack_samples = Vec::new();

        loop {
            tick.tick().await;

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

            // Stack sample (less frequent)
            let stack = stack_sampler.sample();
            stack_samples.push(stack.clone());
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
