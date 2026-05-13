import Foundation

@MainActor
@available(macOS 10.15, iOS 13.0, *)
public final class WorkdaySyncManager: ObservableObject {
    private let store: WorkdayLocalStore
    private let apiBaseURL: URL
    private let photoDataProvider: @Sendable (String) -> Data?
    private let bearerTokenProvider: @Sendable () -> String?
    
    @Published public var isSyncing = false
    
    public init(
        store: WorkdayLocalStore,
        apiBaseURL: URL,
        photoDataProvider: @escaping @Sendable (String) -> Data?,
        bearerTokenProvider: @escaping @Sendable () -> String?
    ) {
        self.store = store
        self.apiBaseURL = apiBaseURL
        self.photoDataProvider = photoDataProvider
        self.bearerTokenProvider = bearerTokenProvider
    }
    
    public func syncAllPendingRecords(employeeId: String) async {
        guard !isSyncing else { return }
        isSyncing = true
        defer { isSyncing = false }
        
        let calendar = Calendar.current
        let now = Date()
        let thirtyDaysAgo = calendar.date(byAdding: .day, value: -30, to: now)!
        
        do {
            let records = try await store.fetchDailyRecords(
                employeeId: employeeId,
                from: thirtyDaysAgo,
                to: now,
                calendar: calendar
            )
            
            for record in records {
                // Only sync records that have ended
                guard record.endMileage != nil else { continue }
                
                if #available(macOS 12.0, iOS 15.0, *) {
                    // 1. Upload Photos first
                    try await uploadRecordMedia(record)
                    
                    // 2. Upload JSON Record
                    try await uploadRecord(record)
                } else {
                    // Fallback or handle older versions if necessary
                }
            }
        } catch {
            print("Sync failed: \(error)")
        }
    }
    
    @available(macOS 12.0, iOS 15.0, *)
    private func uploadRecordMedia(_ record: DailyWorkRecord) async throws {
        // Collect all photo IDs from segments
        let allPhotoIds = record.jobs.flatMap { $0.photoBeforeIds + $0.photoAfterIds }
            + record.fuels.flatMap { $0.photoReceiptIds }
            + record.suppliers.flatMap { $0.photoReceiptIds }
            
        for id in allPhotoIds {
            guard let data = photoDataProvider(id) else { continue }
            try await uploadSinglePhoto(id: id, data: data)
        }
    }
    
    @available(macOS 12.0, iOS 15.0, *)
    private func uploadSinglePhoto(id: String, data: Data) async throws {
        let url = apiBaseURL.appendingPathComponent("media/upload")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        
        if let token = bearerTokenProvider() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let boundary = "Boundary-\(UUID().uuidString)"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        
        var body = Data()
        
        // Add photoId field
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"photoId\"\r\n\r\n".data(using: .utf8)!)
        body.append("\(id)\r\n".data(using: .utf8)!)
        
        // Add image data
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"photo\"; filename=\"\(id).jpg\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
        body.append(data)
        body.append("\r\n".data(using: .utf8)!)
        
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        
        request.httpBody = body
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw NSError(domain: "SyncError", code: 1, userInfo: [NSLocalizedDescriptionKey: "Photo upload failed"])
        }
    }
    
    @available(macOS 12.0, iOS 15.0, *)
    private func uploadRecord(_ record: DailyWorkRecord) async throws {
        let url = apiBaseURL.appendingPathComponent("workday/sync")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        
        if let token = bearerTokenProvider() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        request.httpBody = try encoder.encode(record)
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, 
              (200...299).contains(httpResponse.statusCode) else {
            throw NSError(domain: "SyncError", code: 0, userInfo: nil)
        }
    }
}
