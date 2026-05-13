import Foundation

public typealias DocumentId = String

public enum FirestoreDateKeyFormat {
    // YYYY-MM-DD in employee local time
    // (conversion handled by app layer; we store as a string key)
    public static func makeDateKey(localDate: Date, calendar: Calendar) -> String {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: localDate)
    }
}

public struct WorkdayDocumentId: Hashable, Codable {
    public var employeeId: String
    public var dateKey: String // yyyy-MM-dd (employee local)

    public init(employeeId: String, dateKey: String) {
        self.employeeId = employeeId
        self.dateKey = dateKey
    }

    public var rawValue: String { "\(employeeId)_\(dateKey)" }
}
