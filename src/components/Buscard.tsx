import React, { useState, useEffect } from 'react';
import { Bus, Seat } from '../types';
import { useTheme } from '../context/ThemeContext';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface BusCardProps {
  bus: Bus;
  onBook: (busId: number) => void;
}

const BusCard: React.FC<BusCardProps> = ({ bus }) => {
  interface Passenger {
    name: string;
    age: number | undefined; // Allow age to be either a number or undefined
    gender: string;
  }
  const { theme } = useTheme();
  const [selectedBoarding, setSelectedBoarding] = useState<string | null>(bus.allBoardingPoints[0]?.boarding_point.name || null);
  const [selectedDropping, setSelectedDropping] = useState<string | null>(bus.allDroppingPoints[0]?.dropping_point.name || null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]); // State to store selected seats

  const [passengerDetails, setPassengerDetails] = useState<Passenger[]>([
    { name: '', age: undefined, gender: 'Male' }, // Default to one passenger
  ]);

  const [currentPassenger, setCurrentPassenger] = useState<Passenger>({
    name: '',
    age: undefined,
    gender: 'Male',
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  useEffect(() => {
    if (editingIndex !== null) {
      const passengerToEdit = passengerDetails[editingIndex];
      setCurrentPassenger({
        name: passengerToEdit.name,
        age: passengerToEdit.age,
        gender: passengerToEdit.gender,
      });
    }
  }, [editingIndex, passengerDetails]);


  const [dropdownOpen, setDropdownOpen] = useState<{ boarding: boolean; dropping: boolean }>({
    boarding: false,
    dropping: false,
  });
  const [isModalOpen, setIsModalOpen] = useState(false); // Track modal visibility
  const handleCardClick = () => {
    setSelectedSeats(allSeats); // Set all seats from the card to the modal
    setIsModalOpen(true); // Open the modal
  };

  const convertToIST = (utcTime: string): { date: string; time: string } => {
    const date = new Date(utcTime);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(date.getTime() + istOffset);
    const formattedDate = istDate.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const formattedTime = istDate.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return { date: formattedDate, time: formattedTime };
  };

  const allSeats: Seat[] = [
    ...(bus.recommended_seats?.Premium?.window || []).map((seat) => ({
      ...seat,
      type: 'window',
    })),
    ...(bus.recommended_seats?.Premium?.aisle || []).map((seat) => ({
      ...seat,
      type: 'aisle',
    })),
    ...(bus.recommended_seats?.Reasonable?.window || []).map((seat) => ({
      ...seat,
      type: 'window',
    })),
    ...(bus.recommended_seats?.Reasonable?.aisle || []).map((seat) => ({
      ...seat,
      type: 'aisle',
    })),
    ...(bus.recommended_seats['Budget-Friendly']?.window || []).map((seat) => ({
      ...seat,
      type: 'window',
    })),
    ...(bus.recommended_seats['Budget-Friendly']?.aisle || []).map((seat) => ({
      ...seat,
      type: 'aisle',
    })),
  ];
  // Removed unused handlePassengerChange function
  const handleConfirmPayment = async () => {
    // Ensure all passenger details are filled
    if (passengerDetails.some((passenger) => !passenger.name || !passenger.age || !passenger.gender)) {
      toast.error('Please fill in all passenger details.');
      return;
    }

    if (!selectedBoarding || !selectedDropping) {
      toast.error('Please complete all selections before confirming payment.');
      return;
    }

    // Calculate total fare for all selected seats
    const totalFare = selectedSeats.reduce(
      (total, seat) =>
        total +
        (seat.fare_details?.['Base Fare'] || 0) +
        (seat.fare_details?.GST || 0) +
        (seat.fare_details?.Discount || 0),
      0
    );

    // Prepare the payload
    const payload = {
      mobile: localStorage.getItem('user_mobile') || '', // Use the logged-in user's mobile number
      email: '', // Add email if required
      seat_map: passengerDetails.map((passenger, index) => ({
        passenger_age: passenger.age,
        seat_id: selectedSeats[index].seat_id,
        passenger_name: passenger.name,
        gender: passenger.gender,
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

    console.log('Payload:', payload); // Log the payload for debugging

    try {
      setIsProcessing(true);
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

      const sandboxUrl = data.payment_url;
      if (!sandboxUrl) {
        throw new Error('Payment URL not found in server response. Please try again.');
      }

      toast.success('Redirecting to payment portal...');
      window.open(sandboxUrl, '_blank');
    } catch (error: any) {
      toast.error(error.message || 'An error occurred during payment.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className="rounded-lg shadow-md p-4 cursor-pointer transition-colors"
        style={{
          backgroundColor: 'var(--color-primary)',
          color: 'var(--color-text-off-white)',
        }}
        onClick={handleCardClick} // Open modal on card click
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-secondary)')} // Change background on hover
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-primary)')} // Revert background on mouse leave
      >


        {/* Second Part: Trip Start, Duration, and End Details */}
        <div className="flex items-center justify-between">
          {/* Start Details */}
          <div className="text-left">
<p className="text-sm font-bold">{convertToIST(bus.startTime).time}</p>
<p className="text-sm font-bold">{bus.from}</p>
            <p className="text-xs">
              {bus.allBoardingPoints[0]?.boarding_point.name}
            </p>
          </div>

          {/* Duration */}
          <div className="flex flex-col items-center mx-4 w-32">
            <div className="flex items-center w-full">
              <div className="flex-1 h-[1.5px] bg-[#fbe822]" />
              <span className="mx-2 flex items-center justify-center">
                {/* Clock Icon (Heroicons or any SVG) */}
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

          {/* End Details */}
          <div className="text-right">
            <p className="text-sm font-bold">{convertToIST(bus.endTime).time}</p>
            <p className="text-sm font-bold">{bus.to}</p>
            <p className="text-xs">
              {bus.allDroppingPoints[0]?.dropping_point.name}
            </p>
          </div>
        </div>


        <div className="flex flex-row justify-between mt-2">
          <div className="text-xs font-medium">
            {/* Recommended Seats Heading */}
            <div className='font-bold'>
              <p>Recommended Seats:</p>
            </div>

            {/* Seat Numbers */}
            <div className="mt-1 grid grid-cols-3 gap-1">
              {allSeats?.map((seat: Seat, index) => (
                <div
                  key={index}
                  className="text-xs bg-[#fbe822] rounded-md px-2 py-1 text-gray-900 flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(251, 232, 34)' }} // fallback for /30
                >
                  {`${seat.seat_number}(${seat.type === 'window' ? 'W' : 'A'})`}
                </div>
              ))}
            </div>
          </div>



          <div className="text-sm font-bold">
            {/* Total Base Fare Heading */}
            <div>
              <strong>Total Base Fare:</strong>
            </div>

            {/* Total Price with GST */}
            <div>
              ₹
              {allSeats.length > 0
                ? allSeats.reduce((total, seat) => total + (seat.fare_details?.['Base Fare'] || 0), 0).toFixed(0)
                : '0.00'}{' '}
              /- + GST
            </div>
          </div>
        </div>

      </div>


      {/* Modal for Trip Review */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90"
          style={{ margin: 0, padding: 0 }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-11/12 max-w-md">
            {/* Header: Journey Details */}
            <div className="bg-[#0078d4] text-white rounded-t-lg p-4">
              {/* First Part: Heading */}
              <div className="text-center mb-2">
                <h4 className="font-semibold text-sm">Trip Review</h4>
              </div>

              {/* Second Part: Trip Start, Duration, and End Details */}
              <div className="flex items-center justify-between">
                {/* Start Details */}
                <div className="text-left">
                  <p className="text-sm font-semibold">{convertToIST(bus.startTime).date}</p>
                  <p className="text-sm">{bus.from}</p>
                  <p className="text-sm">{convertToIST(bus.startTime).time}</p>
                </div>

                {/* Duration */}
                <div className="flex flex-col items-center mx-4 w-32">
                  <div className="flex items-center w-full">
                    <div className="flex-1 h-[1.5px] bg-[#fbe822]" />
                    <span className="mx-2 flex items-center justify-center">
                      {/* Clock Icon (Heroicons or any SVG) */}
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

                {/* End Details */}
                <div className="text-right">
                  <p className="text-sm font-semibold">{convertToIST(bus.endTime).date}</p>
                  <p className="text-sm">{bus.to}</p>
                  <p className="text-sm">{convertToIST(bus.endTime).time}</p>
                </div>
              </div>

              {/* Third Part: Boarding and Dropping Points */}
              <div className="flex items-center justify-between mt-2">
                {/* Boarding Point */}
                <div className="w-1/2 pr-2 relative">
                  <button
                    onClick={() =>
                      setDropdownOpen((prev) => ({
                        boarding: !prev.boarding,
                        dropping: false, // Close the dropping dropdown when boarding is opened
                      }))
                    }
                    className={`w-full flex items-center justify-between text-xs ${theme === 'dark'
                      ? 'bg-gray-800 hover:bg-gray-700'
                      : 'bg-gray-50 hover:bg-gray-100'
                      } p-1 rounded transition-colors`}
                  >
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {selectedBoarding || 'Select Boarding Point'}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 ml-2">▼</span>
                  </button>
                  {dropdownOpen.boarding && (
                    <div
                      className={`absolute z-10 mt-0.5 space-y-1 border rounded-lg p-1 custom-scrollbar ${theme === 'dark'
                        ? 'bg-gray-800 border-gray-700'
                        : 'bg-gray-50 border-gray-200'
                        }`}
                      style={{
                        maxHeight: '150px',
                        overflowY: 'auto',
                        width: '100%', // Matches the width of the button
                      }}
                    >
                      {bus.allBoardingPoints.map((point) => {
                        const { time } = convertToIST(point.currentTime);
                        const isSelected = selectedBoarding === point.boarding_point.name;
                        return (
                          <button
                            key={point.boarding_point_id}
                            className={`dropdown-item w-full p-1 text-left rounded gap-1 text-xs ${isSelected
                              ? 'bg-[var(--color-primary)] text-white'
                              : 'hover:bg-[var(--color-secondary)] hover:text-white'
                              }`}
                            onClick={() => {
                              setSelectedBoarding(point.boarding_point.name);
                              setDropdownOpen((prev) => ({ ...prev, boarding: false }));
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
                    onClick={() =>
                      setDropdownOpen((prev) => ({
                        dropping: !prev.dropping,
                        boarding: false, // Close the boarding dropdown when dropping is opened
                      }))
                    }
                    className={`w-full flex items-center justify-between text-xs ${theme === 'dark'
                      ? 'bg-gray-800 hover:bg-gray-700'
                      : 'bg-gray-50 hover:bg-gray-100'
                      } p-1 rounded transition-colors`}
                  >
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {selectedDropping || 'Select Dropping Point'}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 ml-2">▼</span>
                  </button>
                  {dropdownOpen.dropping && (
                    <div
                      className={`absolute z-10 mt-0.5 space-y-1 border rounded-lg p-1 custom-scrollbar ${theme === 'dark'
                        ? 'bg-gray-800 border-gray-700'
                        : 'bg-gray-50 border-gray-200'
                        }`}
                      style={{
                        maxHeight: '150px',
                        overflowY: 'auto',
                        width: '100%', // Matches the width of the button
                      }}
                    >
                      {bus.allDroppingPoints.map((point) => {
                        const { time } = convertToIST(point.currentTime);
                        const isSelected = selectedDropping === point.dropping_point.name;
                        return (
                          <button
                            key={point.dropping_point_id}
                            className={`dropdown-item w-full p-1 text-left rounded gap-1 text-xs ${isSelected
                              ? 'bg-[var(--color-primary)] text-white'
                              : 'hover:bg-[var(--color-secondary)] hover:text-white'
                              }`}
                            onClick={() => {
                              setSelectedDropping(point.dropping_point.name);
                              setDropdownOpen((prev) => ({ ...prev, dropping: false }));
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
                  <p className="text-sm">
                    <strong>Recomended Seats:</strong>
                  </p>
                  <div className="inline-grid grid-cols-3 gap-1 text-sm">
                    {selectedSeats.map((seat, index) => (
                      <div
                        key={index}
                        className="text-center bg-[#fbe822] rounded-md px-2 py-1 text-gray-900"
                      // fallback for /30
                      >
                        {`${seat.seat_number}(${seat.type === 'window' ? 'W' : 'A'})`}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Side: Fare Details */}
                <div className="space-y-1 w-[40%] text-left ml-4">
                  <div className="flex justify-between text-sm">
                    <strong>Base Fare:</strong>
                    <span>₹{selectedSeats.reduce((total, seat) => total + (seat.fare_details?.['Base Fare'] || 0), 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <strong>GST:</strong>
                    <span>₹{selectedSeats.reduce((total, seat) => total + (seat.fare_details?.GST || 0), 0)}</span>
                  </div>
                  <div className="flex justify-between text-green-500 text-sm">
                    <strong>Discount:</strong>
                    <span>₹{selectedSeats.reduce((total, seat) => total + (seat.fare_details?.Discount || 0), 0)}</span>
                  </div>
                  <div className="border-t border-gray-300 my-2"></div>
                  <div className="flex justify-between text-sm font-semibold">
                    <strong>Total Fare:</strong>
                    <span>₹{selectedSeats
                      .reduce(
                        (total, seat) =>
                          total +
                          (seat.fare_details?.['Base Fare'] || 0) +
                          (seat.fare_details?.GST || 0) +
                          (seat.fare_details?.Discount || 0),
                        0
                      )
                      .toFixed(2)}</span>
                  </div>
                  <div className="border-t border-gray-300 my-2"></div>
                </div>
              </div>
              {/* Rectangle Boxes for Names */}
              <div
                className="mt-2 flex flex-wrap bg-gray-600 gap-1 overflow-y-auto custom-scrollbar"
                style={{ height: '60px', width: '410px', padding: '5px', borderRadius: '8px' }}
              >
                {passengerDetails.map((passenger, index) => (
                  passenger.name && passenger.age && passenger.gender ? ( // Render only if all details are entered
                    <div
                      key={index}
                      className="flex h-7 px-2 items-center justify-between rounded-lg text-sm bg-gray-800 text-white"
                    >
                      {/* Name and Seat Number */}
                      <span className="flex items-center">
                        <div className=" mr-1 bg-green-500 text-white text-xs font-medium px-3 rounded">
                          {selectedSeats[index]?.seat_number || 'N/A'}
                        </div>
                        {passenger.name}{' '}
                      </span>

                      {/* Edit Button */}
                      <button
                        onClick={() => {
                          // Populate the placeholders with the details of the passenger being edited
                          const passengerToEdit = passengerDetails[index];
                          setCurrentPassenger({
                            name: passengerToEdit.name,
                            age: passengerToEdit.age,
                            gender: passengerToEdit.gender,
                          });
                          setEditingIndex(index); // Set the index of the passenger being edited
                        }}
                        className="ml-1 text-blue-400 hover:text-blue-600"
                      >
                        ✎
                      </button>
                    </div>
                  ) : null
                ))}
              </div>

              {/* Passenger Details */}
              <div className="space-y-2 mt-4">
                <div className="flex items-center space-x-2">
                  {/* Seat Number Box */}
                  <div className="mr-1 bg-green-500 text-white text-xs font-medium px-1 rounded">
                    {selectedSeats[editingIndex !== null ? editingIndex : passengerDetails.length]?.seat_number || 'N/A'}
                  </div>
                  {/* Name Input */}
                  <input
                    type="text"
                    name="passenger_name"
                    value={currentPassenger.name || ''}
                    onChange={(e) => setCurrentPassenger({ ...currentPassenger, name: e.target.value })}
                    placeholder="Name"
                    className={`w-1/3 p-1 border rounded text-sm ${theme === 'dark' ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700'}`}
                  />
                  {/* Age Input */}
                  <input
                    type="number"
                    name="passenger_age"
                    value={currentPassenger.age ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCurrentPassenger({
                        ...currentPassenger,
                        age: value === '' ? undefined : Number(value),
                      });
                    }}
                    placeholder="Age"
                    className={`w-1/3 p-1 border rounded text-sm ${theme === 'dark' ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700'}`}
                  />
                  {/* Gender Selection */}
                  <select
                    name="passenger_gender"
                    value={currentPassenger.gender}
                    onChange={(e) => setCurrentPassenger({ ...currentPassenger, gender: e.target.value })}
                    className={`w-1/3 p-1 border rounded text-sm ${theme === 'dark' ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700'}`}
                  >
                    <option value="" disabled>
                      Select Gender
                    </option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                {/* Add Passenger Button */}
                <div className="flex justify-end mt-2">
                  {passengerDetails.length < selectedSeats.length && (
                    <button
                      onClick={() => {
                        if (!currentPassenger.name || currentPassenger.age === undefined || !currentPassenger.gender) {
                          toast.error('Please fill in all passenger details.');
                          return;
                        }
                        setPassengerDetails((prevDetails) => {
                          const updatedDetails = [...prevDetails];
                          if (editingIndex !== null) {
                            updatedDetails[editingIndex] = currentPassenger;
                            setEditingIndex(null);
                          } else {
                            updatedDetails.push(currentPassenger);
                          }
                          return updatedDetails;
                        });
                        setCurrentPassenger({ name: '', age: undefined, gender: 'Male' });
                      }}
                      className="text-[#fbe822] hover:text-blue-800 text-sm font-medium"
                    >
                      +{selectedSeats.length - passengerDetails.length} More Passengers
                    </button>
                  )}
                </div>
              </div>
              {/* Buttons */}
              <div className="flex justify-between mt-4">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="py-1 px-4 rounded-lg font-medium text-sm transition-colors bg-gray-300 text-gray-800 hover:bg-gray-400"
                >
                  Close
                </button>
                <button
                  onClick={handleConfirmPayment}
                  disabled={isProcessing}
                  className={`py-1 px-4 rounded-lg font-medium text-sm transition-colors ${isProcessing
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