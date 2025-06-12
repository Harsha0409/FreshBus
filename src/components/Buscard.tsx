import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { 
  BusWithCategory, 
  getCategoryStyle, 
  getCategorySeats, 
  calculateCategoryFare, 
  convertToIST,
  getSeatBackgroundColor,
  Passenger,
  getSeatGender,
  GreenCoins,
  FreshCard,
  createPaymentPayload,
  FinalFareCalculation
} from '../utils/busUtils';
import ReactDOM from 'react-dom';
import SeatLayout from './Seatlayout';
import { authService } from '../services/api';

interface BusCardProps {
  bus: BusWithCategory;
  onBook: (busId: number) => void;
}

const BusCard: React.FC<BusCardProps> = ({ bus }) => {
  const { theme } = useTheme();
  // Basic state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isModalClosing, setIsModalClosing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [isSeatLayoutOpen, setIsSeatLayoutOpen] = useState(false);
  
  // Green Coins and Fresh Card state
  const [greenCoins, setGreenCoins] = useState<GreenCoins | null>(null);
  const [freshCard, setFreshCard] = useState<FreshCard | null>(null);
  const [appliedGreenCoins, setAppliedGreenCoins] = useState(0);
  const [appliedFreshCard, setAppliedFreshCard] = useState(false);
  
  // Boarding and dropping points
  const [selectedBoarding, setSelectedBoarding] = useState<string | null>(
    (() => {
      // Try to match recommended to allBoardingPoints
      if (bus.recommended_boarding_points?.length) {
        const match = bus.allBoardingPoints.find(bp =>
          bp.boarding_point.name === bus.recommended_boarding_points?.[0]?.name
        );
        if (match) return match.boarding_point.name;
      }
      // Fallback to first allBoardingPoints
      return bus.allBoardingPoints[0]?.boarding_point.name || null;
    })()
  );
  const [selectedDropping, setSelectedDropping] = useState<string | null>(
    (() => {
      // Try to match recommended to allDroppingPoints
      if (bus.recommended_dropping_points?.length) {
        const match = bus.allDroppingPoints.find(dp =>
          dp.dropping_point.name === bus.recommended_dropping_points?.[0]?.name
        );
        if (match) return match.dropping_point.name;
      }
      // Fallback to first allDroppingPoints
      return bus.allDroppingPoints[0]?.dropping_point.name || null;
    })()
  );
  const [dropdownOpen, setDropdownOpen] = useState({ boarding: false, dropping: false });

  // Backend passengers
  const [backendPassengers, setBackendPassengers] = useState<Passenger[]>([]);
  
  // Seats and passengers
  const allSeats = getCategorySeats(bus, bus.category);
  const [selectedSeats, setSelectedSeats] = useState(allSeats);
  
  // Passenger management
  const getInitialPassenger = (index: number = 0) => {
    const seat = selectedSeats[index];
    if (!seat) return { name: '', age: undefined, gender: 'Male' };
    
    // Get gender assignment for this seat
    const seatGender = getSeatGender(bus, seat);
    return { 
      name: '', 
      age: undefined, 
      gender: seatGender === 'female' ? 'Female' : 'Male'
    };
  };
  
  const [passengerDetails, setPassengerDetails] = useState<Array<{
    name: string;
    age: number | undefined;
    gender: string;
  }>>([getInitialPassenger(0)]);
  
  const [currentPassenger, setCurrentPassenger] = useState<{
    name: string;
    age: number | undefined;
    gender: string;
  }>(getInitialPassenger(0));
  
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [currentSeatIndex, setCurrentSeatIndex] = useState(0);
  
  // Get styling and fare info
  const categoryStyle = getCategoryStyle(bus.category);
  const originalFare = calculateCategoryFare(allSeats);
  
  // Calculate final fare with discounts - FIXED VERSION
  const calculateFinalFare = (): FinalFareCalculation => {
    let baseFare = originalFare.baseFare;
    let gst = originalFare.gst;
    let discount = originalFare.discount;
    
    // Calculate the base total before applying additional discounts
    let baseTotal = baseFare + gst + discount;
    
    let actualGreenCoinsDiscount = 0;
    let actualFreshCardDiscount = 0;
    let finalTotal = baseTotal; // Start with base total

    // Scenario 1: Fresh Card is applied (high priority)
    if (appliedFreshCard && freshCard && freshCard.discountAmount > 0) {
      actualFreshCardDiscount = Math.min(freshCard.discountAmount, baseTotal);
      finalTotal -= actualFreshCardDiscount;
      
      // Now apply Green Coins to the remaining amount, rounded up
      if (appliedGreenCoins > 0) {
        actualGreenCoinsDiscount = Math.min(appliedGreenCoins, Math.ceil(finalTotal));
        finalTotal -= actualGreenCoinsDiscount;
      }
    } 
    // Scenario 2: Only Green Coins are applied (or Fresh Card not available/applied)
    else if (appliedGreenCoins > 0) {
      // Green coins applied should cover the base total amount, rounded up
      actualGreenCoinsDiscount = Math.min(appliedGreenCoins, Math.ceil(baseTotal));
      finalTotal -= actualGreenCoinsDiscount;
    }
    // If neither is applied, finalTotal remains baseTotal

    // Ensure finalTotal doesn't go below zero
    finalTotal = Math.max(0, finalTotal);

    return {
      baseFare,
      gst,
      discount,
      greenCoinsDiscount: actualGreenCoinsDiscount,
      freshCardDiscount: actualFreshCardDiscount,
      total: finalTotal
    };
  };

  // Load backend data when component mounts
  useEffect(() => {
    try {
      let busQueryResponse = null;
      
      // Check multiple sources for the bus query response
      if (bus && (bus as any).busQueryResponse) {
        busQueryResponse = (bus as any).busQueryResponse;
      } else if (typeof window !== 'undefined' && (window as any).busQueryResponse) {
        busQueryResponse = (window as any).busQueryResponse;
      } else if (typeof window !== 'undefined' && (window as any).__BUS_QUERY_DATA__) {
        busQueryResponse = (window as any).__BUS_QUERY_DATA__;
      } else {
        // Try localStorage
        const storedData = localStorage.getItem('busQueryResponse');
        if (storedData) {
          try {
            busQueryResponse = JSON.parse(storedData);
          } catch (e) {
            console.error('Error parsing stored bus data:', e);
          }
        }
      }
      
      console.log('Bus Query Response:', busQueryResponse); // Debug log
      
      if (busQueryResponse) {
        // Set green coins data
        if (busQueryResponse.green_coins) {
          console.log('Setting green coins:', busQueryResponse.green_coins); // Debug log
          setGreenCoins(busQueryResponse.green_coins);
        }
        
        // Set fresh card data
        if (busQueryResponse.freshcard) {
          console.log('Setting fresh card:', busQueryResponse.freshcard); // Debug log
          setFreshCard(busQueryResponse.freshcard);
        }
        
        // Set passengers data
        if (busQueryResponse.passengers && Array.isArray(busQueryResponse.passengers)) {
          setBackendPassengers(busQueryResponse.passengers);
        }
      } else {
        console.warn('No bus query response data found');
      }
      
      // Also try to get recent passengers from localStorage
      try {
        const recentPassengersData = localStorage.getItem('recentPassengers');
        if (recentPassengersData) {
          const recentPassengers = JSON.parse(recentPassengersData);
          if (Array.isArray(recentPassengers)) {
            setBackendPassengers(prev => {
              const allPassengers = [...prev];
              recentPassengers.forEach(recentPass => {
                if (!allPassengers.some(existingPass => 
                  existingPass.name.toLowerCase() === recentPass.name.toLowerCase() && 
                  existingPass.age === recentPass.age)) {
                  allPassengers.push(recentPass);
                }
              });
              return allPassengers;
            });
          }
        }
      } catch (e) {
        console.error('Error parsing recent passengers:', e);
      }
    } catch (e) {
      console.error('Error loading backend data:', e);
    }
  }, [bus]);

  // Effects
  useEffect(() => {
    const timer = setTimeout(() => setShowSkeleton(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Initialize passenger details array with empty objects for each seat
  useEffect(() => {
    if (selectedSeats.length > 0) {
      const initialPassengers = selectedSeats.map((_, index) => getInitialPassenger(index));
      setPassengerDetails(initialPassengers);
    }
  }, [selectedSeats]);

  // Prepare passenger details when modal opens
  useEffect(() => {
    if (isModalOpen && selectedSeats.length > 0) {
      // Reset passenger details based on seat count and gender
      const initialPassengers = selectedSeats.map((seat) => {
        const seatGender = getSeatGender(bus, seat);
        return {
          name: '',
          age: undefined,
          gender: seatGender === 'female' ? 'Female' : 'Male'
        };
      });
      
      setPassengerDetails(initialPassengers);
      setCurrentPassenger(initialPassengers[0]);
      setCurrentSeatIndex(0);
      setEditingIndex(null);
      
      // Reset discounts when modal opens (before re-applying them)
      setAppliedGreenCoins(0);
      setAppliedFreshCard(false);
      
      // Automatically apply Green Coins if available
      if (greenCoins && greenCoins.available > 0) {
        // Calculate original fare without any discounts for initial green coin application
        const initialFare = calculateCategoryFare(selectedSeats).total;
        const maxUsable = Math.min(greenCoins.available, Math.ceil(initialFare));
        if (maxUsable > 0) {
          setAppliedGreenCoins(maxUsable);
        }
      }

      // Automatically apply Fresh Card if available
      if (freshCard && freshCard.available && freshCard.balance > 0) {
        setAppliedFreshCard(true);
      }
    }
  }, [isModalOpen, selectedSeats, bus, greenCoins, freshCard]);

  // Animation effect for modal
  useEffect(() => {
    if (isModalOpen) {
      // Trigger animation after modal opens
      const timer = setTimeout(() => setIsModalVisible(true), 10)
      return () => clearTimeout(timer)
    }
  }, [isModalOpen])

  // Event handlers
  const handleCardClick = () => {
    setSelectedSeats(allSeats);
    setIsModalOpen(true);
    
    // Store the backend data in localStorage for future use
    if (window && (window as any).busQueryResponse) {
      localStorage.setItem('busQueryResponse', JSON.stringify((window as any).busQueryResponse));
    }
  };

  // Handle green coins redemption - UPDATED (removed greenCoinsInput usage)
  const handleRedeemGreenCoins = () => {
    if (!greenCoins || greenCoins.available <= 0) {
      toast.error('No green coins available to redeem');
      return;
    }
    
    // Calculate how much we can actually use, rounding up to cover the full amount
    const currentFare = originalFare.total;
    const maxUsable = Math.min(greenCoins.available, Math.ceil(currentFare));
    
    if (maxUsable <= 0) {
      toast.error('No green coins can be applied to this fare');
      return;
    }
    
    setAppliedGreenCoins(maxUsable);
    toast.success(`₹${maxUsable} green coins will be applied!`);
  };

  // Handle fresh card application
  const handleApplyFreshCard = () => {
    if (!freshCard || !freshCard.available || freshCard.balance <= 0) {
      toast.error('Fresh card not available or no balance remaining');
      return;
    }
    
    if (appliedFreshCard) {
      setAppliedFreshCard(false);
      toast.success('Fresh card discount removed');
    } else {
      setAppliedFreshCard(true);
      toast.success(`Fresh card discount will be applied!`);
    }
  };

  // Handle modal close with animation
  const handleModalClose = () => {
    if (isModalClosing) return // Prevent multiple close calls
    setIsModalClosing(true)
    setIsModalVisible(false)
    // Wait for animation to complete before closing modal
    setTimeout(() => {
      setIsModalOpen(false)
      setIsModalVisible(false)
      setIsModalClosing(false)
    }, 300)
  };

  const handleConfirmPayment = async () => {
    const filledPassengers = passengerDetails.filter(p => p.name && p.age !== undefined && p.gender);
  
    if (filledPassengers.length < selectedSeats.length) {
      toast.error(`Please fill details for all ${selectedSeats.length} passengers.`);
      return;
    }

    if (!selectedBoarding || !selectedDropping) {
      toast.error('Please select both boarding and dropping points.');
      return;
    }

    try {
      setIsProcessing(true);
      
      // Get the logged-in user's data
      let userMobile = '';
      let userId = '';
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const userData = JSON.parse(userStr);
          userMobile = userData.mobile || '';
          userId = userData.id || '';
        } catch (e) {
          console.error('Error parsing user data:', e);
        }
      }

      // Check if user is authenticated
      if (!userId || !userMobile) {
        toast.error('Please login to continue with booking.');
        window.dispatchEvent(new CustomEvent('login:required'));
        return;
      }
      
      // Save passenger details for future bookings
      const passengersToSave = filledPassengers.map((p) => ({
        id: Math.floor(Math.random() * 1000000) + 1,
        name: p.name,
        gender: p.gender,
        age: p.age || 0
      }));
      
      // Merge and store unique passengers
      let allPassengers = [...backendPassengers];
      passengersToSave.forEach(newPass => {
        if (!allPassengers.some(existingPass => 
          existingPass.name.toLowerCase() === newPass.name.toLowerCase() && 
          existingPass.age === newPass.age)) {
          allPassengers.push(newPass);
        }
      });
      
      // Store in localStorage for future use
      localStorage.setItem('recentPassengers', JSON.stringify(allPassengers));
      
      // Calculate final fare with accurate discount amounts
      const finalFare = calculateFinalFare();
      
      // Validate payment amount before proceeding
      // Allow payment if final total is exactly 0 after discounts
      if (finalFare.total < 0) {
        toast.error('Invalid payment amount. Final fare cannot be negative.');
        return;
      }
      
      console.log('Final fare calculation:', finalFare); // Debug log
      
      // Use the updated createPaymentPayload function with final fare calculation
      const payload = createPaymentPayload(
        bus,
        selectedSeats,
        passengerDetails,
        selectedBoarding,
        selectedDropping,
        appliedGreenCoins,
        appliedFreshCard,
        freshCard,
        finalFare // Pass the calculated fare breakdown
      );
      
      const response = await authService.fetchWithRefresh('/api/tickets/block', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
          'X-Session-ID': localStorage.getItem('sessionId') || '',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to block ticket');
      }

      const data = await response.json();
      if (data.api_order_id) {
        localStorage.setItem('current_order_id', data.api_order_id);
      }

      if (!data.payment_url) {
        throw new Error('Payment URL not found in server response. Please try again.');
      }

      toast.success('Redirecting to payment portal...');
      window.location.href = data.payment_url;

    } catch (error: any) {
      toast.error(error.message || 'An error occurred during payment.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddOrUpdatePassenger = () => {
    if (!currentPassenger.name || currentPassenger.age === undefined || !currentPassenger.gender) {
      toast.error('Please fill in all passenger details.');
      return;
    }
    
    setPassengerDetails(prevDetails => {
      const updatedDetails = [...prevDetails];
      if (editingIndex !== null) {
        updatedDetails[editingIndex] = currentPassenger;
        setEditingIndex(null);
      } else {
        // Make sure we're updating the right index
        updatedDetails[currentSeatIndex] = currentPassenger;
      }
      return updatedDetails;
    });
    
    // Prepare for next passenger if any
    const nextIndex = editingIndex !== null 
      ? editingIndex + 1
      : currentSeatIndex + 1;
      
    if (nextIndex < selectedSeats.length) {
      setCurrentSeatIndex(nextIndex);
      setCurrentPassenger(getInitialPassenger(nextIndex));
    } else {
      // Reset to empty form with default values for a clean form
      setCurrentPassenger({ name: '', age: undefined, gender: 'Male' });
    }
  };

  // Function to select a passenger from the backend list
  const handleSelectPassenger = (backendPassenger: Passenger) => {
    // Get the seat's required gender
    const seatGender = getSeatGender(bus, selectedSeats[currentSeatIndex]);
    const gender = seatGender === 'female' ? 'Female' : backendPassenger.gender;
    
    const selectedPassenger = {
      name: backendPassenger.name,
      age: backendPassenger.age,
      gender
    };
    
    // Immediately add the passenger to the list
    setPassengerDetails(prevDetails => {
      const updatedDetails = [...prevDetails];
      if (editingIndex !== null) {
        updatedDetails[editingIndex] = selectedPassenger;
        setEditingIndex(null);
      } else {
        updatedDetails[currentSeatIndex] = selectedPassenger;
      }
      return updatedDetails;
    });
    
    // Move to next passenger if any
    const nextIndex = editingIndex !== null 
      ? editingIndex + 1
      : currentSeatIndex + 1;
      
    if (nextIndex < selectedSeats.length) {
      setCurrentSeatIndex(nextIndex);
      setCurrentPassenger(getInitialPassenger(nextIndex));
    } else {
      // Reset to empty form with default values for a clean form
      setCurrentPassenger({ name: '', age: undefined, gender: 'Male' });
    }
  };

  // Check if all passengers are complete and valid
  const getFilledPassengersCount = () => 
    passengerDetails.filter(p => p.name && p.age !== undefined && p.gender).length;
  
  const areAllPassengersValid = getFilledPassengersCount() === selectedSeats.length;

  // Render passenger suggestions from backend
  const renderPassengerSuggestions = () => {
    if (backendPassengers.length === 0) {
      return null;
    }
    
    // Get the seat's required gender
    const seatGender = getSeatGender(bus, selectedSeats[currentSeatIndex]);
    const requiredGender = seatGender || null;
    
    // Get names of already added passengers to avoid duplicates
    // Exclude the current passenger being edited
    const addedNames = passengerDetails
      .filter((p, index) => p.name && index !== editingIndex)
      .map(p => p.name.toLowerCase().trim());
    
    // Filter passengers that match the seat gender requirements and aren't already added
    const filteredPassengers = backendPassengers.filter(p => {
      // Skip already added passengers
      if (addedNames.includes(p.name.toLowerCase().trim())) {
        return false;
      }
      
      // If seat is reserved for specific gender, filter accordingly
      if (requiredGender === 'female' && p.gender !== 'Female') {
        return false;
      }
      if (requiredGender === 'male' && p.gender !== 'Male') {
        return false;
      }
      
      return true;
    });
    
    if (filteredPassengers.length === 0) {
      return null;
    }
    
    return (
      <div className="mt-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Select from previous passengers:
        </p>
        <div 
          className="flex flex-wrap gap-2 mt-1 overflow-y-auto custom-scrollbar p-2 border rounded-lg bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-600"
          style={{ 
            maxHeight: '50px',
            scrollbarWidth: 'thin',
            scrollbarColor: '#cbd5e0 transparent'
          }}
        >
          {filteredPassengers.map((passenger, idx) => (
            <button
              key={idx}
              className="px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-800/40 border border-blue-200 dark:border-blue-700 transition-colors font-medium whitespace-nowrap flex-shrink-0"
              onClick={() => handleSelectPassenger(passenger)}
              title={`Click to select: ${passenger.name} - Age: ${passenger.age}, Gender: ${passenger.gender}`}
            >
              {passenger.name} 
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Render skeleton during loading
  if (showSkeleton) {
    return (
      <div className="rounded-lg shadow-md p-4 w-full bg-[#0078d4] relative overflow-hidden">
        <div className="bus-icon absolute inset-0 flex items-center justify-center opacity-20">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-white">
            <path d="M8 6v6"></path><path d="M15 6v6"></path><path d="M2 12h19.6"></path>
            <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4c-1.1 0-2.1.8-2.4 1.8L.2 13c-.1.4-.2.8-.2 1.2 0 .4.1.8.2 1.2l.8 2.8H4"></path>
            <circle cx="7" cy="18" r="2"></circle><path d="M9 18h4"></path><circle cx="17" cy="18" r="2"></circle>
          </svg>
        </div>
        <div className="flex items-center justify-between mb-4">
          <div className="h-16 w-1/4 bg-gray-200/20 rounded"></div>
          <div className="h-16 w-1/3 bg-gray-200/20 rounded mx-4"></div>
          <div className="h-16 w-1/4 bg-gray-200/20 rounded"></div>
        </div>
        <div className="flex justify-between">
          <div className="h-20 w-3/5 bg-gray-200/20 rounded mr-2"></div>
          <div className="h-20 w-2/5 bg-gray-200/20 rounded"></div>
        </div>
      </div>
    );
  }

  const finalFare = calculateFinalFare();

  return (
    <div className="space-y-4">
      {/* Bus Card */}
      <div
        className="rounded-lg shadow-md px-2 py-2 cursor-pointer transition-colors"
        style={{
          backgroundColor: 'var(--color-primary)',
          color: 'var(--color-text-off-white)',
        }}
        onClick={handleCardClick}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-secondary)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-primary)')}
      >
        <div className="flex items-stretch w-full mt-2">
          {/* LEFT: Start Details + Recommended Seats */}
          <div className="w-1/3 flex flex-col items-start justify-start">
            <div className="text-left mb-2">
              <p className="text-sm font-bold">{convertToIST(bus.startTime).time}</p>
              <p className="text-sm font-bold">{bus.from}</p>
              {bus.recommended_boarding_points && (
                <div className="text-xs">
                  {bus.recommended_boarding_points.map((point, idx) => (
                    <span key={idx}>
                      {point.name}
                      {idx < (bus.recommended_boarding_points?.length ?? 0) - 1 ? ', ' : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            <div className="text-xs">
              <div className='font-bold'><p>Recommended Seats:</p></div>
              <div className="mt-1 grid grid-cols-3 gap-1">
                {allSeats?.map((seat, index) => (
                  <div
                    key={index}
                    className={`text-[10px] sm:text-xs rounded-md px-1 py-0.5 text-gray-900 flex items-center justify-center ${getSeatBackgroundColor(bus, seat)}`}
                  >
                    {`${seat.seat_number}(${seat.type === 'window' ? 'W' : 'A'})`}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CENTER: Clock/Duration + Category Tag */}
          <div className="w-1/3 flex flex-col items-center justify-center">
            <div className="flex flex-col items-center mb-2 w-full">
              <div className="flex items-center w-full">
                <div className="flex-1 h-[1.5px] bg-[#fbe822]" />
                <span className="mx-2 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#fbe822]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                    <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l2 2" />
                  </svg>
                </span>
                <div className="flex-1 h-[1.5px] bg-[#fbe822]" />
              </div>
              <div className="flex justify-center mt-1">
                <p className="text-sm font-semibold text-[#fbe822]">{bus.duration}</p>
              </div>
            </div>
            
           <div
              className={`px-2 py-1 mt-3 rounded-lg font-bold text-[10px] sm:text-xs shadow ${categoryStyle.textColor}`}
              style={{
                background: categoryStyle.background,
                boxShadow: '0 2px 8px 0 rgba(255, 215, 0, 0.2)',
              }}
            >
              {bus.category}
            </div>
          </div>

          {/* RIGHT: End Details + Fare Details */}
          <div className="w-1/3 flex flex-col items-end justify-start">
            <div className="text-right mb-2">
              <p className="text-sm font-bold">{convertToIST(bus.endTime).time}</p>
              <p className="text-sm font-bold">{bus.to}</p>
              {bus.recommended_dropping_points && (
                <div className="text-xs">
                  {bus.recommended_dropping_points.map((point, idx) => (
                    <span key={idx}>
                      {point.name} {idx < (bus.recommended_dropping_points?.length ?? 0) - 1 ? ', ' : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            <div className="text-sm">
              <div className='font-bold'>Total Fare:</div>
              <div>
                <span className='font-bold'>₹{originalFare.baseFare.toFixed(0)}{' '}</span>
                <span> + GST</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal for Trip Review */}
      {isModalOpen && ReactDOM.createPortal(
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-90" 
          style={{ 
            margin: 0, 
            padding: 0,
            opacity: isModalVisible ? 1 : 0,
            transition: "opacity 0.3s ease-in-out"
          }}
          onClick={handleModalClose}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-11/12 max-w-md"
            style={{
              transform: isModalVisible ? "scale(1) translateY(0)" : "scale(0.95) translateY(20px)",
              opacity: isModalVisible ? 1 : 0,
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Journey Details */}
            <div className="bg-[#0078d4] text-white rounded-t-lg p-3">
              <div className="text-center mb-2 flex items-center justify-center">
                <h4 className="font-semibold text-xs">Trip Review - </h4>
                <div className={`ml-2 px-1.5 py-0.5 rounded-lg text-[10px] font-bold ${categoryStyle.textColor}`}
                     style={{ background: categoryStyle.background }}>
                  {bus.category}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-left">
                  <p className="text-xs font-semibold">{convertToIST(bus.startTime).date}</p>
                  <p className="text-xs">{bus.from}</p>
                </div>

                <div className="flex flex-col items-center mx-4 w-32">
                  <div className="flex items-center w-full">
                    <div className="flex-1 h-[1.5px] bg-[#fbe822]" />
                    <span className="mx-2 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#fbe822]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                        <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l2 2" />
                      </svg>
                    </span>
                    <div className="flex-1 h-[1.5px] bg-[#fbe822]" />
                  </div>
                  <div className="flex justify-center mt-1">
                    <p className="text-xs font-semibold text-[#fbe822]">{bus.duration}</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-xs font-semibold">{convertToIST(bus.endTime).date}</p>
                  <p className="text-xs">{bus.to}</p>
                 
                </div>
              </div>

              <div className="flex items-center justify-between mt-2">
                {/* Boarding Point */}
                <div className="w-1/2 pr-2 relative">
                  <button
                    onClick={() => setDropdownOpen(prev => ({ boarding: !prev.boarding, dropping: false }))}
                    className={`w-full flex items-center justify-between text-[10px] ${
                      theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'
                    } p-1 rounded transition-colors`}
                  >
                    <span className="font-medium text-gray-700 dark:text-gray-300 flex-1 flex justify-between items-center">
                      {selectedBoarding ? (
                        <>
                          <span className="truncate">{selectedBoarding}</span>
                          <span className="text-[9px] text-gray-500 dark:text-gray-400 ml-2 flex-shrink-0">
                            {bus.allBoardingPoints.find(bp => bp.boarding_point.name === selectedBoarding) && 
                             convertToIST(bus.allBoardingPoints.find(bp => bp.boarding_point.name === selectedBoarding)!.currentTime).time}
                          </span>
                        </>
                      ) : (
                        'Select Boarding Point & Time'
                      )}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 ml-2">▼</span>
                  </button>
                  
                  {dropdownOpen.boarding && (
                    <div
                      className={`absolute z-10 mt-0.5 space-y-1 border rounded-lg p-1 custom-scrollbar ${
                        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
                      }`}
                      style={{ maxHeight: '150px', overflowY: 'auto', width: '100%' }}
                    >
                      {bus.allBoardingPoints.map((point) => {
                        const { time } = convertToIST(point.currentTime);
                        const isSelected = selectedBoarding === point.boarding_point.name;
                        return (
                          <button
                            key={point.boarding_point_id}
                            className={`dropdown-item w-full p-1 text-left rounded gap-1 text-[10px] ${
                              isSelected
                                ? 'bg-[var(--color-primary)] text-white'
                                : 'hover:bg-[var(--color-secondary)] hover:text-white'
                            }`}
                            onClick={() => {
                              setSelectedBoarding(point.boarding_point.name);
                              setDropdownOpen(prev => ({ ...prev, boarding: false }));
                            }}
                          >
                            <p className="font-medium">{point.boarding_point.name}</p>
                            <p className="text-[9px] text-gray-300">
                              {time} - {point.boarding_point.landmark}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Dropping Point */}
                <div className="w-1/2 pl-2 relative">
                  <button
                    onClick={() => setDropdownOpen(prev => ({ dropping: !prev.dropping, boarding: false }))}
                    className={`w-full flex items-center justify-between text-[10px] ${
                      theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'
                    } p-1 rounded transition-colors`}
                  >
                    <span className="font-medium text-gray-700 dark:text-gray-300 flex-1 flex justify-between items-center">
                      {selectedDropping ? (
                        <>
                          <span className="truncate">{selectedDropping}</span>
                          <span className="text-[9px] text-gray-500 dark:text-gray-400 ml-2 flex-shrink-0">
                            {bus.allDroppingPoints.find(dp => dp.dropping_point.name === selectedDropping) && 
                             convertToIST(bus.allDroppingPoints.find(dp => dp.dropping_point.name === selectedDropping)!.currentTime).time}
                          </span>
                        </>
                      ) : (
                        'Select Dropping Point & Time'
                      )}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 ml-2">▼</span>
                  </button>
                  
                  {dropdownOpen.dropping && (
                    <div
                      className={`absolute z-10 mt-0.5 space-y-1 border rounded-lg p-1 custom-scrollbar ${
                        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
                      }`}
                      style={{ maxHeight: '150px', overflowY: 'auto', width: '100%' }}
                    >
                      {bus.allDroppingPoints.map((point) => {
                        const { time } = convertToIST(point.currentTime);
                        const isSelected = selectedDropping === point.dropping_point.name;
                        return (
                          <button
                            key={point.dropping_point_id}
                            className={`dropdown-item w-full p-1 text-left rounded gap-1 text-[10px] ${
                              isSelected
                                ? 'bg-[var(--color-primary)] text-white'
                                : 'hover:bg-[var(--color-secondary)] hover:text-white'
                            }`}
                            onClick={() => {
                              setSelectedDropping(point.dropping_point.name);
                              setDropdownOpen(prev => ({ ...prev, dropping: false }));
                            }}
                          >
                            <p className="font-medium">{point.dropping_point.name}</p>
                            <p className="text-[9px] text-gray-300">
                              {time} - {point.dropping_point.landmark}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Body: Fare and Passenger Details */}
            <div className="p-3 text-black dark:text-white">
              <div className="flex justify-between">
                {/* Left Side: Seat Details */}
                <div className="flex flex-col h-full"> 
                 <div className="flex items-center justify-between flex-grow">
                    <p className="text-xs"><strong>Recommended Seats:</strong></p>
                  </div>
                  <div className="inline-grid grid-cols-3 gap-1 text-xs">
                    {selectedSeats.map((seat, index) => (
                      <div key={index} className={`text-center rounded-md p-1 text-gray-900 ${getSeatBackgroundColor(bus, seat)}`}>
                        {`${seat.seat_number}(${seat.type === 'window' ? 'W' : 'A'})`}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3">
                    <button
                      onClick={() => setIsSeatLayoutOpen(true)}
                      className="text-[10px] bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded transition-colors w-full"
                    >
                      View Seat Position
                    </button>
                  </div>
                </div>

                {/* Right Side: Fare Details */}
                <div className="space-y-1 w-[40%] text-left ml-4">
                  <div className="flex justify-between text-xs">
                    <strong>Base Fare:</strong>
                    <span>₹{finalFare.baseFare.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <strong>GST:</strong>
                    <span>₹{finalFare.gst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <strong>Discount:</strong>
                    <span>₹{finalFare.discount.toFixed(2)}</span>
                  </div>
                  {finalFare.greenCoinsDiscount > 0 && (
                    <div className="flex justify-between  text-xs">
                      <strong>Green Coins:</strong>
                      <span>-₹{finalFare.greenCoinsDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {finalFare.freshCardDiscount > 0 && (
                    <div className="flex justify-between text-xs">
                      <strong>FreshCard:</strong>
                      <span>-₹{finalFare.freshCardDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-300 my-1"></div>
                  <div className="flex justify-between text-xs font-semibold">
                    <strong>Total Fare:</strong>
                    <span>₹{finalFare.total.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-gray-300 my-1"></div>
                </div>
              </div>

              {/* Green Coins and Fresh Card Section */}
              <div className="flex items-stretch justify-between mt-2 space-x-3">
                {/* Green Coins */}
                <div className="flex flex-col justify-between bg-gray-50 dark:bg-gray-700 rounded-lg px-2 py-2 flex-1 min-h-[3rem]">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center">
                      <p className="text-[10px] font-medium text-gray-700 dark:text-gray-300">
                        Green Coins: <span className="text-xs font-bold text-green-600 ml-1">
                          {greenCoins?.available || 0}
                        </span>
                      </p>
                    </div>
                    {appliedGreenCoins > 0 ? (
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => {
                            setAppliedGreenCoins(0);
                            toast.success('Green coins removed');
                          }}
                          className="text-[10px] px-2 py-0.5 rounded-full transition-colors bg-red-400 hover:bg-red-500 text-white font-bold"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1">
                        <button 
                          onClick={handleRedeemGreenCoins}
                          disabled={!greenCoins || greenCoins.available <= 0}
                          className={`text-[10px] px-2 py-0.5 rounded-full transition-colors font-bold ${
                            greenCoins && greenCoins.available > 0
                              ? 'bg-green-500 hover:bg-green-600 text-white'
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          Apply
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] mt-1 font-bold">
                     'Earn & Save on rides'
                  </div>
                </div>

                {/* Fresh Card */}
                <div className="flex flex-col justify-between bg-gray-50 dark:bg-gray-700 rounded-lg px-2 py-2 flex-1 min-h-[3rem]">
                  <div className="flex justify-between w-full">
                    <div className="text-gray-700 dark:text-gray-300 text-[10px] font-bold">
                      FRESH CARD
                    </div>
                    <button 
                      onClick={handleApplyFreshCard}
                      disabled={!freshCard || !freshCard.available || freshCard.balance <= 0}
                      className={`ml-auto text-[10px] px-2 py-1 rounded transition-colors font-medium ${
                        appliedFreshCard 
                          ? 'bg-red-400 hover:bg-red-500 text-white'
                          : freshCard && freshCard.available && freshCard.balance > 0
                            ? 'bg-yellow-400 hover:bg-yellow-500 text-gray-900'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {appliedFreshCard ? 'Remove' : 'Apply'}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-700 dark:text-gray-300 mt-1 w-full text-left">
                    {freshCard 
                      ? `Balance: ${freshCard.balance} | Save ₹${freshCard.discountAmount}`
                      : 'Save ₹500 On Fresh Bus Rides'
                    }
                  </p>
                </div>
              </div>
              
              {/* Passenger List */}
              <div className=" flex flex-wrap gap-1 mt-1 mb-1 overflow-y-auto custom-scrollbar"
                 style={{ maxHeight: '70px', width: '100%', padding: '4px', borderRadius: '8px' }}>
                {passengerDetails.map((passenger, index) =>
                  passenger.name && passenger.age ? (
                    <div
                      key={index}
                      className="flex h-6 px-2 items-center justify-between rounded-lg text-xs text-gray-800 dark:text-white border border-gray-300 dark:border-gray-700"
                      style={{ background: 'transparent', cursor: 'pointer' }}
                      onClick={() => {
                        setEditingIndex(index);
                        setCurrentPassenger({ ...passenger });
                        setCurrentSeatIndex(index);
                      }}
                    >
                      <span className="flex items-center">
                        <div className={`mr-1 text-black text-[10px] font-medium px-1 rounded ${
                          selectedSeats[index] ? getSeatBackgroundColor(bus, selectedSeats[index]) : 'bg-green-500'
                        }`}>
                          {selectedSeats[index]?.seat_number || 'N/A'}
                          <span className="ml-1">
                            ({selectedSeats[index]?.type === 'window' ? 'W' : 'A'})
                          </span>
                        </div>
                        {passenger.name}
                      </span>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setEditingIndex(index);
                          setCurrentPassenger({ ...passenger });
                          setCurrentSeatIndex(index);
                        }}
                        className="ml-1 text-blue-400 hover:text-blue-600"
                      >
                        ✎
                      </button>
                    </div>
                  ) : null
                )}
              </div>

              {/* Passenger Input Form - Only show if not all passengers filled or if editing */}
              {(!areAllPassengersValid || editingIndex !== null) && (
                <div className="space-y-2 ">
                  <div className="flex items-center space-x-1 sm:space-x-2">
                    {/* Seat display with proper styling based on gender */}
                    {selectedSeats[currentSeatIndex] && (
                      <div className={`text-black text-[10px] font-medium px-1 py-1 rounded flex items-center flex-shrink-0 ${
                        getSeatBackgroundColor(bus, selectedSeats[currentSeatIndex])
                      }`}>
                        <span>
                          {selectedSeats[currentSeatIndex].seat_number}
                        </span>
                        <span className="ml-1 hidden sm:inline">
                          ({selectedSeats[currentSeatIndex].type === 'window' ? 'W' : 'A'})
                        </span>
                      </div>
                    )}
                    
                    <input
                      type="text"
                      value={currentPassenger.name || ''}
                      onChange={(e) => {
                        // Only allow letters and spaces
                        const value = e.target.value.replace(/[^a-zA-Z\s]/g, '');
                        setCurrentPassenger({ ...currentPassenger, name: value });
                      }}
                      placeholder="Name"
                      className={`flex-1 min-w-0 p-1 border rounded text-[10px] sm:text-xs ${theme === 'dark' ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700'}`}
                    />
                    
                    <input
                      type="number"
                      value={currentPassenger.age ?? ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Only allow numbers between 1 and 120
                        const numValue = parseInt(value);
                        if (value === '' || (numValue >= 1 && numValue <= 120)) {
                          setCurrentPassenger({
                            ...currentPassenger,
                            age: value === '' ? undefined : numValue,
                          });
                        }
                      }}
                      placeholder="Age"
                      min="1"
                      max="120"
                      className={`w-10 sm:w-12 p-1 border rounded text-[10px] sm:text-xs appearance-none ${theme === 'dark' ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700'}`}
                      style={{ MozAppearance: 'textfield' }}
                      onWheel={e => (e.target as HTMLInputElement).blur()}
                    />
                    
                    <select
                      value={currentPassenger.gender}
                      onChange={(e) => setCurrentPassenger({ ...currentPassenger, gender: e.target.value })}
                      className={`w-12 sm:w-16 p-1 border rounded text-[10px] sm:text-xs ${theme === 'dark' ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700'}`}
                    >
                      <option value="" disabled>Gender</option>
                      <option value="Male">M</option>
                      <option value="Female">F</option>
                    </select>
                    
                    {/* Yellow circular + button */}
                    <button
                      onClick={handleAddOrUpdatePassenger}
                      className="w-5 h-5 sm:w-6 sm:h-6 bg-[#fbe822] hover:bg-[#f2d800] text-gray-900 font-bold rounded-full text-xs sm:text-sm flex items-center justify-center shadow-sm transition-colors flex-shrink-0"
                      title={editingIndex !== null ? "Update Passenger" : "Add Passenger"}
                      style={{ lineHeight: '1' }}
                    >
                      +
                    </button>
                  </div>
                  
                  {/* Passenger suggestions */}
                  {renderPassengerSuggestions()}
                </div>
              )}

              {/* Show a message when all passengers are added */}
              {areAllPassengersValid && !editingIndex && (
                <div className="mt-3 text-center">
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                    ✓ All passenger details completed
                  </p>
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="flex justify-between mt-3">
                <button
                  onClick={handleModalClose}
                  className="py-1 px-3 rounded-lg font-medium text-xs transition-colors bg-gray-300 text-gray-800 hover:bg-gray-400"
                >
                  Close
                </button>
                <button
                  onClick={handleConfirmPayment}
                  disabled={isProcessing || !areAllPassengersValid}
                  className={`py-1 px-3 rounded-lg font-medium text-xs transition-colors ${
                    isProcessing || !areAllPassengersValid
                      ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isProcessing ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Seat Layout Modal */}
      {isSeatLayoutOpen && ReactDOM.createPortal(
        <SeatLayout
          bus={bus}
          selectedSeats={selectedSeats}
          onSeatSelect={setSelectedSeats}
          onClose={() => setIsSeatLayoutOpen(false)}
        />,
        document.body
      )}
    </div>
  );
};

export default BusCard;