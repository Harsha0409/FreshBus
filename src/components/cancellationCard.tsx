"use client"

import { useState, useMemo, useEffect } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { useTheme } from "../context/ThemeContext"
import { UpcomingTravelsResponse, UpcomingTravel} from "../types/cancellation"
import toast from 'react-hot-toast'
import { addAIMessageToChat } from '../utils/chatHelpers';
import { authService } from '../services/api';
import ReactDOM from 'react-dom';

interface CancellationCardProps {
  data: UpcomingTravelsResponse;
  selectedChatId?: string;
  setChats?: React.Dispatch<React.SetStateAction<any[]>>;
}

export default function CancellationCard({ data, selectedChatId, setChats }: CancellationCardProps) {
  const { theme } = useTheme()
  const [selectedTravel, setSelectedTravel] = useState<UpcomingTravel | null>(null)
  const [showPolicyModal, setShowPolicyModal] = useState(false)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [isModalClosing, setIsModalClosing] = useState(false)
  const [showRefundPolicies, setShowRefundPolicies] = useState(false)
  const [selectedSeatsForCancellation, setSelectedSeatsForCancellation] = useState<Set<string>>(new Set())
  const [selectedRefundMethod, setSelectedRefundMethod] = useState<'cash' | 'coins'>('coins')
  const [isProcessing, setIsProcessing] = useState(false)

  // Animation effect for modal
  useEffect(() => {
    if (showPolicyModal) {
      // Trigger animation after modal opens
      const timer = setTimeout(() => setIsModalVisible(true), 10)
      return () => clearTimeout(timer)
    }
  }, [showPolicyModal])

  // Handle modal close with animation
  const handleModalClose = () => {
    if (isModalClosing) return // Prevent multiple close calls
    setIsModalClosing(true)
    setIsModalVisible(false)
    // Wait for animation to complete before closing modal
    setTimeout(() => {
      setShowPolicyModal(false)
      setIsModalVisible(false)
      setIsModalClosing(false)
    }, 300)
  }

  const handleTravelSelect = (travel: UpcomingTravel) => {
    setSelectedTravel(travel)
    setShowPolicyModal(true)
    setShowRefundPolicies(false)
    setSelectedRefundMethod('coins')
    
    // If single ticket, select all seats by default, otherwise start with none
    if (travel.policy.cancelSeatResponseDto.length === 1) {
      setSelectedSeatsForCancellation(new Set(travel.policy.cancelSeatResponseDto.map(seat => seat.seatNumber)))
    } else {
      setSelectedSeatsForCancellation(new Set())
    }
  }

  const toggleSeatSelection = (seatNumber: string) => {
    const newSelected = new Set(selectedSeatsForCancellation)
    if (newSelected.has(seatNumber)) {
      newSelected.delete(seatNumber)
    } else {
      newSelected.add(seatNumber)
    }
    setSelectedSeatsForCancellation(newSelected)
  }

  // Calculate dynamic refund based on selected seats
  const dynamicRefundCalculation = useMemo(() => {
    if (!selectedTravel) return null

    const selectedCount = selectedSeatsForCancellation.size

    if (selectedCount === 0) {
      // Show zero refund when no seats selected
      return {
        cashRefund: { amount: 0, percentage: 0 },
        coinsRefund: { coins: 0, percentage: 0 }
      }
    }

    // Calculate proportional refund based on selected seats
    const selectedSeats = selectedTravel.policy.cancelSeatResponseDto.filter(
      seat => selectedSeatsForCancellation.has(seat.seatNumber)
    )

    let totalCashRefund = 0
    let totalCoinsRefund = 0

    selectedSeats.forEach(seat => {
      const cashPolicy = seat.seatPolicies.find(p => !p.isCoinsPolicy)
      const coinsPolicy = seat.seatPolicies.find(p => p.isCoinsPolicy)
      
      if (cashPolicy) {
        totalCashRefund += cashPolicy.amount || 0
      }
      if (coinsPolicy) {
        totalCoinsRefund += coinsPolicy.coins || 0
      }
    })

    return {
      cashRefund: { 
        amount: totalCashRefund, 
        percentage: selectedSeats.length > 0 ? selectedSeats[0].seatPolicies.find(p => !p.isCoinsPolicy)?.percentage || 0 : 0 
      },
      coinsRefund: { 
        coins: totalCoinsRefund, 
        percentage: selectedSeats.length > 0 ? selectedSeats[0].seatPolicies.find(p => p.isCoinsPolicy)?.percentage || 0 : 0 
      }
    }
  }, [selectedTravel, selectedSeatsForCancellation])

  // Calculate contextual refund amounts for each policy's time windows
  const getContextualRefundValue = (policy: any, refundItem: any) => {
    const selectedCount = selectedSeatsForCancellation.size
    
    if (selectedCount === 0) {
      return policy.isCoinsPolicy ? "0 coins (0%)" : "₹0.00 (0%)"
    }

    // Extract the base amount and percentage from the original value
    const valueMatch = refundItem.value.match(/(\d+(?:\.\d+)?)/);
    const baseAmount = valueMatch ? parseFloat(valueMatch[1]) : 0;
    const percentageMatch = refundItem.value.match(/\((\d+)%\)/)
    const percentage = percentageMatch ? percentageMatch[1] : "0"
    
    // Calculate proportional amount based on selected seats
    const selectedSeats = selectedTravel?.policy.cancelSeatResponseDto.filter(
      seat => selectedSeatsForCancellation.has(seat.seatNumber)
    ) || []
    
    if (selectedSeats.length === 0) {
      return policy.isCoinsPolicy ? "0 coins (0%)" : "₹0.00 (0%)"
    }

    // Get total seats count for proportional calculation
    const totalSeats = selectedTravel?.policy.cancelSeatResponseDto.length || 1
    const proportionalMultiplier = selectedSeats.length / totalSeats

    // The baseAmount from refundItem.value is already the calculated amount (e.g., ₹1277.77 for 85%)
    // We just need to calculate proportionally based on selected seats
    const proportionalAmount = baseAmount * proportionalMultiplier
    
    if (policy.isCoinsPolicy) {
      return `${Math.round(proportionalAmount)} coins (${percentage}%)`
    } else {
      return `₹${proportionalAmount.toFixed(2)} (${percentage}%)`
    }
  }

  const formatTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString)
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const calculateDuration = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const diff = endDate.getTime() - startDate.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  // Get the selected refund amount based on method choice
  const getSelectedRefundAmount = () => {
    if (!dynamicRefundCalculation) return "₹0.00"
    
    if (selectedRefundMethod === 'cash') {
      return `₹${dynamicRefundCalculation.cashRefund.amount.toFixed(2)}`
    } else {
      return `${dynamicRefundCalculation.coinsRefund.coins} Coins`
    }
  }

  const handleConfirmPayment = async () => {
    if (selectedSeatsForCancellation.size === 0) {
      setShowPolicyModal(false);
      setTimeout(() => {
        toast.error('Please select at least one seat to cancel.');
      }, 100);
      return;
    }

    if (!selectedRefundMethod) {
      setShowPolicyModal(false);
      setTimeout(() => {
        toast.error('Please select a refund method.');
      }, 100);
      return;
    }

    if (!selectedTravel) {
      setShowPolicyModal(false);
      setTimeout(() => {
        toast.error('No travel selected.');
      }, 100);
      return;
    }

    try {
      setIsProcessing(true);

      const seats = Array.from(selectedSeatsForCancellation);
      const policyId = selectedRefundMethod === 'cash' ? 1 : 2; // 1 for base policy, 2 for green coin policy

      const payload = {
          seats: seats,
          policyId: policyId
      };

      const sessionId = localStorage.getItem('sessionId');
      const userStr = localStorage.getItem('user');
      let user: { id?: string; name?: string; mobile?: string } = {};
      try {
        user = userStr && userStr !== "undefined" ? JSON.parse(userStr) : {};
      } catch {
        user = {};
      }

      // Use authService.fetchWithRefresh for cookie-based authentication with automatic token refresh
      const response = await authService.fetchWithRefresh(`/api/tickets/${selectedTravel.travel_details.id}/cancel`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'X-User-ID': user.id?.toString() || '',
              'X-Session-ID': sessionId || ''
          },
          body: JSON.stringify(payload)
      });

      const responseData = await response.json();

      if (!response.ok) {
        setShowPolicyModal(false);
        setTimeout(() => {
          const errorMessage = responseData.message?.toLowerCase() || '';
          if (errorMessage.includes('already cancelled') || 
              errorMessage.includes('mockresponse') || 
              (responseData.statusCode === 400 && errorMessage.includes('selected seat has already been cancelled'))) {
            toast.error('Your ticket has already been cancelled.');
          } else if (errorMessage.includes('session expired')) {
            toast.error('Your session has expired. Please login again.');
            window.dispatchEvent(new CustomEvent('login:required'));
          } else if (errorMessage.includes('invalid ticket')) {
            toast.error('Invalid ticket. Please try again.');
          } else {
            toast.error('Unable to cancel ticket. Please try again later.');
          }
        }, 100);
        return;
      }

      // Display success message
      setShowPolicyModal(false);
      setTimeout(() => {
        toast.success('Ticket cancelled successfully');
      }, 100);
      
      // Get the refund amount from popup calculation instead of backend for green coins
      let refundAmountText = '';
      if (selectedRefundMethod === 'coins') {
        const coinsAmount = dynamicRefundCalculation?.coinsRefund.coins || 0;
        refundAmountText = `${coinsAmount} Green Coins`;
      } else {
        // For cash refund, use backend response or popup calculation as fallback
        const cashAmount = responseData.refund_amount || dynamicRefundCalculation?.cashRefund.amount || 0;
        refundAmountText = `₹${cashAmount.toFixed(2)}`;
      }
      
      // Display AI message with a more customer-friendly format
      const refundMethodText = selectedRefundMethod === 'coins' ? 'Green Coin Wallet' : 'original payment source';
      const cancelledSeats = Array.from(selectedSeatsForCancellation).join(', ');
      const aiMessage = `Dear customer,

Your ticket has been successfully cancelled. Refund has been initiated as per our policy.

Cancelled seat(s): ${cancelledSeats}
Amount credited: ${refundAmountText}
Refund method: ${refundMethodText}

${selectedRefundMethod === 'coins' ? 'Your Green Coins have been instantly credited to your wallet.' : 'The refund will be processed to your original payment method within 3-5 business days.'}

Thank you for using our service.`;
      
      // Add AI message to chat if we have the required props
      if (selectedChatId && setChats) {
        addAIMessageToChat(aiMessage, selectedChatId, setChats);
      } else {
        console.log("AI message created but not added to chat due to missing props:", aiMessage);
      }

    } catch (error) {
      console.error('Error cancelling ticket:', error);
      setShowPolicyModal(false);
      setTimeout(() => {
        toast.error((error as Error).message || 'An error occurred while cancelling the ticket');
      }, 100);
    } finally {
      setIsProcessing(false);
    }
  };

  // We're now using the imported addAIMessageToChat function from '../utils/chatHelpers'
  
  // No longer sending duplicate AI message for empty upcoming travels
  // The UI already displays a message in this case

  return (
    <div className={`w-full max-w-7xl mx-auto  ${theme === 'dark' ? 'dark' : ''}`}>
      {data.data.upcoming_travels.length === 0 ? (
        <>
          <div className="p-4 border border-yellow-300 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700/50">
            <p className="text-center text-yellow-800 dark:text-yellow-200">
              No upcoming travels found to cancel. Please check back later or book a new ticket.
            </p>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {data.data.upcoming_travels.map((travel) => {
          const departureTime = formatTime(travel.travel_details.source.time)
          const arrivalTime = formatTime(travel.travel_details.destination.time)
          const duration = calculateDuration(
            travel.travel_details.source.time,
            travel.travel_details.destination.time
          )

          return (
            <div
              key={travel.travel_details.id}
              className="rounded-lg border p-2 text-white cursor-pointer hover:shadow-lg transition-shadow duration-200 shadow-sm"
              style={{ background: 'linear-gradient(to bottom right, #0078d4, #005a9e)' }}
              onClick={() => handleTravelSelect(travel)}
            >
              <div className="flex justify-between items-stretch w-full mt-2 gap-4">
                <div className="w-1/3 flex flex-col items-start justify-start">
                  <div className="text-left mb-2 w-full">
                    <p className="text-sm font-bold">{departureTime}</p>
                    <p className="text-sm font-bold truncate">{travel.travel_details.source.name}</p>
                    <p className="text-sm font-bold truncate">{travel.travel_details.source.point}</p>
                  </div>
                  <div className="text-xs w-full">
                    <div className="font-bold">Seats:</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {travel.policy.cancelSeatResponseDto.map((seat) => {
                        // Check if the seat is active
                        if (!seat.active) {
                          return null; // Do not render inactive seats
                        }

                        return (
                          <span
                            key={seat.seatNumber}
                            className="rounded-md text-sm font-bold bg-yellow-300 text-black px-2 py-1 inline-flex items-center"
                          >
                            <span>{seat.seatNumber}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="w-1/3 flex flex-col items-center justify-center">
                  <div className="flex flex-col items-center mb-2 w-full">
                    <div className="flex items-center w-full">
                      <div className="flex-1 h-[1.5px] bg-[#fbe822]" />
                      <span className="mx-2 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-5 sm:w-5 text-[#fbe822]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                          <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l2 2" />
                        </svg>
                      </span>
                      <div className="flex-1 h-[1.5px] bg-[#fbe822]" />
                    </div>
                    <div className="flex justify-center mt-1">
                      <p className="text-base sm:text-sm font-semibold text-[#fbe822]">{duration}</p>
                    </div>
                  </div>
                </div>
                <div className="w-1/3 flex flex-col">
                  <div className="text-right mb-2 w-full">
                    <p className="text-sm font-bold">{arrivalTime}</p>
                    <p className="text-sm font-bold truncate">{travel.travel_details.destination.name}</p>
                    <p className="text-sm font-bold truncate">{travel.travel_details.destination.point}</p>
                  </div>
                  <div className="text-sm text-right w-full">
                    <div className="font-bold">Total Fare:</div>
                    <div>
                      <span className="font-bold">₹{travel.policy.billDetails.find(b => b.label === "Total")?.value.replace('₹', '') || '0.00'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })
        }
      </div>
      )}

      {/* Modal */}
      {showPolicyModal && ReactDOM.createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-90 backdrop-blur-sm" 
          style={{ 
            margin: 0, 
            padding: 0,
            opacity: isModalVisible ? 1 : 0,
            transition: "opacity 0.3s ease-in-out"
          }}
          onClick={handleModalClose}
        >
          {/* Modal Content */}
          <div 
            className={`relative rounded-lg shadow-lg border w-[800px] max-w-[90vw] max-h-[90vh] flex flex-col ${
              theme === 'dark' 
                ? 'bg-gray-900 text-white border-gray-700' 
                : 'bg-white text-gray-900 border-gray-200'
            }`}
            style={{
              transform: isModalVisible ? "scale(1) translateY(0)" : "scale(0.95) translateY(20px)",
              opacity: isModalVisible ? 1 : 0,
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {selectedTravel && (
              <>
                {/* Fixed Header */}
                <div 
                  className={`flex-shrink-0 px-2 py-2 border-b ${
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  }`}
                  style={{
                    opacity: isModalVisible ? 1 : 0,
                    transform: isModalVisible ? "translateY(0)" : "translateY(-10px)",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0.05s"
                  }}
                >
                  <h3 className={`text-lg font-bold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-800'
                  }`}>
                    Cancellation Details
                  </h3>
                </div>

                {/* Content - Always scrollable with fixed height */}
                <div 
                  className="flex-1 overflow-y-auto custom-scrollbar px-2 py-2 space-y-3 min-h-0"
                  style={{
                    opacity: isModalVisible ? 1 : 0,
                    transform: isModalVisible ? "translateY(0)" : "translateY(10px)",
                    transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1) 0.1s"
                  }}
                >
                  <h4 className={`text-base font-bold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-800'
                  }`}>
                    Select Seats for Cancellation
                  </h4>
                  
                  <div className={`rounded-lg border shadow-sm ${
                    theme === 'dark' 
                      ? 'bg-gray-800 border-gray-700' 
                      : 'bg-white border-blue-200'
                  }`}>
                    <div className="flex flex-wrap p-2 gap-2">
                      {selectedTravel.policy.cancelSeatResponseDto.map((seat) => {
                        // Check if the seat is active
                        if (!seat.active) {
                          return null; // Do not render inactive seats
                        }

                        return (
                          <div
                            key={seat.seatNumber}
                            onClick={() => toggleSeatSelection(seat.seatNumber)}
                            className={`p-2 rounded-lg cursor-pointer transition-colors flex items-center gap-2 w-fit ${
                              selectedSeatsForCancellation.has(seat.seatNumber)
                                ? "bg-red-500 text-white"
                                : theme === 'dark'
                                  ? "bg-gray-700 hover:bg-gray-600 text-gray-200"
                                  : "bg-gray-100 hover:bg-gray-200 text-gray-800"
                            }`}
                          >
                            <div className="font-bold text-sm">{seat.seatNumber}</div>
                            <div className="text-xs truncate">{seat.name}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Refund Policies - Show when expanded */}
                  <div className={`rounded-lg border shadow-sm overflow-hidden mt-4 ${
                    theme === 'dark' 
                      ? 'bg-gray-800 border-gray-700' 
                      : 'bg-white border-gray-200'
                  }`}>
                    <div 
                      className={`flex items-center justify-between cursor-pointer p-3 transition-colors ${
                        theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                      }`} 
                      onClick={() => setShowRefundPolicies(!showRefundPolicies)}
                    >
                      <h4 className={`text-base font-bold ${
                        theme === 'dark' ? 'text-white' : 'text-gray-800'
                      }`}>
                        View Refund Policies
                      </h4>
                      {showRefundPolicies ? 
                        <ChevronUp className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`} /> : 
                        <ChevronDown className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`} />
                      }
                    </div>
                    
                    {showRefundPolicies && (
                      <div className={`border-t px-3 pb-3 pt-2 space-y-4 ${
                        theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
                      }`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {selectedTravel.policy.mobilePolicy.map((policy) => {
                            const dynamicRefund = dynamicRefundCalculation
                            
                            // Get current refund amount based on dynamic calculation
                            const currentRefundAmount = policy.isCoinsPolicy 
                              ? `${dynamicRefund?.coinsRefund.coins || 0} coins (${dynamicRefund?.coinsRefund.percentage || 0}%)`
                              : `₹${(dynamicRefund?.cashRefund.amount || 0).toFixed(2)} (${dynamicRefund?.cashRefund.percentage || 0}%)`

                            return (
                              <div key={policy.id} className={`rounded-lg border shadow-sm overflow-hidden ${
                                theme === 'dark' 
                                  ? 'bg-gray-700 border-gray-600' 
                                  : 'bg-gray-50 border-gray-200'
                              }`}>
                                <div className="p-3">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                                      <div className="min-w-0 flex-1">
                                        <h5 className={`font-semibold text-sm truncate ${
                                          theme === 'dark' ? 'text-gray-100' : 'text-gray-800'
                                        }`}>
                                          {policy.label}
                                        </h5>
                                        <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${policy.isCoinsPolicy ? 
                                          `${theme === 'dark' ? 'bg-yellow-900 text-yellow-200 border border-yellow-700' : 'bg-yellow-100 text-yellow-800 border border-yellow-300'}` : 
                                          `${theme === 'dark' ? 'bg-blue-900 text-blue-200 border border-blue-700' : 'bg-blue-100 text-blue-800 border border-blue-300'}`
                                        }`}>
                                          {policy.isCoinsPolicy ? "Coins Policy" : "Cash Policy"}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-right ml-2">
                                      <div className={`text-xs ${
                                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                      }`}>
                                        Current Refund
                                      </div>
                                      <div className={`font-bold text-sm ${
                                        selectedSeatsForCancellation.size > 0 ? 'text-green-500' : 
                                        theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                                      }`}>
                                        {currentRefundAmount}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    {policy.refund.map((r, idx) => (
                                      <div key={idx} className={`rounded-lg p-2 border-l-4 ${
                                        r.isCurrentSlab 
                                          ? theme === 'dark'
                                            ? "bg-green-900/30 border-green-500" 
                                            : "bg-green-50 border-green-400"
                                          : theme === 'dark'
                                            ? "bg-gray-600/50 border-gray-500"
                                            : "bg-white border-gray-300"
                                      }`}>
                                        <div className="flex flex-col">
                                          <div className="flex justify-between items-center">
                                            <p className={`text-sm ${
                                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                            }`}>
                                              {r.window && typeof r.window === 'string' ? r.window.trim() || 'N/A' : 'N/A'}
                                            </p>
                                            <div className={`text-right font-semibold text-sm ${
                                              theme === 'dark' ? 'text-gray-200' : 'text-gray-900'
                                            }`}>
                                              {getContextualRefundValue(policy, r)}
                                            </div>
                                          </div>
                                          {r.isCurrentSlab && (
                                            <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 mt-1 self-start ${
                                              theme === 'dark' 
                                                ? 'bg-green-900 text-green-200 border border-green-700' 
                                                : 'bg-green-100 text-green-800 border border-green-300'
                                            }`}>
                                              Current Refund Policy
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Method of Refund Section */}
                  <div className={`rounded-lg border shadow-sm overflow-hidden ${
                    theme === 'dark' 
                      ? 'bg-gray-800 border-gray-700' 
                      : 'bg-white border-gray-200'
                  }`}>
                    <div className="p-4">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className={`text-base font-bold ${
                          theme === 'dark' ? 'text-white' : 'text-gray-800'
                        }`}>
                          Method of Refund
                        </h4>
                        <div className={`text-lg font-bold ${
                          selectedSeatsForCancellation.size > 0
                            ? theme === 'dark' ? 'text-green-400' : 'text-green-600'
                            : theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                        }`}>
                          You Get: {getSelectedRefundAmount()}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Original Payment Source */}
                        <div 
                          className={`rounded-lg border-2 p-4 cursor-pointer transition-all ${
                            selectedRefundMethod === 'cash'
                              ? theme === 'dark'
                                ? 'border-blue-500 bg-blue-900/20'
                                : 'border-blue-500 bg-blue-50'
                              : theme === 'dark'
                                ? 'border-gray-600 bg-gray-700'
                                : 'border-gray-300 bg-gray-50'
                          }`}
                          onClick={() => setSelectedRefundMethod('cash')}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 mt-1">
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                selectedRefundMethod === 'cash'
                                  ? 'border-blue-500 bg-blue-500'
                                  : theme === 'dark'
                                    ? 'border-gray-500'
                                    : 'border-gray-300'
                              }`}>
                                {selectedRefundMethod === 'cash' && (
                                  <div className="w-2 h-2 rounded-full bg-white" />
                                )}
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                  theme === 'dark' ? 'bg-gray-600' : 'bg-gray-200'
                                }`}>
                                  🏛️
                                </div>
                                <h5 className={`font-semibold text-sm ${
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                }`}>
                                  Original Payment Source
                                </h5>
                              </div>
                              <p className={`text-sm ${
                                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                              }`}>
                                The refund will be credited to your source account
                              </p>
                              <div className={`text-sm font-bold mt-2 ${
                                selectedSeatsForCancellation.size > 0 ? 'text-green-500' : 
                                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                              }`}>
                                ₹{(dynamicRefundCalculation?.cashRefund.amount || 0).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Green Coins */}
                        <div 
                          className={`rounded-lg border-2 p-4 cursor-pointer transition-all relative ${
                            selectedRefundMethod === 'coins'
                              ? theme === 'dark'
                                ? 'border-blue-500 bg-blue-900/20'
                                : 'border-blue-500 bg-blue-50'
                              : theme === 'dark'
                                ? 'border-gray-600 bg-gray-700'
                                : 'border-gray-300 bg-gray-50'
                          }`}
                          onClick={() => setSelectedRefundMethod('coins')}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 mt-1">
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                selectedRefundMethod === 'coins'
                                  ? 'border-blue-500 bg-blue-500'
                                  : theme === 'dark'
                                    ? 'border-gray-500'
                                    : 'border-gray-300'
                              }`}>
                                {selectedRefundMethod === 'coins' && (
                                  <div className="w-2 h-2 rounded-full bg-white" />
                                )}
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
                                  💰
                                </div>
                                <h5 className={`font-semibold text-sm ${
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                }`}>
                                  Green Coins
                                </h5>
                                <div className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                                  Instant
                                </div>
                              </div>
                              <p className={`text-sm ${
                                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                              }`}>
                                The refund will be credited to your Green Coin Wallet
                              </p>
                              <div className={`text-sm font-bold mt-2 ${
                                selectedSeatsForCancellation.size > 0 ? 'text-green-500' : 
                                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                              }`}>
                                {dynamicRefundCalculation?.coinsRefund.coins || 0} Coins
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Fixed Footer */}
                <div 
                  className={`flex-shrink-0 flex justify-end gap-2 border-t p-2 ${
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  }`}
                  style={{
                    opacity: isModalVisible ? 1 : 0,
                    transform: isModalVisible ? "translateY(0)" : "translateY(10px)",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0.15s"
                  }}
                >
                  <button 
                    onClick={handleModalClose}
                    className={`inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 text-sm ${theme === 'dark' 
                      ? 'border border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white' 
                      : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Cancel
                  </button>
                  <button 
                    className={`inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 text-sm ${
                      selectedSeatsForCancellation.size > 0
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-gray-400 cursor-not-allowed text-gray-600'
                    }`}
                    disabled={selectedSeatsForCancellation.size === 0 || isProcessing}
                    onClick={handleConfirmPayment}
                  >
                    {isProcessing ? 'Processing...' : 'Proceed with Cancellation'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}