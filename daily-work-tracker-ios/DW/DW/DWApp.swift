//
//  DWApp.swift
//  DW
//
//  Created by Joshua Atkinson on 2026/05/08.
//

import SwiftUI
import DailyWorkTracker

@main
struct DWApp: App {
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            ContentView()
                .onChange(of: scenePhase) { newPhase in
                    if newPhase == .active {
                        // Trigger a sync when app returns to foreground.
                        // Uses employeeId persisted by the UI (see ContentView.swift) with a dev fallback.
                        let storedEmployeeId = UserDefaults.standard.string(forKey: "ddworkrecord_employee_id")
                        SyncCoordinator.shared.triggerSync(employeeId: storedEmployeeId ?? "EMPLOYEE_1")
                    }
                }
        }
    }
}
