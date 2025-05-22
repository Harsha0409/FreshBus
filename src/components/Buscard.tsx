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
  getSeatGender
} from '../utils/busUtils';

interface BusCardProps {
  bus: BusWithCategory;
  onBook: (busId: number) => void;
}

const BusCard: React.FC<BusCardProps> = ({ bus }) => {
  const { theme } = useTheme();
  // Basic state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);
  
  // Boarding and dropping points
  const [selectedBoarding, setSelectedBoarding] = useState<string | null>(
    bus.allBoardingPoints[0]?.boarding_point.name || null
  );
  const [selectedDropping, setSelectedDropping] = useState<string | null>(
    bus.allDroppingPoints[0]?.dropping_point.name || null
  );
  const [dropdownOpen, setDropdownOpen] = useState({ boarding: false, dropping: false });

  
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
  
  const [passengerDetails, setPassengerDetails] = useState<Passenger[]>([
    getInitialPassenger(0)
  ]);
  
  const [currentPassenger, setCurrentPassenger] = useState<Passenger>(getInitialPassenger(0));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [currentSeatIndex, setCurrentSeatIndex] = useState(0);
  
  // Get styling and fare info
  const categoryStyle = getCategoryStyle(bus.category);
  const categoryFare = calculateCategoryFare(allSeats);

  // Effects
  useEffect(() => {
    const timer = setTimeout(() => setShowSkeleton(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Update current passenger when editing index changes
  useEffect(() => {
    if (editingIndex !== null) {
      setCurrentPassenger({...passengerDetails[editingIndex]});
      setCurrentSeatIndex(editingIndex);
    } else {
      // Get the index of the next passenger to add
      const nextIndex = passengerDetails.filter(p => p.name && p.age).length;
      if (nextIndex < selectedSeats.length) {
        setCurrentSeatIndex(nextIndex);
        // Update gender based on seat assignment for new passenger
        setCurrentPassenger(getInitialPassenger(nextIndex));
      }
    }
  }, [editingIndex, passengerDetails, selectedSeats]);

  // Reset passenger details when modal opens
  useEffect(() => {
    if (isModalOpen && selectedSeats.length > 0) {
      // Keep only valid passengers
      const validPassengers = passengerDetails
        .filter((p, i) => p.name && p.age && i < selectedSeats.length)
        .map((p, i) => ({
          ...p,
          gender: getSeatGender(bus, selectedSeats[i]) === 'female' ? 'Female' : p.gender
        }));
      
      // Fill the rest with empty passengers up to seat count
      const emptyPassengers = Array(selectedSeats.length - validPassengers.length)
        .fill(null)
        .map((_, i) => getInitialPassenger(validPassengers.length + i));
      
      setPassengerDetails([...validPassengers, ...emptyPassengers].slice(0, selectedSeats.length));
      
      // Set current passenger to the first incomplete one
      const firstIncompleteIndex = validPassengers.length;
      if (firstIncompleteIndex < selectedSeats.length) {
        setCurrentSeatIndex(firstIncompleteIndex);
        setCurrentPassenger(getInitialPassenger(firstIncompleteIndex));
      }
    }
  }, [isModalOpen, selectedSeats]);

  // Event handlers
  const handleCardClick = () => {
    setSelectedSeats(allSeats);
    setIsModalOpen(true);
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
    
    // Calculate total fare for all selected seats
    const totalFare = selectedSeats.reduce(
      (total, seat) =>
        total +
        (seat.fare_details?.['Base Fare'] || 0) +
        (seat.fare_details?.GST || 0) +
        (seat.fare_details?.Discount || 0),
      0
    );
    
    // Get the logged-in user's mobile number - FIXED HERE
    let userMobile = '';
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        userMobile = userData.mobile || '';
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }
    
    // Prepare payload according to backend expectations
    const payload = {
      mobile: userMobile, // Now correctly using the mobile from user object
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
      total_collect_amount: totalFare.toFixed(2),
      main_category: 1,
      freshcardId: 1,
      freshcard: false,
      return_url: `${window.location.origin}/payment/callback?session_id=${localStorage.getItem('sessionId')}`,
    };
    
    console.log('Booking payload:', payload);
    
    const response = await fetch('/api/tickets/block', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
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
    window.open(data.payment_url, '_blank');
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

  // Helper function to determine the text for the add passenger button
  const getAddPassengerButtonText = () => {
    const filledPassengers = passengerDetails.filter(p => p.name && p.age !== undefined && p.gender);
    const remainingCount = selectedSeats.length - filledPassengers.length;
    
    if (editingIndex !== null) {
      return 'Update Passenger';
    } 
    
    if (remainingCount === 0) {
      return 'All passengers updated';
    }
    
    if (selectedSeats.length === 1) {
      return 'Add Passenger';
    }
    
    if (remainingCount === 1) {
      return 'Add Passenger';
    }
    
    return `Add Passenger +${remainingCount - 1} more`;
  };

  // Check if all passengers are complete and valid
  const getFilledPassengersCount = () => 
    passengerDetails.filter(p => p.name && p.age !== undefined && p.gender).length;
  
  const areAllPassengersValid = getFilledPassengersCount() === selectedSeats.length;


  // Render skeleton during loading
  if (showSkeleton) {
    return (
      <div className="rounded-lg shadow-md p-4 w-full max-w-md bg-[#0078d4] relative overflow-hidden">
        <style>
          {`
          @keyframes blurPulse {
            0%, 100% { filter: blur(4px); opacity: 0.7; }
            50% { filter: blur(8px); opacity: 0.5; }
          }
          .blur-item {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 6px;
            animation: blurPulse 3s ease-in-out infinite;
          }
          .blur-delay-1 { animation-delay: 0s; }
          .blur-delay-2 { animation-delay: 0.5s; }
          .blur-delay-3 { animation-delay: 1s; }
          
          @keyframes fadeIn {
            0% { opacity: 0; }
            100% { opacity: 1; }
          }
          .bus-icon {
            opacity: 0;
            animation: fadeIn 1s ease-in-out forwards;
            animation-delay: 1s;
          }
        `}
        </style>
        <div className="relative">
          <div className="bus-icon absolute inset-0 flex items-center justify-center opacity-20">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-white">
              <path d="M8 6v6"></path><path d="M15 6v6"></path><path d="M2 12h19.6"></path>
              <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4c-1.1 0-2.1.8-2.4 1.8L.2 13c-.1.4-.2.8-.2 1.2 0 .4.1.8.2 1.2l.8 2.8H4"></path>
              <circle cx="7" cy="18" r="2"></circle><path d="M9 18h4"></path><circle cx="17" cy="18" r="2"></circle>
            </svg>
          </div>
          <div className="flex items-center justify-between mb-4">
            <div className="blur-item blur-delay-1 h-16 w-1/4"></div>
            <div className="blur-item blur-delay-2 h-16 w-1/3 mx-4"></div>
            <div className="blur-item blur-delay-3 h-16 w-1/4"></div>
          </div>
          <div className="flex justify-between">
            <div className="blur-item blur-delay-2 h-20 w-3/5 mr-2"></div>
            <div className="blur-item blur-delay-1 h-20 w-2/5"></div>
          </div>
        </div>
      </div>
    );
  }

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
              className={`px-2 py-1 mt-3 rounded-lg font-bold text-xs shadow ${categoryStyle.textColor}`}
              style={{
                background: categoryStyle.background,
                boxShadow: '0 2px 8px 0 rgba(255, 215, 0, 0.2)',
                border: '1px solid #FFD700',
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
                <span className='font-bold'>₹{categoryFare.baseFare.toFixed(0)}{' '}</span>
                <span> + GST</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal for Trip Review */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90" style={{ margin: 0, padding: 0 }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-11/12 max-w-md">
            {/* Header: Journey Details */}
            <div className="bg-[#0078d4] text-white rounded-t-lg p-4">
              <div className="text-center mb-2 flex items-center justify-center">
                <h4 className="font-semibold text-sm">Trip Review - </h4>
                <div className={`ml-2 px-2 py-0.5 rounded-lg text-xs font-bold ${categoryStyle.textColor}`}
                     style={{ background: categoryStyle.background }}>
                  {bus.category}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-left">
                  <p className="text-sm font-semibold">{convertToIST(bus.startTime).date}</p>
                  <p className="text-sm">{bus.from}</p>
                  <p className="text-sm">{convertToIST(bus.startTime).time}</p>
                </div>

                <div className="flex flex-col items-center mx-4 w-32">
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

                <div className="text-right">
                  <p className="text-sm font-semibold">{convertToIST(bus.endTime).date}</p>
                  <p className="text-sm">{bus.to}</p>
                  <p className="text-sm">{convertToIST(bus.endTime).time}</p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-2">
                {/* Boarding Point */}
                <div className="w-1/2 pr-2 relative">
                  <button
                    onClick={() => setDropdownOpen(prev => ({ boarding: !prev.boarding, dropping: false }))}
                    className={`w-full flex items-center justify-between text-xs ${
                      theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'
                    } p-1 rounded transition-colors`}
                  >
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {selectedBoarding || 'Select Boarding Point'}
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
                            className={`dropdown-item w-full p-1 text-left rounded gap-1 text-xs ${
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
                            <p className="text-[10px] text-gray-300">
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
                    className={`w-full flex items-center justify-between text-xs ${
                      theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'
                    } p-1 rounded transition-colors`}
                  >
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {selectedDropping || 'Select Dropping Point'}
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
                            className={`dropdown-item w-full p-1 text-left rounded gap-1 text-xs ${
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
                            <p className="text-[10px] text-gray-300">
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
            <div className="p-4">
              <div className="flex justify-between">
                {/* Left Side: Seat Details */}
                <div className="space-y-1">
                  <p className="text-sm"><strong>Recommended Seats:</strong></p>
                  <div className="inline-grid grid-cols-3 gap-1 text-sm">
                    {selectedSeats.map((seat, index) => (
                      <div key={index} className={`text-center rounded-md px-2 py-1 text-gray-900 ${getSeatBackgroundColor(bus, seat)}`}>
                        {`${seat.seat_number}(${seat.type === 'window' ? 'W' : 'A'})`}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Side: Fare Details */}
                <div className="space-y-1 w-[40%] text-left ml-4">
                  <div className="flex justify-between text-sm">
                    <strong>Base Fare:</strong>
                    <span>₹{categoryFare.baseFare.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <strong>GST:</strong>
                    <span>₹{categoryFare.gst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-green-500 text-sm">
                    <strong>Discount:</strong>
                    <span>₹{categoryFare.discount.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-gray-300 my-2"></div>
                  <div className="flex justify-between text-sm font-semibold">
                    <strong>Total Fare:</strong>
                    <span>₹{categoryFare.total.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-gray-300 my-2"></div>
                </div>
              </div>
              
              {/* Passenger List */}
              <div className="mt-2 flex flex-wrap gap-1 overflow-y-auto custom-scrollbar"
                   style={{ maxHeight: '80px', width: '100%', padding: '5px', borderRadius: '8px' }}>
                {passengerDetails.map((passenger, index) =>
                  passenger.name && passenger.age ? (
                    <div key={index} className="flex h-7 px-2 items-center justify-between rounded-lg text-sm text-gray-800 dark:text-white border border-gray-300 dark:border-gray-700"
                         style={{ background: 'transparent' }}>
                      <span className="flex items-center">
                        <div className={`mr-1 text-black text-xs font-medium px-1 rounded ${
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
                        onClick={() => setEditingIndex(index)}
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
  <div className="space-y-2 mt-4">
    <div className="flex items-center space-x-2">
      {/* Seat display with proper styling based on gender */}
      {selectedSeats[currentSeatIndex] && (
        <div className={`mr-1 text-black text-xs font-medium px-1 rounded flex items-center ${
          getSeatBackgroundColor(bus, selectedSeats[currentSeatIndex])
        }`}>
          <span>
            {selectedSeats[currentSeatIndex].seat_number}
          </span>
          <span className="ml-1">
            ({selectedSeats[currentSeatIndex].type === 'window' ? 'W' : 'A'})
          </span>
        </div>
      )}
      
      <input
        type="text"
        value={currentPassenger.name || ''}
        onChange={(e) => setCurrentPassenger({ ...currentPassenger, name: e.target.value })}
        placeholder="Name"
        className={`w-1/3 p-1 border rounded text-sm ${theme === 'dark' ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700'}`}
      />
      
      <input
        type="number"
        value={currentPassenger.age ?? ''}
        onChange={(e) => {
          const value = e.target.value;
          setCurrentPassenger({
            ...currentPassenger,
            age: value === '' ? undefined : Number(value),
          });
        }}
        placeholder="Age"
        className={`w-1/3 p-1 border rounded text-sm appearance-none ${theme === 'dark' ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700'}`}
        style={{ MozAppearance: 'textfield' }}
        onWheel={e => (e.target as HTMLInputElement).blur()}
      />
      
      <select
        value={currentPassenger.gender}
        onChange={(e) => setCurrentPassenger({ ...currentPassenger, gender: e.target.value })}
        className={`w-1/3 p-1 border rounded text-sm ${theme === 'dark' ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700'}`}
      >
        <option value="" disabled>Select Gender</option>
        <option value="Male">Male</option>
        <option value="Female">Female</option>
      </select>
    </div>
    
    {/* Add/Update Passenger Button */}
    <div className="flex justify-end mt-2">
      <button
        onClick={handleAddOrUpdatePassenger}
        className="bg-[#fbe822] hover:bg-[#f2d800] text-gray-900 font-medium py-1 px-3 rounded-lg text-sm shadow-sm transition-colors"
      >
        {getAddPassengerButtonText()}
      </button>
    </div>
  </div>
)}

{/* Show a message when all passengers are added */}
{areAllPassengersValid && !editingIndex && (
  <div className="mt-4 text-center">
    <p className="text-sm text-green-600 dark:text-green-400 font-medium">
      ✓ All passenger details completed
    </p>
  </div>
)}
              
              {/* Action Buttons */}
              <div className="flex justify-between mt-4">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="py-1 px-4 rounded-lg font-medium text-sm transition-colors bg-gray-300 text-gray-800 hover:bg-gray-400"
                >
                  Close
                </button>
                <button
                  onClick={handleConfirmPayment}
                  disabled={isProcessing || !areAllPassengersValid}
                  className={`py-1 px-4 rounded-lg font-medium text-sm transition-colors ${
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
        </div>
      )}
    </div>
  );
};

export default BusCard;