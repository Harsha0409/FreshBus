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
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null); // Track the selected seat ID
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [selectedBoarding, setSelectedBoarding] = useState<string | null>(bus.allBoardingPoints[0]?.boarding_point.name || null);
  const [selectedDropping, setSelectedDropping] = useState<string | null>(bus.allDroppingPoints[0]?.dropping_point.name || null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [userName, setUserName] = useState('');
  const [passengerAge, setPassengerAge] = useState<number | null>(null); // State for passenger age
  const [gender, setGender] = useState<string>('Male'); // State for gender

  const [userPhone, setUserPhone] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState<{ boarding: boolean; dropping: boolean }>({
    boarding: false,
    dropping: false,
  });
  const [isModalOpen, setIsModalOpen] = useState(false); // Track modal visibility

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

  const getCategoryTagStyle = (category: string) => {
    switch (category) {
      case 'Premium':
        return 'bg-[#6B21A8] text-white'; // Darker purple
      case 'Reasonable':
        return 'bg-[#1E40AF] text-white'; // Darker blue
      case 'Budget-Friendly':
        return 'bg-[#065F46] text-white'; // Darker emerald
      default:
        return 'bg-gray-700 text-white'; // Darker gray for default
    }
  };

  const handleConfirmPayment = async () => {
    if (!userName  || !userPhone) {
      toast.error('Please fill in all the required fields.');
      return;
    }

    if (!selectedSeat || !selectedBoarding || !selectedDropping) {
      toast.error('Please complete all selections before confirming payment.');
      return;
    }

    const totalFare =
      (selectedSeat?.fare_details?.['Base Fare'] || 0) +
      (selectedSeat?.fare_details?.GST || 0) +
      (selectedSeat?.fare_details?.Discount || 0);

    const payload = {
      mobile: userPhone,
      email: '',
      seat_map: [
        {
          passenger_age: passengerAge,
          seat_id: selectedSeat.seat_id,
          passenger_name: userName,
          gender: gender,
        },
      ],
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
      {(['Premium', 'Reasonable', 'Budget-Friendly'] as Array<keyof typeof bus.recommended_seats>).map((category) =>
        (bus.recommended_seats?.[category]?.window || [])
          .concat(bus.recommended_seats?.[category]?.aisle || [])
          .map((seat: Seat) => (
            <div
              key={seat.seat_id}
              onClick={() => {
                setSelectedSeat(seat);
                setSelectedSeatId(seat.seat_id.toString());
                setIsModalOpen(true); // Open the modal
              }}
              className={`rounded-lg shadow-md h-fit transition-all hover:shadow-lg cursor-pointer ${
                selectedSeatId === seat.seat_id.toString()
                  ? 'bg-[#0056b3] text-[#f8f9fa]'
                  : 'bg-[#0078d4] text-[#f8f9fa] hover:bg-[#0056b3]'
              }`}
            >
<div className="p-2">
  <div className="mt-1 flex items-center justify-between">
    <div className="flex items-center">
      <p className="text-xs font-medium">
        Seat: {seat.seat_number} ({seat.type === 'window' ? 'W' : 'A'}) - ₹{seat.price}
      </p>
    </div>
    <span
      className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getCategoryTagStyle(category)}`}
    >
      {category}
    </span>
  </div>
  <p className="text-xs mt-1">
    <strong>Boarding:</strong> {bus.allBoardingPoints[0]?.boarding_point.name} at{' '}
    {convertToIST(bus.allBoardingPoints[0]?.currentTime).time}
  </p>
  <p className="text-xs">
    <strong>Dropping:</strong> {bus.allDroppingPoints[0]?.dropping_point.name} at{' '}
    {convertToIST(bus.allDroppingPoints[0]?.currentTime).time}
  </p>
</div>
            </div>
          ))
      )}
{/* Modal for Trip Review */}
{isModalOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-11/12 max-w-md">
      {/* Header: Journey Details */}
      <div className="bg-[#0078d4] text-white rounded-t-lg">
        <div className="text-center py-2">
          <h4 className="font-semibold text-sm">Trip Review</h4>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            {/* Start Details */}
            <div className="text-left">
              <p className="text-sm font-semibold">{convertToIST(bus.startTime).date}</p>
              <p className="text-sm">{bus.from}</p>
              <p className="text-sm">{convertToIST(bus.startTime).time}</p>
              <div className="mt-2">
                {/* Dropdown for Boarding Points */}
                <div className="mb-2 relative">
                  <button
                    onClick={() =>
                      setDropdownOpen((prev) => ({ ...prev, boarding: !prev.boarding }))
                    }
                    className={`w-full flex items-center justify-between text-xs ${
                      theme === 'dark'
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
                      className={`absolute z-10 mt-0.5 w-auto space-y-1 border rounded-lg p-1 custom-scrollbar ${
                        theme === 'dark'
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
              </div>
            </div>

            {/* Horizontal Line with Duration */}
            <div className="flex flex-col items-center mx-4">
              <div className="w-full h-[1px] bg-gray-400 mb-2"></div>
              <p className="text-sm text-gray-200">
              Duration: {bus.duration}
              </p>
              <div className="w-full h-[1px] bg-gray-400 mt-2"></div>
            </div>

            {/* End Details */}
            <div className="text-right">
              <p className="text-sm font-semibold">{convertToIST(bus.endTime).date}</p>
              <p className="text-sm">{bus.to}</p>
              <p className="text-sm">{convertToIST(bus.endTime).time}</p>
              <div className="mt-2">
                {/* Dropdown for Dropping Points */}
                <div className="mb-2 relative">
                  <button
                    onClick={() =>
                      setDropdownOpen((prev) => ({ ...prev, dropping: !prev.dropping }))
                    }
                    className={`w-full flex items-center justify-between text-xs ${
                      theme === 'dark'
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
                      className={`absolute z-10 mt-0.5 w-auto space-y-1 border rounded-lg p-1 custom-scrollbar ${
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                      style={{
                        maxHeight: '150px',
                        overflowY: 'auto',
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
          </div>
        </div>
      </div>

      {/* Body: Fare and Passenger Details */}
      <div className="p-4">
        {/* Fare Details */}
        <div className="space-y-1">
          <p className="text-sm">
            <strong>Base Fare:</strong> ₹{selectedSeat?.fare_details?.['Base Fare'] || 0}
          </p>
          <p className="text-sm">
            <strong>GST:</strong> ₹{selectedSeat?.fare_details?.GST || 0}
          </p>
          <p className="text-sm">
            <strong>Discount:</strong> ₹{selectedSeat?.fare_details?.Discount || 0}
          </p>
          <p className="text-sm font-semibold">
            <strong>Total Fare:</strong> ₹
            {(selectedSeat?.fare_details?.['Base Fare'] || 0) +
              (selectedSeat?.fare_details?.GST || 0) +
              (selectedSeat?.fare_details?.Discount || 0)}
          </p>
        </div>

{/* Passenger Details */}
<div className="space-y-2 mt-4">
  {/* Name and Age in One Line */}
  <div className="flex space-x-2">
    <input
      type="text"
      placeholder="Enter your name"
      value={userName}
      onChange={(e) => setUserName(e.target.value)}
      className={`w-1/2 p-1 border rounded text-sm placeholder-gray-400 ${
        theme === 'dark' ? 'bg-gray-600 text-gray-300' :'bg-gray-200 text-gray-700'
      }`}
    />
    <input
      type="number"
      placeholder="Enter your age"
      value={passengerAge || ''}
      onChange={(e) => setPassengerAge(Number(e.target.value))}
      className={`w-1/2 p-1 border rounded text-sm placeholder-gray-400 ${
        theme === 'dark' ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700'
      }`}
    />
  </div>

  {/* Mobile Number in Next Line */}
  <input
    type="tel"
    placeholder="Enter your phone number"
    value={userPhone}
    onChange={(e) => setUserPhone(e.target.value)}
    className={`w-full p-1 border rounded text-sm placeholder-gray-400 ${
      theme === 'dark' ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700'
    }`}
  />

  {/* Gender Selection */}
  <div className="flex items-center space-x-4 mt-2">
    <label className="flex items-center space-x-1">
      <input
        type="radio"
        name="gender"
        value="Male"
        className="form-radio"
      />
      <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Male</span>
    </label>
    <label className="flex items-center space-x-1">
      <input
        type="radio"
        name="gender"
        value="Female"
        checked={gender === 'Female'}
        onChange={(e) => setGender(e.target.value)}
        className="form-radio"
      />
      <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Female</span>
    </label>
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
            className={`py-1 px-4 rounded-lg font-medium text-sm transition-colors ${
              isProcessing
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