// In types.ts
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string | any; // Allow content to be string or JSON object
  contentType?: 'text' | 'json' | 'bus_data'; // Add content type
  timestamp: Date;
  busRoutes?: Bus[];
  rawData?: any; // Add this property to store the complete JSON response
isLoading?: boolean; // Optional property to indicate loading state
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  lastUpdated: Date;
}

export interface FareDetails {
  "Base Fare": number;
  "GST": number;
  "Discount": number;
}

export interface SeatPosition {
  seatNumber: string;
  price: number | string;
  seat_id: number | string;
  fare?: FareDetails;
}

export interface BookingInfo {
  mobile: string;
  email: string;
  seat_map: Array<{
    passenger_age: number;
    seat_id: number | string;
    passenger_name: string;
    gender: string;
  }>;
  trip_id: number;
  boarding_point_id: number | string;
  dropping_point_id: number | string;
  boarding_point_time: string;
  dropping_point_time: string;
  total_collect_amount: number;
  fare?: FareDetails;
  main_category: number;
  freshcardId: number;
  freshcard: boolean;
  return_url: string;
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
  recommended_seats: RecommendedSeats;
 
}

export interface BoardingPoint {
  boarding_point_id: number;
  currentTime: string;
  boarding_point: {
    id: number;
    name: string;
    stationId: number;
    latitude: number;
    longitude: number;
    landmark: string;
    active: boolean;
  };
}

export interface DroppingPoint {
  dropping_point_id: number;
  currentTime: string;
  dropping_point: {
    id: number;
    name: string;
    stationId: number;
    latitude: number;
    longitude: number;
    landmark: string;
    active: boolean;
  };
}

export interface RecommendedSeats {
  Premium?: SeatCategory;
  Reasonable?: SeatCategory;
  "Budget-Friendly"?: SeatCategory;
}

export interface SeatCategory {
  window: Seat[];
  aisle: Seat[];
}

export interface Seat {
  seat_id: number;
  seat_number: number;
  price: number;
  type?: string;
  fare_details: {
    "Base Fare": number;
    GST: number;
    Discount: number;
  };
  is_reserved_female: boolean;
  is_reserved_male: boolean;
  availability_status_code: string;
}

export interface LocationPoint {
  tripID: number | string;
  name: string;
  landmark?: string;
  time?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
}

export interface HistoryMessage {
  role: 'user' | 'assistant' | 'meta';
  content: string;
}

export interface ConversationHistory {
  history: HistoryMessage[];
}