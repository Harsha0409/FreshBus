export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string | any;
  contentType?: 'text' | 'json' | 'bus_data';
  timestamp: Date;
  busRoutes?: Bus[];
  rawData?: any;
  isLoading?: boolean;
  ticketData?: any; // You can type this more strictly if you have a TicketData interface
  passengerData?: Passenger[];
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
  type?: "window" | "aisle";
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
  Premium?: {
    window?: Seat[];
    aisle?: Seat[];
  };
  Reasonable?: {
    window?: Seat[];
    aisle?: Seat[];
  };
  "Budget-Friendly"?: {
    window?: Seat[];
    aisle?: Seat[];
  };
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
  name: string;
  age: number | string;
  gender: string;
  seat: string | number;
}

// If you want to type the full backend response:
export interface BusQueryResponse {
  recommendations: Bus[];
  passengers: Passenger[];
}