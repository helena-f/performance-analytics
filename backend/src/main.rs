mod api;
mod models;
mod profiler;

use actix_cors::Cors;
use actix_web::{web, App, HttpServer};
use env_logger::Env;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(Env::default().default_filter_or("info"));

    log::info!("🔬 PerfScope Profiler starting on http://localhost:8080");

    HttpServer::new(|| {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header();

        App::new()
            .wrap(cors)
            .configure(api::routes::configure)
            .route("/ws/profile", web::get().to(api::ws::profiling_ws))
    })
    .bind("0.0.0.0:8080")?
    .run()
    .await
}
