import Foundation

public struct Employee: Identifiable, Codable, Hashable, Sendable {
    public var id: String
    public var displayName: String

    public init(id: String, displayName: String) {
        self.id = id
        self.displayName = displayName
    }
}

public enum JobStatus: String, Codable, CaseIterable, Sendable {
    case complete
    case returnRequired
}

public enum PrivateTimeCategory: String, Codable, CaseIterable, Sendable {
    case privateNonWork
    case workRelated
}

public enum WorkdayEventType: String, Codable, CaseIterable, Sendable {
    case workshop
    case travel
    case supplier
    case fuel
    case job
    case privateTime
}

public struct LatLng: Codable, Hashable, Sendable {
    public var lat: Double
    public var lng: Double

    public init(lat: Double, lng: Double) {
        self.lat = lat
        self.lng = lng
    }
}

public struct WorkshopSegment: Codable, Hashable, Sendable {
    public var start: Date
    public var end: Date
    public var startLocation: LatLng
    public var endLocation: LatLng

    public init(start: Date, end: Date, startLocation: LatLng, endLocation: LatLng) {
        self.start = start
        self.end = end
        self.startLocation = startLocation
        self.endLocation = endLocation
    }

    public var durationSeconds: TimeInterval { end.timeIntervalSince(start) }
}

public struct TravelSegment: Codable, Hashable, Sendable {
    public var startTime: Date
    public var endTime: Date

    public var startLocation: LatLng
    public var endLocation: LatLng

    public var startMileage: Double
    public var endMileage: Double

    public var vehicleId: String?

    public var distanceTraveledMeters: Double { max(0, (endMileage - startMileage) * 1000.0) }

    public var durationSeconds: TimeInterval { endTime.timeIntervalSince(startTime) }

    public init(
        startTime: Date,
        endTime: Date,
        startLocation: LatLng,
        endLocation: LatLng,
        startMileage: Double,
        endMileage: Double,
        vehicleId: String? = nil
    ) {
        self.startTime = startTime
        self.endTime = endTime
        self.startLocation = startLocation
        self.endLocation = endLocation
        self.startMileage = startMileage
        self.endMileage = endMileage
        self.vehicleId = vehicleId
    }
}

public struct SupplierSegment: Codable, Hashable, Sendable {
    public var arrivalTime: Date
    public var departureTime: Date

    public var arrivalLocation: LatLng
    public var departureLocation: LatLng

    public var supplierName: String
    public var amountSpent: Double?
    public var whatPurchased: String?
    public var jobId: String?

    public var startMileage: Double?
    public var endMileage: Double?
    public var photoReceiptIds: [String]

    public var distanceMeters: Double?

    public init(
        arrivalTime: Date,
        departureTime: Date,
        arrivalLocation: LatLng,
        departureLocation: LatLng,
        supplierName: String,
        amountSpent: Double,
        whatPurchased: String,
        jobId: String?,
        startMileage: Double?,
        endMileage: Double?,
        photoReceiptIds: [String] = []
    ) {
        self.arrivalTime = arrivalTime
        self.departureTime = departureTime
        self.arrivalLocation = arrivalLocation
        self.departureLocation = departureLocation
        self.supplierName = supplierName
        self.amountSpent = amountSpent
        self.whatPurchased = whatPurchased
        self.jobId = jobId
        self.startMileage = startMileage
        self.endMileage = endMileage
        self.photoReceiptIds = photoReceiptIds
        if let startMileage, let endMileage {
            self.distanceMeters = max(0, (endMileage - startMileage) * 1000.0)
        } else {
            self.distanceMeters = nil
        }
    }

    public var durationSeconds: TimeInterval { departureTime.timeIntervalSince(arrivalTime) }
    
    public var totalHours: Double { durationSeconds / 3600.0 }
}

public struct FuelSegment: Codable, Hashable, Sendable {
    public var arrivalTime: Date
    public var departureTime: Date

    public var arrivalLocation: LatLng
    public var departureLocation: LatLng

    public var startMileage: Double?
    public var endMileage: Double?
    public var distanceMeters: Double?

    public var litersFilled: Double
    public var totalCost: Double
    public var fuelStationName: String?

    public var photoReceiptIds: [String]

    public init(
        arrivalTime: Date,
        departureTime: Date,
        arrivalLocation: LatLng,
        departureLocation: LatLng,
        startMileage: Double?,
        endMileage: Double?,
        litersFilled: Double,
        totalCost: Double,
        fuelStationName: String?,
        photoReceiptIds: [String]
    ) {
        self.arrivalTime = arrivalTime
        self.departureTime = departureTime
        self.arrivalLocation = arrivalLocation
        self.departureLocation = departureLocation
        self.startMileage = startMileage
        self.endMileage = endMileage
        if let startMileage, let endMileage {
            self.distanceMeters = max(0, (endMileage - startMileage) * 1000.0)
        } else {
            self.distanceMeters = nil
        }
        self.litersFilled = litersFilled
        self.totalCost = totalCost
        self.fuelStationName = fuelStationName
        self.photoReceiptIds = photoReceiptIds
    }

    public var durationSeconds: TimeInterval { departureTime.timeIntervalSince(arrivalTime) }
}

public struct JobSegment: Codable, Hashable, Sendable {
    public var jobId: String
    public var clientName: String
    public var siteName: String?

    public var startTime: Date
    public var endTime: Date

    public var startLocation: LatLng
    public var endLocation: LatLng

    public var startMileage: Double?
    public var endMileage: Double?
    public var distanceMeters: Double?

    public var status: JobStatus

    public var photoBeforeIds: [String]
    public var photoAfterIds: [String]

    public init(
        jobId: String,
        clientName: String,
        siteName: String?,
        startTime: Date,
        endTime: Date,
        startLocation: LatLng,
        endLocation: LatLng,
        startMileage: Double?,
        endMileage: Double?,
        status: JobStatus,
        photoBeforeIds: [String],
        photoAfterIds: [String]
    ) {
        self.jobId = jobId
        self.clientName = clientName
        self.siteName = siteName
        self.startTime = startTime
        self.endTime = endTime
        self.startLocation = startLocation
        self.endLocation = endLocation
        self.startMileage = startMileage
        self.endMileage = endMileage
        if let startMileage, let endMileage {
            self.distanceMeters = max(0, (endMileage - startMileage) * 1000.0)
        } else {
            self.distanceMeters = nil
        }
        self.status = status
        self.photoBeforeIds = photoBeforeIds
        self.photoAfterIds = photoAfterIds
    }

    public var durationSeconds: TimeInterval { endTime.timeIntervalSince(startTime) }
}

public struct PrivateSegment: Codable, Hashable, Sendable {
    public var startTime: Date
    public var endTime: Date

    public var startLocation: LatLng
    public var endLocation: LatLng

    public var description: String
    public var category: PrivateTimeCategory
    public var workRelatedTask: String?
    public var notes: String?

    public init(
        startTime: Date,
        endTime: Date,
        startLocation: LatLng,
        endLocation: LatLng,
        description: String,
        category: PrivateTimeCategory,
        workRelatedTask: String?,
        notes: String?
    ) {
        self.startTime = startTime
        self.endTime = endTime
        self.startLocation = startLocation
        self.endLocation = endLocation
        self.description = description
        self.category = category
        self.workRelatedTask = workRelatedTask
        self.notes = notes
    }

    public var durationSeconds: TimeInterval { endTime.timeIntervalSince(startTime) }
}

public struct DailyWorkRecord: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var employeeId: String
    public var date: Date

    public var vehicleId: String?

    public var workshops: [WorkshopSegment]
    public var travels: [TravelSegment]
    public var suppliers: [SupplierSegment]
    public var fuels: [FuelSegment]
    public var jobs: [JobSegment]
    public var privateSegments: [PrivateSegment]

    public var endNotes: String?

    // Workday-level locations
    public var dayStartLocation: LatLng?
    public var dayEndLocation: LatLng?

    public var startMileage: Double?
    public var endMileage: Double?

    public var totalJobTime: Double { jobs.map { $0.durationSeconds }.reduce(0, +) / 3600.0 }
    public var totalWorkshopTime: Double { workshops.map { $0.durationSeconds }.reduce(0, +) / 3600.0 }
    public var totalPrivateTime: Double { privateSegments.map { $0.durationSeconds }.reduce(0, +) / 3600.0 }
    public var totalSupplierTime: Double { suppliers.map { $0.durationSeconds }.reduce(0, +) / 3600.0 }
    public var totalFuelStops: Int { fuels.count }

    // Aggregated Metrics for Reports
    public var totalHours: Double {
        let allSegments = workshops.map { $0.durationSeconds } 
            + travels.map { $0.durationSeconds }
            + suppliers.map { $0.durationSeconds }
            + fuels.map { $0.durationSeconds }
            + jobs.map { $0.durationSeconds }
        return allSegments.reduce(0, +) / 3600.0
    }

    public var totalDistanceKm: Double {
        let travelDist = travels.map { $0.distanceTraveledMeters }.reduce(0, +)
        return travelDist / 1000.0
    }

    public init(
        id: String,
        employeeId: String,
        date: Date,
        vehicleId: String? = nil,
        workshops: [WorkshopSegment] = [],
        travels: [TravelSegment] = [],
        suppliers: [SupplierSegment] = [],
        fuels: [FuelSegment] = [],
        jobs: [JobSegment] = [],
        privateSegments: [PrivateSegment] = [],
        endNotes: String? = nil,
        dayStartLocation: LatLng? = nil,
        dayEndLocation: LatLng? = nil,
        startMileage: Double? = nil,
        endMileage: Double? = nil
    ) {
        self.id = id
        self.employeeId = employeeId
        self.date = date
        self.vehicleId = vehicleId
        self.workshops = workshops
        self.travels = travels
        self.suppliers = suppliers
        self.fuels = fuels
        self.jobs = jobs
        self.privateSegments = privateSegments
        self.endNotes = endNotes
        self.dayStartLocation = dayStartLocation
        self.dayEndLocation = dayEndLocation
        self.startMileage = startMileage
        self.endMileage = endMileage
    }
}
