import Foundation

public final class OfflineWorkdayRepository: WorkdayRepository, WorkdayLocalStore, @unchecked Sendable {
    private let fileManager = FileManager.default
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    public init() {
        self.encoder = JSONEncoder()
        self.encoder.dateEncodingStrategy = .iso8601
        self.decoder = JSONDecoder()
        self.decoder.dateDecodingStrategy = .iso8601
        
        try? fileManager.createDirectory(at: storageURL, withIntermediateDirectories: true)
    }

    private var storageURL: URL {
        fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("WorkdayRecords", isDirectory: true)
    }

    private func fileURL(for recordId: String) -> URL {
        // Sanitize recordId to be used as a filename
        let safeName = recordId.replacingOccurrences(of: ":", with: "_")
        return storageURL.appendingPathComponent("\(safeName).json")
    }

    // MARK: - WorkdayRepository

    public func upsertDailyRecord(_ record: DailyWorkRecord) async throws {
        try await upsertDailyRecord(record, calendar: .current)
    }

    public func upsertDailyRecord(_ record: DailyWorkRecord, calendar: Calendar) async throws {
        let data = try encoder.encode(record)
        let url = fileURL(for: record.id)
        
        // Atomic write to prevent data corruption
        try data.write(to: url, options: .atomic)
    }

    public func fetchDailyRecord(id: String) async throws -> DailyWorkRecord? {
        let url = fileURL(for: id)
        guard fileManager.fileExists(atPath: url.path) else { return nil }
        
        let data = try Data(contentsOf: url)
        return try decoder.decode(DailyWorkRecord.self, from: data)
    }

    // MARK: - WorkdayLocalStore (For SyncManager)

    public func fetchDailyRecords(
        employeeId: String,
        from: Date,
        to: Date,
        calendar: Calendar
    ) async throws -> [DailyWorkRecord] {
        let allFiles = try fileManager.contentsOfDirectory(at: storageURL, includingPropertiesForKeys: nil)
        
        var results: [DailyWorkRecord] = []
        
        for url in allFiles where url.pathExtension == "json" {
            do {
                let data = try Data(contentsOf: url)
                let record = try decoder.decode(DailyWorkRecord.self, from: data)
                
                // Filter by employee and date range
                if record.employeeId == employeeId {
                    let recordDate = record.date
                    if recordDate >= from && recordDate <= to {
                        results.append(record)
                    }
                }
            } catch {
                // Skip corrupted files
                print("Failed to decode local record at \(url): \(error)")
                continue
            }
        }
        
        // Return sorted by date descending
        return results.sorted { $0.date > $1.date }
    }

    public func fetchDailyRecordForAdmin(employeeId: String, dateKey: String) async throws -> DailyWorkRecord {
        throw NSError(domain: "NotImplemented", code: 501)
    }

    public func fetchSummaryForAdmin(employeeId: String?, from: Date, to: Date, calendar: Calendar) async throws -> [DailyWorkRecord] {
        return try await fetchDailyRecords(employeeId: employeeId ?? "", from: from, to: to, calendar: calendar)
    }
}