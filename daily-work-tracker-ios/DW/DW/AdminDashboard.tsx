import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Card, DatePicker } from '../components/UI';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';

export const AdminDashboard = () => {
    const [employees, setEmployees] = useState([]);
    const [reports, setReports] = useState([]);
    const [newEmpCode, setNewEmpCode] = useState('');
    const [newEmpName, setNewEmpName] = useState('');
    const [liveEmployeeLocations, setLiveEmployeeLocations] = useState([]); // New state for live locations
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [apiError, setApiError] = useState(null);

    const fetchReports = async (dates: [string, string]) => {
        try {
            setApiError(null);
            const res = await fetch(`/api/v1/admin/reports?startDate=${dates[0]}&endDate=${dates[1]}`);
            if (!res.ok) throw new Error(`Failed to fetch reports: ${res.statusText}`);
            const data = await res.json();
            setReports(data);
        } catch (error: any) {
            setApiError(error.message);
        }
    };

    const handleAddEmployee = async () => {
        await fetch('/api/v1/admin/employees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeCode: newEmpCode, displayName: newEmpName })
        });
        alert('Employee Code Assigned');
    };

    // New useEffect for live locations polling
    useEffect(() => {
        const fetchLiveLocations = async () => {
            try {
                const res = await fetch('/api/v1/admin/live-locations', {
                    headers: {
                        // In a production app, this token would be securely managed (e.g., from an admin login session)
                        'Authorization': `Bearer ${process.env.ADMIN_TOKEN || 'admin-secret-123'}` 
                    }
                });
                if (res.ok) {
                    const data = await res.json();
                    setLiveEmployeeLocations(data);
                } else {
                    console.error('Failed to fetch live locations:', res.statusText);
                }
            } catch (error) {
                console.error('Error fetching live locations:', error);
            }
        };

        fetchLiveLocations(); // Fetch immediately on mount
        const interval = setInterval(fetchLiveLocations, 30000); // Poll every 30 seconds
        return () => clearInterval(interval); // Cleanup on unmount
    }, []); // Empty dependency array means this runs once on mount and cleans up on unmount

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            <h1 className="text-3xl font-bold mb-8">Work Tracker Admin</h1>
            
            {apiError && (
                <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-700">
                    <p className="font-bold">Error</p>
                    <p>{apiError}</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <Card title="Assign Employee Code">
                    <div className="space-y-4">
                        <Input placeholder="Employee Code (e.g. EMP001)" value={newEmpCode} onChange={e => setNewEmpCode(e.target.value)} />
                        <Input placeholder="Full Name" value={newEmpName} onChange={e => setNewEmpName(e.target.value)} />
                        <Button onClick={handleAddEmployee} className="w-full">Assign Code</Button>
                    </div>
                </Card>

                <Card title="Report Filters">
                    <div className="space-y-4">
                        <DatePicker.RangePicker onChange={(dates) => fetchReports(dates)} />
                        <Button variant="secondary" onClick={() => window.print()}>Export to PDF</Button>
                    </div>
                </Card>
            </div>

            {/* New Card for Live Employee Locations Map */}
            <Card title="Live Employee Locations" className="mb-8">
                <div style={{ height: '500px', width: '100%' }}>
                    {liveEmployeeLocations.length > 0 ? (
                        <MapContainer
                            // Center the map on the first employee's location, or a default if none
                            center={[
                                liveEmployeeLocations[0].location.lat,
                                liveEmployeeLocations[0].location.lng
                            ]}
                            zoom={10}
                            style={{ height: '100%' }}
                        >
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            {liveEmployeeLocations.map((employee: any) => (
                                <Marker
                                    key={employee.employeeCode}
                                    position={[employee.location.lat, employee.location.lng]}
                                >
                                    <Popup>
                                        <strong>{employee.employeeCode}</strong>
                                        <br />
                                        Last known location
                                    </Popup>
                                </Marker>
                            ))}
                        </MapContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            No active employee locations to display.
                        </div>
                    )}
                </div>
            </Card>

            {selectedRecord && (
                <Card title={`Route Detail: ${selectedRecord.employee_code} - ${selectedRecord.work_date}`} className="mb-8">
                    <div style={{ height: '400px', width: '100%' }}>
                        <MapContainer center={[selectedRecord.raw_data.dayStartLocation?.lat || 0, selectedRecord.raw_data.dayStartLocation?.lng || 0]} zoom={13} style={{ height: '100%' }}>
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            {[
                                ...(selectedRecord.raw_data.workshops || []),
                                ...(selectedRecord.raw_data.travels || []),
                                ...(selectedRecord.raw_data.jobs || []),
                                ...(selectedRecord.raw_data.suppliers || []),
                                ...(selectedRecord.raw_data.fuels || []),
                            ].map((segment: any, idx: number) => (
                                <React.Fragment key={idx}>
                                    {segment.startLocation && (
                                        <Marker position={[segment.startLocation.lat, segment.startLocation.lng]}>
                                            <Popup>Segment Start</Popup>
                                        </Marker>
                                    )}
                                    {segment.endLocation && (
                                        <Marker position={[segment.endLocation.lat, segment.endLocation.lng]}>
                                            <Popup>Segment End</Popup>
                                        </Marker>
                                    )}
                                    <Polyline 
                                        positions={[
                                            [segment.startLocation?.lat || segment.arrivalLocation?.lat, segment.startLocation?.lng || segment.arrivalLocation?.lng],
                                            [segment.endLocation?.lat || segment.departureLocation?.lat, segment.endLocation?.lng || segment.departureLocation?.lng]
                                        ].filter(p => p[0] !== undefined)} 
                                        color={idx % 2 === 0 ? 'blue' : 'red'} 
                                    />
                                </React.Fragment>
                            ))}
                        </MapContainer>
                    </div>
                </Card>
            )}

            <Card title="Workday Summaries">
                <Table 
                    data={reports} 
                    columns={[
                        { title: 'Date', dataIndex: 'work_date' },
                        { title: 'Employee', dataIndex: 'employee_code' },
                        { title: 'Total Hours', dataIndex: 'total_hours' },
                        { title: 'Distance (km)', dataIndex: 'total_distance_km' },
                        { title: 'Status', render: (row) => row.end_mileage ? 'Completed' : 'In Progress' },
                        { 
                            title: 'Actions', 
                            render: (row) => (
                                <Button variant="ghost" onClick={() => setSelectedRecord(row)}>View Map</Button>
                            )
                        }
                    ]}
                />
            </Card>
        </div>
    );
};