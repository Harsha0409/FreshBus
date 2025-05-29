export interface Fare {
    coins: number;
    pass: boolean;
    discount: number;
    freshcard: number;
    freshcardPurchase: number;
    amount: number;
    tax: number;
  }
  
  export interface SeatPolicy {
    label: string;
    id: number;
    isCoinsPolicy: boolean;
    customerActive: boolean;
    amount: number;
    coins: number;
    pass: number;
    percentage: number;
  }
  
  export interface Seat {
    id: number;
    active: boolean;
    age: number;
    gender: string;
    name: string;
    seatNumber: string;
    fare: Fare;
    totalFare: number;
    seatPolicies: SeatPolicy[];
  }
  
  export interface RefundSlab {
    pass: number;
    slabId: number;
    isCurrentSlab: boolean;
    window: string;
    percentage?: number;
    amount?: number;
    coins?: number;
    value?: string;
  }
  
  export interface Policy {
    id: number;
    label: string;
    isCoinsPolicy: boolean;
    customerActive: boolean;
    refund: RefundSlab[];
  }
  
  export interface BillDetail {
    label: string;
    value: string;
  }
  
  export interface CancellationData {
    cancelSeatResponseDto: Seat[];
    policies: Policy[];
    mobilePolicy: Policy[];
    billDetails: BillDetail[];
    reasons: any[];
    info: any[];
    extraRefunds: any[];
  }
  
  export interface TravelDetails {
    id: number;
    ticketId: string;
    tripId: number;
    downloadLink: string;
    trackingUrl: string;
    trackingUrlNew: string;
    downloadLabel: string;
    status: string;
    bookingid: string;
    date: string;
    source: {
      name: string;
      point: string;
      landmark: string;
      time: string;
    };
    destination: {
      name: string;
      point: string;
      landmark: string;
      time: string;
    };
    vehicleType: string;
    preCoins: number;
    coins: number;
    preCarbonKg: number;
    carbonKg: number;
  }
  
  export interface TravelPolicy {
    policy_fetch_success: boolean;
    cancelSeatResponseDto: Seat[];
    policies: Policy[];
    mobilePolicy: Policy[];
    billDetails: BillDetail[];
    reasons: any[];
    info: any[];
    extraRefunds: any[];
  }
  
  export interface UpcomingTravel {
    travel_details: TravelDetails;
    policy: TravelPolicy;
    policy_fetch_success: boolean;
  }
  
  export interface UpcomingTravelsResponse {
    success: boolean;
    data: {
      upcoming_travels: UpcomingTravel[];
      count: number;
      fetch_timestamp: string;
    };
  }