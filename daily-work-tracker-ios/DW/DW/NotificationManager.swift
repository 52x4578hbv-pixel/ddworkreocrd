import UserNotifications
import DailyWorkTracker

public final class NotificationManager {
    public static let shared = NotificationManager()
    
    private init() {}

    public func requestAuthorization() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            if granted {
                print("Notification permissions granted.")
            } else {
                print("Notification permissions denied. Reminders will not be shown.")
            }
        }
    }

    public func scheduleReminder(for phase: WorkdayPhase) {
        cancelReminders() // Clear previous ones
        
        guard phase != .start && phase != .end else { return }

        let content = UNMutableNotificationContent()
        content.title = "Active Timer: \(phase)"
        content.body = "You still have an active session running. Don't forget to stop or transition when finished."
        content.sound = .default

        // Remind every 2 hours (7200 seconds)
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 7200, repeats: true)
        let request = UNNotificationRequest(identifier: "workday_active_reminder", content: content, trigger: trigger)

        UNUserNotificationCenter.current().add(request)
    }

    public func cancelReminders() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["workday_active_reminder"])
    }
}