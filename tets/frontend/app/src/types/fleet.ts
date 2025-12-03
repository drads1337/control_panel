// Fleet Management Types

export type VehicleStatus = 'available' | 'in_route' | 'maintenance' | 'out_of_service';
export type VehicleType = 'truck' | 'trailer' | 'car' | 'van';

export interface Vehicle {
  id: number;
  vin: string;
  license_plate: string;
  make: string;
  model: string;
  year: number;
  type: VehicleType;
  status: VehicleStatus;
  current_location?: {
    lat: number;
    lng: number;
  };
  registration_expiry?: string;
  insurance_expiry?: string;
  mileage: number;
  created_at: string;
  updated_at: string;
}

export interface VehicleCreate {
  vin: string;
  license_plate: string;
  make: string;
  model: string;
  year: number;
  type: VehicleType;
  registration_expiry?: string;
  insurance_expiry?: string;
  mileage?: number;
}

export type DriverStatus = 'available' | 'in_route' | 'off_duty' | 'on_break' | 'sick_leave';
export type HOSStatus = 'on_duty' | 'driving' | 'off_duty' | 'sleeper_berth';

export interface Driver {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  cdl_number: string;
  cdl_expiry?: string;
  medical_expiry?: string;
  status: DriverStatus;
  hos_status?: HOSStatus;
  available_hours?: number;
  rating?: number;
  total_trips?: number;
  total_miles?: number;
  created_at: string;
  updated_at: string;
}

export interface DriverCreate {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  cdl_number: string;
  cdl_expiry?: string;
  medical_expiry?: string;
}

export type TripStatus = 'pending' | 'assigned' | 'dispatched' | 'in_transit' | 'delivered' | 'cancelled' | 'on_hold';
export type LoadType = 'general_freight' | 'refrigerated' | 'hazmat' | 'flatbed' | 'dry_van' | 'other';

export interface Trip {
  id: number;
  trip_number: string;
  load_type: LoadType;
  pickup_location: {
    address: string;
    city: string;
    state: string;
    zip: string;
    lat?: number;
    lng?: number;
  };
  delivery_location: {
    address: string;
    city: string;
    state: string;
    zip: string;
    lat?: number;
    lng?: number;
  };
  pickup_date: string;
  delivery_date: string;
  status: TripStatus;
  driver_id?: number;
  driver?: Driver;
  vehicle_id?: number;
  vehicle?: Vehicle;
  customer_name?: string;
  revenue?: number;
  distance?: number;
  weight?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface TripCreate {
  load_type: LoadType;
  pickup_location: {
    address: string;
    city: string;
    state: string;
    zip: string;
  };
  delivery_location: {
    address: string;
    city: string;
    state: string;
    zip: string;
  };
  pickup_date: string;
  delivery_date: string;
  customer_name?: string;
  revenue?: number;
  distance?: number;
  weight?: number;
  notes?: string;
}

export interface Dispatch {
  id: number;
  trip_id: number;
  trip: Trip;
  driver_id: number;
  driver: Driver;
  vehicle_id: number;
  vehicle: Vehicle;
  dispatched_at: string;
  dispatcher_id?: number;
  notes?: string;
  created_at: string;
}

export interface DispatchCreate {
  trip_id: number;
  driver_id: number;
  vehicle_id: number;
  notes?: string;
}

export type ExpenseCategory = 'fuel' | 'maintenance' | 'driver_salary' | 'insurance' | 'tolls' | 'permits' | 'other';
export type RevenueCategory = 'load_payment' | 'fuel_surcharge' | 'accessorial' | 'other';

export interface FinancialTransaction {
  id: number;
  type: 'revenue' | 'expense';
  category: ExpenseCategory | RevenueCategory;
  amount: number;
  description: string;
  trip_id?: number;
  trip?: Trip;
  vehicle_id?: number;
  vehicle?: Vehicle;
  driver_id?: number;
  driver?: Driver;
  transaction_date: string;
  created_at: string;
}

export interface FinancialTransactionCreate {
  type: 'revenue' | 'expense';
  category: ExpenseCategory | RevenueCategory;
  amount: number;
  description: string;
  trip_id?: number;
  vehicle_id?: number;
  driver_id?: number;
  transaction_date: string;
}

export interface DashboardStats {
  active_trips: number;
  drivers_in_route: number;
  available_vehicles: number;
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
  fleet_utilization: number;
  average_mpg: number;
}

export interface HOSRecord {
  id: number;
  driver_id: number;
  driver: Driver;
  status: HOSStatus;
  start_time: string;
  end_time?: string;
  location?: {
    lat: number;
    lng: number;
  };
  violations?: string[];
  created_at: string;
}

export interface MaintenanceRecord {
  id: number;
  vehicle_id: number;
  vehicle: Vehicle;
  type: 'scheduled' | 'repair' | 'inspection';
  description: string;
  cost: number;
  mileage: number;
  service_date: string;
  next_service_date?: string;
  vendor?: string;
  created_at: string;
}

export interface FuelRecord {
  id: number;
  vehicle_id: number;
  vehicle: Vehicle;
  driver_id?: number;
  driver?: Driver;
  gallons: number;
  price_per_gallon: number;
  total_cost: number;
  location: string;
  state: string;
  mileage: number;
  fuel_date: string;
  receipt_url?: string;
  created_at: string;
}

export interface RouteOptimization {
  id: number;
  trip_ids: number[];
  trips: Trip[];
  optimized_route: {
    waypoints: Array<{
      trip_id: number;
      order: number;
      location: {
        lat: number;
        lng: number;
      };
    }>;
    total_distance: number;
    estimated_time: number;
    estimated_fuel_cost: number;
  };
  created_at: string;
}

export interface ComplianceDocument {
  id: number;
  type: 'cdl' | 'medical' | 'registration' | 'insurance' | 'permit' | 'inspection' | 'other';
  entity_type: 'driver' | 'vehicle';
  entity_id: number;
  document_number: string;
  expiry_date?: string;
  issue_date?: string;
  status: 'valid' | 'expiring_soon' | 'expired';
  file_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

