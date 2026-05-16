//
//  ContentView.swift
//  DW
//
//  Created by Joshua Atkinson on 2026/05/08.
//

import SwiftUI
import DailyWorkTracker

struct ContentView: View {
    @State private var isSignedIn: Bool = {
        let token = UserDefaults.standard.string(forKey: "ddworkrecord_id_token") ?? ""
        let businessCode = UserDefaults.standard.string(forKey: "ddworkrecord_business_code") ?? ""
        return !token.isEmpty && !businessCode.isEmpty
    }()

    var body: some View {
        NavigationView {
            Group {
                if isSignedIn {
                    StartDayScreen()
                        .onAppear {
                            NotificationManager.shared.requestAuthorization()
                        }
                } else {
                    LoginScreen {
                        isSignedIn = true
                    }
                }
            }
        }
    }
}

struct StartDayScreen: View {
    @State private var employeeId: String = UserDefaults.standard.string(forKey: "ddworkrecord_employee_id") ?? "EMPLOYEE_1"

    private func configureAuthTokenProvider() {
        // Placeholder until FirebaseAuth Swift SDK is added.
        // Set this value after login/onboarding:
        //   UserDefaults.standard.set(<firebaseIdToken>, forKey: "ddworkrecord_id_token")
        SyncCoordinator.bearerTokenProvider = {
            UserDefaults.standard.string(forKey: "ddworkrecord_id_token")
        }
    }

    @State private var assistant1Id: String = UserDefaults.standard.string(forKey: "ddworkrecord_assistant_1_id") ?? ""
    @State private var assistant2Id: String = UserDefaults.standard.string(forKey: "ddworkrecord_assistant_2_id") ?? ""
    @State private var assistant3Id: String = UserDefaults.standard.string(forKey: "ddworkrecord_assistant_3_id") ?? ""
    @State private var activeAssistantSlot: Int = 0 // 0 = Crew/Employee, 1-3 = assistants

    @State private var vehicleId: String = UserDefaults.standard.string(forKey: "ddworkrecord_vehicle_id") ?? ""
    @State private var startMileage: String = ""

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "clock.arrow.circlepath")
                .font(.system(size: 48))
                .foregroundStyle(.tint)

            Text("Daily Work Tracking")
                .font(.title2)
                .fontWeight(.bold)

            VStack(alignment: .leading, spacing: 8) {
                Text("Employee ID")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                TextField("Employee ID", text: $employeeId)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textFieldStyle(.roundedBorder)
                
                TextField("Vehicle ID", text: $vehicleId)
                    .textFieldStyle(.roundedBorder)
                
                TextField("Starting Mileage", text: $startMileage)
                    .keyboardType(.decimalPad)
                    .textFieldStyle(.roundedBorder)

                Divider().padding(.vertical, 8)

                Text("Assistant 1 ID").font(.subheadline).foregroundStyle(.secondary)
                TextField("Assistant 1 ID", text: $assistant1Id).textFieldStyle(.roundedBorder)

                Text("Assistant 2 ID").font(.subheadline).foregroundStyle(.secondary)
                TextField("Assistant 2 ID", text: $assistant2Id).textFieldStyle(.roundedBorder)

                Text("Assistant 3 ID").font(.subheadline).foregroundStyle(.secondary)
                TextField("Assistant 3 ID", text: $assistant3Id).textFieldStyle(.roundedBorder)
            }
            .padding(.horizontal)

            NavigationLink {
                WorkdayHomeScreen(employeeId: employeeId, vehicleId: vehicleId, initialMileage: Double(startMileage) ?? 0)
            } label: {
                Text("Start Day")
                    .frame(maxWidth: .infinity)
            }
            .onTapGesture {
                // Used by DWApp.swift when the app returns to foreground to know which employee to sync.
                UserDefaults.standard.set(employeeId, forKey: "ddworkrecord_employee_id")
                UserDefaults.standard.set(vehicleId, forKey: "ddworkrecord_vehicle_id")
                UserDefaults.standard.set(assistant1Id, forKey: "ddworkrecord_assistant_1_id")
                UserDefaults.standard.set(assistant2Id, forKey: "ddworkrecord_assistant_2_id")
                UserDefaults.standard.set(assistant3Id, forKey: "ddworkrecord_assistant_3_id")
            }
            .buttonStyle(.borderedProminent)
            .padding(.horizontal)
            .padding(.top, 8)

            Spacer()
        }
        .padding(.top, 24)
        .navigationTitle("Welcome")
        .onAppear {
            configureAuthTokenProvider()
        }
    }
}

struct WorkdayHomeScreen: View {
    let employeeId: String
    let vehicleId: String

    @Environment(\.dismiss) private var dismiss

    @State private var engine: WorkdayEngine
    @State private var errorMessage: String?

    @StateObject private var locationService = LocationService()
    private let repository: WorkdayRepository = OfflineWorkdayRepository()

    init(employeeId: String, vehicleId: String, initialMileage: Double) {
        self.employeeId = employeeId
        self.vehicleId = vehicleId
        let seed = DailyWorkRecord(
            id: "EMP:\(employeeId)",
            employeeId: employeeId,
            date: Date(),
            vehicleId: vehicleId,
            workshops: [],
            travels: [],
            suppliers: [],
            fuels: [],
            jobs: [],
            privateSegments: [],
            endNotes: nil,
            dayStartLocation: nil,
            dayEndLocation: nil,
            startMileage: initialMileage,
            endMileage: nil
        )
        _engine = State(initialValue: WorkdayEngine(seedRecord: seed))
    }

    var body: some View {
        Form {
            Section("Day Summary") {
                HStack {
                    Label("\(String(format: "%.1f", engine.record.totalHours)) hrs", systemImage: "clock")
                    Spacer()
                    Label("\(String(format: "%.1f", engine.record.totalDistanceKm)) km", systemImage: "car")
                }
                .font(.headline)
            }

            Section("Workflow") {
                Text("Current phase: \(String(describing: engine.phase))")
                    .foregroundStyle(.secondary)
                    .onChange(of: engine.phase) { newPhase in
                        NotificationManager.shared.scheduleReminder(for: newPhase)
                    }

                workflowButtons
            }

            if let errorMessage {
                Section {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.leading)
                }
            }
        }
        .navigationTitle("Workday")
        .navigationBarBackButtonHidden(true)
        .interactiveDismissDisabled(engine.phase != .end)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    if engine.phase == .end {
                        dismiss()
                    }
                } label: {
                    Image(systemName: "chevron.left")
                        .accessibilityLabel("Back to Welcome")
                }
                .disabled(engine.phase != .end)
            }
        }
    }

    @ViewBuilder
    private var workflowButtons: some View {
        switch engine.phase {
        case .start:
            Button("Workshop Start") {
                errorMessage = nil
                Task { @MainActor in
                    do {
                        let ok = await locationService.requestAuthorizationIfNeeded()
                        guard ok else { throw LocationService.LocationError.notAuthorized }
                        let fix = try await locationService.requestOneShotFixAssumingAuthorized()
                        try engine.startWorkshop(at: Date(), location: fix)
                        try await repository.upsertDailyRecord(engine.record)
                    } catch {
                        errorMessage = String(describing: error)
                    }
                }
            }

        case .workshop:
            Button("Stop Workshop") {
                errorMessage = nil
                Task { @MainActor in
                    do {
                        let ok = await locationService.requestAuthorizationIfNeeded()
                        guard ok else { throw LocationService.LocationError.notAuthorized }
                        let fix = try await locationService.requestOneShotFixAssumingAuthorized()
                        try engine.stopWorkshop(at: Date(), location: fix)
                        try await repository.upsertDailyRecord(engine.record)
                    } catch {
                        errorMessage = String(describing: error)
                    }
                }
            }

        case .travel:
            Group {
                NavigationLink { TravelScreen(engine: $engine, run: run) } label: { Text("Travel") }
                NavigationLink { JobScreen(engine: $engine, run: run) } label: { Text("Job") }
                NavigationLink { SupplierScreen(engine: $engine, run: run) } label: { Text("Supplier") }
                NavigationLink { FuelScreen(engine: $engine, run: run) } label: { Text("Fuel") }
                NavigationLink { PrivateScreen(engine: $engine, run: run) } label: { Text("Private") }
                NavigationLink { EndDayScreen(engine: $engine) } label: { Text("End Day Summary") }
            }

        case .supplier:
            NavigationLink { SupplierScreen(engine: $engine, run: run) } label: { Text("Supplier") }

        case .fuel:
            NavigationLink { FuelScreen(engine: $engine, run: run) } label: { Text("Fuel") }

        case .job:
            NavigationLink { JobScreen(engine: $engine, run: run) } label: { Text("Job") }

        case .privateTime:
            NavigationLink { PrivateScreen(engine: $engine, run: run) } label: { Text("Private") }

        case .end:
            Text("Workday Completed").font(.headline).foregroundStyle(.green)
        }
    }

    private func run(_ work: () throws -> Void) {
        errorMessage = nil
        do { try work() } catch { errorMessage = String(describing: error) }
    }
}

struct TravelScreen: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var engine: WorkdayEngine
    let run: (@escaping () throws -> Void) -> Void

    @StateObject private var locationService = LocationService()

    @State private var startingMileage: String = ""
    @State private var endingMileage: String = ""
    @State private var mode: Mode = .start
    @State private var stopError: String? = nil

    enum Mode { case start, stop }

    var body: some View {
        Form {
            Section("Travel Tracking") {
                if let stopError {
                    Text(stopError)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.leading)
                }

                if mode == .start {
                    TextField("Starting mileage", text: $startingMileage)
                        .keyboardType(.decimalPad)

                    Button("Start Travel") {
                        stopError = nil
                        Task {
                    do {
                        let ok = await locationService.requestAuthorizationIfNeeded()
                        guard ok else { throw LocationService.LocationError.notAuthorized }
                        let fix = try await locationService.requestOneShotFixAssumingAuthorized()
                        try engine.startTravel(
                            at: Date(),
                            startingMileage: Double(startingMileage) ?? 0,
                            location: fix,
                            vehicleId: nil
                        )
                        mode = .stop
                    } catch {
                                stopError = String(describing: error)
                            }
                        }
                    }
                } else {
                    TextField("Ending mileage", text: $endingMileage)
                        .keyboardType(.decimalPad)

                    Button("Stop Travel") {
                        let end = Double(endingMileage) ?? 0
                        stopError = nil
                        Task {
                    do {
                        let ok = await locationService.requestAuthorizationIfNeeded()
                        guard ok else { throw LocationService.LocationError.notAuthorized }
                        let fix = try await locationService.requestOneShotFixAssumingAuthorized()
                        try engine.stopTravel(
                            at: Date(),
                            endingMileage: end,
                            location: fix
                        )
                        // Persist after stop
                        let repository = OfflineWorkdayRepository() as WorkdayRepository
                        try await repository.upsertDailyRecord(engine.record)
                        dismiss()
                    } catch {
                                stopError = String(describing: error)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Travel")
    }
}

struct SupplierScreen: View {
    @Binding var engine: WorkdayEngine
    let run: (@escaping () throws -> Void) -> Void

    @StateObject private var locationService = LocationService()

    @State private var arrivalMode = false
    @State private var supplierName = ""
    @State private var amountSpent = ""
    @State private var whatPurchased = ""
    @State private var jobId = ""
    @State private var mileage = ""
    @State private var selectedUIImages: [UIImage] = []
    @State private var showPicker = false

    @State private var errorMessage: String?

    var body: some View {
        Form {
            if showPicker {
                PhotoPicker(selectedImages: $selectedUIImages)
            }
            
            if let errorMessage {
                Section {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.leading)
                }
            }

            Section("Supplier") {
                if !arrivalMode {
                    Button("Arrive / Start Supplier Timer") {
                        errorMessage = nil
                        Task {
                            do {
                                let ok = await locationService.requestAuthorizationIfNeeded()
                                guard ok else { throw LocationService.LocationError.notAuthorized }
                                let fix = try await locationService.requestOneShotFixAssumingAuthorized()
                                try engine.startSupplier(
                                    arrivalTime: Date(), 
                                    arrivalLocation: fix, 
                                    startMileage: Double(mileage)
                                )
                                arrivalMode = true
                            } catch {
                                errorMessage = String(describing: error)
                            }
                        }
                    }
                } else {
                    TextField("Supplier name", text: $supplierName)
                    TextField("Current Mileage", text: $mileage).keyboardType(.decimalPad)
                    TextField("Amount spent", text: $amountSpent).keyboardType(.decimalPad)
                    TextField("What was purchased", text: $whatPurchased)
                    TextField("Job ID (optional)", text: $jobId)
                    
                    Section("Receipts") {
                        Button("Add Photo") { showPicker = true }
                        Text("\(selectedUIImages.count) photos selected")
                    }

                    Button("Stop Supplier & Save") {
                        errorMessage = nil
                        let amount = Double(amountSpent) ?? 0
                        let jobIdVal = jobId.trimmingCharacters(in: .whitespacesAndNewlines)
                        
                        let photoIds = selectedUIImages.compactMap { PhotoService.shared.savePhoto(image: $0) }

                        Task {
                            do {
                                let ok = await locationService.requestAuthorizationIfNeeded()
                                guard ok else { throw LocationService.LocationError.notAuthorized }
                                let fix = try await locationService.requestOneShotFixAssumingAuthorized()
                                try engine.stopSupplier(
                                    endTime: Date(),
                                    departureLocation: fix,
                                    supplierName: supplierName,
                                    amountSpent: amount,
                                    whatPurchased: whatPurchased,
                                    jobId: jobIdVal.isEmpty ? nil : jobIdVal,
                                    startMileage: engine.record.suppliers.last?.startMileage,
                                    endMileage: Double(mileage),
                                    photoReceiptIds: photoIds
                                )
                                // Persist after stop
                                let repository = OfflineWorkdayRepository() as WorkdayRepository
                                try await repository.upsertDailyRecord(engine.record)
                                arrivalMode = false
                            } catch {
                                errorMessage = String(describing: error)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Supplier")
    }
}

struct FuelScreen: View {
    @Binding var engine: WorkdayEngine
    let run: (@escaping () throws -> Void) -> Void

    @StateObject private var locationService = LocationService()

    @State private var arrivalMode = false
    @State private var litersFilled = ""
    @State private var totalCost = ""
    @State private var fuelStationName = ""
    @State private var mileage = ""
    @State private var selectedUIImages: [UIImage] = []
    @State private var showPicker = false

    var body: some View {
        Form {
            Section("Fuel") {
                if !arrivalMode {
                    Button("Arrive / Start Fuel Timer") {
                        Task {
                            do {
                                let ok = await locationService.requestAuthorizationIfNeeded()
                                guard ok else { throw LocationService.LocationError.notAuthorized }
                                let fix = try await locationService.requestOneShotFixAssumingAuthorized()
                                try engine.startFuel(
                                    arrivalTime: Date(), 
                                    arrivalLocation: fix, 
                                    startMileage: Double(mileage)
                                )
                                arrivalMode = true
                            } catch {
                                // Keep it simple for MVP; user can retry
                                arrivalMode = false
                            }
                        }
                    }
                } else {
                    TextField("Current Mileage", text: $mileage).keyboardType(.decimalPad)
                    TextField("Liters filled", text: $litersFilled).keyboardType(.decimalPad)
                    TextField("Total cost", text: $totalCost).keyboardType(.decimalPad)
                    TextField("Fuel station name (optional)", text: $fuelStationName)
                    
                    Section("Receipt Photo") {
                        Button("Add Photo") { showPicker = true }
                        Text("\(selectedUIImages.count) photos selected")
                    }

                    Button("Stop Fuel & Save") {
                        let liters = Double(litersFilled) ?? 0
                        let cost = Double(totalCost) ?? 0
                        let stationVal = fuelStationName.trimmingCharacters(in: .whitespacesAndNewlines)
                        let photoIds = selectedUIImages.compactMap { PhotoService.shared.savePhoto(image: $0) }

                        Task {
                            do {
                                let ok = await locationService.requestAuthorizationIfNeeded()
                                guard ok else { throw LocationService.LocationError.notAuthorized }
                                let fix = try await locationService.requestOneShotFixAssumingAuthorized()
                                try engine.stopFuel(
                                    endTime: Date(),
                                    departureLocation: fix,
                                    litersFilled: liters,
                                    totalCost: cost,
                                    fuelStationName: stationVal.isEmpty ? nil : stationVal,
                                    startMileage: engine.record.fuels.last?.startMileage,
                                    endMileage: Double(mileage),
                                    photoReceiptIds: photoIds
                                )
                                // Persist after stop
                                let repository = OfflineWorkdayRepository() as WorkdayRepository
                                try await repository.upsertDailyRecord(engine.record)
                                arrivalMode = false
                            } catch {
                                // Leave arrivalMode true so user can retry
                            }
                        }
                    }
                }
            }.sheet(isPresented: $showPicker) {
                PhotoPicker(selectedImages: $selectedUIImages)
            }.navigationTitle("Fuel")
        }
    }
}

struct JobScreen: View {
    @Binding var engine: WorkdayEngine
    let run: (@escaping () throws -> Void) -> Void

    private let repository: WorkdayRepository = OfflineWorkdayRepository()

    @StateObject private var locationService = LocationService()

    @State private var started = false
    @State private var jobId = ""
    @State private var clientName = ""
    @State private var siteName = ""
    @State private var status: JobStatus = .complete
    @State private var mileage = ""
    
    @State private var beforeImages: [UIImage] = []
    @State private var afterImages: [UIImage] = []
    @State private var showPicker = false

    @State private var errorMessage: String?

    var body: some View {
        Form {
            if let errorMessage {
                Text(errorMessage).foregroundStyle(.red)
            }
            Section("Job") {
                if !started {
                    TextField("Job ID", text: $jobId)
                    TextField("Client name", text: $clientName)
                    TextField("Site name / location", text: $siteName)
                    TextField("Starting Mileage", text: $mileage).keyboardType(.decimalPad)
                    
                    Section("Before Photos") {
                        Button("Add Photos") { showPicker = true }
                        Text("\(beforeImages.count) photos selected")
                    }

                    Button("Start Job") {
                        Task {
                            do {
                                let ok = await locationService.requestAuthorizationIfNeeded()
                                guard ok else { throw LocationService.LocationError.notAuthorized }
                                let fix = try await locationService.requestOneShotFixAssumingAuthorized()
                                let photoIds = beforeImages.compactMap { PhotoService.shared.savePhoto(image: $0) }
                                try engine.startJob(
                                    startTime: Date(),
                                    jobId: jobId,
                                    clientName: clientName,
                                    siteName: siteName,
                                    location: fix,
                                    startMileage: Double(mileage) ?? 0,
                                    photoBeforeIds: photoIds
                                )
                                started = true
                            } catch {
                                errorMessage = String(describing: error)
                            }
                        }
                    }
                } else {
                    TextField("Ending Mileage", text: $mileage).keyboardType(.decimalPad)
                    Picker("Status", selection: $status) {
                        Text("Complete").tag(JobStatus.complete)
                        Text("Return Required").tag(JobStatus.returnRequired)
                    }
                    
                    Section("After Photos") {
                        Button("Add Photos") { showPicker = true }
                        Text("\(afterImages.count) photos selected")
                    }

                    Button("Stop Job & Save") {
                        Task { @MainActor in
                            do {
                                let ok = await locationService.requestAuthorizationIfNeeded()
                                guard ok else { throw LocationService.LocationError.notAuthorized }
                                let fix = try await locationService.requestOneShotFixAssumingAuthorized()
                                let photoIds = afterImages.compactMap { PhotoService.shared.savePhoto(image: $0) }
                                try engine.stopJob(
                                    endTime: Date(),
                                    endLocation: fix,
                                    status: status,
                                    startMileage: engine.record.jobs.last?.startMileage,
                                    endMileage: Double(mileage),
                                    photoAfterIds: photoIds
                                )
                                try await repository.upsertDailyRecord(engine.record)
                                started = false
                            } catch {
                                errorMessage = String(describing: error)
                            }
                        }
                    }
                }
            }
        }
        .sheet(isPresented: $showPicker) {
            PhotoPicker(selectedImages: started ? $afterImages : $beforeImages)
        }
        .navigationTitle("Job")
    }
}

struct PrivateScreen: View {
    @Binding var engine: WorkdayEngine
    let run: (@escaping () throws -> Void) -> Void

    @StateObject private var locationService = LocationService()

    @State private var started = false
    @State private var description = ""
    @State private var category: PrivateTimeCategory = .privateNonWork
    @State private var workRelatedTask = ""
    @State private var notes = ""
    @State private var errorMessage: String?

    var body: some View {
        Form {
            if let errorMessage {
                Text(errorMessage).foregroundStyle(.red)
            }
            Section("Private Time") {
                if !started {
                    TextField("Description", text: $description)
                    Picker("Category", selection: $category) {
                        Text("Private (non-work)").tag(PrivateTimeCategory.privateNonWork)
                        Text("Work-related private").tag(PrivateTimeCategory.workRelated)
                    }
                    if category == .workRelated {
                        TextField("Work-related private task", text: $workRelatedTask)
                    }
                    Button("Start Private") {
                        Task {
                            do {
                                let ok = await locationService.requestAuthorizationIfNeeded()
                                guard ok else { throw LocationService.LocationError.notAuthorized }
                                let fix = try await locationService.requestOneShotFixAssumingAuthorized()
                                try engine.startPrivate(
                                    startTime: Date(),
                                    description: description,
                                    category: category,
                                    workRelatedTask: category == .workRelated ? workRelatedTask : nil,
                                    location: fix
                                )
                                started = true
                            } catch {
                                errorMessage = String(describing: error)
                            }
                        }
                    }
                } else {
                    TextField("End Notes (optional)", text: $notes)
                    Button("Stop Private & Save") {
                        Task {
                            do {
                                let ok = await locationService.requestAuthorizationIfNeeded()
                                guard ok else { throw LocationService.LocationError.notAuthorized }
                                let fix = try await locationService.requestOneShotFixAssumingAuthorized()
                                try engine.stopPrivate(
                                    endTime: Date(),
                                    endLocation: fix,
                                    notes: notes.isEmpty ? nil : notes
                                )
                                // Persist after stop
                                let repository = OfflineWorkdayRepository() as WorkdayRepository
                                try await repository.upsertDailyRecord(engine.record)
                                started = false
                            } catch {
                                errorMessage = String(describing: error)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Private")
    }
}

struct EndDayScreen: View {
    @State private var notes: String = ""
    @State private var mileage: String = ""
    @State private var debugStep: String = "idle"
    @State private var endDayTapCount: Int = 0
    @State private var endDayLastTap: Date?

    @Binding var engine: WorkdayEngine
    private let repository: WorkdayRepository = OfflineWorkdayRepository()
    @StateObject private var locationService = LocationService()

    @State private var errorMessage: String?

    var body: some View {
        Form {
            if let errorMessage {
                Section {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.leading)
                }
            }

            Section {
                Text("End Day status: \(debugStep) (taps: \(endDayTapCount))")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                if let endDayLastTap {
                    Text("Last tap: \(endDayLastTap.formatted(date: .numeric, time: .standard))")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }

            Section("Totals") {
                Text("Workshops: \(engine.record.workshops.count)")
                Text("Travel segments: \(engine.record.travels.count)")
                Text("Suppliers: \(engine.record.suppliers.count)")
                Text("Fuel: \(engine.record.fuels.count)")
                Text("Jobs: \(engine.record.jobs.count)")
                Text("Private segments: \(engine.record.privateSegments.count)")
            }

            Section("Final Details") {
                TextField("Ending Mileage", text: $mileage).keyboardType(.decimalPad)
                TextField("Notes", text: $notes)
            }

            Section {
                    Button("Complete Workday") {
                        // Update state synchronously first so we can confirm the tap handler runs.
                        print("EndDay tapped")
                        errorMessage = nil
                        endDayTapCount += 1
                        endDayLastTap = Date()
                        debugStep = "tapped"

                        Task.detached(priority: .userInitiated) { [notes, mileage, locationService, repository] in
                            do {
                                let ok = await locationService.requestAuthorizationIfNeeded()
                                guard ok else { throw LocationService.LocationError.notAuthorized }

                                await MainActor.run { debugStep = "requestLocation" }

                                let fix = try await locationService.requestOneShotFixAssumingAuthorized(timeoutSeconds: 8)

                                await MainActor.run { debugStep = "endDay" }
                                try await MainActor.run {
                                    try engine.endDay(
                                        at: Date(),
                                        endNotes: notes.isEmpty ? nil : notes,
                                        endLocation: fix,
                                        endMileage: Double(mileage)
                                    )
                                }

                                await MainActor.run { debugStep = "persist" }
                                try await repository.upsertDailyRecord(engine.record)

                                await MainActor.run { debugStep = "done" }
                            } catch {
                                await MainActor.run {
                                    debugStep = "failed"
                                    errorMessage = String(describing: error)
                                }
                            }
                        }
                    }
                .buttonStyle(.borderedProminent)
            }
        }
        .navigationTitle("End Day")
    }
}

#Preview {
    ContentView()
}
