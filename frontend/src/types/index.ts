export interface Vehicle {
  id: string
  name: string
  class: 'motorcycle' | 'car' | 'lcv' | 'bus' | 'truck' | 'hcm'
  axle_count: number
  created_at: string
}

export interface Trip {
  id: string
  vehicle_id: string
  origin: string
  destination: string
  distance_km: number
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
  vehicle_name?: string
  vehicle_class?: string
  toll_amount?: number
  fuel_cost?: number
  flagged?: boolean
}

export interface TollEstimate {
  id: string
  trip_id: string
  toll_amount: number
  fuel_cost: number
  flagged: boolean
  computed_at: string
}

export interface Corridor {
  id: string
  name: string
  avg_toll: number
  trip_count: number
  updated_at: string
}

export interface AnalyticsSummary {
  total_trips: number
  total_toll_spend: number
  avg_cost_per_trip: number
  flagged_routes: number
}

export interface SpendDataPoint {
  date: string
  spend: number
}

export interface PaginatedTrips {
  data: Trip[]
  total: number
  page: number
  per_page: number
}

export interface TripEvent {
  type: string
  trip_id?: string
  trip_num?: number
  origin?: string
  destination?: string
  status?: string
  timestamp: string
}

export interface TollBreakdown {
  plaza_name: string
  km: number
  amount: number
}

export interface FuelStop {
  name: string
  km: number
  price_per_l: number
}

export interface RouteDetail {
  trip: Trip
  estimate: TollEstimate
  breakdown: TollBreakdown[]
  fuel_stops: FuelStop[]
}

export interface User {
  id: string
  email: string
  name: string
}
