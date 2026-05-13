import Foundation
import Combine

@MainActor
@available(macOS 10.15, iOS 13.0, *)
public final class SyncCoordinator: ObservableObject {
    public static let shared = SyncCoordinator()
    
    /// A closure provided by the App target to load photo data,
    /// as the package cannot see App-level services directly.
    ///
    /// Note: This is a mutable global set by the App/UI layer. Since SyncCoordinator
    /// itself is @MainActor, this effectively runs on the main actor, but Swift 6
    /// still requires an explicit concurrency escape hatch for the stored static.
    public nonisolated(unsafe) static var photoProvider: (@Sendable (String) -> Data?)?

    /// App/UI layer should provide a Firebase ID token for API Authorization:
    /// `Authorization: Bearer <idToken>`
    public nonisolated(unsafe) static var bearerTokenProvider: (@Sendable () -> String?)?

    private let syncManager: WorkdaySyncManager
    private let repository = OfflineWorkdayRepository()
    private var timer: Timer?
    
    private init() {
        // Production URL (must be your deployed API domain)
        // Example: https://your-api-domain.com/api/v1
        // Use your Azure API base URL here. 
        // If using Azure Static Web Apps with a linked backend, this is usually your custom domain + /api/v1
        let productionURL = URL(string: "https://ddworkrecord-api.azurewebsites.net/api/v1")
        let baseURL = productionURL ?? URL(string: "http://localhost:3000/api/v1")!

        if baseURL.host == "localhost" {
            print("[SyncCoordinator] WARNING: Running in LOCAL mode (localhost:3000). Ensure your Azure API is reachable if this is a production build.")
        }

        self.syncManager = WorkdaySyncManager(
            store: repository,
            apiBaseURL: baseURL,
            photoDataProvider: { id in
                return SyncCoordinator.photoProvider?(id)
            },
            bearerTokenProvider: {
                return SyncCoordinator.bearerTokenProvider?()
            }
        )
    }
    
    public func startAutomatedSync(employeeId: String) {
        stopAutomatedSync()
        
        // Initial sync
        triggerSync(employeeId: employeeId)
        
        // Periodic sync every 15 minutes while app is active
        timer = Timer.scheduledTimer(withTimeInterval: 900, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.triggerSync(employeeId: employeeId)
            }
        }
    }
    
    public func stopAutomatedSync() {
        timer?.invalidate()
        timer = nil
    }
    
    public func triggerSync(employeeId: String) {
        let manager = self.syncManager
        Task {
            await manager.syncAllPendingRecords(employeeId: employeeId)
        }
    }
}
