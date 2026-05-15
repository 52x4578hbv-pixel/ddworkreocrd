import Foundation
import CoreLocation
import DailyWorkTracker
import SwiftUI
import Combine

public final class LocationService: NSObject, CLLocationManagerDelegate, ObservableObject {
    public enum LocationError: Error, Equatable {
        case notAuthorized
        case requestFailed
        case timeout
        case disabled
    }

    private let manager: CLLocationManager
    private var continuation: CheckedContinuation<LatLng, Error>?
    private var timeoutTask: Task<Void, Never>?

    private var authorizationContinuation: CheckedContinuation<Bool, Never>?
    private var authorizationTimeoutTask: Task<Void, Never>?
    private var authorizationRequestID: UInt64 = 0

    @Published private(set) var lastCoordinate: LatLng?

    public override init() {
        self.manager = CLLocationManager()
        super.init()
        self.manager.delegate = self
        self.manager.desiredAccuracy = kCLLocationAccuracyBest
    }

    private func isAuthorized(_ status: CLAuthorizationStatus) -> Bool {
        switch status {
        case .authorizedAlways, .authorizedWhenInUse:
            return true
        default:
            return false
        }
    }

    private func currentAuthorizationStatus() -> CLAuthorizationStatus {
        manager.authorizationStatus
    }

    // Public: request/await authorization if needed.
    public func requestAuthorizationIfNeeded(timeoutSeconds: TimeInterval = 10) async -> Bool {
        let status = currentAuthorizationStatus()
        if isAuthorized(status) { return true }

        guard status == .notDetermined else {
            return false
        }

        authorizationRequestID &+= 1
        let requestID = authorizationRequestID

        return await withCheckedContinuation { (cont: CheckedContinuation<Bool, Never>) in
            // Cancel any in-flight wait (resume old one) to avoid leaked continuations.
            if let existing = self.authorizationContinuation {
                existing.resume(returning: false)
            }
            authorizationContinuation = cont

            // Timeout: resume the captured continuation for *this* request.
            authorizationTimeoutTask?.cancel()
            authorizationTimeoutTask = Task { [timeoutSeconds, requestID] in
                try? await Task.sleep(for: .seconds(timeoutSeconds))

                // Only resume if this is still the active request.
                guard requestID == self.authorizationRequestID else { return }

                // Ensure the timeout doesn't resume after success.
                guard self.authorizationContinuation != nil else { return }

                self.authorizationContinuation?.resume(returning: false)
                self.authorizationContinuation = nil
            }

            #if os(iOS)
            Task { @MainActor in
                self.manager.requestWhenInUseAuthorization()
            }
            #else
            Task { @MainActor in
                self.manager.requestAlwaysAuthorization()
            }
            #endif
        }
    }

    // Public: one-shot fix; will request authorization if needed.
    public func requestOneShotFix(timeoutSeconds: TimeInterval = 12) async throws -> LatLng {
        guard CLLocationManager.locationServicesEnabled() else {
            throw LocationError.disabled
        }

        guard await requestAuthorizationIfNeeded() else {
            throw LocationError.notAuthorized
        }

        return try await requestOneShotFixAssumingAuthorized(timeoutSeconds: timeoutSeconds)
    }

    // Public: only call this after authorization is already known to be granted.
    public func requestOneShotFixAssumingAuthorized(timeoutSeconds: TimeInterval = 12) async throws -> LatLng {
        guard CLLocationManager.locationServicesEnabled() else {
            throw LocationError.disabled
        }

        guard isAuthorized(currentAuthorizationStatus()) else {
            throw LocationError.notAuthorized
        }

        return try await withCheckedThrowingContinuation { (cont: CheckedContinuation<LatLng, Error>) in
            self.continuation = cont

            // CLLocationManager must be driven on the main actor.
            Task { @MainActor in
                self.manager.requestLocation()
            }

            timeoutTask = Task { [timeoutSeconds] in
                try? await Task.sleep(for: .seconds(timeoutSeconds))
                if let continuation = self.continuation {
                    continuation.resume(throwing: LocationError.timeout)
                    self.continuation = nil
                }
            }
        }
    }

    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        guard let authorizationContinuation else { return }
        let status = currentAuthorizationStatus()
        authorizationContinuation.resume(returning: isAuthorized(status))
        self.authorizationContinuation = nil
        authorizationTimeoutTask?.cancel()
        authorizationTimeoutTask = nil
        // Ensure timeout tasks from older requests won't resume again.
        authorizationRequestID &+= 1
    }

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let latest = locations.last else { return }

        timeoutTask?.cancel()
        timeoutTask = nil

        let coord = LatLng(lat: latest.coordinate.latitude, lng: latest.coordinate.longitude)
        Task { @MainActor in
            self.lastCoordinate = coord
        }

        continuation?.resume(returning: coord)
        continuation = nil
    }

    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        timeoutTask?.cancel()
        timeoutTask = nil
        continuation?.resume(throwing: LocationError.requestFailed)
        continuation = nil
    }
}
