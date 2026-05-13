import SwiftUI
import Foundation

@available(macOS 10.15, iOS 13.0, *)
public struct LoginScreen: View {
    public typealias OnSignedIn = () -> Void

    private let onSignedIn: OnSignedIn

    @State private var apiKey: String = ""
    @State private var email: String = ""
    @State private var password: String = ""

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
                Text("Firebase Web API Key")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                TextField("apiKey", text: $apiKey)
                    .autocorrectionDisabled()
                    .textFieldStyle(.roundedBorder)
            }

            VStack(alignment: .leading, spacing: 10) {
                Text("Email")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                TextField("you@company.com", text: $email)
                    .autocorrectionDisabled()
                    .textFieldStyle(.roundedBorder)
            }

            VStack(alignment: .leading, spacing: 10) {
                Text("Password")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                SecureField("Password", text: $password)
                    .textFieldStyle(.roundedBorder)
            }

            if let errorMessage {
                Text(errorMessage)
                    .foregroundStyle(.red)
                    .font(.footnote)
                    .multilineTextAlignment(.leading)
            }

            Button {
                Task {
                    errorMessage = nil
                    isSigningIn = true
                    defer { isSigningIn = false }

                    do {
                        let rest = FirebaseAuthRest()
                        let resp = try await rest.signInWithEmailPassword(
                            apiKey: apiKey,
                            email: email,
                            password: password
                        )

                        UserDefaults.standard.set(resp.idToken, forKey: "ddworkrecord_id_token")

                        // SyncCoordinator reads id token from UserDefaults in this app.
                        SyncCoordinator.bearerTokenProvider = {
                            UserDefaults.standard.string(forKey: "ddworkrecord_id_token")
                        }

                        onSignedIn()
                    } catch {
                        let msg = error.localizedDescription
                        errorMessage = msg.isEmpty ? "Sign-in failed." : msg
                    }
                }
            } label: {
                Text(isSigningIn ? "Signing in..." : "Sign in")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(isSigningIn)
            .padding(.top, 8)

            Spacer()
        }
        .padding(24)
        .navigationTitle("Authentication")
    }
}
