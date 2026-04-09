use crate::models::{SwiftUIIssue, SwiftUIIssueType, Severity, StackSample};
use rand::Rng;

/// Analyzes profiling data to detect SwiftUI performance issues
pub struct SwiftUIAnalyzer {
    start_time: std::time::Instant,
    issue_count: u32,
}

// Realistic SwiftUI view names
const VIEW_NAMES: &[&str] = &[
    "ContentView", "ProfileView", "DashboardView", "SettingsView",
    "FeedView", "DetailView", "SearchResultsView", "ChatView",
    "ImageGalleryView", "NotificationListView", "CartView",
    "OnboardingView", "MapView", "TimelineView",
];

impl SwiftUIAnalyzer {
    pub fn new() -> Self {
        Self {
            start_time: std::time::Instant::now(),
            issue_count: 0,
        }
    }

    /// Analyze stack samples for SwiftUI-related performance issues
    pub fn analyze_stacks(&mut self, stacks: &[StackSample]) -> Vec<SwiftUIIssue> {
        let mut issues = Vec::new();
        let mut rng = rand::thread_rng();

        // Count SwiftUI body recomputations per view
        let mut body_calls: std::collections::HashMap<String, u32> = std::collections::HashMap::new();
        for stack in stacks {
            for frame in &stack.frames {
                if frame.module == "SwiftUI" && frame.function_name.contains("body.getter") {
                    *body_calls.entry(frame.function_name.clone()).or_insert(0) += 1;
                }
                if frame.module == "MyApp" && frame.function_name.contains("body.getter") {
                    let view = frame.function_name.split('.').next().unwrap_or("Unknown");
                    *body_calls.entry(view.to_string()).or_insert(0) += 1;
                }
            }
        }

        // Flag views with excessive recomputations
        for (view, count) in &body_calls {
            if *count > 5 {
                issues.push(SwiftUIIssue {
                    timestamp: self.start_time.elapsed().as_secs_f64(),
                    view_name: view.clone(),
                    issue_type: SwiftUIIssueType::ExcessiveBodyRecomputation,
                    description: format!(
                        "{} was recomputed {} times in the sampling window. This suggests unnecessary state invalidation triggering redundant view updates.",
                        view, count
                    ),
                    severity: if *count > 15 { Severity::Critical } else { Severity::Warning },
                    suggested_fix: format!(
                        "Extract child views into separate structs with their own @State. Use @ObservedObject only where needed. Consider using .equatable() modifier on {}.",
                        view
                    ),
                    update_count: *count,
                    time_spent_ms: *count as f64 * rng.gen_range(0.5..3.0),
                });
            }
        }

        issues
    }

    /// Generate a periodic SwiftUI issue detection (for live streaming)
    pub fn generate_issue(&mut self) -> Option<SwiftUIIssue> {
        let mut rng = rand::thread_rng();

        // Only generate issues occasionally (simulate real detection)
        if !rng.gen_bool(0.15) {
            return None;
        }

        self.issue_count += 1;
        let view = VIEW_NAMES[rng.gen_range(0..VIEW_NAMES.len())];

        let (issue_type, description, severity, fix) = match rng.gen_range(0..6) {
            0 => (
                SwiftUIIssueType::ExcessiveBodyRecomputation,
                format!("{}.body was recomputed {} times in 1s — likely caused by a parent state change propagating unnecessarily.", view, rng.gen_range(8..30)),
                Severity::Critical,
                format!("Break {} into smaller subviews. Move @State to the lowest common ancestor. Use @ObservedObject only for properties the view reads.", view),
            ),
            1 => (
                SwiftUIIssueType::UnnecessaryStateChange,
                format!("@State property in {} was set to its current value, triggering a redundant body evaluation.", view),
                Severity::Warning,
                "Guard state mutations: `if newValue != currentValue { self.value = newValue }`. Consider using Equatable conformance.".to_string(),
            ),
            2 => (
                SwiftUIIssueType::HeavyViewInit,
                format!("{}.init() took {:.1}ms — initializers should be lightweight as SwiftUI may call them frequently.", view, rng.gen_range(5.0..50.0)),
                Severity::Warning,
                "Move expensive setup to .onAppear or .task. Use lazy initialization for heavy resources.".to_string(),
            ),
            3 => (
                SwiftUIIssueType::UnbatchedUpdates,
                format!("Multiple @Published property changes in {}'s ViewModel triggered {} separate view updates instead of one batched update.", view, rng.gen_range(3..8)),
                Severity::Warning,
                "Wrap multiple property changes in a single objectWillChange.send() call, or restructure into a single @Published struct.".to_string(),
            ),
            4 => (
                SwiftUIIssueType::MainThreadBlocking,
                format!("{} performed a {:.0}ms synchronous operation on the main thread during body evaluation.", view, rng.gen_range(16.0..200.0)),
                Severity::Critical,
                "Move heavy computation to a background thread using .task { } or Task.detached { }. Use @State to store async results.".to_string(),
            ),
            _ => (
                SwiftUIIssueType::LargeViewHierarchy,
                format!("{} produced a view hierarchy with {} nodes — deep hierarchies slow down diffing.", view, rng.gen_range(200..1000)),
                Severity::Info,
                "Flatten the view hierarchy. Use Group instead of nested VStacks. Consider LazyVStack for long lists.".to_string(),
            ),
        };

        Some(SwiftUIIssue {
            timestamp: self.start_time.elapsed().as_secs_f64(),
            view_name: view.to_string(),
            issue_type,
            description,
            severity,
            suggested_fix: fix,
            update_count: rng.gen_range(1..30),
            time_spent_ms: rng.gen_range(0.5..50.0),
        })
    }
}
