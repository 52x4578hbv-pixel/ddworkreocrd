import Foundation

public enum FirebaseAuthRestError: LocalizedError {
    case missingApiKey
    case invalidCredentials(String)
    case requestFailed(String)
    case decodingFailed

    public var errorDescription: String? {
        switch self {
        case .missingApiKey:
            return "Missing Firebase Web API key."
        case .invalidCredentials(let msg):
            return "Invalid credentials: \(msg)"
        case .requestFailed(let msg):
            return "Request failed: \(msg)"
        case .decodingFailed:
            return "Failed to decode Firebase response."
        }
    }
}

public struct FirebaseAuthRestSignInResponse: Codable {
    public let idToken: String
    public let refreshToken: String?
    public let expiresIn: String?
    public let localId: String?

    public init(idToken: String, refreshToken: String?, expiresIn: String?, localId: String?) {
        self.idToken = idToken
        self.refreshToken = refreshToken
        self.expiresIn = expiresIn
        self.localId = localId
    }
}

public final class FirebaseAuthRest {
    /// Firebase Auth REST API endpoint for email/password sign-in.
    /// https://firebase.google.com/docs/reference/rest/auth#section-sign-in-email-password
    private static func signInWithPasswordURL(apiKey: String) -> URL? {
        return URL(string: "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=\(apiKey)")
    }

    public init() {}

    public func signInWithEmailPassword(
        apiKey: String,
        email: String,
        password: String
    ) async throws -> FirebaseAuthRestSignInResponse {
        guard !apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw FirebaseAuthRestError.missingApiKey
        }

        guard let url = Self.signInWithPasswordURL(apiKey: apiKey) else {
            throw FirebaseAuthRestError.requestFailed("Invalid Firebase API key URL.")
        }

        struct Payload: Encodable {
            let email: String
            let password: String
            let returnSecureToken: Bool
        }

        let payload = Payload(email: email, password: password, returnSecureToken: true)
        let bodyData = try JSONEncoder().encode(payload)

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = bodyData

        let (data, response) = try await URLSession.shared.data(for: request)

        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            let message = Self.extractFirebaseErrorMessage(from: data)
            if http.statusCode == 400 || http.statusCode == 401 {
                throw FirebaseAuthRestError.invalidCredentials(message)
            }
            throw FirebaseAuthRestError.requestFailed("HTTP \(http.statusCode): \(message)")
        }

        do {
            return try JSONDecoder().decode(FirebaseAuthRestSignInResponse.self, from: data)
        } catch {
            throw FirebaseAuthRestError.decodingFailed
        }
    }

    private static func extractFirebaseErrorMessage(from data: Data) -> String {
        // Firebase errors come back like:
        // { "error": { "message": "INVALID_LOGIN_CREDENTIALS", ... } }
        struct ErrorEnvelope: Decodable {
            struct ErrorBody: Decodable {
                let message: String?
            }
            let error: ErrorBody?
        }

        if let decoded = try? JSONDecoder().decode(ErrorEnvelope.self, from: data) {
            return decoded.error?.message ?? "Unknown Firebase error."
        }

        return String(data: data, encoding: .utf8) ?? "Unknown Firebase error."
    }
}
