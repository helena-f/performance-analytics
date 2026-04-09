use actix_web::{web, HttpResponse, Responder};
use sysinfo::{System, ProcessRefreshKind, RefreshKind, CpuRefreshKind};
use crate::models::ProcessInfo;
use crate::profiler::sampler::StackSampler;

/// List running processes available for profiling
pub async fn list_processes() -> impl Responder {
    let mut system = System::new_with_specifics(
        RefreshKind::new()
            .with_cpu(CpuRefreshKind::everything())
            .with_processes(ProcessRefreshKind::new()
                .with_cpu()
                .with_memory()),
    );

    // Need two refreshes for accurate CPU reading
    system.refresh_all();
    tokio::time::sleep(std::time::Duration::from_millis(300)).await;
    system.refresh_all();

    let mut processes: Vec<ProcessInfo> = system.processes()
        .iter()
        .map(|(pid, process)| {
            let name = process.name().to_string();
            let is_apple = name.starts_with("com.apple")
                || ["Finder", "Safari", "Xcode", "Mail", "Music", "Photos",
                    "Notes", "Messages", "Terminal", "Preview", "Simulator"]
                    .iter().any(|n| name.contains(n));

            ProcessInfo {
                pid: pid.as_u32(),
                name,
                cpu_percent: process.cpu_usage() as f64,
                memory_bytes: process.memory(),
                thread_count: 0,
                is_apple_process: is_apple,
            }
        })
        .collect();

    // Sort by CPU usage descending
    processes.sort_by(|a, b| b.cpu_percent.partial_cmp(&a.cpu_percent).unwrap_or(std::cmp::Ordering::Equal));

    // Limit to top 100
    processes.truncate(100);

    HttpResponse::Ok().json(processes)
}

/// Generate a demo flame graph
pub async fn get_flame_graph() -> impl Responder {
    let mut sampler = StackSampler::new();
    let mut samples = Vec::new();

    for _ in 0..200 {
        samples.push(sampler.sample());
    }

    let flame = StackSampler::build_flame_graph(&samples);
    HttpResponse::Ok().json(flame)
}

/// Health check
pub async fn health() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok",
        "version": "0.1.0",
        "name": "PerfScope Profiler"
    }))
}

/// Configure API routes
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api")
            .route("/health", web::get().to(health))
            .route("/processes", web::get().to(list_processes))
            .route("/flamegraph", web::get().to(get_flame_graph))
    );
}
