import Foundation

public protocol WorkdayRepository: Sendable {
    /// Saves or updates a workday record to local storage.
    func upsertDailyRecord(_ record: DailyWorkRecord) async throws
    
    /// Retrieves a specific record by its unique ID.
    func fetchDailyRecord(id: String) async throws -> DailyWorkRecord?

    /// Fetches all records within a date range for a specific employee.
    func fetchDailyRecords(employeeId: String, from: Date, to: Date, calendar: Calendar) async throws -> [DailyWorkRecord]

    /// Admin: Retrieves a record by date key.
    func fetchDailyRecordForAdmin(employeeId: String, dateKey: String) async throws -> DailyWorkRecord

    /// Admin: Retrieves summaries across employees.
    func fetchSummaryForAdmin(employeeId: String?, from: Date, to: Date, calendar: Calendar) async throws -> [DailyWorkRecord]
}

public protocol WorkdayLocalStore: Sendable {
    func fetchDailyRecords(employeeId: String, from: Date, to: Date, calendar: Calendar) async throws -> [DailyWorkRecord]
    func upsertDailyRecord(_ record: DailyWorkRecord, calendar: Calendar) async throws
}