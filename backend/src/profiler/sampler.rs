use crate::models::{StackSample, StackFrame, FlameNode, IoSample, EnergySample, ThermalState};
use rand::Rng;

/// Simulates stack sampling for profiling visualization
/// In production, this would use dtrace/perf/frame pointers
pub struct StackSampler {
    start_time: std::time::Instant,
    sample_count: u64,
}

// Realistic function names that mirror SwiftUI/UIKit app internals
const SWIFT_MODULES: &[(&str, &[&str])] = &[
    ("SwiftUI", &[
        "View.body.getter", "ViewGraph.updateOutputs(at:)",
        "AttributeGraph.updateValue()", "DisplayList.build()",
        "LayoutComputer.sizeThatFits(_:)", "ViewRendererHost.render(interval:updateDisplayList:)",
        "GraphHost.runTransaction()", "StateObject.wrappedValue.getter",
        "ObservedObject.wrappedValue.getter", "EnvironmentObject.wrappedValue.getter",
        "List.body.getter", "ForEach.body.getter", "VStack.body.getter",
        "NavigationStack.body.getter", "AsyncImage.body.getter",
    ]),
    ("UIKit", &[
        "UIView.layoutSubviews()", "UIView.draw(_:)",
        "CALayer.display()", "UIApplication.sendEvent(_:)",
        "UIViewController.viewDidLoad()", "UITableView.reloadData()",
        "UICollectionView.performBatchUpdates(_:completion:)",
    ]),
    ("CoreAnimation", &[
        "CA::Transaction::commit()", "CA::Layer::layout_and_display_if_needed()",
        "CA::Context::commit_transaction()", "CA::Display::DisplayLink::dispatch_items()",
    ]),
    ("CoreGraphics", &[
        "CGContextDrawImage", "CGBitmapContextCreateImage",
        "CGPathCreateMutable", "CGContextFillRect",
    ]),
    ("libdispatch", &[
        "dispatch_async", "dispatch_sync", "dispatch_queue_invoke",
        "dispatch_worker_thread2", "dispatch_main_queue_callback_4CF",
    ]),
    ("Foundation", &[
        "NSRunLoop.run(mode:before:)", "JSONDecoder.decode(_:from:)",
        "URLSession.dataTask(with:completionHandler:)",
        "NotificationCenter.post(name:object:userInfo:)",
        "OperationQueue.addOperation(_:)",
    ]),
    ("MyApp", &[
        "ContentView.body.getter", "ProfileView.body.getter",
        "DashboardView.body.getter", "SettingsView.body.getter",
        "DataManager.fetchItems()", "DataManager.processResponse(_:)",
        "ImageCache.loadImage(url:)", "NetworkService.request(_:)",
        "CoreDataStack.save()", "AnalyticsTracker.logEvent(_:)",
        "SearchViewModel.performSearch(_:)", "FeedViewModel.refreshFeed()",
    ]),
];

impl StackSampler {
    pub fn new() -> Self {
        Self {
            start_time: std::time::Instant::now(),
            sample_count: 0,
        }
    }

    /// Generate a realistic stack sample
    pub fn sample(&mut self) -> StackSample {
        let mut rng = rand::thread_rng();
        self.sample_count += 1;

        // Build a realistic call stack (deeper stacks more common in SwiftUI apps)
        let depth = rng.gen_range(4..=15);
        let mut frames = Vec::with_capacity(depth);

        // Start with low-level dispatch/runloop
        let low_level = &["libdispatch", "Foundation"];
        let mid_level = &["CoreAnimation", "CoreGraphics", "UIKit"];
        let high_level = &["SwiftUI", "MyApp"];

        // Build bottom-up: low-level -> framework -> app code
        let low_count = rng.gen_range(1..=3).min(depth);
        let mid_count = rng.gen_range(1..=3).min(depth - low_count);
        let high_count = depth - low_count - mid_count;

        for _ in 0..low_count {
            let module_name = low_level[rng.gen_range(0..low_level.len())];
            frames.push(self.random_frame(module_name, &mut rng));
        }
        for _ in 0..mid_count {
            let module_name = mid_level[rng.gen_range(0..mid_level.len())];
            frames.push(self.random_frame(module_name, &mut rng));
        }
        for _ in 0..high_count {
            let module_name = high_level[rng.gen_range(0..high_level.len())];
            frames.push(self.random_frame(module_name, &mut rng));
        }

        // Reverse so app code is on top (most recent frame first)
        frames.reverse();

        let thread_names = ["main", "com.apple.main-thread", "com.apple.uikit.eventfetch-thread",
                           "com.apple.CoreAnimation.render-server", "NSOperationQueue 0x1",
                           "dispatch-worker-0", "dispatch-worker-1"];
        let thread_name = thread_names[rng.gen_range(0..thread_names.len())];

        StackSample {
            timestamp: self.start_time.elapsed().as_secs_f64(),
            thread_id: rng.gen_range(1..=8),
            thread_name: thread_name.to_string(),
            frames,
            weight: rng.gen_range(1..=5),
        }
    }

    fn random_frame(&self, module: &str, rng: &mut impl Rng) -> StackFrame {
        let (mod_name, functions) = SWIFT_MODULES.iter()
            .find(|(m, _)| *m == module)
            .unwrap_or(&SWIFT_MODULES[0]);

        let func = functions[rng.gen_range(0..functions.len())];

        StackFrame {
            function_name: func.to_string(),
            module: mod_name.to_string(),
            file: if module == "MyApp" {
                Some(format!("{}.swift", func.split('.').next().unwrap_or("Unknown")))
            } else {
                None
            },
            line: if module == "MyApp" { Some(rng.gen_range(10..500)) } else { None },
        }
    }

    /// Build a flame graph from collected stack samples
    pub fn build_flame_graph(samples: &[StackSample]) -> FlameNode {
        let mut root = FlameNode {
            name: "root".to_string(),
            module: "".to_string(),
            value: 0,
            total: 0,
            children: Vec::new(),
        };

        for sample in samples {
            let weight = sample.weight;
            // Walk the frames bottom-up (deepest frame = index len-1, top frame = 0)
            let frames: Vec<&StackFrame> = sample.frames.iter().rev().collect();
            Self::insert_frames(&mut root, &frames, 0, weight);
        }

        Self::compute_totals(&mut root);
        root
    }

    fn insert_frames(node: &mut FlameNode, frames: &[&StackFrame], idx: usize, weight: u64) {
        if idx >= frames.len() {
            node.value += weight;
            return;
        }

        let frame = frames[idx];
        let child_name = format!("{}::{}", frame.module, frame.function_name);

        let child_pos = node.children.iter().position(|c| c.name == child_name);
        let child = if let Some(pos) = child_pos {
            &mut node.children[pos]
        } else {
            node.children.push(FlameNode {
                name: child_name,
                module: frame.module.clone(),
                value: 0,
                total: 0,
                children: Vec::new(),
            });
            node.children.last_mut().unwrap()
        };

        Self::insert_frames(child, frames, idx + 1, weight);
    }

    fn compute_totals(node: &mut FlameNode) -> u64 {
        let mut total = node.value;
        for child in &mut node.children {
            total += Self::compute_totals(child);
        }
        node.total = total;
        total
    }
}

/// Simulates I/O activity sampling
pub struct IoSampler {
    start_time: std::time::Instant,
    cumulative_read: u64,
    cumulative_write: u64,
}

impl IoSampler {
    pub fn new() -> Self {
        Self {
            start_time: std::time::Instant::now(),
            cumulative_read: 0,
            cumulative_write: 0,
        }
    }

    pub fn sample(&mut self) -> IoSample {
        let mut rng = rand::thread_rng();

        // Simulate bursty I/O patterns
        let read_burst = if rng.gen_bool(0.3) { rng.gen_range(50000..500000) } else { rng.gen_range(0..10000) };
        let write_burst = if rng.gen_bool(0.2) { rng.gen_range(20000..200000) } else { rng.gen_range(0..5000) };

        self.cumulative_read += read_burst;
        self.cumulative_write += write_burst;

        IoSample {
            timestamp: self.start_time.elapsed().as_secs_f64(),
            disk_read_bytes: read_burst,
            disk_write_bytes: write_burst,
            network_rx_bytes: rng.gen_range(1000..100000),
            network_tx_bytes: rng.gen_range(500..50000),
        }
    }
}

/// Simulates energy impact sampling (like Instruments' Energy Log)
pub struct EnergySampler {
    start_time: std::time::Instant,
}

impl EnergySampler {
    pub fn new() -> Self {
        Self {
            start_time: std::time::Instant::now(),
        }
    }

    pub fn sample(&mut self, cpu_usage: f64) -> EnergySample {
        let mut rng = rand::thread_rng();

        let cpu_energy = (cpu_usage / 100.0).clamp(0.0, 1.0);
        let gpu_energy: f64 = rng.gen_range(0.0..0.3);
        let total = (cpu_energy * 0.7 + gpu_energy * 0.3).clamp(0.0, 1.0);

        let thermal = if total > 0.8 {
            ThermalState::Serious
        } else if total > 0.5 {
            ThermalState::Fair
        } else {
            ThermalState::Nominal
        };

        EnergySample {
            timestamp: self.start_time.elapsed().as_secs_f64(),
            cpu_energy,
            gpu_energy,
            total_impact: total,
            thermal_state: thermal,
        }
    }
}
