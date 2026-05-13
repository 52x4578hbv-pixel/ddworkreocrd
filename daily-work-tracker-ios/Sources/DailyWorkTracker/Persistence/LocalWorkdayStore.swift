import Foundation

public enum LocalStoreError: Error, Equatable {
    case invalidDateKey
    case directoryCreationFailed
    case encodeFailed
    case decodeFailed
    case fileNotFound
    case writeFailed
}

/// Offline JSON file store (no Core Data required).
/// Stores each workday as a single JSON file, keyed by employeeId + local dateKey (yyyy-MM-dd).
public struct LocalWorkdayJSONStore: WorkdayLocalStore, @unchecked Sendable {
    private let fileManager: FileManager
    private let baseDirectoryURL: URL
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    public init(
        fileManager: FileManager = .default,
        baseDirectoryURL: URL? = nil
    ) {
        self.fileManager = fileManager
        if let baseDirectoryURL {
            self.baseDirectoryURL = baseDirectoryURL
        } else {
            // Use Application Support; survives reinstall? No. But is correct for production caches.
            let root = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            self.baseDirectoryURL = root.appendingPathComponent("DailyWorkTracker", isDirectory: true)
        }

        self.encoder = JSONEncoder()
        // Keep as Date ISO8601 for readability + stable decode
        self.encoder.dateEncodingStrategy = .iso8601

        self.decoder = JSONDecoder()
        self.decoder.dateDecodingStrategy = .iso8601
    }

    private func ensureBaseDirectory() throws {
        if !fileManager.fileExists(atPath: baseDirectoryURL.path) {
            try fileManager.createDirectory(at: baseDirectoryURL, withIntermediateDirectories: true)
        }
    }

    private func dateKey(for localDate: Date, calendar: Calendar) -> String {
        return FirestoreDateKeyFormat.makeDateKey(localDate: localDate, calendar: calendar)
    }

    private func workdayURL(employeeId: String, dateKey: String) throws -> URL {
        try ensureBaseDirectory()
        let safeEmployeeId = employeeId.replacingOccurrences(of: "/", with: "_")
        let safeDateKey = dateKey.replacingOccurrences(of: "/", with: "-")
        return baseDirectoryURL
            .appendingPathComponent(safeEmployeeId, isDirectory: true)
            .appendingPathComponent("\(safeDateKey).json", isDirectory: false)
    }

    private func employeeDirectoryURL(employeeId: String) throws -> URL {
        try ensureBaseDirectory()
        let safeEmployeeId = employeeId.replacingOccurrences(of: "/", with: "_")
        return baseDirectoryURL.appendingPathComponent(safeEmployeeId, isDirectory: true)
    }

    public func upsertDailyRecord(_ record: DailyWorkRecord, calendar: Calendar) async throws {
        // This app’s domain model uses a `date: Date` field.
        // Convert to local dateKey for stable filenames.
        let dateKey = FirestoreDateKeyFormat.makeDateKey(localDate: record.date, calendar: calendar)
        let url = try workdayURL(employeeId: record.employeeId, dateKey: dateKey)

        let employeeDir = try employeeDirectoryURL(employeeId: record.employeeId)
        if !fileManager.fileExists(atPath: employeeDir.path) {
            try fileManager.createDirectory(at: employeeDir, withIntermediateDirectories: true)
        }

        let payload: Data
        do {
            payload = try encoder.encode(record)
        } catch {
            throw LocalStoreError.encodeFailed
        }

        // Atomic write: write temp -> replace.
        let tmpURL = url.appendingPathExtension("tmp")
        do {
            try payload.write(to: tmpURL, options: [.atomic])
            if fileManager.fileExists(atPath: url.path) {
                _ = try? fileManager.removeItem(at: url)
            }
            try fileManager.moveItem(at: tmpURL, to: url)
        } catch {
            // Try cleanup
            _ = try? fileManager.removeItem(at: tmpURL)
            throw LocalStoreError.writeFailed
        }
    }

    public func fetchDailyRecords(employeeId: String, from: Date, to: Date, calendar: Calendar) async throws -> [DailyWorkRecord] {
        // Build date keys and try decode each file. Skip missing files.
        let days = dateRangeDays(from: from, to: to, calendar: calendar)
        var results: [DailyWorkRecord] = []
        results.reserveCapacity(days.count)

        for day in days {
            let dk = dateKey(for: day, calendar: calendar)
            let url = try workdayURL(employeeId: employeeId, dateKey: dk)
            if !fileManager.fileExists(atPath: url.path) {
                continue
            }
            let data = try Data(contentsOf: url)
            do {
                let record = try decoder.decode(DailyWorkRecord.self, from: data)
                results.append(record)
            } catch {
                throw LocalStoreError.decodeFailed
            }
        }

        // Deterministic order
        results.sort { $0.date < $1.date }
        return results
    }

    public func fetchDailyRecordForAdmin(employeeId: String, dateKey: String) async throws -> DailyWorkRecord {
        let url = try workdayURL(employeeId: employeeId, dateKey: dateKey)
        guard fileManager.fileExists(atPath: url.path) else {
            throw LocalStoreError.fileNotFound
        }
        let data = try Data(contentsOf: url)
        do {
            return try decoder.decode(DailyWorkRecord.self, from: data)
        } catch {
            throw LocalStoreError.decodeFailed
        }
    }

    public func fetchSummaryForAdmin(employeeId: String?, from: Date, to: Date, calendar: Calendar) async throws -> [DailyWorkRecord] {
        let days = dateRangeDays(from: from, to: to, calendar: calendar)

        let employeeIds: [String]
        if let employeeId {
            employeeIds = [employeeId]
        } else {
            // List all employee directories
            try ensureBaseDirectory()
            let contents = try fileManager.contentsOfDirectory(at: baseDirectoryURL, includingPropertiesForKeys: nil)
            employeeIds = contents
                .filter { $0.hasDirectoryPath }
                .map { $0.lastPathComponent }
        }

        var all: [DailyWorkRecord] = []
        for eid in employeeIds {
            for day in days {
                let dk = dateKey(for: day, calendar: calendar)
                let url = try workdayURL(employeeId: eid, dateKey: dk)
                if !fileManager.fileExists(atPath: url.path) { continue }
                let data = try Data(contentsOf: url)
                do {
                    let record = try decoder.decode(DailyWorkRecord.self, from: data)
                    all.append(record)
                } catch {
                    throw LocalStoreError.decodeFailed
                }
            }
        }

        all.sort { ($0.employeeId, $0.date) < ($1.employeeId, $1.date) }
        return all
    }

    private func dateRangeDays(from start: Date, to end: Date, calendar: Calendar) -> [Date] {
        let startOfDay = calendar.startOfDay(for: start)
        let endOfDay = calendar.startOfDay(for: end)

        var days: [Date] = []
        var current = startOfDay
        while current <= endOfDay {
            days.append(current)
            guard let next = calendar.date(byAdding: .day, value: 1, to: current) else { break }
            current = next
        }
        return days
    }
}
