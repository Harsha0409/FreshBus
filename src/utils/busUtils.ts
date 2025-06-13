import { Bus, Seat, GreenCoins, FreshCard, FinalFareCalculation } from '../types/chat';

// Define valid category literals
export type CategoryType = 'Premium' | 'Reasonable' | 'Budget-Friendly';

export interface CategoryBus extends Bus {
  category: CategoryType;
  categorySeats: Seat[];
}

export interface BusWithCategory extends Bus {
  category: CategoryType;
  categorySeats: {
    window?: Seat[];
    aisle?: Seat[];
  };
}

// Time and date conversion functions
export function convertToIST(utcTime: string): { date: string; time: string } {
  const date = new Date(utcTime);
  const formattedDate = date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).replace(/am|pm/gi, match => match.toUpperCase());
  return { date: formattedDate, time: formattedTime };
}

export function getAvailableCategories(bus: Bus): CategoryType[] {
  const categories: CategoryType[] = [];
  if (
    bus.recommended_seats?.Premium &&
    ((bus.recommended_seats.Premium.window && bus.recommended_seats.Premium.window.length > 0) ||
      (bus.recommended_seats.Premium.aisle && bus.recommended_seats.Premium.aisle.length > 0))
  ) {
    categories.push('Premium');
  }
  if (
    bus.recommended_seats?.Reasonable &&
    ((bus.recommended_seats.Reasonable.window && bus.recommended_seats.Reasonable.window.length > 0) ||
      (bus.recommended_seats.Reasonable.aisle && bus.recommended_seats.Reasonable.aisle.length > 0))
  ) {
    categories.push('Reasonable');
  }
  if (
    bus.recommended_seats?.['Budget-Friendly'] &&
    ((bus.recommended_seats['Budget-Friendly'].window && bus.recommended_seats['Budget-Friendly'].window.length > 0) ||
      (bus.recommended_seats['Budget-Friendly'].aisle && bus.recommended_seats['Budget-Friendly'].aisle.length > 0))
  ) {
    categories.push('Budget-Friendly');
  }
  return categories;
}

export function flattenBusesByCategory(buses: Bus[]): BusWithCategory[] {
  const result: BusWithCategory[] = [];
  buses.forEach((bus) => {
    const categories: CategoryType[] = ['Premium', 'Reasonable', 'Budget-Friendly'];
    categories.forEach((cat) => {
      const seats = bus.recommended_seats?.[cat];
      if (
        seats &&
        ((seats.window && seats.window.length > 0) ||
          (seats.aisle && seats.aisle.length > 0))
      ) {
        result.push({
          ...bus,
          category: cat,
          categorySeats: seats,
        });
      }
    });
  });
  return result;
}

export function splitBusByCategory(buses: Bus[]): CategoryBus[] {
  const categoryBuses: CategoryBus[] = [];
  
  buses.forEach(bus => {
    const categories = getAvailableCategories(bus);
    categories.forEach(category => {
      const categorySeats: Seat[] = [
        ...(bus.recommended_seats?.[category]?.window || []).map(seat => ({
          ...seat,
          type: 'window' as const,
        })),
        ...(bus.recommended_seats?.[category]?.aisle || []).map(seat => ({
          ...seat,
          type: 'aisle' as const,
        })),
      ];
      if (categorySeats.length > 0) {
        categoryBuses.push({
          ...bus,
          category,
          categorySeats,
        });
      }
    });
  });
  
  return categoryBuses;
}

export function getCategoryStyle(category: CategoryType): { background: string; textColor: string } {
  switch (category) {
    case 'Premium':
      return {
        background: 'linear-gradient(135deg, #FFD700 0%, #FFF700 25%, #FFD700 50%, #D4AF37 75%, #FFD700 100%)',
        textColor: 'text-gray-900'
      };
    case 'Reasonable':
      return {
        background: 'linear-gradient(135deg, #E8E8E8 0%, #FFFFFF 25%, #C0C0C0 50%, #A8A8A8 75%, #E8E8E8 100%)',
        textColor: 'text-gray-900'
      };
    case 'Budget-Friendly':
      return {
        background: 'linear-gradient(135deg, #CD7F32 0%, #FFB347 25%, #CD7F32 50%, #A0522D 75%, #CD7F32 100%)',
        textColor: 'text-gray-900'
      };
    default:
      return {
        background: 'linear-gradient(90deg, #6c757d 0%, #adb5bd 100%)',
        textColor: 'text-gray-900'
      };
  }
}

export function getCategorySeats(bus: Bus, category: CategoryType): Seat[] {
  const categorySeats = bus.recommended_seats?.[category];
  if (!categorySeats) return [];
  return [
    ...(categorySeats.window || []).map(seat => ({
      ...seat,
      type: 'window' as const,
    })),
    ...(categorySeats.aisle || []).map(seat => ({
      ...seat,
      type: 'aisle' as const,
    })),
  ];
}

export function calculateCategoryFare(seats: Seat[]): {
  baseFare: number;
  gst: number;
  discount: number;
  total: number;
} {
  const baseFare = seats.reduce((total, seat) => total + (seat.fare_details?.['Base Fare'] || 0), 0);
  const gst = seats.reduce((total, seat) => total + (seat.fare_details?.GST || 0), 0);
  const discount = seats.reduce((total, seat) => total + (seat.fare_details?.Discount || 0), 0);
  return {
    baseFare,
    gst,
    discount,
    total: baseFare + gst + discount
  };
}

export interface Passenger {
  id?: number;
  name: string;
  age: number | undefined;
  gender: string;
}

export function getSeatBackgroundColor(bus: Bus, seat: Seat): string {
  let gender: string | undefined;
  if (bus.gender_assignments) {
    for (const category in bus.gender_assignments) {
      if (bus.gender_assignments[category]?.[seat.seat_id]) {
        gender = bus.gender_assignments[category][seat.seat_id];
        break;
      }
    }
  }
  return gender === 'female' ? 'bg-pink-300' : 'bg-yellow-300';
}

export function getSeatGender(bus: Bus, seat: Seat | undefined): string | null {
  if (!seat || !bus.gender_assignments) return null;
  for (const category in bus.gender_assignments) {
    if (bus.gender_assignments[category]?.[seat.seat_id]) {
      return bus.gender_assignments[category][seat.seat_id];
    }
  }
  return null;
}

export function createPaymentPayload(
  bus: BusWithCategory, 
  selectedSeats: Seat[], 
  passengerDetails: Passenger[],
  selectedBoarding: string | null,
  selectedDropping: string | null,
  appliedGreenCoins: number = 0,
  appliedFreshCard: boolean = false,
  freshCard: FreshCard | null = null,
  finalFareCalculation?: FinalFareCalculation
) {
  // Parse user data from localStorage
  let mobile = '';
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const userData = JSON.parse(userStr);
      mobile = userData.mobile || '';
    }
  } catch (e) {
    console.error('Error parsing user data:', e);
  }

  console.log('Extracted mobile number:', mobile);

  // Use provided final fare calculation or calculate here
  let actualGreenCoinsUsed = 0;
  let finalAmount = 0;
  
  if (finalFareCalculation) {
    actualGreenCoinsUsed = finalFareCalculation.greenCoinsDiscount;
    finalAmount = finalFareCalculation.total;
  } else {
    // Fallback calculation
    const totalFare = selectedSeats.reduce(
      (total, seat) =>
        total +
        (seat.fare_details?.['Base Fare'] || 0) +
        (seat.fare_details?.GST || 0) +
        (seat.fare_details?.Discount || 0),
      0
    );
    
    let remainingAmount = totalFare;
    
    // Apply green coins first
    if (appliedGreenCoins > 0) {
      actualGreenCoinsUsed = Math.min(appliedGreenCoins, remainingAmount);
      remainingAmount -= actualGreenCoinsUsed;
    }
    
    // Then apply fresh card discount to remaining amount
    if (appliedFreshCard && freshCard) {
      const freshCardDiscount = Math.min(freshCard.discountAmount, remainingAmount);
      remainingAmount -= freshCardDiscount;
    }
    
    // Ensure minimum payment amount
    finalAmount = Math.max(1, remainingAmount);
  }

  // Prepare the payload
  const payload = {
    mobile,
    email: '',
    seat_map: passengerDetails.map((passenger, index) => ({
      passenger_age: passenger.age,
      seat_id: selectedSeats[index].seat_id,
      passenger_name: passenger.name,
      passenger_gender: passenger.gender,
    })),
    trip_id: bus.tripID,
    boarding_point_id: bus.allBoardingPoints.find((bp) => bp.boarding_point.name === selectedBoarding)?.boarding_point_id,
    dropping_point_id: bus.allDroppingPoints.find((dp) => dp.dropping_point.name === selectedDropping)?.dropping_point_id,
    boarding_point_time: bus.allBoardingPoints.find((bp) => bp.boarding_point.name === selectedBoarding)?.currentTime,
    dropping_point_time: bus.allDroppingPoints.find((dp) => dp.dropping_point.name === selectedDropping)?.currentTime,
    total_collect_amount: finalAmount.toFixed(2),
    main_category: 1,
    freshcardId: appliedFreshCard && freshCard ? freshCard.id : 0,
    freshcard: appliedFreshCard,
    green_coins: actualGreenCoinsUsed, // Send the actual amount used, not the applied amount
    return_url: `${window.location.origin}/payment/callback?session_id=${localStorage.getItem('sessionId')}`,
  };

  // Validation checks
  if (!mobile) {
    throw new Error('Mobile number is required for booking');
  }

  // Debugging: Log the payload
  console.log('Payload with discounts:', payload);
  console.log('Applied green coins (user input):', appliedGreenCoins);
  console.log('Actual green coins used (sent to backend):', actualGreenCoinsUsed);
  console.log('Applied fresh card:', appliedFreshCard);
  console.log('Final amount:', finalAmount);
  
  return payload;
}

export function validatePassengerDetails(passengerDetails: Passenger[]): boolean {
  return !passengerDetails.some((passenger) => !passenger.name || !passenger.age || !passenger.gender);
}

// Export the interfaces
export type { GreenCoins, FreshCard, FinalFareCalculation };