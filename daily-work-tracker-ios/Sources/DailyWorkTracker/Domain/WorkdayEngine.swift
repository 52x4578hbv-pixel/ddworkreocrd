import Foundation

public enum WorkdayPhase: Equatable, Codable, Sendable {
    case start // before first workshop
    case travel
    case workshop
    case supplier
    case fuel
    case job
    case privateTime
    case end
}

public enum WorkdayTimerError: Error, Equatable {
    case invalidTransition(from: WorkdayPhase, to: WorkdayPhase)
    case timerNotRunning
}

/// Pure Swift engine that enforces the workflow + builds a DailyWorkRecord.
public struct WorkdayEngine {
    public private(set) var phase: WorkdayPhase
    private var calendar: Calendar

    private let unknownLatLng = LatLng(lat: 0, lng: 0)

    // Current in-progress segments (arrival/start captured when timer starts)
    private var workshopStart: Date?
    private var workshopStartLocation: LatLng?

    private var travelStartTime: Date?
    private var travelStartMileage: Double?
    private var travelStartLocation: LatLng?

    private var supplierArrivalTime: Date?
    private var supplierArrivalLocation: LatLng?
    private var supplierName: String?
    private var supplierAmountSpent: Double?
    private var supplierWhatPurchased: String?
    private var supplierJobId: String?

    private var fuelArrivalTime: Date?
    private var fuelArrivalLocation: LatLng?

    private var jobStartTime: Date?
    private var jobStartLocation: LatLng?
    private var jobClientName: String?
    private var jobSiteName: String?
    private var jobId: String?
    private var jobPhotoBeforeIds: [String] = []

    private var privateStartTime: Date?
    private var privateStartLocation: LatLng?
    private var privateDescription: String?
    private var privateCategory: PrivateTimeCategory?
    private var privateWorkRelatedTask: String?

    // Record being built
    public private(set) var record: DailyWorkRecord

    public init(calendar: Calendar = Calendar.current, seedRecord: DailyWorkRecord) {
        self.calendar = calendar
        self.record = seedRecord
        self.phase = seedRecord.workshops.isEmpty ? .start : .workshop
    }

    // MARK: - Workshop

    public mutating func startWorkshop(at date: Date, location: LatLng? = nil) throws {
        guard phase == .start || phase == .travel || phase == .end || phase == .workshop else {
            if case .supplier = phase { throw WorkdayTimerError.invalidTransition(from: phase, to: .workshop) }
            throw WorkdayTimerError.invalidTransition(from: phase, to: .workshop)
        }
        workshopStart = date
        workshopStartLocation = location ?? unknownLatLng
        phase = .workshop
    }

    public mutating func stopWorkshop(at date: Date, location: LatLng? = nil) throws {
        guard let start = workshopStart, let startLocation = workshopStartLocation else {
            throw WorkdayTimerError.timerNotRunning
        }
        record.workshops.append(
            WorkshopSegment(
                start: start,
                end: date,
                startLocation: startLocation,
                endLocation: location ?? unknownLatLng
            )
        )
        workshopStart = nil
        workshopStartLocation = nil
        phase = .travel
    }

    // MARK: - Travel

    public mutating func startTravel(
        at date: Date,
        startingMileage: Double,
        location: LatLng? = nil,
        vehicleId: String? = nil
    ) throws {
        guard phase == .travel || phase == .workshop || phase == .start else {
            throw WorkdayTimerError.invalidTransition(from: phase, to: .travel)
        }
        travelStartTime = date
        travelStartMileage = startingMileage
        travelStartLocation = location ?? unknownLatLng
        if let vehicleId { record.vehicleId = vehicleId }
        phase = .travel
    }

    public mutating func stopTravel(
        at date: Date,
        endingMileage: Double,
        location: LatLng? = nil
    ) throws {
        guard let startTime = travelStartTime,
              let startMileage = travelStartMileage,
              let startLocation = travelStartLocation else {
            throw WorkdayTimerError.timerNotRunning
        }
        record.travels.append(
            TravelSegment(
                startTime: startTime,
                endTime: date,
                startLocation: startLocation,
                endLocation: location ?? unknownLatLng,
                startMileage: startMileage,
                endMileage: endingMileage,
                vehicleId: record.vehicleId
            )
        )
        travelStartTime = nil
        travelStartMileage = nil
        travelStartLocation = nil
        phase = .travel
    }

    // MARK: - Supplier

    public mutating func startSupplier(arrivalTime: Date, arrivalLocation: LatLng? = nil, startMileage: Double? = nil) throws {
        guard phase == .travel || phase == .supplier else {
            throw WorkdayTimerError.invalidTransition(from: phase, to: .supplier)
        }
        supplierArrivalTime = arrivalTime
        supplierArrivalLocation = arrivalLocation ?? unknownLatLng
        self.travelStartMileage = startMileage // Re-using internal storage for start tracking
        supplierName = nil
        supplierAmountSpent = nil
        supplierWhatPurchased = nil
        supplierJobId = nil
        phase = .supplier
    }

    public mutating func stopSupplier(
        endTime: Date,
        departureLocation: LatLng? = nil,
        supplierName: String,
        amountSpent: Double,
        whatPurchased: String,
        jobId: String?,
        startMileage: Double? = nil,
        endMileage: Double? = nil,
        photoReceiptIds: [String] = []
    ) throws {
        guard let arrival = supplierArrivalTime,
              let arrivalLocation = supplierArrivalLocation else {
            throw WorkdayTimerError.timerNotRunning
        }

        supplierArrivalTime = nil
        supplierArrivalLocation = nil
        self.supplierName = supplierName
        self.supplierAmountSpent = amountSpent
        self.supplierWhatPurchased = whatPurchased
        self.supplierJobId = jobId

        record.suppliers.append(
            SupplierSegment(
                arrivalTime: arrival,
                departureTime: endTime,
                arrivalLocation: arrivalLocation,
                departureLocation: departureLocation ?? unknownLatLng,
                supplierName: supplierName,
                amountSpent: amountSpent,
                whatPurchased: whatPurchased,
                jobId: jobId,
                startMileage: startMileage,
                endMileage: endMileage,
                photoReceiptIds: photoReceiptIds
            )
        )

        phase = .travel
    }

    // MARK: - Fuel

    public mutating func startFuel(arrivalTime: Date, arrivalLocation: LatLng? = nil, startMileage: Double? = nil) throws {
        guard phase == .travel || phase == .fuel else {
            throw WorkdayTimerError.invalidTransition(from: phase, to: .fuel)
        }
        fuelArrivalTime = arrivalTime
        fuelArrivalLocation = arrivalLocation ?? unknownLatLng
        self.travelStartMileage = startMileage
        phase = .fuel
    }

    public mutating func stopFuel(
        endTime: Date,
        departureLocation: LatLng? = nil,
        litersFilled: Double,
        totalCost: Double,
        fuelStationName: String?,
        startMileage: Double? = nil,
        endMileage: Double? = nil,
        photoReceiptIds: [String] = []
    ) throws {
        guard let arrival = fuelArrivalTime,
              let arrivalLocation = fuelArrivalLocation else {
            throw WorkdayTimerError.timerNotRunning
        }
        fuelArrivalTime = nil
        fuelArrivalLocation = nil

        record.fuels.append(
            FuelSegment(
                arrivalTime: arrival,
                departureTime: endTime,
                arrivalLocation: arrivalLocation,
                departureLocation: departureLocation ?? unknownLatLng,
                startMileage: startMileage,
                endMileage: endMileage,
                litersFilled: litersFilled,
                totalCost: totalCost,
                fuelStationName: fuelStationName,
                photoReceiptIds: photoReceiptIds
            )
        )

        phase = .travel
    }

    // MARK: - Job

    public mutating func startJob(
        startTime: Date,
        jobId: String,
        clientName: String,
        siteName: String,
        location: LatLng? = nil,
        startMileage: Double,
        photoBeforeIds: [String] = []
    ) throws {
        guard phase == .travel || phase == .job else {
            throw WorkdayTimerError.invalidTransition(from: phase, to: .job)
        }
        self.jobStartTime = startTime
        self.jobStartLocation = location ?? unknownLatLng
        self.travelStartMileage = startMileage
        self.jobId = jobId
        self.jobClientName = clientName
        self.jobSiteName = siteName
        self.jobPhotoBeforeIds = photoBeforeIds
        phase = .job
    }

    public mutating func stopJob(
        endTime: Date,
        endLocation: LatLng? = nil,
        status: JobStatus,
        startMileage: Double? = nil,
        endMileage: Double? = nil,
        photoAfterIds: [String] = []
    ) throws {
        guard let startTime = jobStartTime,
              let startLocation = jobStartLocation,
              let storedJobId = self.jobId,
              let clientName = jobClientName,
              let siteName = jobSiteName else {
            throw WorkdayTimerError.timerNotRunning
        }

        record.jobs.append(
            JobSegment(
                jobId: storedJobId,
                clientName: clientName,
                siteName: siteName,
                startTime: startTime,
                endTime: endTime,
                startLocation: startLocation,
                endLocation: endLocation ?? unknownLatLng,
                startMileage: startMileage,
                endMileage: endMileage,
                status: status,
                photoBeforeIds: jobPhotoBeforeIds,
                photoAfterIds: photoAfterIds
            )
        )

        jobStartTime = nil
        jobStartLocation = nil
        self.jobId = nil
        jobClientName = nil
        jobSiteName = nil
        jobPhotoBeforeIds = []
        phase = .travel
    }

    // MARK: - Private

    public mutating func startPrivate(
        startTime: Date,
        description: String,
        category: PrivateTimeCategory,
        workRelatedTask: String?,
        location: LatLng? = nil
    ) throws {
        guard phase == .travel || phase == .privateTime else {
            throw WorkdayTimerError.invalidTransition(from: phase, to: .privateTime)
        }
        privateStartTime = startTime
        privateStartLocation = location ?? unknownLatLng
        privateDescription = description
        privateCategory = category
        privateWorkRelatedTask = workRelatedTask
        phase = .privateTime
    }

    public mutating func stopPrivate(
        endTime: Date,
        endLocation: LatLng? = nil,
        notes: String?
    ) throws {
        guard let startTime = privateStartTime,
              let startLocation = privateStartLocation,
              let description = privateDescription,
              let category = privateCategory else {
            throw WorkdayTimerError.timerNotRunning
        }
        record.privateSegments.append(
            PrivateSegment(
                startTime: startTime,
                endTime: endTime,
                startLocation: startLocation,
                endLocation: endLocation ?? unknownLatLng,
                description: description,
                category: category,
                workRelatedTask: privateWorkRelatedTask,
                notes: notes
            )
        )
        privateStartTime = nil
        privateStartLocation = nil
        privateDescription = nil
        privateCategory = nil
        privateWorkRelatedTask = nil
        phase = .travel
    }

    // MARK: - End Day

    public mutating func endDay(at date: Date, endNotes: String?, endLocation: LatLng? = nil, endMileage: Double? = nil) throws {
        if workshopStart != nil || travelStartTime != nil || supplierArrivalTime != nil || fuelArrivalTime != nil || jobStartTime != nil || privateStartTime != nil {
            throw WorkdayTimerError.invalidTransition(from: phase, to: .end)
        }
        record.endNotes = endNotes
        record.dayEndLocation = endLocation ?? unknownLatLng
        record.endMileage = endMileage
        phase = .end
    }
}
