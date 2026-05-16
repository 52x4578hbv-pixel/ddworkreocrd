import SwiftUI
import Foundation

@available(macOS 10.15, iOS 13.0, *)
public struct LoginScreen: View {
    public typealias OnSignedIn = () -> Void
    private let onSignedIn: OnSignedIn

    private enum LS {
        static let idToken = "ddworkrecord_id_token"
        static let businessCode = "ddworkrecord_business_code"
        static let employeeId = "ddworkrecord_employee_id"
        static let vehicleId = "ddworkrecord_vehicle_id"
        static let assistant1Id = "ddworkrecord_assistant_1_id"
        static let assistant2Id = "ddworkrecord_assistant_2_id"
        static let assistant3Id = "ddworkrecord_assistant_3_id"
    }

    @State private var businessCode: String = UserDefaults.standard.string(forKey: LS.businessCode) ?? ""
    @State private var employeeId: String = UserDefaults.standard.string(forKey: LS.employeeId) ?? ""
    @State private var workerSecret: String = UserDefaults.standard.string(forKey: LS.idToken) ?? ""

    @State private var vehicleId: String = UserDefaults.standard.string(forKey: LS.vehicleId) ?? ""
    @State private var assistant1Id: String = UserDefaults.standard.string(forKey: LS.assistant1Id) ?? ""
    @State private var assistant2Id: String = UserDefaults.standard.string(forKey: LS.assistant2Id) ?? ""
    @State private var assistant3Id: String = UserDefaults.standard.string(forKey: LS.assistant3Id) ?? ""

    @State private var errorMessage: String?
    @State private var isSigningIn: Bool = false

    public init(onSignedIn: @escaping OnSignedIn) {
        self.onSignedIn = onSignedIn
    }

    public var body: some View {
        VStack(spacing: 16) {
            Text("Sign in")
                .font(.system(size: 28, weight: .bold))

            VStack(alignment: .leading, spacing: 10) {
                Text("Business access code")
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                TextField("ACCESS CODE (tenant code)", text: $businessCode)
                    .autocorrectionDisabled()
            }

            VStack(alignment: .leading, spacing: 10) {
                Text("Employee ID")
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                TextField("EMP-001", text: $employeeId)
                    .autocorrectionDisabled()
            }

            VStack(alignment: .leading, spacing: 10) {
                Text("Worker secret")
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                SecureField("Worker secret", text: $workerSecret)
            }

            VStack(alignment: .leading, spacing: 10) {
                Text("Vehicle ID (optional)")
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                TextField("VEH-01", text: $vehicleId)
                    .autocorrectionDisabled()
            }

            VStack(alignment: .leading, spacing: 10) {
                Text("Assistant IDs (optional)")
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                TextField("Assistant 1 (AS-01)", text: $assistant1Id)
                    .autocorrectionDisabled()
                TextField("Assistant 2 (AS-02)", text: $assistant2Id)
                    .autocorrectionDisabled()
                TextField("Assistant 3 (AS-03)", text: $assistant3Id)
                    .autocorrectionDisabled()
            }

            if let errorMessage {
                Text(errorMessage)
                    .foregroundColor(.red)
                    .font(.footnote)
                    .multilineTextAlignment(.leading)
            }

            Button {
                Task {
                    errorMessage = nil
                    isSigningIn = true
                    defer { isSigningIn = false }

                    let b = businessCode.trimmingCharacters(in: .whitespacesAndNewlines)
                    let e = employeeId.trimmingCharacters(in: .whitespacesAndNewlines)
                    let s = workerSecret.trimmingCharacters(in: .whitespacesAndNewlines)

                    if b.isEmpty {
                        errorMessage = "Business access code is required."
                        return
                    }
                    if e.isEmpty {
                        errorMessage = "Employee ID is required."
                        return
                    }
                    if s.isEmpty {
                        errorMessage = "Worker secret is required."
                        return
                    }

                    // MVP wiring:
                    // - store workerSecret as bearer token in ddworkrecord_id_token
                    // - keep employeeId/vehicleId/assistant ids for UI + tagging
                    UserDefaults.standard.set(b, forKey: LS.businessCode)
                    UserDefaults.standard.set(s, forKey: LS.idToken)
                    UserDefaults.standard.set(e, forKey: LS.employeeId)

                    UserDefaults.standard.set(vehicleId, forKey: LS.vehicleId)
                    UserDefaults.standard.set(assistant1Id, forKey: LS.assistant1Id)
                    UserDefaults.standard.set(assistant2Id, forKey: LS.assistant2Id)
                    UserDefaults.standard.set(assistant3Id, forKey: LS.assistant3Id)

                    onSignedIn()
                }
            } label: {
                Text(isSigningIn ? "Signing in..." : "Sign in")
                    .frame(maxWidth: .infinity)
            }
            .disabled(isSigningIn)
            .padding(.top, 8)

            Spacer()
        }
        .padding(24)
    }
}
