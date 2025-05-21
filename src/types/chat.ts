export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string | any;
  contentType?: 'text' | 'json' | 'bus_data';
  timestamp: Date;
  busRoutes?: Bus[];
  rawData?: any;
  isLoading?: boolean;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  lastUpdated: Date;
}

export interface FareDetails {
  "Base Fare": number;
  GST: number;
  Discount: number;
}

export interface Seat {
  seat_id: number;
  seat_number: number;
  price: number;
  type?: string;
  fare_details: FareDetails;
  is_reserved_female: boolean;
  is_reserved_male: boolean;
  availability_status_code: string;
}

export interface SeatCategory {
  window: Seat[];
  aisle: Seat[];
}

export interface RecommendedSeats {
  Premium?: SeatCategory;
  Reasonable?: SeatCategory;
  "Budget-Friendly"?: SeatCategory;
}

export interface GenderAssignments {
  [category: string]: {
    [seat_id: string]: "male" | "female";
  };
}

export interface BoardingPoint {
  boarding_point_id: number;
  currentTime: string;
  boarding_point: {
    id: number;
    name: string;
    landmark: string;
    // Optional fields (add if present in your backend)
    stationId?: number;
    latitude?: number;
    longitude?: number;
    active?: boolean;
  };
}

export interface DroppingPoint {
  dropping_point_id: number;
  currentTime: string;
  dropping_point: {
    id: number;
    name: string;
    landmark: string;
    // Optional fields (add if present in your backend)
    stationId?: number;
    latitude?: number;
    longitude?: number;
    active?: boolean;
  };
}

export interface RecommendedPoint {
  name: string;
  landmark: string;
  popularity: number;
}

export interface Bus {
  tripID: number;
  from: string;
  to: string;
  rating: number;
  duration: string;
  startTime: string;
  endTime: string;
  allBoardingPoints: BoardingPoint[];
  allDroppingPoints: DroppingPoint[];
  recommended_boarding_points?: RecommendedPoint[];
  recommended_dropping_points?: RecommendedPoint[];
  recommended_seats?: RecommendedSeats;
  gender_assignments?: GenderAssignments;
}

export interface Passenger {
  id: number;
  name: string;
  gender: string;
  age: number;
}

// If you want to type the full backend response:
export interface BusQueryResponse {
  recommendations: Bus[];
  passengers: Passenger[];
}