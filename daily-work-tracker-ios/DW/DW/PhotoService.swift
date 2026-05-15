import UIKit

/// Singleton service to handle local persistence of photos before they are synced to the backend.
public final class PhotoService {
    public static let shared = PhotoService()
    
    private init() {
        createDirectoryIfNeeded()
    }

    private var photosDirectory: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("WorkdayPhotos", isDirectory: true)
    }

    private func createDirectoryIfNeeded() {
        try? FileManager.default.createDirectory(at: photosDirectory, withIntermediateDirectories: true)
    }

    public func savePhoto(image: UIImage) -> String? {
        let id = UUID().uuidString
        let fileURL = photosDirectory.appendingPathComponent("\(id).jpg")
        
        // Compress image to manage storage and upload bandwidth
        guard let data = image.jpegData(compressionQuality: 0.7) else { return nil }
        
        do {
            try data.write(to: fileURL)
            return id
        } catch {
            return nil
        }
    }

    public func loadData(id: String) -> Data? {
        let fileURL = photosDirectory.appendingPathComponent("\(id).jpg")
        return try? Data(contentsOf: fileURL)
    }
}