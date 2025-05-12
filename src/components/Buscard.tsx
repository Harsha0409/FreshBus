import React, { useState } from 'react';
import { Bus, Seat } from '../types';
import { useTheme } from '../context/ThemeContext';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface BusCardProps {
  bus: Bus;
  onBook: (busId: number) => void;
}

const BusCard: React.FC<BusCardProps> = ({ bus }) => {
  const { theme } = useTheme();
  const [selectedBoarding, setSelectedBoarding] = useState<string | null>(bus.allBoardingPoints[0]?.boarding_point.name || null);
  const [selectedDropping, setSelectedDropping] = useState<string | null>(bus.allDroppingPoints[0]?.dropping_point.name || null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]); // State to store selected seats
  const [passengerDetails, setPassengerDetails] = useState([
    { name: '', age: null, gender: 'Male' }, // Default to one passenger
  ]);
 
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
  const handlePassengerChange = (index: number, field: string, value: string | number | null) => {
    setPassengerDetails((prevDetails) =>
      prevDetails.map((detail, i) =>
        i === index ? { ...detail, [field]: value } : detail
      )
    );
  };
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
      {/* Render Seats for the Trip */}
      <div
        className="rounded-lg shadow-md p-4 cursor-pointer"
        style={{
          backgroundColor: 'var(--color-primary)', // Always use the primary blue color
          color: 'var(--color-text-off-white)', // Text color remains dynamic
        }}
        onClick={handleCardClick} // Open modal on card click
      >
        {/* Seats Section */}
        <div className="text-sm font-medium">
          <strong>Seats:</strong>{' '}
          {allSeats
            ?.map(
              (seat: Seat) =>
                `${seat.seat_number}(${seat.type === 'window' ? 'W' : 'A'})`
            )
            .join(' ')}
        </div>
        <div className="text-sm font-medium mt-2">
  <strong>Total Base Fare:</strong> ₹
  {allSeats.length > 0
    ? allSeats.reduce((total, seat) => total + (seat.fare_details?.['Base Fare'] || 0), 0).toFixed(2)
    : '0.00'}
</div>

        {/* Boarding and Dropping Points */}
        <div className="mt-2">
          <p className="text-xs">
            <strong>Boarding:</strong> {bus.allBoardingPoints[0]?.boarding_point.name} at{' '}
            {convertToIST(bus.allBoardingPoints[0]?.currentTime).time}
          </p>
          <p className="text-xs">
            <strong>Dropping:</strong> {bus.allDroppingPoints[0]?.dropping_point.name} at{' '}
            {convertToIST(bus.allDroppingPoints[0]?.currentTime).time}
          </p>
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
                <div className="flex flex-col items-center mx-4">
                  <div className="w-full h-[1px] bg-gray-200 mb-1"></div>
                  <p className="text-sm font-semibold">Duration: {bus.duration}</p>
                  <div className="w-full h-[1px] bg-gray-200 mt-1"></div>
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
                <div className="w-1/2 pr-2">
                  <button
                    onClick={() =>
                      setDropdownOpen((prev) => ({ ...prev, boarding: !prev.boarding }))
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
                      className={`absolute z-10 mt-0.5 w-auto space-y-1 border rounded-lg p-1 custom-scrollbar ${theme === 'dark'
                        ? 'bg-gray-800 border-gray-700'
                        : 'bg-gray-50 border-gray-200'
                        }`}
                      style={{
                        maxHeight: '150px',
                        overflowY: 'auto',
                      }}
                    >
                      {bus.allBoardingPoints.map((point) => {
                        const { date, time } = convertToIST(point.currentTime);
                        return (
                          <button
                            key={point.boarding_point_id}
                            className="dropdown-item w-full p-1 text-left rounded gap-1 text-xs"
                            onClick={() => {
                              setSelectedBoarding(point.boarding_point.name);
                              setDropdownOpen((prev) => ({ ...prev, boarding: false }));
                            }}
                          >
                            <p className="text-[10px] text-gray-500">{date}</p>
                            <p className="font-medium">{point.boarding_point.name}</p>
                            <p className="text-[10px] text-gray-500">
                              {time} - {point.boarding_point.landmark}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Dropping Point */}
                <div className="w-1/2 pl-2">
                  <button
                    onClick={() =>
                      setDropdownOpen((prev) => ({ ...prev, dropping: !prev.dropping }))
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
                      className={`absolute z-10 mt-0.5 w-auto space-y-1 border rounded-lg p-1 custom-scrollbar ${theme === 'dark'
                        ? 'bg-gray-800 border-gray-700'
                        : 'bg-gray-50 border-gray-200'
                        }`}
                      style={{
                        maxHeight: '150px',
                        overflowY: 'auto',
                        width: '100%',
                        // left: '0',
                        // right: '0',

                      }}
                    >
                      {bus.allDroppingPoints.map((point) => {
                        const { date, time } = convertToIST(point.currentTime);
                        return (
                          <button
                            key={point.dropping_point_id}
                            className="dropdown-item w-full p-1 text-left rounded gap-1 text-xs"
                            onClick={() => {
                              setSelectedDropping(point.dropping_point.name);
                              setDropdownOpen((prev) => ({ ...prev, dropping: false }));
                            }}
                          >
                            <p className="text-[10px] text-gray-500">{date}</p>
                            <p className="font-medium">{point.dropping_point.name}</p>
                            <p className="text-[10px] text-gray-500">
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
                    <strong>Seat Number:</strong>
                  </p>
                  <p className="text-sm">
                    {selectedSeats
                      ?.map((seat) => `${seat.seat_number}(${seat.type === 'window' ? 'W' : 'A'})`)
                      .join(', ')}
                  </p>
                </div>

                {/* Right Side: Fare Details */}
                <div className="space-y-1 text-right">
                  <p className="text-sm">
                    <strong>Base Fare:</strong> ₹
                    {selectedSeats.reduce((total, seat) => total + (seat.fare_details?.['Base Fare'] || 0), 0)}
                  </p>
                  <p className="text-sm">
                    <strong>GST:</strong> ₹
                    {selectedSeats.reduce((total, seat) => total + (seat.fare_details?.GST || 0), 0)}
                  </p>
                  <p className="text-sm">
                    <strong>Discount:</strong> ₹
                    {selectedSeats.reduce((total, seat) => total + (seat.fare_details?.Discount || 0), 0)}
                  </p>
                  <p className="text-sm font-semibold">
                    <strong>Total Fare:</strong> ₹
                    {selectedSeats
                      .reduce(
                        (total, seat) =>
                          total +
                          (seat.fare_details?.['Base Fare'] || 0) +
                          (seat.fare_details?.GST || 0) +
                          (seat.fare_details?.Discount || 0),
                        0
                      )
                      .toFixed(2)}
                  </p>
                </div>
              </div>

{/* Passenger Details */}
<div className="space-y-2 mt-4">
  {passengerDetails.map((passenger, index) => (
    <div key={index} className="flex items-center space-x-2">
      {/* Name Input */}
      <input
        type="text"
        name={`passenger_name_${index}`}
        value={passenger.name || ''} // Bind to specific passenger's name
        onChange={(e) => handlePassengerChange(index, 'name', e.target.value)} // Update specific passenger's name
        placeholder="Name" 
        className={`w-1/3 p-1 border rounded text-sm ${
          theme === 'dark' ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700'
        }`}
      />

      {/* Age Input */}
      <input
        type="number"
        name={`passenger_age_${index}`}
        value={passenger.age || ''} // Bind to specific passenger's age
        onChange={(e) => handlePassengerChange(index, 'age', Number(e.target.value))} // Update specific passenger's age
        placeholder="Age" 
        className={`w-1/3 p-1 border rounded text-sm ${
          theme === 'dark' ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700'
        }`}
      />

      {/* Gender Selection */}
      <select
        name={`passenger_gender_${index}`}
        value={passenger.gender || 'Male'} // Default to "Male"
        onChange={(e) => handlePassengerChange(index, 'gender', e.target.value)} // Update specific passenger's gender
        className={`w-1/3 p-1 border rounded text-sm ${
          theme === 'dark' ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700'
        }`}
      >
        <option value="Male">Male</option>
        <option value="Female">Female</option>
      </select>
    </div>
  ))}

  {/* Add Passenger Button */}
  <div className="flex justify-end mt-2">
    <button
      onClick={() => {
        if (passengerDetails.length < selectedSeats.length) {
          setPassengerDetails((prevDetails) => [
            ...prevDetails,
            { name: '', age: null, gender: 'Male' }, // Add a new passenger with default values
          ]);
        } else {
          toast.error('Passenger details cannot exceed the number of selected seats.');
        }
      }}
      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
    >
      + Add Passenger
    </button>
  </div>
</div>              {/* Buttons */}
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